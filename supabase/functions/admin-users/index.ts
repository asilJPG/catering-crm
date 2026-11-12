// Edge Function «admin-users»: создание, изменение и удаление сотрудников.
// Работает только для администратора. Ключ service role доступен функции автоматически
// и никогда не попадает в браузер.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {EMAIL_DOMAIN, cors, hashPassword, reply} from '../_shared/password.ts';

const ROLES = ['manager', 'director'];
const MIN_PASSWORD = 8;
const PASSWORD_TAKEN = 'Такой пароль уже используется. Придумайте другой.';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: cors});

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Кто вызывает: проверяем токен и роль в профиле.
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const {data: caller} = await admin.auth.getUser(token);
  if (!caller.user) return reply({error: 'Требуется вход'}, 401);
  const {data: me} = await admin
    .from('profiles')
    .select('role, active')
    .eq('id', caller.user.id)
    .maybeSingle();
  if (!me || !me.active || me.role !== 'admin') {
    return reply({error: 'Только администратор может управлять сотрудниками'}, 403);
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return reply({error: 'Некорректный запрос'}, 400);
  }

  /** Владелец пароля, если он уже занят кем-то другим. */
  const ownerOf = async (password: string) => {
    const {data} = await admin
      .from('profile_secrets')
      .select('id')
      .eq('pass_hash', await hashPassword(password))
      .maybeSingle();
    return data?.id as string | undefined;
  };

  if (body.action === 'create') {
    const name = String(body.name ?? '').trim();
    const password = String(body.password ?? '');
    if (!name) return reply({error: 'Укажите имя'}, 400);
    if (password.length < MIN_PASSWORD) {
      return reply({error: `Пароль не короче ${MIN_PASSWORD} символов`}, 400);
    }
    if (!ROLES.includes(body.role)) return reply({error: 'Недопустимая роль'}, 400);
    if (await ownerOf(password)) return reply({error: PASSWORD_TAKEN}, 409);

    // Логин внутренний: сотрудники входят по паролю, но Supabase Auth требует email.
    const login = `u${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const created = await admin.auth.admin.createUser({
      email: `${login}@${EMAIL_DOMAIN}`,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      return reply({error: created.error?.message ?? 'Не удалось создать пользователя'}, 400);
    }
    const id = created.data.user.id;
    const profile = await admin.from('profiles').insert({id, login, name, role: body.role, active: true});
    const secret = profile.error
      ? profile
      : await admin.from('profile_secrets').insert({id, pass_hash: await hashPassword(password)});
    if (secret.error) {
      await admin.auth.admin.deleteUser(id); // профиль и секрет удаляются каскадом
      return reply({error: secret.error.message}, 400);
    }
    return reply({ok: true});
  }

  const id = String(body.id ?? '');
  if (!id) return reply({error: 'Не указан сотрудник'}, 400);
  if (id === caller.user.id) return reply({error: 'Свою учётную запись менять здесь нельзя'}, 400);

  const {data: target} = await admin.from('profiles').select('role').eq('id', id).maybeSingle();
  if (!target) return reply({error: 'Сотрудник не найден'}, 404);
  if (target.role === 'admin') return reply({error: 'Администраторов здесь менять нельзя'}, 403);

  if (body.action === 'update') {
    const patch: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
    if (body.role !== undefined) {
      if (!ROLES.includes(body.role)) return reply({error: 'Недопустимая роль'}, 400);
      patch.role = body.role;
    }
    if (typeof body.active === 'boolean') patch.active = body.active;

    if (body.password) {
      const password = String(body.password);
      if (password.length < MIN_PASSWORD) {
        return reply({error: `Пароль не короче ${MIN_PASSWORD} символов`}, 400);
      }
      const owner = await ownerOf(password);
      if (owner && owner !== id) return reply({error: PASSWORD_TAKEN}, 409);
      const changed = await admin.auth.admin.updateUserById(id, {password});
      if (changed.error) return reply({error: changed.error.message}, 400);
      const saved = await admin
        .from('profile_secrets')
        .upsert({id, pass_hash: await hashPassword(password)});
      if (saved.error) return reply({error: saved.error.message}, 400);
    }
    if (Object.keys(patch).length > 0) {
      const updated = await admin.from('profiles').update(patch).eq('id', id);
      if (updated.error) return reply({error: updated.error.message}, 400);
    }
    // Отключённого выбрасываем из всех открытых сессий.
    if (body.active === false) await admin.auth.admin.signOut(id).catch(() => {});
    return reply({ok: true});
  }

  if (body.action === 'delete') {
    const removed = await admin.auth.admin.deleteUser(id);
    if (removed.error) return reply({error: removed.error.message}, 400);
    return reply({ok: true});
  }

  return reply({error: 'Неизвестное действие'}, 400);
});
