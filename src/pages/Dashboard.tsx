import {Button} from '@astryxdesign/core/Button';
import {Badge} from '@astryxdesign/core/Badge';
import {Card} from '@astryxdesign/core/Card';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Grid} from '@astryxdesign/core/Grid';
import {Icon} from '@astryxdesign/core/Icon';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {Link} from '@astryxdesign/core/Link';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {Heading, Text} from '@astryxdesign/core/Text';
import {PlusIcon} from '@heroicons/react/24/outline';
import {PageFrame} from '../components/PageFrame';
import {
  EVENT_STATUS,
  FORMAT_LABEL,
  eventEnd,
  eventTotals,
  formatDateShort,
  money,
  todayISO,
} from '../lib/format';
import {useStore} from '../lib/store';
import type {CateringEvent, Order} from '../lib/types';

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <VStack gap={2}>
        <Text type="label" color="secondary">
          {label}
        </Text>
        <Heading level={2}>{value}</Heading>
        <Text type="supporting" color="secondary">
          {hint}
        </Text>
      </VStack>
    </Card>
  );
}

export default function Dashboard() {
  const {events, orders, catalog, clients} = useStore();
  const today = todayISO();

  const upcoming = events
    .filter(event => event.date >= today && event.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date));
  const newOrders = orders.filter(order => order.status === 'new');
  const booked = upcoming.filter(event => event.status !== 'draft');
  const bookedRevenue = booked.reduce(
    (sum, event) => sum + eventTotals(event, catalog).total,
    0,
  );
  const toCollect = booked.reduce(
    (sum, event) => sum + Math.max(eventTotals(event, catalog).due, 0),
    0,
  );
  const stockIds = new Set(catalog.filter(item => item.stock !== null).map(item => item.id));
  const awaitingAct = events.filter(
    event =>
      (event.status === 'confirmed' || event.status === 'in_progress') &&
      eventEnd(event) < today &&
      !event.returnAct &&
      event.lines.some(line => stockIds.has(line.itemId)),
  );
  const guests = upcoming.reduce((sum, event) => sum + event.guests, 0);

  const clientName = (id: string) =>
    clients.find(client => client.id === id)?.name ?? '—';

  const eventColumns: TableColumn<CateringEvent>[] = [
    {
      key: 'title',
      header: 'Мероприятие',
      width: proportional(3, {minWidth: 220}),
      renderCell: event => (
        <VStack gap={0.5}>
          <Link href={`/events/${event.id}`}>{event.title}</Link>
          <Text type="supporting" color="secondary">
            {FORMAT_LABEL[event.format]} · {clientName(event.clientId)}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'date',
      header: 'Дата',
      width: pixel(150),
      renderCell: event => `${formatDateShort(event.date)}, ${event.startTime}`,
    },
    {key: 'guests', header: 'Гости', width: pixel(80), align: 'end'},
    {
      key: 'total',
      header: 'Сумма',
      width: pixel(130),
      align: 'end',
      renderCell: event => money(eventTotals(event, catalog).total),
    },
    {
      key: 'status',
      header: 'Статус',
      width: pixel(150),
      renderCell: event => (
        <Badge
          variant={EVENT_STATUS[event.status].tone}
          label={EVENT_STATUS[event.status].label}
        />
      ),
    },
  ];

  const orderColumns: TableColumn<Order>[] = [
    {
      key: 'contactName',
      header: 'Контакт',
      width: proportional(2, {minWidth: 160}),
      renderCell: order => (
        <VStack gap={0.5}>
          <Text type="body">{order.contactName}</Text>
          <Text type="supporting" color="secondary">
            {order.phone}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'format',
      header: 'Запрос',
      width: proportional(2, {minWidth: 160}),
      renderCell: order =>
        `${FORMAT_LABEL[order.format]}, ${order.guests} гостей`,
    },
    {
      key: 'date',
      header: 'Дата',
      width: pixel(120),
      renderCell: order => formatDateShort(order.date),
    },
  ];

  return (
    <PageFrame
      title="Обзор"
      subtitle="Что происходит в кейтеринге сегодня"
      actions={
        <Button
          label="Новое мероприятие"
          variant="primary"
          href="/events/new"
          icon={<Icon icon={PlusIcon} size="sm" />}
        />
      }>
      {awaitingAct.length > 0 ? (
        <Card variant="yellow">
          <VStack gap={2}>
            <Heading level={4}>
              Ждут акта возврата: {awaitingAct.length}
            </Heading>
            <Text type="supporting" color="secondary">
              Мероприятие прошло, а мебель и посуда ещё не сданы — склад не знает, сколько вернулось.
            </Text>
            {awaitingAct.map(event => (
              <HStack key={event.id} gap={2} hAlign="between" vAlign="center">
                <Link href={`/events/${event.id}`}>{event.title}</Link>
                <Text type="supporting" color="secondary">
                  {event.responsible ? `Ответственный: ${event.responsible}` : 'Ответственный не указан'}
                </Text>
              </HStack>
            ))}
          </VStack>
        </Card>
      ) : null}

      <Grid columns={{minWidth: 220, repeat: 'fit'}} gap={4}>
        <Metric
          label="Новые заявки"
          value={String(newOrders.length)}
          hint="ждут ответа менеджера"
        />
        <Metric
          label="Мероприятий впереди"
          value={String(upcoming.length)}
          hint={`${guests} гостей суммарно`}
        />
        <Metric
          label="Подтверждённая выручка"
          value={money(bookedRevenue)}
          hint="по предстоящим мероприятиям"
        />
        <Metric
          label="К получению"
          value={money(toCollect)}
          hint="остаток после предоплат"
        />
      </Grid>

      <Grid columns={{minWidth: 420, repeat: 'fit'}} gap={4}>
        <Card>
          <VStack gap={3}>
            <HStack hAlign="between" vAlign="center">
              <Heading level={3}>Ближайшие мероприятия</Heading>
              <Link href="/events">Все мероприятия</Link>
            </HStack>
            {upcoming.length > 0 ? (
              <Table
                data={upcoming.slice(0, 6)}
                columns={eventColumns}
                idKey="id"
                hasHover
              />
            ) : (
              <EmptyState
                isCompact
                title="Пока ничего не запланировано"
                description="Создайте мероприятие или переведите в него заявку."
              />
            )}
          </VStack>
        </Card>
        <Card>
          <VStack gap={3}>
            <HStack hAlign="between" vAlign="center">
              <Heading level={3}>Новые заявки</Heading>
              <Link href="/orders">Все заявки</Link>
            </HStack>
            {newOrders.length > 0 ? (
              <Table
                data={newOrders.slice(0, 6)}
                columns={orderColumns}
                idKey="id"
                hasHover
              />
            ) : (
              <EmptyState
                isCompact
                title="Новых заявок нет"
                description="Все входящие заявки разобраны."
              />
            )}
          </VStack>
        </Card>
      </Grid>
    </PageFrame>
  );
}
