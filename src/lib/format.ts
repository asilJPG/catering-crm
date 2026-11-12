import type {
  CatalogItem,
  Kit,
  Reservation,
  CateringEvent,
  EventFormat,
  EventStatus,
  ItemKind,
  OrderStatus,
} from './types';

/** Валюта всей CRM — меняется в одном месте. */
export const CURRENCY = 'сум';

const numberFormat = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 0});

export function money(value: number): string {
  return `${numberFormat.format(Math.round(value))} ${CURRENCY}`;
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(iso: string): string {
  if (!iso) return '—';
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  });
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDaysISO(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const KIND_LABEL: Record<ItemKind, string> = {
  dish: 'Блюда и напитки',
  furniture: 'Мебель',
  equipment: 'Посуда и оборудование',
  service: 'Персонал и услуги',
};

export const KIND_ORDER: ItemKind[] = [
  'dish',
  'furniture',
  'equipment',
  'service',
];

export const FORMAT_LABEL: Record<EventFormat, string> = {
  banquet: 'Банкет',
  buffet: 'Фуршет',
  coffee_break: 'Кофе-брейк',
  wedding: 'Свадьба',
  corporate: 'Корпоратив',
  bbq: 'Барбекю',
};

export const FORMAT_OPTIONS = (
  Object.keys(FORMAT_LABEL) as EventFormat[]
).map(value => ({value, label: FORMAT_LABEL[value]}));

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

export const EVENT_STATUS: Record<EventStatus, {label: string; tone: BadgeTone}> =
  {
    draft: {label: 'Черновик', tone: 'neutral'},
    confirmed: {label: 'Подтверждено', tone: 'info'},
    in_progress: {label: 'В работе', tone: 'warning'},
    done: {label: 'Проведено', tone: 'success'},
    cancelled: {label: 'Отменено', tone: 'error'},
  };

export const EVENT_STATUS_OPTIONS = (
  Object.keys(EVENT_STATUS) as EventStatus[]
).map(value => ({value, label: EVENT_STATUS[value].label}));

export const ORDER_STATUS: Record<OrderStatus, {label: string; tone: BadgeTone}> =
  {
    new: {label: 'Новая', tone: 'info'},
    in_work: {label: 'В работе', tone: 'warning'},
    converted: {label: 'Мероприятие создано', tone: 'success'},
    rejected: {label: 'Отказ', tone: 'error'},
  };

export type EventTotals = {
  byKind: Record<ItemKind, number>;
  subtotal: number;
  discountAmount: number;
  total: number;
  perGuest: number;
  due: number;
};

export function eventTotals(
  event: Pick<CateringEvent, 'lines' | 'discount' | 'guests' | 'prepaid'>,
  catalog: CatalogItem[],
): EventTotals {
  const byId = new Map(catalog.map(item => [item.id, item]));
  const byKind: Record<ItemKind, number> = {
    dish: 0,
    furniture: 0,
    equipment: 0,
    service: 0,
  };
  for (const line of event.lines) {
    const item = byId.get(line.itemId);
    if (item) byKind[item.kind] += item.price * line.qty;
  }
  const subtotal = KIND_ORDER.reduce((sum, kind) => sum + byKind[kind], 0);
  const discountAmount = (subtotal * (event.discount || 0)) / 100;
  const total = subtotal - discountAmount;
  return {
    byKind,
    subtotal,
    discountAmount,
    total,
    perGuest: event.guests > 0 ? total / event.guests : 0,
    due: total - (event.prepaid || 0),
  };
}

/** Статусы, при которых мероприятие занимает позиции на складе. */
export const RESERVING_STATUSES: EventStatus[] = ['confirmed', 'in_progress'];

export const isReserving = (status: EventStatus) =>
  RESERVING_STATUSES.includes(status);

export const eventEnd = (event: Pick<CateringEvent, 'date' | 'endDate'>) =>
  event.endDate && event.endDate >= event.date ? event.endDate : event.date;

function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  // Защита от опечатки в годе: не считаем больше двух месяцев.
  while (cursor <= last && days.length < 62) {
    days.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Занятость склада по подтверждённым мероприятиям: по строке на каждую позицию. */
export function reservationsFromEvents(events: CateringEvent[]): Reservation[] {
  return events
    .filter(event => isReserving(event.status))
    .flatMap(event =>
      event.lines.map(line => ({
        eventId: event.id,
        itemId: line.itemId,
        qty: line.qty,
        date: event.date,
        endDate: eventEnd(event),
      })),
    );
}

/** Сколько единиц позиции занято подтверждёнными мероприятиями в конкретный день. */
export function reservedOnDay(
  reservations: Reservation[],
  itemId: string,
  day: string,
  excludeEventId?: string,
): number {
  let reserved = 0;
  for (const entry of reservations) {
    if (entry.itemId !== itemId || entry.eventId === excludeEventId) continue;
    if (day >= entry.date && day <= entry.endDate) reserved += entry.qty;
  }
  return reserved;
}

/**
 * Сколько единиц можно взять на период: остаток на складе минус самый загруженный день
 * периода среди других подтверждённых мероприятий. Для блюд и услуг склад не считается.
 */
export function freeStock(
  item: CatalogItem,
  reservations: Reservation[],
  start: string,
  end: string,
  excludeEventId?: string,
): number | null {
  if (item.stock === null) return null;
  let peak = 0;
  for (const day of daysBetween(start, end || start)) {
    peak = Math.max(peak, reservedOnDay(reservations, item.id, day, excludeEventId));
  }
  return item.stock - peak;
}

/** Позиции мероприятия, которых не хватает на складе на его даты. */
export function shortagesFor(
  event: CateringEvent,
  reservations: Reservation[],
  catalog: CatalogItem[],
): string[] {
  const byId = new Map(catalog.map(item => [item.id, item]));
  return event.lines.flatMap(line => {
    const item = byId.get(line.itemId);
    if (!item) return [];
    const free = freeStock(item, reservations, event.date, eventEnd(event), event.id);
    return free !== null && line.qty > free
      ? [`${item.name}: нужно ${line.qty}, свободно ${Math.max(free, 0)}`]
      : [];
  });
}

/** Стоимость комплекта — сумма его позиций. */
export function kitPrice(kit: Kit, catalog: CatalogItem[]): number {
  const byId = new Map(catalog.map(item => [item.id, item]));
  return kit.items.reduce(
    (sum, entry) => sum + (byId.get(entry.itemId)?.price ?? 0) * entry.qty,
    0,
  );
}
