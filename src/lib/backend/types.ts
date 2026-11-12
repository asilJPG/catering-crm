import type {AppUser, Database, Reservation, Role} from '../types';

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

/** Всё, что приложению нужно от хранилища: вход, данные и управление пользователями. */
export interface Backend {
  mode: 'local' | 'supabase';
  getSession(): Promise<AppUser | null>;
  /** Вход по одному паролю: у каждого сотрудника он свой и не повторяется. */
  signIn(password: string): Promise<AppUser>;
  signOut(): Promise<void>;

  loadData(user: AppUser): Promise<Database>;
  /** Занятость склада мероприятиями, которые пользователь не видит (для менеджера). */
  loadReservations(): Promise<Reservation[]>;
  upsert(collection: Collection, row: {id: string}): Promise<void>;
  remove(collection: Collection, id: string): Promise<void>;
  /** Списание недостающего по акту возврата. Менеджер не может править каталог напрямую. */
  applyLosses(eventId: string, losses: Record<string, number>): Promise<void>;

  listPeople(): Promise<AppUser[]>;
  createUser(input: NewUserInput): Promise<void>;
  updateUser(id: string, patch: UserPatch): Promise<void>;
  deleteUser(id: string): Promise<void>;
}

export const MIN_PASSWORD_LENGTH = 8;

/** Пароль — единственный ключ для входа, поэтому он длиннее обычного. */
export function validatePassword(password: string): string | null {
  return password.length >= MIN_PASSWORD_LENGTH
    ? null
    : `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`;
}

export const PASSWORD_TAKEN = 'Такой пароль уже используется. Придумайте другой.';
