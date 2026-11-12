-- Первый администратор.
-- 1) В Supabase: Authentication → Users → Add user → Create new user.
--    Email: admin@luma-crm.app, пароль — свой (не короче 8 символов), галочка «Auto Confirm User».
-- 2) Задайте секрет сервера (один раз, в терминале):
--      supabase secrets set PASSWORD_PEPPER=<длинная случайная строка>
-- 3) Впишите ниже тот же пароль и ту же строку PASSWORD_PEPPER и выполните скрипт.
--    После этого администратор входит в CRM по этому паролю.
--    Не оставляйте пароль и секрет в файле после запуска.

with admin_user as (
  select id from auth.users where email = 'admin@luma-crm.app'
), created as (
  insert into public.profiles (id, login, name, role, active)
  select id, 'admin', 'Администратор', 'admin', true from admin_user
  on conflict (id) do update set role = 'admin', active = true
  returning id
)
insert into public.profile_secrets (id, pass_hash)
select id, encode(
  extensions.hmac(
    convert_to('ПАРОЛЬ_АДМИНИСТРАТОРА', 'utf8'),
    convert_to('ТОТ_ЖЕ_PASSWORD_PEPPER', 'utf8'),
    'sha256'
  ), 'hex')
from created
on conflict (id) do update set pass_hash = excluded.pass_hash;
