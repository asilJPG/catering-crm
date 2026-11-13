import {defineSchema, defineTable} from 'convex/server';
import {v} from 'convex/values';
import {
  catalogFields,
  clientFields,
  eventFields,
  kitFields,
  orderFields,
  role,
} from './validators';

export default defineSchema({
  // ── Данные CRM ──
  catalog: defineTable(catalogFields).index('by_appId', ['id']),
  kits: defineTable(kitFields).index('by_appId', ['id']),
  clients: defineTable(clientFields).index('by_appId', ['id']),
  events: defineTable(eventFields)
    .index('by_appId', ['id'])
    .index('by_createdBy', ['createdBy']),
  orders: defineTable(orderFields).index('by_appId', ['id']),

  // ── Сотрудники и вход ──
  // Вход только по паролю: passHash = HMAC-SHA256(PASSWORD_PEPPER, пароль), уникален.
  users: defineTable({
    name: v.string(),
    role,
    active: v.boolean(),
    passHash: v.string(),
  }).index('by_passHash', ['passHash']),

  sessions: defineTable({
    userId: v.id('users'),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index('by_token', ['token'])
    .index('by_user', ['userId']),

  // Неудачные попытки входа — ограничение перебора пароля.
  loginAttempts: defineTable({
    deviceId: v.string(),
    at: v.number(),
  })
    .index('by_device', ['deviceId', 'at'])
    .index('by_at', ['at']),
});
