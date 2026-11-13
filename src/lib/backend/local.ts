import {createSeed} from '../seed';
import type {AppUser, Database, ReturnAct, Role} from '../types';
import {
  PASSWORD_TAKEN,
  type Backend,
  type Collection,
  type NewUserInput,
  type UserPatch,
} from './types';

/**
 * Локальный режим для разработки и демо: данные и пользователи лежат в браузере.
 * Пароли хешируются, но защиты от взлома тут нет — для работы нужен режим Supabase.
 */
const DB_KEY = 'luma-catering-crm-v6';
const USERS_KEY = 'luma-users-v1';
const SESSION_KEY = 'luma-session-v1';

type StoredUser = AppUser & {salt: string; hash: string};

async function hashPassword(password: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function makeUser(
  id: string,
  login: string,
  name: string,
  role: Role,
  password: string,
): Promise<StoredUser> {
  const salt = crypto.randomUUID();
  return {id, login, name, role, active: true, salt, hash: await hashPassword(password, salt)};
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Хранилище недоступно — работаем без сохранения.
  }
}

async function loadUsers(): Promise<StoredUser[]> {
  const saved = read<StoredUser[]>(USERS_KEY);
  if (saved) return saved;
  const seeded = await Promise.all([
    makeUser('u-admin', 'admin', 'Администратор', 'admin', 'admin123'),
    makeUser('u-director', 'director', 'Бахтиёр Рахимов', 'director', 'director123'),
    makeUser('u-alisher', 'alisher', 'Алишер Юсупов', 'manager', 'alisher123'),
    makeUser('u-dilshod', 'dilshod', 'Дилшод Назаров', 'manager', 'dilshod123'),
  ]);
  write(USERS_KEY, seeded);
  return seeded;
}

async function findByPassword(users: StoredUser[], password: string) {
  for (const user of users) {
    if ((await hashPassword(password, user.salt)) === user.hash) return user;
  }
  return undefined;
}

const publicUser = ({id, login, name, role, active}: StoredUser): AppUser => ({
  id,
  login,
  name,
  role,
  active,
});

function loadDb(): Database {
  return read<Database>(DB_KEY) ?? createSeed();
}

export const localBackend: Backend = {
  mode: 'local',

  async getSession() {
    const id = read<string>(SESSION_KEY);
    if (!id) return null;
    const user = (await loadUsers()).find(entry => entry.id === id && entry.active);
    return user ? publicUser(user) : null;
  },

  async signIn(password) {
    const user = await findByPassword(await loadUsers(), password);
    if (!user) throw new Error('Неверный пароль');
    if (!user.active) throw new Error('Учётная запись отключена. Обратитесь к администратору.');
    write(SESSION_KEY, user.id);
    return publicUser(user);
  },

  async signOut() {
    localStorage.removeItem(SESSION_KEY);
  },

  async loadSnapshot() {
    const db = loadDb();
    write(DB_KEY, db);
    // В локальном режиме приложение видит все мероприятия, отдельная выборка занятости не нужна.
    return {db, reservations: [], people: (await loadUsers()).map(publicUser)};
  },

  async upsert(collection: Collection, row) {
    const db = loadDb();
    const list = db[collection] as {id: string}[];
    const index = list.findIndex(entry => entry.id === row.id);
    if (index >= 0) list[index] = row;
    else list.unshift(row);
    write(DB_KEY, db);
  },

  async remove(collection: Collection, id) {
    const db = loadDb();
    (db[collection] as {id: string}[]) = (db[collection] as {id: string}[]).filter(
      entry => entry.id !== id,
    );
    write(DB_KEY, db);
  },

  async applyReturnAct(eventId: string, act: ReturnAct) {
    const db = loadDb();
    const event = db.events.find(entry => entry.id === eventId);
    if (!event || event.returnAct) return;
    for (const line of act.lines) {
      const lost = Math.max(line.issued - line.returned, 0);
      if (lost <= 0) continue;
      db.catalog = db.catalog.map(item =>
        item.id === line.itemId && item.stock !== null
          ? {...item, stock: Math.max(item.stock - lost, 0)}
          : item,
      );
    }
    db.events = db.events.map(entry =>
      entry.id === eventId ? {...entry, status: 'done', returnAct: act} : entry,
    );
    write(DB_KEY, db);
  },

  async listPeople() {
    return (await loadUsers()).map(publicUser);
  },

  async createUser(input: NewUserInput) {
    const users = await loadUsers();
    if (await findByPassword(users, input.password)) throw new Error(PASSWORD_TAKEN);
    const id = `u-${crypto.randomUUID()}`;
    // Логин внутренний: сотрудники входят по паролю, но запись в таблице нужна.
    users.push(await makeUser(id, id.slice(2, 10), input.name, input.role, input.password));
    write(USERS_KEY, users);
  },

  async updateUser(id, patch: UserPatch) {
    const users = await loadUsers();
    const index = users.findIndex(entry => entry.id === id);
    if (index < 0) throw new Error('Пользователь не найден');
    const current = users[index];
    const next = {...current};
    if (patch.name !== undefined) next.name = patch.name;
    if (patch.role !== undefined) next.role = patch.role;
    if (patch.active !== undefined) next.active = patch.active;
    if (patch.password) {
      const owner = await findByPassword(users, patch.password);
      if (owner && owner.id !== id) throw new Error(PASSWORD_TAKEN);
      next.salt = crypto.randomUUID();
      next.hash = await hashPassword(patch.password, next.salt);
    }
    users[index] = next;
    write(USERS_KEY, users);
  },

  async deleteUser(id) {
    write(USERS_KEY, (await loadUsers()).filter(entry => entry.id !== id));
  },
};
