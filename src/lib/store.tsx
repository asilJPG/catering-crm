import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {Center} from '@astryxdesign/core/Center';
import {Spinner} from '@astryxdesign/core/Spinner';
import {useCurrentUser} from './auth';
import {backend, type Collection} from './backend';
import {reservationsFromEvents} from './format';
import type {
  AppUser,
  CatalogItem,
  CateringEvent,
  Client,
  Database,
  EventStatus,
  Kit,
  Order,
  OrderStatus,
  Reservation,
  ReturnAct,
} from './types';

const COLLECTIONS: Collection[] = ['catalog', 'kits', 'clients', 'events', 'orders'];

type Store = Database & {
  /** Люди системы — чтобы показывать, кто создал мероприятие. */
  people: AppUser[];
  /** Занятость склада всеми подтверждёнными мероприятиями, включая чужие. */
  reservations: Reservation[];
  syncError: string | null;
  dismissSyncError: () => void;
  saveCatalogItem: (item: CatalogItem) => void;
  removeCatalogItem: (id: string) => void;
  saveKit: (kit: Kit) => void;
  removeKit: (id: string) => void;
  saveClient: (client: Client) => void;
  saveEvent: (event: CateringEvent) => void;
  removeEvent: (id: string) => void;
  setEventStatus: (id: string, status: EventStatus) => void;
  saveReturnAct: (eventId: string, act: ReturnAct) => void;
  saveOrder: (order: Order) => void;
  setOrderStatus: (id: string, status: OrderStatus) => void;
};

const StoreContext = createContext<Store | null>(null);

function upsert<T extends {id: string}>(list: T[], value: T): T[] {
  return list.some(entry => entry.id === value.id)
    ? list.map(entry => (entry.id === value.id ? value : entry))
    : [value, ...list];
}

type Op = {kind: 'upsert'; collection: Collection; row: {id: string}} | {kind: 'remove'; collection: Collection; id: string};

/** Что изменилось между двумя состояниями: по ссылкам на строки, без глубокого сравнения. */
function diff(prev: Database, next: Database, skip: Collection[]): Op[] {
  const ops: Op[] = [];
  for (const collection of COLLECTIONS) {
    if (skip.includes(collection)) continue;
    const before = new Map((prev[collection] as {id: string}[]).map(row => [row.id, row]));
    const after = next[collection] as {id: string}[];
    const seen = new Set<string>();
    for (const row of after) {
      seen.add(row.id);
      if (before.get(row.id) !== row) ops.push({kind: 'upsert', collection, row});
    }
    for (const id of before.keys()) {
      if (!seen.has(id)) ops.push({kind: 'remove', collection, id});
    }
  }
  return ops;
}

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'Не удалось сохранить изменения';

export function StoreProvider({children}: {children: ReactNode}) {
  const {user} = useCurrentUser();
  const [db, setDb] = useState<Database | null>(null);
  const [people, setPeople] = useState<AppUser[]>([]);
  const [extraReservations, setExtraReservations] = useState<Reservation[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);

  const synced = useRef<Database | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);

  const enqueue = useCallback((task: () => Promise<void>) => {
    pending.current += 1;
    queue.current = queue.current
      .then(task)
      .catch(error => setSyncError(errorText(error)))
      .finally(() => {
        pending.current -= 1;
      });
  }, []);

  const refreshReservations = useCallback(() => {
    backend.loadReservations().then(setExtraReservations).catch(() => {});
  }, []);

  const refreshAll = useCallback(async () => {
    const [data, reservations, list] = await Promise.all([
      backend.loadData(user),
      backend.loadReservations(),
      backend.listPeople(),
    ]);
    synced.current = data;
    setDb(data);
    setExtraReservations(reservations);
    setPeople(list);
  }, [user]);

  useEffect(() => {
    refreshAll().catch(error => setSyncError(errorText(error)));
  }, [refreshAll]);

  // Когда вкладку открывают снова, подтягиваем изменения коллег, если своё уже сохранено.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && pending.current === 0) {
        refreshAll().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshAll]);

  // Любое изменение состояния уходит в хранилище. Менеджер каталог не пишет: по акту — отдельная функция.
  useEffect(() => {
    if (!db || !synced.current || db === synced.current) return;
    const ops = diff(
      synced.current,
      db,
      user.role === 'manager' ? ['catalog', 'kits'] : [],
    );
    synced.current = db;
    if (ops.length === 0) return;
    enqueue(async () => {
      for (const op of ops) {
        if (op.kind === 'upsert') await backend.upsert(op.collection, op.row);
        else await backend.remove(op.collection, op.id);
      }
      refreshReservations();
    });
  }, [db, user.role, enqueue, refreshReservations]);

  const update = useCallback(
    (change: (prev: Database) => Database) =>
      setDb(prev => (prev ? change(prev) : prev)),
    [],
  );

  const saveCatalogItem = useCallback(
    (item: CatalogItem) => update(prev => ({...prev, catalog: upsert(prev.catalog, item)})),
    [update],
  );

  const removeCatalogItem = useCallback(
    (id: string) =>
      update(prev => ({
        ...prev,
        catalog: prev.catalog.filter(item => item.id !== id),
        kits: prev.kits.map(kit =>
          kit.items.some(entry => entry.itemId === id)
            ? {...kit, items: kit.items.filter(entry => entry.itemId !== id)}
            : kit,
        ),
        events: prev.events.map(event =>
          event.lines.some(line => line.itemId === id)
            ? {...event, lines: event.lines.filter(line => line.itemId !== id)}
            : event,
        ),
      })),
    [update],
  );

  const saveKit = useCallback(
    (kit: Kit) => update(prev => ({...prev, kits: upsert(prev.kits, kit)})),
    [update],
  );

  const removeKit = useCallback(
    (id: string) => update(prev => ({...prev, kits: prev.kits.filter(kit => kit.id !== id)})),
    [update],
  );

  const saveClient = useCallback(
    (client: Client) => update(prev => ({...prev, clients: upsert(prev.clients, client)})),
    [update],
  );

  const saveEvent = useCallback(
    (event: CateringEvent) =>
      update(prev => {
        const owned = {...event, createdBy: event.createdBy ?? user.id};
        return {
          ...prev,
          events: upsert(prev.events, owned),
          orders: owned.orderId
            ? prev.orders.map(order =>
                order.id === owned.orderId
                  ? {...order, status: 'converted', eventId: owned.id}
                  : order,
              )
            : prev.orders,
        };
      }),
    [update, user.id],
  );

  const removeEvent = useCallback(
    (id: string) =>
      update(prev => ({
        ...prev,
        events: prev.events.filter(event => event.id !== id),
        orders: prev.orders.map(order =>
          order.eventId === id ? {...order, status: 'in_work', eventId: null} : order,
        ),
      })),
    [update],
  );

  const setEventStatus = useCallback(
    (id: string, status: EventStatus) =>
      update(prev => ({
        ...prev,
        events: prev.events.map(event => (event.id === id ? {...event, status} : event)),
      })),
    [update],
  );

  /** Акт возврата закрывает мероприятие и списывает недостающее со склада. Повторно не применяется. */
  const saveReturnAct = useCallback(
    (eventId: string, act: ReturnAct) => {
      const losses: Record<string, number> = {};
      for (const line of act.lines) {
        const lost = Math.max(line.issued - line.returned, 0);
        if (lost > 0) losses[line.itemId] = lost;
      }
      let applied = false;
      update(prev => {
        const target = prev.events.find(event => event.id === eventId);
        if (!target || target.returnAct) return prev;
        applied = true;
        return {
          ...prev,
          catalog: prev.catalog.map(item =>
            losses[item.id] && item.stock !== null
              ? {...item, stock: Math.max(item.stock - losses[item.id], 0)}
              : item,
          ),
          events: prev.events.map(event =>
            event.id === eventId ? {...event, status: 'done', returnAct: act} : event,
          ),
        };
      });
      // Менеджер не пишет в каталог напрямую — остаток меняет серверная функция.
      queueMicrotask(() => {
        if (applied && user.role === 'manager' && Object.keys(losses).length > 0) {
          enqueue(() => backend.applyLosses(eventId, losses));
        }
      });
    },
    [update, enqueue, user.role],
  );

  const saveOrder = useCallback(
    (order: Order) => update(prev => ({...prev, orders: upsert(prev.orders, order)})),
    [update],
  );

  const setOrderStatus = useCallback(
    (id: string, status: OrderStatus) =>
      update(prev => ({
        ...prev,
        orders: prev.orders.map(order => (order.id === id ? {...order, status} : order)),
      })),
    [update],
  );

  const store = useMemo<Store | null>(() => {
    if (!db) return null;
    const visibleEvents =
      user.role === 'manager'
        ? db.events.filter(event => event.createdBy === user.id)
        : db.events;
    const known = new Set(db.events.map(event => event.id));
    return {
      ...db,
      events: visibleEvents,
      people,
      reservations: [
        ...extraReservations.filter(entry => !known.has(entry.eventId)),
        ...reservationsFromEvents(db.events),
      ],
      syncError,
      dismissSyncError: () => setSyncError(null),
      saveCatalogItem,
      removeCatalogItem,
      saveKit,
      removeKit,
      saveClient,
      saveEvent,
      removeEvent,
      setEventStatus,
      saveReturnAct,
      saveOrder,
      setOrderStatus,
    };
  }, [
    db,
    user.role,
    user.id,
    people,
    extraReservations,
    syncError,
    saveCatalogItem,
    removeCatalogItem,
    saveKit,
    removeKit,
    saveClient,
    saveEvent,
    removeEvent,
    setEventStatus,
    saveReturnAct,
    saveOrder,
    setOrderStatus,
  ]);

  if (!store) {
    return (
      <Center height="100%">
        <Spinner label="Загружаем данные" />
      </Center>
    );
  }
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
