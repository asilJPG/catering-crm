import type {AppUser, Database, Reservation, ReturnAct, Role} from '../types';

export type Collection = 'catalog' | 'kits' | 'clients' | 'events' | 'orders';

export type NewUserInput = {
  name: string;
  role: Role;
  password: string;
};

export type UserPatch = {
  name?: string;
  role?: Role;
  active?: boolean;
  /** Новый пароль; пустой — не менять. */
  password?: string;
};

/** Всё, что интерфейс получает от хранилища за один раз. */
export type Snapshot = {
  db: Database;
  /** Занятость склада всеми подтверждёнными мероприятиями, включая те, которых пользователь не видит. */
  reservations: Reservation[];
  people: AppUser[];
};

/** Всё, что приложению нужно от хранилища: вход, данные и управление пользователями. */
export interface Backend {
  mode: 'local' | 'convex';
  getSession(): Promise<AppUser | null>;
  /** Вход по одному паролю: у каждого сотрудника он свой и не повторяется. */
  signIn(password: string): Promise<AppUser>;
  signOut(): Promise<void>;

  loadSnapshot(user: AppUser): Promise<Snapshot>;
  /** Живая подписка: вызывается при каждом изменении данных (только Convex). Возвращает отписку. */
  subscribe?(onChange: (snapshot: Snapshot) => void): () => void;
  upsert(collection: Collection, row: {id: string}): Promise<void>;
  remove(collection: Collection, id: string): Promise<void>;
  /** Акт возврата: закрывает мероприятие и списывает недостающее со склада одной операцией. */
  applyReturnAct(eventId: string, act: ReturnAct): Promise<void>;

  listPeople(): Promise<AppUser[]>;
  createUser(input: NewUserInput): Promise<void>;
  updateUser(id: string, patch: UserPatch): Promise<void>;
  deleteUser(id: string): Promise<void>;
}

export const MIN_PASSWORD_LENGTH = 6;

/** Пароль — единственный ключ для входа, поэтому он длиннее обычного. */
export function validatePassword(password: string): string | null {
  return password.length >= MIN_PASSWORD_LENGTH
    ? null
    : `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`;
}

export const PASSWORD_TAKEN = 'Такой пароль уже используется. Придумайте другой.';
