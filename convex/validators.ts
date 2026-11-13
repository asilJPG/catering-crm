import {v} from 'convex/values';

// Валидаторы совпадают с типами в src/lib/types.ts. Поле `id` — строковый идентификатор приложения,
// отдельный от служебного `_id` Convex: интерфейс работает с `id`.

export const itemKind = v.union(
  v.literal('dish'),
  v.literal('furniture'),
  v.literal('equipment'),
  v.literal('service'),
);

export const eventFormat = v.union(
  v.literal('banquet'),
  v.literal('buffet'),
  v.literal('coffee_break'),
  v.literal('wedding'),
  v.literal('corporate'),
  v.literal('bbq'),
);

export const eventStatus = v.union(
  v.literal('draft'),
  v.literal('confirmed'),
  v.literal('in_progress'),
  v.literal('done'),
  v.literal('cancelled'),
);

export const orderStatus = v.union(
  v.literal('new'),
  v.literal('in_work'),
  v.literal('converted'),
  v.literal('rejected'),
);

export const role = v.union(v.literal('admin'), v.literal('director'), v.literal('manager'));
/** Роли, которые администратор может выдавать. */
export const assignableRole = v.union(v.literal('director'), v.literal('manager'));

const qtyLine = v.object({itemId: v.string(), qty: v.number()});

export const catalogFields = {
  id: v.string(),
  kind: itemKind,
  category: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  image: v.optional(v.string()),
  unit: v.string(),
  price: v.number(),
  /** Число для мебели и посуды, null для блюд и услуг. */
  stock: v.union(v.number(), v.null()),
};

export const kitFields = {
  id: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  image: v.optional(v.string()),
  items: v.array(qtyLine),
};

export const clientFields = {
  id: v.string(),
  name: v.string(),
  company: v.string(),
  phone: v.string(),
  email: v.string(),
};

export const returnActV = v.object({
  date: v.string(),
  responsible: v.string(),
  comment: v.string(),
  lines: v.array(
    v.object({
      itemId: v.string(),
      issued: v.number(),
      returned: v.number(),
      note: v.string(),
    }),
  ),
});

export const eventFields = {
  id: v.string(),
  title: v.string(),
  clientId: v.string(),
  format: eventFormat,
  date: v.string(),
  endDate: v.optional(v.string()),
  startTime: v.string(),
  endTime: v.string(),
  venue: v.string(),
  guests: v.number(),
  status: eventStatus,
  lines: v.array(qtyLine),
  discount: v.number(),
  prepaid: v.number(),
  notes: v.string(),
  responsible: v.optional(v.string()),
  returnAct: v.optional(returnActV),
  /** Идентификатор пользователя (`users._id` строкой): менеджер видит только свои. */
  createdBy: v.optional(v.string()),
  kits: v.optional(v.array(v.object({kitId: v.string(), qty: v.number()}))),
  orderId: v.union(v.string(), v.null()),
  createdAt: v.string(),
};

export const orderFields = {
  id: v.string(),
  contactName: v.string(),
  phone: v.string(),
  source: v.string(),
  format: eventFormat,
  date: v.string(),
  guests: v.number(),
  budget: v.union(v.number(), v.null()),
  comment: v.string(),
  status: orderStatus,
  eventId: v.union(v.string(), v.null()),
  createdAt: v.string(),
};
