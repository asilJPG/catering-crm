import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import type {AppUser, Database, Reservation} from '../types';
import {
  type Backend,
  type Collection,
  type NewUserInput,
  type UserPatch,
} from './types';

type ProfileRow = {id: string; login: string; name: string; role: AppUser['role']; active: boolean};

const COLLECTIONS: Collection[] = ['catalog', 'kits', 'clients', 'events', 'orders'];

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const client: SupabaseClient = createClient(url, anonKey);

  const fail = (error: {message: string} | null) => {
    if (error) throw new Error(error.message);
  };

  async function profileOf(userId: string): Promise<AppUser | null> {
    const {data, error} = await client
      .from('profiles')
      .select('id, login, name, role, active')
      .eq('id', userId)
      .maybeSingle<ProfileRow>();
    fail(error);
    return data ? {...data} : null;
  }

  async function callAdmin(body: Record<string, unknown>) {
    const {data, error} = await client.functions.invoke('admin-users', {body});
    if (error) {
      // Тело ответа функции содержит понятное сообщение об ошибке.
      const detail = await (error as {context?: Response}).context?.json?.().catch(() => null);
      throw new Error(detail?.error ?? error.message);
    }
    if (data?.error) throw new Error(data.error);
  }

  return {
    mode: 'supabase',

    async getSession() {
      const {data} = await client.auth.getSession();
      if (!data.session) return null;
      const profile = await profileOf(data.session.user.id);
      return profile?.active ? profile : null;
    },

    async signIn(password) {
      // Пароль ищет владельца на сервере (функция password-login) и возвращает готовую сессию.
      const {data, error} = await client.functions.invoke('password-login', {
        body: {password},
      });
      if (error) {
        const detail = await (error as {context?: Response}).context?.json?.().catch(() => null);
        throw new Error(detail?.error ?? 'Не удалось войти. Попробуйте позже.');
      }
      const {error: sessionError} = await client.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) throw new Error('Не удалось войти. Попробуйте позже.');
      const profile = await profileOf(data.user_id);
      if (!profile?.active) {
        await client.auth.signOut();
        throw new Error('Учётная запись отключена. Обратитесь к администратору.');
      }
      return profile;
    },

    async signOut() {
      await client.auth.signOut();
    },

    async loadData() {
      const results = await Promise.all(
        COLLECTIONS.map(name => client.from(name).select('data')),
      );
      const db = {} as Record<Collection, unknown[]>;
      results.forEach((result, index) => {
        fail(result.error);
        db[COLLECTIONS[index]] = (result.data ?? []).map(row => (row as {data: unknown}).data);
      });
      return db as unknown as Database;
    },

    async loadReservations() {
      const {data, error} = await client.rpc('get_reservations');
      fail(error);
      return ((data ?? []) as {event_id: string; item_id: string; qty: number; date: string; end_date: string}[]).map(
        (row): Reservation => ({
          eventId: row.event_id,
          itemId: row.item_id,
          qty: row.qty,
          date: row.date,
          endDate: row.end_date,
        }),
      );
    },

    async upsert(collection, row) {
      fail((await client.from(collection).upsert({id: row.id, data: row})).error);
    },

    async remove(collection, id) {
      fail((await client.from(collection).delete().eq('id', id)).error);
    },

    async applyLosses(eventId, losses) {
      fail((await client.rpc('apply_return_act', {p_event_id: eventId, p_losses: losses})).error);
    },

    async listPeople() {
      const {data, error} = await client
        .from('profiles')
        .select('id, login, name, role, active')
        .order('name');
      fail(error);
      return (data ?? []) as AppUser[];
    },

    async createUser(input: NewUserInput) {
      await callAdmin({
        action: 'create',
        name: input.name,
        role: input.role,
        password: input.password,
      });
    },

    async updateUser(id, patch: UserPatch) {
      await callAdmin({action: 'update', id, ...patch});
    },

    async deleteUser(id) {
      await callAdmin({action: 'delete', id});
    },
  };
}
