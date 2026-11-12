// Edge Function «password-login»: вход по одному паролю.
// Деплой: supabase functions deploy password-login --no-verify-jwt
// (функция открыта для неавторизованных — она и выдаёт сессию).
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {EMAIL_DOMAIN, cors, hashPassword, reply} from '../_shared/password.ts';

const MAX_FAILURES = 8; // неудачных попыток с одного адреса
const WINDOW_MINUTES = 10;

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: cors});

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();

  let password = '';
  try {
    password = String((await req.json()).password ?? '');
  } catch {
    return reply({error: 'Некорректный запрос'}, 400);
  }
  if (!password || password.length > 200) return reply({error: 'Введите пароль'}, 400);

  // Пароль — единственный ключ, поэтому перебор ограничиваем.
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const {count} = await admin
    .from('login_attempts')
    .select('id', {count: 'exact', head: true})
    .eq('ip', ip)
    .gte('at', since);
  if ((count ?? 0) >= MAX_FAILURES) {
    return reply({error: `Слишком много попыток. Подождите ${WINDOW_MINUTES} минут.`}, 429);
  }

  const fail = async (message: string, status: number) => {
    await admin.from('login_attempts').insert({ip});
    await admin
      .from('login_attempts')
      .delete()
      .lt('at', new Date(Date.now() - 24 * 3600_000).toISOString());
    return reply({error: message}, status);
  };

  const hash = await hashPassword(password);
  const {data: secret} = await admin
    .from('profile_secrets')
    .select('id, profiles ( login, active )')
    .eq('pass_hash', hash)
    .maybeSingle();
  const profile = Array.isArray(secret?.profiles) ? secret?.profiles[0] : secret?.profiles;
  if (!secret || !profile) return fail('Неверный пароль', 401);
  if (!profile.active) return reply({error: 'Учётная запись отключена. Обратитесь к администратору.'}, 403);

  const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!);
  const {data, error} = await anon.auth.signInWithPassword({
    email: `${profile.login}@${EMAIL_DOMAIN}`,
    password,
  });
  if (error || !data.session) return fail('Неверный пароль', 401);

  await admin.from('login_attempts').delete().eq('ip', ip);
  return reply({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user_id: data.user.id,
  });
});
