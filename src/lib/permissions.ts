import type {Role} from './types';

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Администратор',
  director: 'Директор',
  manager: 'Менеджер',
};

/** Роли, которые админ может выдавать при создании пользователя. */
export const ASSIGNABLE_ROLES: Role[] = ['manager', 'director', 'admin'];

/** Что разрешено роли. Сервер (RLS в Supabase) проверяет то же самое независимо от интерфейса. */
export function permissionsFor(role: Role) {
  const isPrivileged = role === 'admin' || role === 'director';
  return {
    /** Видит мероприятия всех, а не только созданные самим. */
    viewAllEvents: isPrivileged,
    /** Добавляет и меняет позиции каталога и комплекты. */
    editCatalog: isPrivileged,
    /** Меняет существующих клиентов. */
    editClients: isPrivileged,
    /** Заводит новых клиентов — нужно менеджеру, чтобы оформить мероприятие. */
    addClients: true,
    manageUsers: role === 'admin',
  };
}
