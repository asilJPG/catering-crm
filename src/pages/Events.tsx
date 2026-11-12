import {useState} from 'react';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Icon} from '@astryxdesign/core/Icon';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {Link} from '@astryxdesign/core/Link';
import {Selector} from '@astryxdesign/core/Selector';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {MagnifyingGlassIcon, PlusIcon} from '@heroicons/react/24/outline';
import {PageFrame} from '../components/PageFrame';
import {
  EVENT_STATUS,
  EVENT_STATUS_OPTIONS,
  FORMAT_LABEL,
  eventEnd,
  eventTotals,
  formatDateShort,
  money,
} from '../lib/format';
import {useCurrentUser} from '../lib/auth';
import {useStore} from '../lib/store';
import type {CateringEvent} from '../lib/types';

export default function Events() {
  const {events, clients, catalog, people} = useStore();
  const {can} = useCurrentUser();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');

  const clientName = (id: string) =>
    clients.find(client => client.id === id)?.name ?? '—';

  const needle = query.trim().toLowerCase();
  const visible = events
    .filter(event => status === 'all' || event.status === status)
    .filter(
      event =>
        !needle ||
        event.title.toLowerCase().includes(needle) ||
        event.venue.toLowerCase().includes(needle) ||
        clientName(event.clientId).toLowerCase().includes(needle),
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const columns: TableColumn<CateringEvent>[] = [
    {
      key: 'title',
      header: 'Мероприятие',
      width: proportional(3, {minWidth: 260}),
      renderCell: event => (
        <VStack gap={0.5}>
          <Link href={`/events/${event.id}`}>{event.title}</Link>
          <Text type="supporting" color="secondary">
            {FORMAT_LABEL[event.format]} · {event.venue || 'площадка не указана'}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'date',
      header: 'Дата',
      width: pixel(170),
      renderCell: event => (
        <VStack gap={0.5}>
          <Text type="body">
            {formatDateShort(event.date)}
            {eventEnd(event) !== event.date ? ` — ${formatDateShort(eventEnd(event))}` : ''}
          </Text>
          <Text type="supporting" color="secondary">
            {event.startTime}–{event.endTime}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'clientId',
      header: 'Клиент',
      width: proportional(2, {minWidth: 160}),
      renderCell: event => clientName(event.clientId),
    },
    ...(can.viewAllEvents
      ? [
          {
            key: 'createdBy',
            header: 'Менеджер',
            width: pixel(150),
            renderCell: event =>
              people.find(person => person.id === event.createdBy)?.name ?? '—',
          } satisfies TableColumn<CateringEvent>,
        ]
      : []),
    {key: 'guests', header: 'Гости', width: pixel(80), align: 'end'},
    {
      key: 'menu',
      header: 'Меню',
      width: pixel(160),
      align: 'end',
      renderCell: event => {
        const dishes = event.lines.filter(
          line => catalog.find(item => item.id === line.itemId)?.kind === 'dish',
        ).length;
        return dishes > 0 ? (
          <VStack gap={0.5}>
            <Text type="body">{money(eventTotals(event, catalog).byKind.dish)}</Text>
            <Text type="supporting" color="secondary">
              {dishes} блюд
            </Text>
          </VStack>
        ) : (
          '—'
        );
      },
    },
    {
      key: 'total',
      header: 'Сумма',
      width: pixel(140),
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

  return (
    <PageFrame
      title={can.viewAllEvents ? 'Мероприятия' : 'Мои мероприятия'}
      subtitle={
        can.viewAllEvents
          ? 'Все события с меню, мебелью, персоналом и сметой'
          : 'Мероприятия, которые вы создали'
      }
      actions={
        <Button
          label="Новое мероприятие"
          variant="primary"
          href="/events/new"
          icon={<Icon icon={PlusIcon} size="sm" />}
        />
      }>
      <HStack gap={3} vAlign="end" wrap="wrap">
        <TextInput
          label="Поиск"
          isLabelHidden
          type="search"
          width={320}
          placeholder="Название, площадка или клиент"
          startIcon={MagnifyingGlassIcon}
          hasClear
          value={query}
          onChange={setQuery}
        />
        <Selector
          label="Статус"
          isLabelHidden
          width={200}
          options={[
            {value: 'all', label: 'Все статусы'},
            ...EVENT_STATUS_OPTIONS,
          ]}
          value={status}
          onChange={setStatus}
        />
      </HStack>

      <Card padding={0}>
        {visible.length > 0 ? (
          <Table data={visible} columns={columns} idKey="id" hasHover />
        ) : (
          <EmptyState
            title="Ничего не найдено"
            description="Измените фильтры или создайте новое мероприятие."
            actions={
              <Button
                label="Новое мероприятие"
                variant="secondary"
                href="/events/new"
              />
            }
          />
        )}
      </Card>
    </PageFrame>
  );
}
