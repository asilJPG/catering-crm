import {ConvexClient} from 'convex/browser';
import {ConvexError} from 'convex/values';
import {api} from '../../../convex/_generated/api';
import type {AppUser, ReturnAct} from '../types';
import type {Backend, Collection, NewUserInput, Snapshot, UserPatch} from './types';

const TOKEN_KEY = 'luma-convex-token';
const DEVICE_KEY = 'luma-convex-device';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Без хранилища вход не переживёт перезагрузку страницы.
  }
}

/** Случайный идентификатор браузера: по нему сервер ограничивает перебор пароля. */
function deviceId(): string {
  let id = readStorage(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    writeStorage(DEVICE_KEY, id);
  }
  return id;
}

/** Понятное сообщение из серверной ошибки: пользовательские тексты приходят как ConvexError. */
function explain(error: unknown): Error {
  if (error instanceof ConvexError && typeof error.data === 'string') {
    return new Error(error.data);
  }
  return new Error('Не удалось выполнить действие. Проверьте соединение и попробуйте ещё раз.');
}

async function run<T>(task: Promise<T>): Promise<T> {
  try {
    return await task;
  } catch (error) {
    throw explain(error);
  }
}

export function createConvexBackend(url: string): Backend {
  const client = new ConvexClient(url);
  const token = () => readStorage(TOKEN_KEY) ?? '';

  // Convex не принимает undefined в полях: убираем их, как это делает JSON.
  const clean = <T,>(row: T): T => JSON.parse(JSON.stringify(row));

  return {
    mode: 'convex',

    async getSession() {
      const saved = token();
      if (!saved) return null;
      try {
        const user = await client.query(api.auth.me, {token: saved});
        if (!user) writeStorage(TOKEN_KEY, null);
        return user as AppUser | null;
      } catch {
        return null;
      }
    },

    async signIn(password) {
      const result = await run(
        client.action(api.authNode.signIn, {password, deviceId: deviceId()}),
      );
      writeStorage(TOKEN_KEY, result.token);
      return result.user as AppUser;
    },

    async signOut() {
      const saved = token();
      writeStorage(TOKEN_KEY, null);
      if (saved) await client.mutation(api.auth.signOut, {token: saved}).catch(() => {});
    },

    async loadSnapshot() {
      return (await run(client.query(api.data.snapshot, {token: token()}))) as unknown as Snapshot;
    },

    subscribe(onChange) {
      return client.onUpdate(
        api.data.snapshot,
        {token: token()},
        snapshot => onChange(snapshot as unknown as Snapshot),
        () => {},
      );
    },

    async upsert(collection: Collection, row) {
      const args = {token: token(), row: clean(row)} as never;
      switch (collection) {
        case 'catalog':
          await run(client.mutation(api.data.saveCatalogItem, args));
          break;
        case 'kits':
          await run(client.mutation(api.data.saveKit, args));
          break;
        case 'clients':
          await run(client.mutation(api.data.saveClient, args));
          break;
        case 'orders':
          await run(client.mutation(api.data.saveOrder, args));
          break;
        case 'events':
          await run(client.mutation(api.data.saveEvent, args));
          break;
      }
    },

    async remove(collection, id) {
      await run(client.mutation(api.data.remove, {token: token(), collection, id}));
    },

    async applyReturnAct(eventId: string, act: ReturnAct) {
      await run(
        client.mutation(api.data.applyReturnAct, {token: token(), eventId, act: clean(act)}),
      );
    },

    async listPeople() {
      return (await run(client.query(api.auth.listPeople, {token: token()}))) as AppUser[];
    },

    async createUser(input: NewUserInput) {
      if (input.role === 'admin') throw new Error('Администратора здесь создать нельзя');
      await run(
        client.action(api.authNode.createUser, {
          token: token(),
          name: input.name,
          role: input.role,
          password: input.password,
        }),
      );
    },

    async updateUser(id, patch: UserPatch) {
      await run(
        client.action(api.authNode.updateUser, {
          token: token(),
          id,
          name: patch.name,
          role: patch.role === 'admin' ? undefined : patch.role,
          active: patch.active,
          password: patch.password,
        }),
      );
    },

    async deleteUser(id) {
      await run(client.mutation(api.auth.deleteUser, {token: token(), id}));
    },
  };
}
