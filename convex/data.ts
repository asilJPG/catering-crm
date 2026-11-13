import {ConvexError, v} from 'convex/values';
import {internalMutation, mutation, query} from './_generated/server';
import {isPrivileged, requirePrivileged, requireUser, strip, toAppUser} from './lib';
import {
  catalogFields,
  clientFields,
  eventFields,
  kitFields,
  orderFields,
  returnActV,
} from './validators';
import {isReserving, reservationsFromEvents, shortagesFor} from '../src/lib/format';
import {createSeed} from '../src/lib/seed';
import type {CatalogItem, CateringEvent} from '../src/lib/types';

// Все правила доступа и проверки склада выполняются здесь, на сервере: интерфейс только отражает их.

/**
 * Всё, что нужно интерфейсу, одним запросом (он живой: при любом изменении данных приходит заново).
 * Менеджер получает только свои мероприятия, но занятость склада считается по всем.
 */
export const snapshot = query({
  args: {token: v.string()},
  handler: async (ctx, {token}) => {
    const user = await requireUser(ctx, token);
    const [catalog, kits, clients, orders, allEvents, users] = await Promise.all([
      ctx.db.query('catalog').order('desc').collect(),
      ctx.db.query('kits').order('desc').collect(),
      ctx.db.query('clients').order('desc').collect(),
      ctx.db.query('orders').order('desc').collect(),
      ctx.db.query('events').order('desc').collect(),
      ctx.db.query('users').collect(),
    ]);
    const visible =
      user.role === 'manager'
        ? allEvents.filter(event => event.createdBy === String(user._id))
        : allEvents;
    return {
      db: {
        catalog: catalog.map(strip),
        kits: kits.map(strip),
        clients: clients.map(strip),
        orders: orders.map(strip),
        events: visible.map(strip),
      },
      reservations: reservationsFromEvents(allEvents.map(strip) as unknown as CateringEvent[]),
      people: users.map(toAppUser),
    };
  },
});

// ── Каталог и комплекты: правит директор и администратор ──

export const saveCatalogItem = mutation({
  args: {token: v.string(), row: v.object(catalogFields)},
  handler: async (ctx, {token, row}) => {
    requirePrivileged(await requireUser(ctx, token));
    const existing = await ctx.db
      .query('catalog')
      .withIndex('by_appId', q => q.eq('id', row.id))
      .unique();
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert('catalog', row);
  },
});

export const saveKit = mutation({
  args: {token: v.string(), row: v.object(kitFields)},
  handler: async (ctx, {token, row}) => {
    requirePrivileged(await requireUser(ctx, token));
    const existing = await ctx.db
      .query('kits')
      .withIndex('by_appId', q => q.eq('id', row.id))
      .unique();
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert('kits', row);
  },
});

// ── Клиенты: добавляют все, меняют директор и администратор ──

export const saveClient = mutation({
  args: {token: v.string(), row: v.object(clientFields)},
  handler: async (ctx, {token, row}) => {
    const user = await requireUser(ctx, token);
    const existing = await ctx.db
      .query('clients')
      .withIndex('by_appId', q => q.eq('id', row.id))
      .unique();
    if (existing) {
      requirePrivileged(user);
      await ctx.db.replace(existing._id, row);
    } else {
      await ctx.db.insert('clients', row);
    }
  },
});

// ── Заявки: ведут все сотрудники ──

export const saveOrder = mutation({
  args: {token: v.string(), row: v.object(orderFields)},
  handler: async (ctx, {token, row}) => {
    await requireUser(ctx, token);
    const existing = await ctx.db
      .query('orders')
      .withIndex('by_appId', q => q.eq('id', row.id))
      .unique();
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert('orders', row);
  },
});

// ── Мероприятия ──

export const saveEvent = mutation({
  args: {token: v.string(), row: v.object(eventFields)},
  handler: async (ctx, {token, row}) => {
    const user = await requireUser(ctx, token);
    const me = String(user._id);
    const existing = await ctx.db
      .query('events')
      .withIndex('by_appId', q => q.eq('id', row.id))
      .unique();

    if (existing && !isPrivileged(user) && existing.createdBy !== me) {
      throw new ConvexError('Это мероприятие создал другой сотрудник');
    }

    // Автора и акт возврата клиент менять не может: акт оформляется отдельной функцией.
    const {returnAct: _ignoredAct, createdBy: _ignoredAuthor, ...rest} = row;
    void _ignoredAct;
    void _ignoredAuthor;
    const next = {
      ...rest,
      createdBy: existing ? existing.createdBy : me,
      ...(existing?.returnAct ? {returnAct: existing.returnAct} : {}),
    };

    // Склад проверяем в той же транзакции, что и запись: два менеджера не займут одни и те же позиции.
    if (isReserving(next.status)) {
      const [catalog, allEvents] = await Promise.all([
        ctx.db.query('catalog').collect(),
        ctx.db.query('events').collect(),
      ]);
      const reservations = reservationsFromEvents(
        allEvents.filter(event => event.id !== next.id).map(strip) as unknown as CateringEvent[],
      );
      const missing = shortagesFor(
        next as unknown as CateringEvent,
        reservations,
        catalog.map(strip) as unknown as CatalogItem[],
      );
      if (missing.length > 0) {
        throw new ConvexError(`Не хватает на складе: ${missing.join('; ')}`);
      }
    }

    if (existing) await ctx.db.replace(existing._id, next);
    else await ctx.db.insert('events', next);
  },
});

/**
 * Акт возврата: в одной транзакции закрывает мероприятие и списывает недостающее со склада.
 * Менеджер не правит каталог напрямую, поэтому остаток меняется здесь — и только для его мероприятия.
 */
export const applyReturnAct = mutation({
  args: {token: v.string(), eventId: v.string(), act: returnActV},
  handler: async (ctx, {token, eventId, act}) => {
    const user = await requireUser(ctx, token);
    const event = await ctx.db
      .query('events')
      .withIndex('by_appId', q => q.eq('id', eventId))
      .unique();
    if (!event) throw new ConvexError('Мероприятие не найдено');
    if (!isPrivileged(user) && event.createdBy !== String(user._id)) {
      throw new ConvexError('Это мероприятие создал другой сотрудник');
    }
    if (event.returnAct) throw new ConvexError('Акт возврата по этому мероприятию уже оформлен');

    for (const line of act.lines) {
      if (line.issued < 0 || line.returned < 0 || line.returned > line.issued) {
        throw new ConvexError('В акте возвращено больше, чем выдано');
      }
    }
    for (const line of act.lines) {
      const lost = line.issued - line.returned;
      if (lost <= 0) continue;
      const item = await ctx.db
        .query('catalog')
        .withIndex('by_appId', q => q.eq('id', line.itemId))
        .unique();
      if (item && item.stock !== null) {
        await ctx.db.patch(item._id, {stock: Math.max(item.stock - lost, 0)});
      }
    }
    await ctx.db.patch(event._id, {status: 'done', returnAct: act});
  },
});

// ── Удаление ──

export const remove = mutation({
  args: {
    token: v.string(),
    collection: v.union(
      v.literal('catalog'),
      v.literal('kits'),
      v.literal('clients'),
      v.literal('orders'),
      v.literal('events'),
    ),
    id: v.string(),
  },
  handler: async (ctx, {token, collection, id}) => {
    const user = await requireUser(ctx, token);
    if (collection === 'events') {
      const event = await ctx.db
        .query('events')
        .withIndex('by_appId', q => q.eq('id', id))
        .unique();
      if (!event) return;
      if (!isPrivileged(user) && event.createdBy !== String(user._id)) {
        throw new ConvexError('Это мероприятие создал другой сотрудник');
      }
      await ctx.db.delete(event._id);
      return;
    }
    requirePrivileged(user);
    const doc = await ctx.db
      .query(collection)
      .withIndex('by_appId', q => q.eq('id', id))
      .unique();
    if (doc) await ctx.db.delete(doc._id);
  },
});

// ── Демо-данные: запускаются вручную, ничего не перезаписывают ──

/** npx convex run data:loadDemoCatalog — каталог, комплекты и клиенты из демо-набора, если таблицы пусты. */
export const loadDemoCatalog = internalMutation({
  args: {},
  handler: async ctx => {
    const seed = createSeed();
    const counts = {catalog: 0, kits: 0, clients: 0};
    if ((await ctx.db.query('catalog').first()) === null) {
      for (const item of seed.catalog) {
        await ctx.db.insert('catalog', item);
        counts.catalog += 1;
      }
    }
    if ((await ctx.db.query('kits').first()) === null) {
      for (const kit of seed.kits) {
        await ctx.db.insert('kits', kit);
        counts.kits += 1;
      }
    }
    if ((await ctx.db.query('clients').first()) === null) {
      for (const client of seed.clients) {
        await ctx.db.insert('clients', client);
        counts.clients += 1;
      }
    }
    return counts;
  },
});
