import {ConvexError, v} from 'convex/values';
import {internalMutation, internalQuery, mutation, query} from './_generated/server';
import {
  LOGIN_WINDOW_MS,
  MAX_FAILURES_PER_DEVICE,
  MAX_FAILURES_TOTAL,
  SESSION_MS,
  toAppUser,
  userFor,
} from './lib';
import {assignableRole} from './validators';

// Хеширование паролей (нужен Node) живёт в authNode.ts. Здесь — всё, что работает с базой.

export const me = query({
  args: {token: v.string()},
  handler: async (ctx, {token}) => {
    const user = await userFor(ctx, token);
    return user ? toAppUser(user) : null;
  },
});

/** Список сотрудников для всех вошедших: имена нужны, чтобы показать, кто создал мероприятие. */
export const listPeople = query({
  args: {token: v.string()},
  handler: async (ctx, {token}) => {
    if (!(await userFor(ctx, token))) throw new ConvexError('Требуется вход');
    const users = await ctx.db.query('users').collect();
    return users.map(toAppUser).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  },
});

export const signOut = mutation({
  args: {token: v.string()},
  handler: async (ctx, {token}) => {
    const session = await ctx.db
      .query('sessions')
      .withIndex('by_token', q => q.eq('token', token))
      .unique();
    if (session) await ctx.db.delete(session._id);
  },
});

/**
 * Находит владельца по хешу пароля и открывает сессию. Неудачи записываем и считаем,
 * поэтому вместо исключения возвращаем {ok:false}: при исключении запись откатилась бы.
 */
export const startSession = internalMutation({
  args: {passHash: v.string(), token: v.string(), deviceId: v.string()},
  handler: async (ctx, {passHash, token, deviceId}) => {
    const since = Date.now() - LOGIN_WINDOW_MS;
    const device = await ctx.db
      .query('loginAttempts')
      .withIndex('by_device', q => q.eq('deviceId', deviceId).gte('at', since))
      .collect();
    const total = await ctx.db
      .query('loginAttempts')
      .withIndex('by_at', q => q.gte('at', since))
      .collect();
    if (device.length >= MAX_FAILURES_PER_DEVICE || total.length >= MAX_FAILURES_TOTAL) {
      return {ok: false as const, message: 'Слишком много попыток. Подождите 10 минут.'};
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_passHash', q => q.eq('passHash', passHash))
      .unique();
    if (!user) {
      await ctx.db.insert('loginAttempts', {deviceId, at: Date.now()});
      return {ok: false as const, message: 'Неверный пароль'};
    }
    if (!user.active) {
      return {
        ok: false as const,
        message: 'Учётная запись отключена. Обратитесь к администратору.',
      };
    }
    await ctx.db.insert('sessions', {
      userId: user._id,
      token,
      expiresAt: Date.now() + SESSION_MS,
    });
    return {ok: true as const, user: toAppUser(user)};
  },
});

/** Для node-действий: кто вызывает и админ ли он. */
export const adminCheck = internalQuery({
  args: {token: v.string()},
  handler: async (ctx, {token}) => {
    const user = await userFor(ctx, token);
    return user && user.role === 'admin' ? toAppUser(user) : null;
  },
});

const PASSWORD_TAKEN = 'Такой пароль уже используется. Придумайте другой.';

export const adminCreate = internalMutation({
  args: {
    name: v.string(),
    role: v.union(assignableRole, v.literal('admin')),
    passHash: v.string(),
  },
  handler: async (ctx, {name, role, passHash}) => {
    const taken = await ctx.db
      .query('users')
      .withIndex('by_passHash', q => q.eq('passHash', passHash))
      .unique();
    if (taken) return {ok: false as const, message: PASSWORD_TAKEN};
    await ctx.db.insert('users', {name, role, active: true, passHash});
    return {ok: true as const};
  },
});

export const adminUpdate = internalMutation({
  args: {
    adminId: v.string(),
    id: v.string(),
    name: v.optional(v.string()),
    role: v.optional(assignableRole),
    active: v.optional(v.boolean()),
    passHash: v.optional(v.string()),
  },
  handler: async (ctx, {adminId, id, name, role, active, passHash}) => {
    const target = ctx.db.normalizeId('users', id);
    const user = target ? await ctx.db.get(target) : null;
    if (!target || !user) return {ok: false as const, message: 'Сотрудник не найден'};
    if (id === adminId) {
      return {ok: false as const, message: 'Свою учётную запись менять здесь нельзя'};
    }
    if (user.role === 'admin') {
      return {ok: false as const, message: 'Администраторов здесь менять нельзя'};
    }
    if (passHash) {
      const owner = await ctx.db
        .query('users')
        .withIndex('by_passHash', q => q.eq('passHash', passHash))
        .unique();
      if (owner && owner._id !== target) return {ok: false as const, message: PASSWORD_TAKEN};
    }
    const patch: Record<string, unknown> = {};
    if (name) patch.name = name;
    if (role) patch.role = role;
    if (active !== undefined) patch.active = active;
    if (passHash) patch.passHash = passHash;
    await ctx.db.patch(target, patch);

    // Отключённого или с новым паролем выбрасываем из открытых сессий.
    if (active === false || passHash) {
      const sessions = await ctx.db
        .query('sessions')
        .withIndex('by_user', q => q.eq('userId', target))
        .collect();
      for (const session of sessions) await ctx.db.delete(session._id);
    }
    return {ok: true as const};
  },
});

export const deleteUser = mutation({
  args: {token: v.string(), id: v.string()},
  handler: async (ctx, {token, id}) => {
    const admin = await userFor(ctx, token);
    if (!admin || admin.role !== 'admin') {
      throw new ConvexError('Только администратор может управлять сотрудниками');
    }
    const target = ctx.db.normalizeId('users', id);
    const user = target ? await ctx.db.get(target) : null;
    if (!target || !user) throw new ConvexError('Сотрудник не найден');
    if (target === admin._id) throw new ConvexError('Свою учётную запись удалить нельзя');
    if (user.role === 'admin') throw new ConvexError('Администраторов здесь удалять нельзя');
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_user', q => q.eq('userId', target))
      .collect();
    for (const session of sessions) await ctx.db.delete(session._id);
    await ctx.db.delete(target);
  },
});

/**
 * Служебное удаление пользователя из терминала: npx convex run auth:removeUser '{"id":"..."}'.
 * Нужно, например, чтобы заменить администратора: в интерфейсе админов удалять нельзя.
 * Последнего администратора удалить нельзя, чтобы не остаться без входа.
 */
export const removeUser = internalMutation({
  args: {id: v.string()},
  handler: async (ctx, {id}) => {
    const target = ctx.db.normalizeId('users', id);
    const user = target ? await ctx.db.get(target) : null;
    if (!target || !user) throw new ConvexError('Пользователь не найден');
    if (user.role === 'admin') {
      const admins = (await ctx.db.query('users').collect()).filter(u => u.role === 'admin');
      if (admins.length < 2) throw new ConvexError('Нельзя удалить последнего администратора');
    }
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_user', q => q.eq('userId', target))
      .collect();
    for (const session of sessions) await ctx.db.delete(session._id);
    await ctx.db.delete(target);
    return {removed: user.name};
  },
});
