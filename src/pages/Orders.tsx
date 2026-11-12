import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {DateInput} from '@astryxdesign/core/DateInput';
import type {DateInputProps} from '@astryxdesign/core/DateInput';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Icon} from '@astryxdesign/core/Icon';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {Link} from '@astryxdesign/core/Link';
import {MoreMenu} from '@astryxdesign/core/MoreMenu';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {Selector} from '@astryxdesign/core/Selector';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {Text} from '@astryxdesign/core/Text';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {PlusIcon} from '@heroicons/react/24/outline';
import {FormDialog} from '../components/FormDialog';
import {PageFrame} from '../components/PageFrame';
import {
  CURRENCY,
  FORMAT_LABEL,
  FORMAT_OPTIONS,
  ORDER_STATUS,
  addDaysISO,
  formatDateShort,
  money,
  newId,
  todayISO,
} from '../lib/format';
import {useStore} from '../lib/store';
import type {EventFormat, Order} from '../lib/types';

type ISODate = NonNullable<DateInputProps['value']>;

const SOURCES = ['Сайт', 'Звонок', 'Instagram', 'Telegram', 'Рекомендация'];

type Draft = {
  contactName: string;
  phone: string;
  source: string;
  format: EventFormat;
  date: string;
  guests: number;
  budget: number | null;
  comment: string;
};

const emptyDraft = (): Draft => ({
  contactName: '',
  phone: '',
  source: SOURCES[0],
  format: 'banquet',
  date: addDaysISO(14),
  guests: 30,
  budget: null,
  comment: '',
});

export default function Orders() {
  const {orders, clients, saveOrder, saveClient, setOrderStatus} = useStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('active');
  const [draft, setDraft] = useState<Draft | null>(null);

  const visible = orders
    .filter(order =>
      filter === 'all'
        ? true
        : filter === 'active'
          ? order.status === 'new' || order.status === 'in_work'
          : order.status === 'converted' || order.status === 'rejected',
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const patch = (changes: Partial<Draft>) =>
    setDraft(prev => (prev ? {...prev, ...changes} : prev));

  const submit = () => {
    if (!draft) return;
    saveOrder({
      ...draft,
      id: newId('or'),
      status: 'new',
      eventId: null,
      createdAt: todayISO(),
    });
    setDraft(null);
  };

  /** Заявка превращается в мероприятие: клиент заводится в базе, мастер открывается с её данными. */
  const convert = (order: Order) => {
    const known = clients.some(client => client.phone === order.phone);
    if (!known) {
      saveClient({
        id: newId('c'),
        name: order.contactName,
        company: '',
        phone: order.phone,
        email: '',
      });
    }
    if (order.status === 'new') setOrderStatus(order.id, 'in_work');
    navigate(`/events/new?order=${order.id}`);
  };

  const columns: TableColumn<Order>[] = [
    {
      key: 'contactName',
      header: 'Контакт',
      width: proportional(2, {minWidth: 160}),
      renderCell: order => (
        <VStack gap={0.5}>
          <Text type="body" weight="medium">
            {order.contactName}
          </Text>
          <Text type="supporting" color="secondary">
            {order.phone} · {order.source}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'format',
      header: 'Запрос',
      width: proportional(3, {minWidth: 200}),
      renderCell: order => (
        <VStack gap={0.5}>
          <Text type="body">
            {FORMAT_LABEL[order.format]}, {order.guests} гостей
          </Text>
          {order.comment ? (
            <Text type="supporting" color="secondary" maxLines={2}>
              {order.comment}
            </Text>
          ) : null}
        </VStack>
      ),
    },
    {
      key: 'date',
      header: 'Дата',
      width: pixel(120),
      renderCell: order => formatDateShort(order.date),
    },
    {
      key: 'budget',
      header: 'Бюджет',
      width: pixel(120),
      align: 'end',
      renderCell: order => (order.budget ? money(order.budget) : '—'),
    },
    {
      key: 'status',
      header: 'Статус',
      width: pixel(180),
      renderCell: order => (
        <Badge
          variant={ORDER_STATUS[order.status].tone}
          label={ORDER_STATUS[order.status].label}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      width: pixel(225),
      align: 'end',
      renderCell: order =>
        order.status === 'converted' && order.eventId ? (
          <Link href={`/events/${order.eventId}`}>Открыть мероприятие</Link>
        ) : (
          <HStack gap={1} vAlign="center" hAlign="end">
            <Button
              label="Создать мероприятие"
              size="sm"
              variant={order.status === 'rejected' ? 'secondary' : 'primary'}
              onClick={() => convert(order)}
            />
            <MoreMenu
              size="sm"
              label="Действия с заявкой"
              items={[
                {
                  label: 'Взять в работу',
                  onClick: () => setOrderStatus(order.id, 'in_work'),
                },
                {
                  label: 'Вернуть в новые',
                  onClick: () => setOrderStatus(order.id, 'new'),
                },
                {
                  label: 'Отказ',
                  onClick: () => setOrderStatus(order.id, 'rejected'),
                },
              ]}
            />
          </HStack>
        ),
    },
  ];

  return (
    <PageFrame
      title="Заявки"
      subtitle="Входящие запросы клиентов — отсюда они превращаются в мероприятия"
      actions={
        <Button
          label="Новая заявка"
          variant="primary"
          icon={<Icon icon={PlusIcon} size="sm" />}
          onClick={() => setDraft(emptyDraft())}
        />
      }>
      <HStack>
        <SegmentedControl
          label="Фильтр заявок"
          value={filter}
          onChange={setFilter}>
          <SegmentedControlItem value="active" label="Активные" />
          <SegmentedControlItem value="closed" label="Закрытые" />
          <SegmentedControlItem value="all" label="Все" />
        </SegmentedControl>
      </HStack>

      <Card padding={0}>
        {visible.length > 0 ? (
          <Table
            data={visible}
            columns={columns}
            idKey="id"
            hasHover
            verticalAlign="top"
          />
        ) : (
          <EmptyState
            title="Заявок нет"
            description="Запишите входящий запрос, чтобы он не потерялся."
            actions={
              <Button
                label="Новая заявка"
                variant="secondary"
                onClick={() => setDraft(emptyDraft())}
              />
            }
          />
        )}
      </Card>

      <FormDialog
        isOpen={draft !== null}
        title="Новая заявка"
        subtitle="Запишите, что хочет клиент — детали уточните позже"
        submitLabel="Добавить заявку"
        isSubmitDisabled={
          !draft || !draft.contactName.trim() || !draft.phone.trim()
        }
        onClose={() => setDraft(null)}
        onSubmit={submit}>
        {draft ? (
          <>
            <TextInput
              label="Имя контакта"
              isRequired
              value={draft.contactName}
              onChange={contactName => patch({contactName})}
            />
            <HStack gap={3}>
              <TextInput
                label="Телефон"
                type="tel"
                isRequired
                width="100%"
                value={draft.phone}
                onChange={phone => patch({phone})}
              />
              <Selector
                label="Источник"
                width="100%"
                options={SOURCES}
                value={draft.source}
                onChange={source => patch({source})}
              />
            </HStack>
            <HStack gap={3}>
              <Selector
                label="Формат"
                width="100%"
                options={FORMAT_OPTIONS}
                value={draft.format}
                onChange={format => patch({format: format as EventFormat})}
              />
              <DateInput
                label="Желаемая дата"
                width="100%"
                value={draft.date as ISODate}
                onChange={date => patch({date: date ?? ''})}
              />
            </HStack>
            <HStack gap={3}>
              <NumberInput
                label="Гостей"
                width="100%"
                min={1}
                isIntegerOnly
                value={draft.guests}
                onChange={guests => patch({guests})}
              />
              <NumberInput
                label="Бюджет"
                width="100%"
                isOptional
                hasClear
                min={0}
                units={CURRENCY}
                value={draft.budget}
                onChange={budget => patch({budget})}
              />
            </HStack>
            <TextArea
              label="Комментарий"
              isOptional
              value={draft.comment}
              onChange={comment => patch({comment})}
            />
          </>
        ) : null}
      </FormDialog>
    </PageFrame>
  );
}
