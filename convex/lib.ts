import {ConvexError} from 'convex/values';
import type {Doc} from './_generated/dataModel';
import type {MutationCtx, QueryCtx} from './_generated/server';
import type {AppUser} from '../src/lib/types';

export const SESSION_MS = 30 * 24 * 3600 * 1000;
export const LOGIN_WINDOW_MS = 10 * 60 * 1000;
export const MAX_FAILURES_PER_DEVICE = 8;
export const MAX_FAILURES_TOTAL = 40;
export const MIN_PASSWORD_LENGTH = 6;

export const toAppUser = (user: Doc<'users'>): AppUser => ({
  id: String(user._id),
  login: String(user._id).slice(0, 8),
  name: user.name,
  role: user.role,
  active: user.active,
});

/** Пользователь по токену сессии; null, если сессии нет, она истекла или доступ отключён. */
export async function userFor(
  ctx: QueryCtx | MutationCtx,
  token: string,
): Promise<Doc<'users'> | null> {
  const session = await ctx.db
    .query('sessions')
    .withIndex('by_token', q => q.eq('token', token))
    .unique();
  if (!session || session.expiresAt < Date.now()) return null;
  const user = await ctx.db.get(session.userId);
  return user && user.active ? user : null;
}

export async function requireUser(ctx: QueryCtx | MutationCtx, token: string) {
  const user = await userFor(ctx, token);
  if (!user) throw new ConvexError('Требуется вход');
  return user;
}

export const isPrivileged = (user: Doc<'users'>) =>
  user.role === 'admin' || user.role === 'director';

export function requirePrivileged(user: Doc<'users'>) {
  if (!isPrivileged(user)) throw new ConvexError('Недостаточно прав для этого действия');
}

/** Убирает служебные поля Convex: интерфейс работает со своим `id`. */
export function strip<T extends {_id: unknown; _creationTime: number}>(doc: T) {
  const {_id, _creationTime, ...rest} = doc;
  void _id;
  void _creationTime;
  return rest;
}
