import {useMemo, useState} from 'react';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {ClickableCard} from '@astryxdesign/core/ClickableCard';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Grid} from '@astryxdesign/core/Grid';
import {Icon} from '@astryxdesign/core/Icon';
import {IconButton} from '@astryxdesign/core/IconButton';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {Link} from '@astryxdesign/core/Link';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {StackItem} from '@astryxdesign/core/Stack';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Heading, Text} from '@astryxdesign/core/Text';
import {ChevronLeftIcon, ChevronRightIcon} from '@heroicons/react/24/outline';
import {PageFrame} from '../components/PageFrame';
import {
  EVENT_STATUS,
  FORMAT_LABEL,
  eventEnd,
  formatDate,
  reservedOnDay,
  toISODate,
  todayISO,
} from '../lib/format';
import {useStore} from '../lib/store';
import type {CateringEvent, EventStatus} from '../lib/types';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const DOT: Record<EventStatus, 'neutral' | 'accent' | 'warning' | 'success' | 'error'> = {
  draft: 'neutral',
  confirmed: 'accent',
  in_progress: 'warning',
  done: 'success',
  cancelled: 'error',
};

/** Недели месяца, начиная с понедельника, — только полные недели, чтобы сетка была ровной. */
function monthCells(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  return Array.from({length: weeks * 7}, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return toISODate(day);
  });
}

export default function Calendar() {
  const {events, catalog, reservations, clients} = useStore();
  const today = todayISO();
  const now = new Date();
  const [cursor, setCursor] = useState({year: now.getFullYear(), month: now.getMonth()});
  const [selected, setSelected] = useState(today);

  const cells = useMemo(() => monthCells(cursor.year, cursor.month), [cursor]);
  const monthTitle = new Date(cursor.year, cursor.month, 1).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });

  const stockItems = useMemo(() => catalog.filter(item => item.stock !== null), [catalog]);

  const activeEvents = events.filter(event => event.status !== 'cancelled');
  const eventsOn = (day: string): CateringEvent[] =>
    activeEvents.filter(event => day >= event.date && day <= eventEnd(event));

  /** Самая загруженная позиция склада в день: доля занятого от всего. */
  const peakLoad = (day: string) => {
    let peak = 0;
    for (const item of stockItems) {
      if (!item.stock) continue;
      peak = Math.max(peak, reservedOnDay(reservations, item.id, day) / item.stock);
    }
    return peak;
  };

  const shift = (delta: number) =>
    setCursor(prev => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return {year: next.getFullYear(), month: next.getMonth()};
    });

  const clientName = (id: string) => clients.find(client => client.id === id)?.name ?? '—';

  const selectedEvents = eventsOn(selected);
  const usage = stockItems
    .map(item => ({
      item,
      reserved: reservedOnDay(reservations, item.id, selected),
    }))
    .filter(entry => entry.reserved > 0)
    .sort((a, b) => b.reserved / (b.item.stock ?? 1) - a.reserved / (a.item.stock ?? 1));

  return (
    <PageFrame
      title="Календарь"
      subtitle="Занятость площадок и склада по дням"
      actions={
        <HStack gap={2} vAlign="center">
          <IconButton
            label="Предыдущий месяц"
            variant="secondary"
            icon={<Icon icon={ChevronLeftIcon} size="sm" />}
            onClick={() => shift(-1)}
          />
          <Button
            label="Сегодня"
            variant="secondary"
            onClick={() => {
              setCursor({year: now.getFullYear(), month: now.getMonth()});
              setSelected(today);
            }}
          />
          <IconButton
            label="Следующий месяц"
            variant="secondary"
            icon={<Icon icon={ChevronRightIcon} size="sm" />}
            onClick={() => shift(1)}
          />
        </HStack>
      }>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <Heading level={3}>{monthTitle}</Heading>
        <HStack gap={4} wrap="wrap">
          {(Object.keys(DOT) as EventStatus[])
            .filter(status => status !== 'cancelled')
            .map(status => (
              <Badge key={status} variant={EVENT_STATUS[status].tone} label={EVENT_STATUS[status].label} />
            ))}
        </HStack>
      </HStack>

      <VStack gap={2}>
        <Grid columns={7} gap={2}>
          {WEEKDAYS.map(day => (
            <Text key={day} type="supporting" color="secondary">
              {day}
            </Text>
          ))}
        </Grid>
        <Grid columns={7} gap={2}>
          {cells.map(day => {
            const dayEvents = eventsOn(day);
            const inMonth = Number(day.slice(5, 7)) - 1 === cursor.month;
            const load = peakLoad(day);
            return (
              <ClickableCard
                key={day}
                label={`${formatDate(day)}: мероприятий ${dayEvents.length}`}
                padding={2}
                variant={day === selected ? 'blue' : load >= 1 ? 'red' : load >= 0.8 ? 'yellow' : 'default'}
                onClick={() => setSelected(day)}>
                <VStack gap={1}>
                  <HStack hAlign="between" vAlign="center">
                    <Text
                      type="label"
                      weight={day === today ? 'bold' : 'medium'}
                      color={inMonth ? 'primary' : 'disabled'}>
                      {Number(day.slice(8))}
                    </Text>
                    {load > 0 ? (
                      <Text type="supporting" color={load >= 0.8 ? 'primary' : 'secondary'}>
                        склад {Math.round(load * 100)}%
                      </Text>
                    ) : null}
                  </HStack>
                  {dayEvents.slice(0, 2).map(event => (
                    <HStack key={event.id} gap={1} vAlign="center">
                      <StatusDot variant={DOT[event.status]} label={EVENT_STATUS[event.status].label} />
                      <Text type="supporting" maxLines={1}>
                        {event.title}
                      </Text>
                    </HStack>
                  ))}
                  {dayEvents.length > 2 ? (
                    <Text type="supporting" color="secondary">
                      ещё {dayEvents.length - 2}
                    </Text>
                  ) : null}
                </VStack>
              </ClickableCard>
            );
          })}
        </Grid>
      </VStack>

      <Grid columns={{minWidth: 360, repeat: 'fit'}} gap={4}>
        <Card>
          <VStack gap={3}>
            <Heading level={3}>{formatDate(selected)}</Heading>
            {selectedEvents.length === 0 ? (
              <EmptyState
                isCompact
                title="В этот день мероприятий нет"
                description="Можно планировать новое."
                actions={<Button label="Новое мероприятие" variant="secondary" href="/events/new" />}
              />
            ) : (
              selectedEvents.map(event => (
                <HStack key={event.id} gap={3} vAlign="start" hAlign="between">
                  <StackItem size="fill">
                    <VStack gap={0.5}>
                      <Link href={`/events/${event.id}`}>{event.title}</Link>
                      <Text type="supporting" color="secondary">
                        {FORMAT_LABEL[event.format]} · {clientName(event.clientId)} · {event.guests} гостей
                      </Text>
                      <Text type="supporting" color="secondary">
                        {event.startTime}–{event.endTime}
                        {event.venue ? ` · ${event.venue}` : ''}
                      </Text>
                    </VStack>
                  </StackItem>
                  <Badge
                    variant={EVENT_STATUS[event.status].tone}
                    label={EVENT_STATUS[event.status].label}
                  />
                </HStack>
              ))
            )}
          </VStack>
        </Card>

        <Card>
          <VStack gap={3}>
            <VStack gap={1}>
              <Heading level={3}>Склад в этот день</Heading>
              <Text type="supporting" color="secondary">
                Занято подтверждёнными мероприятиями, включая чужие
              </Text>
            </VStack>
            {usage.length === 0 ? (
              <Text type="supporting" color="secondary">
                Мебель и посуда в этот день свободны.
              </Text>
            ) : (
              usage.map(({item, reserved}) => {
                const stock = item.stock ?? 0;
                const isFull = reserved >= stock;
                return (
                  <ProgressBar
                    key={item.id}
                    label={`${item.name}: занято ${reserved} из ${stock}`}
                    value={Math.min(reserved, stock)}
                    max={Math.max(stock, 1)}
                    variant={isFull ? 'error' : reserved / Math.max(stock, 1) >= 0.8 ? 'warning' : 'accent'}
                  />
                );
              })
            )}
          </VStack>
        </Card>
      </Grid>
    </PageFrame>
  );
}
