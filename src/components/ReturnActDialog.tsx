import {useMemo, useState} from 'react';
import {DateInput} from '@astryxdesign/core/DateInput';
import type {DateInputProps} from '@astryxdesign/core/DateInput';
import {Divider} from '@astryxdesign/core/Divider';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {StackItem} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {todayISO} from '../lib/format';
import {useStore} from '../lib/store';
import type {CateringEvent, ReturnAct} from '../lib/types';
import {FormDialog} from './FormDialog';

type ISODate = NonNullable<DateInputProps['value']>;

/** Позиции мероприятия, которые считаются на складе (мебель, посуда, оборудование). */
export function stockLines(event: CateringEvent, stockIds: Set<string>) {
  return event.lines.filter(line => stockIds.has(line.itemId));
}

export function ReturnActDialog({
  event,
  onClose,
  onSubmit,
}: {
  event: CateringEvent;
  onClose: () => void;
  onSubmit: (act: ReturnAct) => void;
}) {
  const {catalog} = useStore();
  const byId = useMemo(() => new Map(catalog.map(item => [item.id, item])), [catalog]);
  const lines = useMemo(
    () =>
      stockLines(
        event,
        new Set(catalog.filter(item => item.stock !== null).map(item => item.id)),
      ),
    [event, catalog],
  );

  const [responsible, setResponsible] = useState(event.responsible ?? '');
  const [date, setDate] = useState<string>(todayISO());
  const [comment, setComment] = useState('');
  const [returned, setReturned] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map(line => [line.itemId, line.qty])),
  );
  const [notes, setNotes] = useState<Record<string, string>>({});

  const lostOf = (itemId: string, issued: number) =>
    Math.max(issued - (returned[itemId] ?? issued), 0);
  const missingNote = lines.some(
    line => lostOf(line.itemId, line.qty) > 0 && !(notes[line.itemId] ?? '').trim(),
  );
  const totalLost = lines.reduce((sum, line) => sum + lostOf(line.itemId, line.qty), 0);

  return (
    <FormDialog
      isOpen
      width={640}
      title="Акт возврата"
      subtitle={`${event.title} — укажите, сколько позиций вернулось на склад`}
      submitLabel="Подписать акт"
      isSubmitDisabled={!responsible.trim() || missingNote}
      onClose={onClose}
      onSubmit={() =>
        onSubmit({
          date,
          responsible: responsible.trim(),
          comment: comment.trim(),
          lines: lines.map(line => ({
            itemId: line.itemId,
            issued: line.qty,
            returned: Math.min(returned[line.itemId] ?? line.qty, line.qty),
            note: (notes[line.itemId] ?? '').trim(),
          })),
        })
      }>
      <HStack gap={3} vAlign="start">
        <StackItem size="fill">
          <TextInput
            label="Кто сдаёт (ответственный)"
            isRequired
            value={responsible}
            onChange={setResponsible}
          />
        </StackItem>
        <DateInput
          label="Дата возврата"
          value={date as ISODate}
          onChange={value => setDate(value ?? todayISO())}
        />
      </HStack>

      <Divider />

      {lines.map(line => {
        const item = byId.get(line.itemId);
        if (!item) return null;
        const lost = lostOf(line.itemId, line.qty);
        return (
          <VStack gap={2} key={line.itemId}>
            <HStack gap={3} vAlign="center" hAlign="between">
              <StackItem size="fill">
                <VStack gap={0.5}>
                  <Text type="body" weight="medium">
                    {item.name}
                  </Text>
                  <Text type="supporting" color="secondary">
                    Выдано: {line.qty} {item.unit}
                  </Text>
                </VStack>
              </StackItem>
              <NumberInput
                label={`Вернулось: ${item.name}`}
                isLabelHidden
                width={130}
                min={0}
                max={line.qty}
                isIntegerOnly
                hasNumberSteppers
                value={returned[line.itemId] ?? line.qty}
                onChange={value =>
                  setReturned(prev => ({...prev, [line.itemId]: value}))
                }
              />
            </HStack>
            {lost > 0 ? (
              <TextInput
                label={`Не вернулось ${lost} — что случилось?`}
                isRequired
                placeholder="Разбито, потеряно, осталось на площадке"
                value={notes[line.itemId] ?? ''}
                onChange={value =>
                  setNotes(prev => ({...prev, [line.itemId]: value}))
                }
              />
            ) : null}
          </VStack>
        );
      })}

      <Divider />
      <TextArea
        label="Комментарий к акту"
        isOptional
        value={comment}
        onChange={setComment}
      />
      <Text type="supporting" color="secondary">
        {totalLost > 0
          ? `Недостающее (${totalLost} шт.) будет списано со склада, мероприятие закроется.`
          : 'Всё вернулось полностью — мероприятие закроется, позиции освободятся.'}
      </Text>
    </FormDialog>
  );
}
