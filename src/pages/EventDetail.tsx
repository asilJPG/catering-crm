import {useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Divider} from '@astryxdesign/core/Divider';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Grid} from '@astryxdesign/core/Grid';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {Selector} from '@astryxdesign/core/Selector';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {Heading, Text} from '@astryxdesign/core/Text';
import {PageFrame} from '../components/PageFrame';
import {ReturnActDialog, stockLines} from '../components/ReturnActDialog';
import {
  EVENT_STATUS,
  EVENT_STATUS_OPTIONS,
  FORMAT_LABEL,
  KIND_LABEL,
  KIND_ORDER,
  eventEnd,
  eventTotals,
  formatDate,
  isReserving,
  shortagesFor,
  money,
} from '../lib/format';
import {useStore} from '../lib/store';
import type {EventStatus} from '../lib/types';

type Row = {
  id: string;
  name: string;
  category: string;
  unit: string;
  qty: number;
  price: number;
  sum: number;
};

const columns: TableColumn<Row>[] = [
  {key: 'name', header: 'Позиция', width: proportional(3, {minWidth: 220})},
  {key: 'category', header: 'Категория', width: proportional(2, {minWidth: 140})},
  {
    key: 'qty',
    header: 'Кол-во',
    width: pixel(120),
    align: 'end',
    renderCell: row => `${row.qty} ${row.unit}`,
  },
  {
    key: 'price',
    header: 'Цена',
    width: pixel(120),
    align: 'end',
    renderCell: row => money(row.price),
  },
  {
    key: 'sum',
    header: 'Сумма',
    width: pixel(130),
    align: 'end',
    renderCell: row => money(row.sum),
  },
];

function MoneyRow({
  label,
  value,
  isStrong,
}: {
  label: string;
  value: string;
  isStrong?: boolean;
}) {
  return (
    <HStack hAlign="between" vAlign="center" gap={3}>
      <Text type="body" color={isStrong ? 'primary' : 'secondary'}>
        {label}
      </Text>
      <Text type="body" weight={isStrong ? 'semibold' : 'normal'} hasTabularNumbers>
        {value}
      </Text>
    </HStack>
  );
}

export default function EventDetail() {
  const {eventId} = useParams();
  const navigate = useNavigate();
  const {events, reservations, clients, catalog, setEventStatus, removeEvent, saveReturnAct} =
    useStore();
  const [isRemoving, setIsRemoving] = useState(false);
  const [shortages, setShortages] = useState<string[] | null>(null);
  const [isActOpen, setIsActOpen] = useState(false);

  const event = events.find(entry => entry.id === eventId);
  if (!event) {
    return (
      <PageFrame title="Мероприятие не найдено">
        <EmptyState
          title="Такого мероприятия нет"
          description="Возможно, оно было удалено."
          actions={
            <Button label="К списку мероприятий" variant="secondary" href="/events" />
          }
        />
      </PageFrame>
    );
  }

  const client = clients.find(entry => entry.id === event.clientId);
  const totals = eventTotals(event, catalog);
  const byId = new Map(catalog.map(item => [item.id, item]));
  const stockIds = new Set(catalog.filter(item => item.stock !== null).map(item => item.id));
  const hasStockLines = stockLines(event, stockIds).length > 0;
  const canReturn =
    !event.returnAct &&
    hasStockLines &&
    event.status !== 'draft' &&
    event.status !== 'cancelled';
  const act = event.returnAct;
  const actDamage = act
    ? act.lines.reduce(
        (sum, line) =>
          sum + Math.max(line.issued - line.returned, 0) * (byId.get(line.itemId)?.price ?? 0),
        0,
      )
    : 0;

  const rowsFor = (kind: (typeof KIND_ORDER)[number]): Row[] =>
    event.lines.flatMap(line => {
      const item = byId.get(line.itemId);
      if (!item || item.kind !== kind) return [];
      return [
        {
          id: item.id,
          name: item.name,
          category: item.category,
          unit: item.unit,
          qty: line.qty,
          price: item.price,
          sum: item.price * line.qty,
        },
      ];
    });

  return (
    <PageFrame
      title={event.title}
      subtitle={`${FORMAT_LABEL[event.format]} · ${eventEnd(event) !== event.date ? `${formatDate(event.date)} — ${formatDate(eventEnd(event))}` : formatDate(event.date)}, ${event.startTime}–${event.endTime}`}
      titleEnd={
        <Badge
          variant={EVENT_STATUS[event.status].tone}
          label={EVENT_STATUS[event.status].label}
        />
      }
      actions={
        <>
          <Selector
            label="Статус"
            isLabelHidden
            variant="secondary"
            width={180}
            options={EVENT_STATUS_OPTIONS}
            value={event.status}
            onChange={value => {
              const status = value as EventStatus;
              if (isReserving(status)) {
                const missing = shortagesFor(event, reservations, catalog);
                if (missing.length > 0) {
                  setShortages(missing);
                  return;
                }
              }
              setEventStatus(event.id, status);
            }}
          />
          <Button
            label="Смета PDF"
            variant="secondary"
            href={`/events/${event.id}/estimate`}
          />
          {canReturn ? (
            <Button
              label="Акт возврата"
              variant="secondary"
              onClick={() => setIsActOpen(true)}
            />
          ) : null}
          <Button
            label="Удалить"
            variant="ghost"
            onClick={() => setIsRemoving(true)}
          />
          <Button
            label="Редактировать"
            variant="primary"
            href={`/events/${event.id}/edit`}
          />
        </>
      }>
      <Grid columns={{minWidth: 340, repeat: 'fit'}} gap={4}>
        <Card>
          <VStack gap={4}>
            <Heading level={3}>Детали</Heading>
            <MetadataList columns="single">
              <MetadataListItem label="Клиент">
                {client
                  ? `${client.name}${client.company ? `, ${client.company}` : ''}`
                  : '—'}
              </MetadataListItem>
              <MetadataListItem label="Телефон">
                {client?.phone || '—'}
              </MetadataListItem>
              <MetadataListItem label="Ответственный">
                {event.responsible || '—'}
              </MetadataListItem>
              <MetadataListItem label="Площадка">
                {event.venue || '—'}
              </MetadataListItem>
              <MetadataListItem label="Гостей">{event.guests}</MetadataListItem>
              <MetadataListItem label="Заметки">
                {event.notes || '—'}
              </MetadataListItem>
            </MetadataList>
          </VStack>
        </Card>

        <Card>
          <VStack gap={3}>
            <Heading level={3}>Смета</Heading>
            {KIND_ORDER.map(kind => (
              <MoneyRow
                key={kind}
                label={KIND_LABEL[kind]}
                value={money(totals.byKind[kind])}
              />
            ))}
            {event.discount > 0 ? (
              <MoneyRow
                label={`Скидка ${event.discount}%`}
                value={`−${money(totals.discountAmount)}`}
              />
            ) : null}
            <Divider />
            <MoneyRow label="Итого" value={money(totals.total)} isStrong />
            <MoneyRow label="На гостя" value={money(totals.perGuest)} />
            <ProgressBar
              label={`Оплачено ${money(event.prepaid)}, осталось ${money(Math.max(totals.due, 0))}`}
              value={Math.min(event.prepaid, totals.total)}
              max={Math.max(totals.total, 1)}
              variant={totals.due <= 0 ? 'success' : 'accent'}
            />
          </VStack>
        </Card>
      </Grid>

      {act ? (
        <Card>
          <VStack gap={3}>
            <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
              <Heading level={3}>Акт возврата</Heading>
              <Text type="supporting" color="secondary">
                Сдал {act.responsible} · {formatDate(act.date)}
              </Text>
            </HStack>
            <Table
              data={act.lines.map(line => ({
                id: line.itemId,
                name: byId.get(line.itemId)?.name ?? '—',
                issued: line.issued,
                returned: line.returned,
                lost: Math.max(line.issued - line.returned, 0),
                note: line.note,
              }))}
              columns={[
                {key: 'name', header: 'Позиция', width: proportional(3, {minWidth: 200})},
                {key: 'issued', header: 'Выдано', width: pixel(90), align: 'end'},
                {key: 'returned', header: 'Вернулось', width: pixel(100), align: 'end'},
                {
                  key: 'lost',
                  header: 'Не вернулось',
                  width: pixel(120),
                  align: 'end',
                  renderCell: row =>
                    row.lost > 0 ? <Badge variant="error" label={String(row.lost)} /> : '—',
                },
                {key: 'note', header: 'Причина', width: proportional(2, {minWidth: 160})},
              ]}
              idKey="id"
              density="compact"
            />
            {act.comment ? (
              <Text type="supporting" color="secondary">
                {act.comment}
              </Text>
            ) : null}
            <Text type="body" weight="medium">
              {actDamage > 0
                ? `Списано со склада на сумму ${money(actDamage)}`
                : 'Всё вернулось, потерь нет'}
            </Text>
          </VStack>
        </Card>
      ) : null}

      {isActOpen ? (
        <ReturnActDialog
          event={event}
          onClose={() => setIsActOpen(false)}
          onSubmit={result => {
            saveReturnAct(event.id, result);
            setIsActOpen(false);
          }}
        />
      ) : null}

      {event.lines.length === 0 ? (
        <Card>
          <EmptyState
            title="В мероприятии пока пусто"
            description="Добавьте блюда, мебель и персонал, чтобы получить смету."
            actions={
              <Button
                label="Заполнить"
                variant="secondary"
                href={`/events/${event.id}/edit`}
              />
            }
          />
        </Card>
      ) : (
        KIND_ORDER.map(kind => {
          const rows = rowsFor(kind);
          if (rows.length === 0) return null;
          return (
            <Card key={kind}>
              <VStack gap={3}>
                <HStack hAlign="between" vAlign="center">
                  <Heading level={3}>{KIND_LABEL[kind]}</Heading>
                  <Text type="body" weight="semibold" hasTabularNumbers>
                    {money(totals.byKind[kind])}
                  </Text>
                </HStack>
                <Table data={rows} columns={columns} idKey="id" density="compact" />
              </VStack>
            </Card>
          );
        })
      )}

      <AlertDialog
        isOpen={shortages !== null}
        onOpenChange={open => {
          if (!open) setShortages(null);
        }}
        title="Нельзя подтвердить: не хватает на складе"
        description={(shortages ?? []).join('; ')}
        actionLabel="Понятно"
        actionVariant="primary"
        onAction={() => setShortages(null)}
      />

      <AlertDialog
        isOpen={isRemoving}
        onOpenChange={setIsRemoving}
        title="Удалить мероприятие?"
        description={`«${event.title}» будет удалено вместе со сметой. Это действие нельзя отменить.`}
        cancelLabel="Отмена"
        actionLabel="Удалить"
        actionVariant="destructive"
        onAction={() => {
          removeEvent(event.id);
          navigate('/events');
        }}
      />
    </PageFrame>
  );
}
