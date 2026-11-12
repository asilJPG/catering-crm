import {useParams} from 'react-router-dom';
import {Button} from '@astryxdesign/core/Button';
import {Divider} from '@astryxdesign/core/Divider';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {Heading, Text} from '@astryxdesign/core/Text';
import {
  FORMAT_LABEL,
  KIND_LABEL,
  KIND_ORDER,
  eventEnd,
  eventTotals,
  formatDate,
  money,
} from '../lib/format';
import {useStore} from '../lib/store';

type Row = {id: string; name: string; qty: string; price: string; sum: string};

const columns: TableColumn<Row>[] = [
  {key: 'name', header: 'Позиция', width: proportional(4, {minWidth: 220})},
  {key: 'qty', header: 'Кол-во', width: pixel(110), align: 'end'},
  {key: 'price', header: 'Цена', width: pixel(130), align: 'end'},
  {key: 'sum', header: 'Сумма', width: pixel(140), align: 'end'},
];

function Line({label, value, isStrong}: {label: string; value: string; isStrong?: boolean}) {
  return (
    <HStack hAlign="between" gap={4}>
      <Text type="body" weight={isStrong ? 'semibold' : 'normal'}>
        {label}
      </Text>
      <Text type="body" weight={isStrong ? 'semibold' : 'normal'} hasTabularNumbers>
        {value}
      </Text>
    </HStack>
  );
}

/** Смета на отдельной странице без меню: «Сохранить PDF» открывает печать, где выбирается PDF. */
export default function Estimate() {
  const {eventId} = useParams();
  const {events, clients, catalog, people} = useStore();
  const event = events.find(entry => entry.id === eventId);

  if (!event) {
    return (
      <EmptyState
        title="Мероприятие не найдено"
        actions={<Button label="К мероприятиям" variant="secondary" href="/events" />}
      />
    );
  }

  const client = clients.find(entry => entry.id === event.clientId);
  const totals = eventTotals(event, catalog);
  const byId = new Map(catalog.map(item => [item.id, item]));
  const manager = people.find(person => person.id === event.createdBy);
  const end = eventEnd(event);

  return (
    <div className="estimate-page">
      <div className="no-print estimate-toolbar">
        <HStack gap={2} hAlign="between" vAlign="center">
          <Button label="Назад" variant="secondary" href={`/events/${event.id}`} />
          <Button label="Сохранить PDF" variant="primary" onClick={() => window.print()} />
        </HStack>
        <Text type="supporting" color="secondary">
          В окне печати выберите «Сохранить как PDF».
        </Text>
      </div>

      <div className="estimate-sheet">
        <VStack gap={5}>
          <HStack hAlign="between" vAlign="start" gap={4}>
            <VStack gap={1}>
              <Heading level={2}>Luma Catering</Heading>
              <Text type="supporting" color="secondary">
                Коммерческое предложение
              </Text>
            </VStack>
            <VStack gap={0.5}>
              <Text type="body" weight="semibold">
                Смета № {event.id.slice(-6).toUpperCase()}
              </Text>
              <Text type="supporting" color="secondary">
                от {formatDate(event.createdAt)}
              </Text>
            </VStack>
          </HStack>

          <Divider />

          <VStack gap={2}>
            <Heading level={3}>{event.title}</Heading>
            <Text type="body">
              {FORMAT_LABEL[event.format]} ·{' '}
              {end !== event.date
                ? `${formatDate(event.date)} — ${formatDate(end)}`
                : formatDate(event.date)}
              , {event.startTime}–{event.endTime}
            </Text>
            {event.venue ? <Text type="body">Площадка: {event.venue}</Text> : null}
            <Text type="body">Гостей: {event.guests}</Text>
            {client ? (
              <Text type="body">
                Заказчик: {client.name}
                {client.company ? `, ${client.company}` : ''}
                {client.phone ? `, ${client.phone}` : ''}
              </Text>
            ) : null}
            {manager ? <Text type="body">Ваш менеджер: {manager.name}</Text> : null}
          </VStack>

          {KIND_ORDER.map(kind => {
            const rows: Row[] = event.lines.flatMap(line => {
              const item = byId.get(line.itemId);
              if (!item || item.kind !== kind) return [];
              return [
                {
                  id: item.id,
                  name: item.name,
                  qty: `${line.qty} ${item.unit}`,
                  price: money(item.price),
                  sum: money(item.price * line.qty),
                },
              ];
            });
            if (rows.length === 0) return null;
            return (
              <VStack gap={2} key={kind}>
                <HStack hAlign="between">
                  <Heading level={4}>{KIND_LABEL[kind]}</Heading>
                  <Text type="body" weight="semibold" hasTabularNumbers>
                    {money(totals.byKind[kind])}
                  </Text>
                </HStack>
                <Table data={rows} columns={columns} idKey="id" density="compact" />
              </VStack>
            );
          })}

          <Divider />

          <VStack gap={2}>
            <Line label="Сумма по позициям" value={money(totals.subtotal)} />
            {event.discount > 0 ? (
              <Line label={`Скидка ${event.discount}%`} value={`−${money(totals.discountAmount)}`} />
            ) : null}
            <Line label="Итого" value={money(totals.total)} isStrong />
            <Line label="Стоимость на гостя" value={money(totals.perGuest)} />
            {event.prepaid > 0 ? (
              <>
                <Line label="Предоплата" value={money(event.prepaid)} />
                <Line label="К оплате" value={money(Math.max(totals.due, 0))} isStrong />
              </>
            ) : null}
          </VStack>

          {event.notes ? (
            <VStack gap={1}>
              <Text type="label" color="secondary">
                Пожелания
              </Text>
              <Text type="body">{event.notes}</Text>
            </VStack>
          ) : null}

          <Text type="supporting" color="secondary">
            Предложение действительно 7 дней. Мебель и посуда предоставляются на период
            мероприятия; недостающее по акту возврата оплачивается по стоимости из сметы.
          </Text>
        </VStack>
      </div>
    </div>
  );
}
