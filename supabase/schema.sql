-- Luma Catering CRM — схема базы Supabase.
-- Выполните целиком в SQL Editor нового проекта. Скрипт можно запускать повторно.

-- ───────────── Профили сотрудников ─────────────
-- Пароли хранит Supabase Auth, здесь — только роль и имя.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  login text not null unique check (login ~ '^[a-z0-9._-]{3,32}$'),
  name text not null,
  role text not null check (role in ('admin', 'director', 'manager')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Хеши паролей для входа «только по паролю». Клиенты их не видят: у таблицы включён RLS
-- и нет ни одной политики, читает и пишет её только серверная функция (service role).
create table if not exists public.profile_secrets (
  id uuid primary key references public.profiles (id) on delete cascade,
  pass_hash text not null unique
);
alter table public.profile_secrets enable row level security;

-- Неудачные попытки входа — для ограничения перебора пароля.
create table if not exists public.login_attempts (
  id bigserial primary key,
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists login_attempts_ip_at on public.login_attempts (ip, at);
alter table public.login_attempts enable row level security;

-- Роль текущего пользователя; для отключённых — null, и политики ниже ничего не разрешают.
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_privileged()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.app_role() in ('admin', 'director'), false)
$$;

-- ───────────── Данные ─────────────
-- Каждая запись — документ jsonb: формат совпадает с типами приложения.
do $$
declare t text;
begin
  foreach t in array array['catalog', 'kits', 'clients', 'events', 'orders'] loop
    execute format(
      'create table if not exists public.%I (
         id text primary key,
         data jsonb not null,
         created_by uuid default auth.uid() references auth.users (id) on delete set null,
         updated_at timestamptz not null default now()
       )', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['catalog', 'kits', 'clients', 'events', 'orders'] loop
    execute format('drop trigger if exists touch on public.%I', t);
    execute format(
      'create trigger touch before update on public.%I
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ───────────── Права доступа (RLS) ─────────────
alter table public.profiles enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated using (public.app_role() is not null or id = auth.uid());
-- Менять профили можно только через функцию администратора (service role), поэтому политик на запись нет.

-- Каталог и комплекты: смотрят все, меняют директор и администратор.
drop policy if exists catalog_read on public.catalog;
create policy catalog_read on public.catalog for select to authenticated using (public.app_role() is not null);
drop policy if exists catalog_write on public.catalog;
create policy catalog_write on public.catalog for all to authenticated
  using (public.is_privileged()) with check (public.is_privileged());

drop policy if exists kits_read on public.kits;
create policy kits_read on public.kits for select to authenticated using (public.app_role() is not null);
drop policy if exists kits_write on public.kits;
create policy kits_write on public.kits for all to authenticated
  using (public.is_privileged()) with check (public.is_privileged());

-- Клиенты: смотрят все, добавляют все, меняют и удаляют директор и администратор.
drop policy if exists clients_read on public.clients;
create policy clients_read on public.clients for select to authenticated using (public.app_role() is not null);
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert to authenticated with check (public.app_role() is not null);
drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated
  using (public.is_privileged()) with check (public.is_privileged());
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete to authenticated using (public.is_privileged());

-- Заявки: видят и ведут все сотрудники.
drop policy if exists orders_all on public.orders;
create policy orders_all on public.orders for all to authenticated
  using (public.app_role() is not null) with check (public.app_role() is not null);

-- Мероприятия: менеджер видит и меняет только созданные им; директор и администратор — все.
drop policy if exists events_read on public.events;
create policy events_read on public.events for select to authenticated
  using (public.is_privileged() or (public.app_role() = 'manager' and created_by = auth.uid()));
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated
  with check (public.app_role() is not null and created_by = auth.uid());
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated
  using (public.is_privileged() or (public.app_role() = 'manager' and created_by = auth.uid()))
  with check (public.is_privileged() or (public.app_role() = 'manager' and created_by = auth.uid()));
drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete to authenticated
  using (public.is_privileged() or (public.app_role() = 'manager' and created_by = auth.uid()));

-- ───────────── Функции для склада ─────────────

-- Занятость склада всеми подтверждёнными мероприятиями. Менеджеру нужна полная картина,
-- чтобы не продать мебель, занятую чужим мероприятием, но самих чужих мероприятий он не видит:
-- функция отдаёт только позицию, количество и даты.
create or replace function public.get_reservations()
returns table (event_id text, item_id text, qty integer, date text, end_date text)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    l->>'itemId',
    (l->>'qty')::integer,
    e.data->>'date',
    coalesce(nullif(e.data->>'endDate', ''), e.data->>'date')
  from public.events e
  cross join lateral jsonb_array_elements(e.data->'lines') l
  where public.app_role() is not null
    and e.data->>'status' in ('confirmed', 'in_progress')
$$;

-- Списание по акту возврата. Менеджер не может менять каталог напрямую,
-- поэтому остаток правит эта функция — и только для его собственного мероприятия.
create or replace function public.apply_return_act(p_event_id text, p_losses jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.events;
  loss record;
begin
  select * into ev from public.events where id = p_event_id;
  if ev.id is null then
    raise exception 'Мероприятие не найдено';
  end if;
  if not (public.is_privileged() or (public.app_role() = 'manager' and ev.created_by = auth.uid())) then
    raise exception 'Нет доступа к этому мероприятию';
  end if;

  for loss in select key as item_id, value::integer as qty from jsonb_each_text(p_losses) loop
    if loss.qty > 0 then
      update public.catalog
      set data = jsonb_set(
        data, '{stock}',
        to_jsonb(greatest((data->>'stock')::integer - loss.qty, 0))
      )
      where id = loss.item_id and data->>'stock' is not null;
    end if;
  end loop;
end $$;

revoke all on function public.get_reservations() from public, anon;
revoke all on function public.apply_return_act(text, jsonb) from public, anon;
grant execute on function public.get_reservations() to authenticated;
grant execute on function public.apply_return_act(text, jsonb) to authenticated;
