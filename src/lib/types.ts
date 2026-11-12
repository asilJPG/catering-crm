export type ItemKind = 'dish' | 'furniture' | 'equipment' | 'service';

export type Role = 'admin' | 'director' | 'manager';

export type AppUser = {
  id: string;
  login: string;
  name: string;
  role: Role;
  active: boolean;
};

export type KitItem = {itemId: string; qty: number};

/** Комплект мебели: при выборе в мероприятие добавляется всё, что внутри. */
export type Kit = {
  id: string;
  name: string;
  description?: string;
  image?: string;
  items: KitItem[];
};

/** Занятость позиции на склада в период мероприятия (только подтверждённые). */
export type Reservation = {
  eventId: string;
  itemId: string;
  qty: number;
  date: string;
  endDate: string;
};

export type CatalogItem = {
  id: string;
  kind: ItemKind;
  category: string;
  name: string;
  /** Короткое описание для меню и каталога. */
  description?: string;
  /** Фото позиции (data URL, сжатое при загрузке). */
  image?: string;
  unit: string;
  price: number;
  /** Сколько единиц есть на складе. Для блюд и услуг не используется. */
  stock: number | null;
};

export type Client = {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
};

export type EventStatus =
  | 'draft'
  | 'confirmed'
  | 'in_progress'
  | 'done'
  | 'cancelled';

export type EventFormat =
  | 'banquet'
  | 'buffet'
  | 'coffee_break'
  | 'wedding'
  | 'corporate'
  | 'bbq';

export type EventLine = {itemId: string; qty: number};

export type ReturnLine = {
  itemId: string;
  issued: number;
  returned: number;
  /** Что случилось с недостающими: разбито, потеряно, осталось на площадке. */
  note: string;
};

/** Акт возврата: ответственный фиксирует, сколько позиций вернулось с мероприятия. */
export type ReturnAct = {
  date: string;
  responsible: string;
  comment: string;
  lines: ReturnLine[];
};

export type CateringEvent = {
  id: string;
  title: string;
  clientId: string;
  format: EventFormat;
  date: string;
  /** Последний день, когда позиции заняты. Если не задан — равен дате начала. */
  endDate?: string;
  startTime: string;
  endTime: string;
  venue: string;
  guests: number;
  status: EventStatus;
  lines: EventLine[];
  discount: number;
  prepaid: number;
  notes: string;
  /** Ответственный за мероприятие: он сдаёт акт возврата. */
  responsible?: string;
  returnAct?: ReturnAct;
  /** Кто создал мероприятие: менеджер видит только свои. */
  createdBy?: string;
  /** Сколько комплектов выбрано (позиции комплектов уже внутри lines). */
  kits?: {kitId: string; qty: number}[];
  orderId: string | null;
  createdAt: string;
};

export type OrderStatus = 'new' | 'in_work' | 'converted' | 'rejected';

export type Order = {
  id: string;
  contactName: string;
  phone: string;
  source: string;
  format: EventFormat;
  date: string;
  guests: number;
  budget: number | null;
  comment: string;
  status: OrderStatus;
  eventId: string | null;
  createdAt: string;
};

export type Database = {
  catalog: CatalogItem[];
  kits: Kit[];
  clients: Client[];
  events: CateringEvent[];
  orders: Order[];
};
