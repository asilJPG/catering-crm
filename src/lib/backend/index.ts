import {localBackend} from './local';
import {createSupabaseBackend} from './supabase';
import type {Backend} from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Supabase включается, когда в .env заданы адрес проекта и публичный ключ; иначе — локальный режим. */
export const backend: Backend = url && anonKey ? createSupabaseBackend(url, anonKey) : localBackend;

export * from './types';
