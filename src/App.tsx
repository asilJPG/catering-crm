import type {ComponentProps, ReactElement} from 'react';
import {
  Link as RouterLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import {Theme} from '@astryxdesign/core/theme';
import {InternationalizationProvider} from '@astryxdesign/core/i18n';
import ruRU from '@astryxdesign/core/locales/ru-RU.generated.js';
import {LinkProvider} from '@astryxdesign/core/Link';
import {AppShell} from '@astryxdesign/core/AppShell';
import {
  SideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
} from '@astryxdesign/core/SideNav';
import {NavIcon} from '@astryxdesign/core/NavIcon';
import {Icon} from '@astryxdesign/core/Icon';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Center} from '@astryxdesign/core/Center';
import {Spinner} from '@astryxdesign/core/Spinner';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';
import {
  ArrowRightStartOnRectangleIcon,
  CalendarDaysIcon,
  CalendarIcon,
  HomeIcon,
  KeyIcon,
  InboxArrowDownIcon,
  PlusIcon,
  SparklesIcon,
  Squares2X2Icon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import {AuthProvider, useAuth, useCurrentUser} from './lib/auth';
import {ROLE_LABEL} from './lib/permissions';
import {StoreProvider, useStore} from './lib/store';
import Calendar from './pages/Calendar';
import Estimate from './pages/Estimate';
import Login from './pages/Login';
import Users from './pages/Users';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import EventWizard from './pages/EventWizard';
import Catalog from './pages/Catalog';
import Clients from './pages/Clients';

/** Astryx-ссылки передают `href`; для переходов без перезагрузки отдаём его роутеру. */
function AppLink({
  href,
  ...rest
}: Omit<ComponentProps<typeof RouterLink>, 'to'> & {href?: string}) {
  if (!href || /^(https?:|mailto:|tel:)/.test(href)) {
    return <a href={href} {...rest} />;
  }
  return <RouterLink to={href} {...rest} />;
}

function Navigation() {
  const {pathname} = useLocation();
  const {orders} = useStore();
  const {user, can} = useCurrentUser();
  const {signOut} = useAuth();
  const newOrders = orders.filter(order => order.status === 'new').length;
  const isAt = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  return (
    <SideNav
      collapsible
      footer={
        <SideNavSection title="Аккаунт" isHeaderHidden>
          <SideNavItem
            label={user.name}
            icon={UsersIcon}
            endContent={<Badge variant="neutral" label={ROLE_LABEL[user.role]} />}
          />
          <SideNavItem
            label="Выйти"
            icon={ArrowRightStartOnRectangleIcon}
            onClick={() => signOut()}
          />
        </SideNavSection>
      }
      header={
        <SideNavHeading
          heading="Luma Catering"
          icon={<NavIcon icon={<Icon icon={SparklesIcon} size="sm" />} />}
          headingHref="/"
        />
      }>
      <SideNavSection title="Действия" isHeaderHidden>
        <SideNavItem
          label="Новое мероприятие"
          icon={PlusIcon}
          href="/events/new"
          isSelected={pathname === '/events/new'}
        />
      </SideNavSection>
      <SideNavSection title="Работа">
        <SideNavItem
          label="Обзор"
          icon={HomeIcon}
          href="/"
          isSelected={isAt('/')}
        />
        <SideNavItem
          label="Заявки"
          icon={InboxArrowDownIcon}
          href="/orders"
          isSelected={isAt('/orders')}
          endContent={
            newOrders > 0 ? (
              <Badge variant="info" label={String(newOrders)} />
            ) : undefined
          }
        />
        <SideNavItem
          label="Календарь"
          icon={CalendarIcon}
          href="/calendar"
          isSelected={isAt('/calendar')}
        />
        <SideNavItem
          label={can.viewAllEvents ? 'Мероприятия' : 'Мои мероприятия'}
          icon={CalendarDaysIcon}
          href="/events"
          isSelected={isAt('/events') && pathname !== '/events/new'}
        />
      </SideNavSection>
      <SideNavSection title="База">
        <SideNavItem
          label="Каталог"
          icon={Squares2X2Icon}
          href="/catalog"
          isSelected={isAt('/catalog')}
        />
        <SideNavItem
          label="Клиенты"
          icon={UsersIcon}
          href="/clients"
          isSelected={isAt('/clients')}
        />
      </SideNavSection>
      {can.manageUsers ? (
        <SideNavSection title="Администрирование">
          <SideNavItem
            label="Сотрудники"
            icon={KeyIcon}
            href="/users"
            isSelected={isAt('/users')}
          />
        </SideNavSection>
      ) : null}
    </SideNav>
  );
}

function Shell() {
  const {can} = useCurrentUser();
  const {syncError, dismissSyncError} = useStore();
  const allowed = (ok: boolean, page: ReactElement) =>
    ok ? page : <Navigate to="/" replace />;

  return (
    <Routes>
      <Route path="/events/:eventId/estimate" element={<Estimate />} />
      <Route
        path="*"
        element={
          <AppShell
            contentPadding={0}
            sideNav={<Navigation />}
            banner={
              syncError ? (
                <Banner
                  status="error"
                  title="Изменения не сохранены"
                  description={syncError}
                  onDismiss={dismissSyncError}
                />
              ) : undefined
            }>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/new" element={<EventWizard key="new" />} />
              <Route path="/events/:eventId" element={<EventDetail />} />
              <Route path="/events/:eventId/edit" element={<EventWizard key="edit" />} />
              <Route path="/catalog" element={<Catalog />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/users" element={allowed(can.manageUsers, <Users />)} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  );
}

function Gate() {
  const {user, isLoading} = useAuth();
  if (isLoading) {
    return (
      <Center height="100%">
        <Spinner label="Загрузка" />
      </Center>
    );
  }
  if (!user) return <Login />;
  return (
    <StoreProvider key={user.id}>
      <Shell />
    </StoreProvider>
  );
}

export default function App() {
  return (
    <InternationalizationProvider locale="ru-RU" messages={{'ru-RU': ruRU}}>
      <Theme theme={neutralTheme} mode="light">
        <LinkProvider component={AppLink}>
          <AuthProvider>
            <Gate />
          </AuthProvider>
        </LinkProvider>
      </Theme>
    </InternationalizationProvider>
  );
}
