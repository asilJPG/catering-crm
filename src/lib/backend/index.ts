import {createConvexBackend} from './convex';
import {localBackend} from './local';
import type {Backend} from './types';

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

/**
 * Convex включается, когда в .env.local задан VITE_CONVEX_URL (его создаёт `npx convex dev`);
 * иначе приложение работает в демо-режиме с данными в браузере.
 */
export const backend: Backend = convexUrl ? createConvexBackend(convexUrl) : localBackend;

export * from './types';
