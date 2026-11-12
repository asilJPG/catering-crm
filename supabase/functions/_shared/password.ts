// Общие вещи для функций: хеш пароля для поиска владельца и домен внутреннего email.
export const EMAIL_DOMAIN = 'luma-crm.app';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {...cors, 'Content-Type': 'application/json'},
  });

/**
 * HMAC-SHA256 пароля с секретом сервера (PASSWORD_PEPPER). По хешу функция входа находит владельца,
 * не перебирая пароли; без секрета хеш из базы пароль не раскрывает.
 */
export async function hashPassword(password: string): Promise<string> {
  const pepper = Deno.env.get('PASSWORD_PEPPER');
  if (!pepper) throw new Error('Не задан секрет PASSWORD_PEPPER');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(pepper),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(password));
  return [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2, '0')).join('');
}
