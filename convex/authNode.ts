'use node';
// Действия, которым нужен Node: хеш пароля с секретом сервера и случайные токены.
import {createHmac, randomBytes} from 'node:crypto';
import {ConvexError, v} from 'convex/values';
import {internal} from './_generated/api';
import {action, internalAction} from './_generated/server';
import {MIN_PASSWORD_LENGTH} from './lib';
import type {AppUser} from '../src/lib/types';
import {assignableRole} from './validators';

// Явные типы результатов нужны: без них TypeScript не может вывести тип api, который ссылается на этот файл.
type Outcome = {ok: true} | {ok: false; message: string};
type Started = {ok: true; user: AppUser} | {ok: false; message: string};

/** HMAC-SHA256 пароля с секретом PASSWORD_PEPPER: по хешу находим владельца, не перебирая пароли. */
function hashPassword(password: string): string {
  const pepper = process.env.PASSWORD_PEPPER;
  if (!pepper) throw new ConvexError('На сервере не задан секрет PASSWORD_PEPPER');
  return createHmac('sha256', pepper).update(password).digest('hex');
}

function checkPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ConvexError(`Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`);
  }
}

export const signIn = action({
  args: {password: v.string(), deviceId: v.string()},
  handler: async (ctx, {password, deviceId}): Promise<{token: string; user: AppUser}> => {
    if (!password || password.length > 200) throw new ConvexError('Введите пароль');
    const token = randomBytes(32).toString('hex');
    const result: Started = await ctx.runMutation(internal.auth.startSession, {
      passHash: hashPassword(password),
      token,
      deviceId: deviceId.slice(0, 100),
    });
    if (!result.ok) throw new ConvexError(result.message);
    return {token, user: result.user};
  },
});

export const createUser = action({
  args: {token: v.string(), name: v.string(), role: assignableRole, password: v.string()},
  handler: async (ctx, {token, name, role, password}): Promise<void> => {
    const admin: AppUser | null = await ctx.runQuery(internal.auth.adminCheck, {token});
    if (!admin) throw new ConvexError('Только администратор может управлять сотрудниками');
    if (!name.trim()) throw new ConvexError('Укажите имя');
    checkPassword(password);
    const result: Outcome = await ctx.runMutation(internal.auth.adminCreate, {
      name: name.trim(),
      role,
      passHash: hashPassword(password),
    });
    if (!result.ok) throw new ConvexError(result.message);
  },
});

export const updateUser = action({
  args: {
    token: v.string(),
    id: v.string(),
    name: v.optional(v.string()),
    role: v.optional(assignableRole),
    active: v.optional(v.boolean()),
    password: v.optional(v.string()),
  },
  handler: async (ctx, {token, id, name, role, active, password}): Promise<void> => {
    const admin: AppUser | null = await ctx.runQuery(internal.auth.adminCheck, {token});
    if (!admin) throw new ConvexError('Только администратор может управлять сотрудниками');
    if (password) checkPassword(password);
    const result: Outcome = await ctx.runMutation(internal.auth.adminUpdate, {
      adminId: admin.id,
      id,
      name: name?.trim() || undefined,
      role,
      active,
      passHash: password ? hashPassword(password) : undefined,
    });
    if (!result.ok) throw new ConvexError(result.message);
  },
});

/** Первый администратор. Запускается вручную: npx convex run authNode:seedAdmin '{...}' */
export const seedAdmin = internalAction({
  args: {name: v.string(), password: v.string()},
  handler: async (ctx, {name, password}): Promise<void> => {
    checkPassword(password);
    const result: Outcome = await ctx.runMutation(internal.auth.adminCreate, {
      name,
      role: 'admin',
      passHash: hashPassword(password),
    });
    if (!result.ok) throw new ConvexError(result.message);
  },
});
