import {useEffect, useMemo, useState} from 'react';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {DateInput} from '@astryxdesign/core/DateInput';
import type {DateInputProps} from '@astryxdesign/core/DateInput';
import {Divider} from '@astryxdesign/core/Divider';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Grid} from '@astryxdesign/core/Grid';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Stack, StackItem} from '@astryxdesign/core/Stack';
import {useMediaQuery} from '@astryxdesign/core/hooks';
import {Step, Stepper} from '@astryxdesign/core/Stepper';
import {Heading, Text} from '@astryxdesign/core/Text';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {TimeInput} from '@astryxdesign/core/TimeInput';
import type {TimeInputProps} from '@astryxdesign/core/TimeInput';
import {MagnifyingGlassIcon} from '@heroicons/react/24/outline';
import {FormDialog} from '../components/FormDialog';
import {ItemGallery} from '../components/ItemGallery';
import {PageFrame} from '../components/PageFrame';
import {
  CURRENCY,
  FORMAT_LABEL,
  FORMAT_OPTIONS,
  KIND_LABEL,
  KIND_ORDER,
  addDaysISO,
  eventTotals,
  money,
  newId,
  eventEnd,
  freeStock,
  isReserving,
  formatDateShort,
  EVENT_STATUS_OPTIONS,
  todayISO,
} from '../lib/format';
import {useCurrentUser} from '../lib/auth';
import {useStore} from '../lib/store';
import type {
  CatalogItem,
  CateringEvent,
  Client,
  EventFormat,
  Kit,
  ItemKind,
} from '../lib/types';
import {ClientFields} from './Clients';

type ISODate = NonNullable<DateInputProps['value']>;
type ISOTime = NonNullable<TimeInputProps['value']>;

const STEPS: {label: string; kind?: ItemKind}[] = [
  {label: 'Детали'},
  {label: 'Меню', kind: 'dish'},
  {label: 'Мебель', kind: 'furniture'},
  {label: 'Посуда и оборудование', kind: 'equipment'},
  {label: 'Персонал и услуги', kind: 'service'},
  {label: 'Итог'},
];

const STEP_HINT: Record<ItemKind, string> = {
  dish: 'Выберите всё, что нравится клиенту — сумма считается справа.',
  furniture: 'Стулья и столы разных видов. Остаток считается на дату с учётом других мероприятий.',
  equipment: 'Остаток считается на выбранную дату с учётом других мероприятий.',
  service: 'Смены персонала, доставка, монтаж и уборка.',
};

type Draft = {form: CateringEvent; step: number};

/** Черновик живёт в sessionStorage: переходы по страницам и перезагрузка его не сбрасывают. */
function readDraft(key: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function clearDraft(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Хранилище недоступно — нечего чистить.
  }
}

const GALLERY_TITLE: Record<ItemKind, string> = {
  dish: 'Меню',
  furniture: 'Мебель',
  equipment: 'Посуда и оборудование',
  service: 'Персонал и услуги',
};

function ItemPicker({
  kind,
  quantities,
  guests,
  available,
  onChange,
}: {
  kind: ItemKind;
  quantities: Record<string, number>;
  guests: number;
  available: (item: CatalogItem) => number | null;
  onChange: (itemId: string, qty: number) => void;
}) {
  const {catalog} = useStore();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();

  const groups = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const item of catalog) {
      if (item.kind !== kind) continue;
      if (needle && !item.name.toLowerCase().includes(needle)) continue;
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()];
  }, [catalog, kind, needle]);

  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Heading level={3}>{KIND_LABEL[kind]}</Heading>
        <Text type="supporting" color="secondary">
          {STEP_HINT[kind]}
        </Text>
      </VStack>
      <TextInput
        label="Поиск позиции"
        isLabelHidden
        type="search"
        placeholder="Найти позицию"
        startIcon={MagnifyingGlassIcon}
        hasClear
        value={query}
        onChange={setQuery}
      />
      {groups.length === 0 ? (
        <Card>
          <EmptyState
            isCompact
            title="Ничего не найдено"
            description="Измените запрос или добавьте позицию в каталог."
            actions={<Button label="Открыть каталог" variant="secondary" href="/catalog" />}
          />
        </Card>
      ) : null}
      {groups.map(([category, list]) => (
        <Card key={category}>
          <VStack gap={3}>
            <Text type="label" color="secondary">
              {category}
            </Text>
            {list.map((item, index) => {
              const qty = quantities[item.id] ?? 0;
              const free = available(item);
              const isOver = free !== null && qty > free;
              return (
                <VStack gap={3} key={item.id}>
                  {index > 0 ? <Divider /> : null}
                  <HStack gap={3} vAlign="center" hAlign="between">
                    <StackItem size="fill">
                      <VStack gap={0.5}>
                        <Text type="body" weight={qty > 0 ? 'semibold' : 'normal'}>
                          {item.name}
                        </Text>
                        <Text type="supporting" color="secondary">
                          {money(item.price)} / {item.unit}
                          {free !== null ? ` · свободно ${Math.max(free, 0)}` : ''}
                          {qty > 0 ? ` · ${money(qty * item.price)}` : ''}
                        </Text>
                      </VStack>
                    </StackItem>
                    {kind === 'dish' && guests > 0 ? (
                      <Button
                        label="По гостям"
                        variant="ghost"
                        size="sm"
                        onClick={() => onChange(item.id, guests)}
                      />
                    ) : null}
                    <NumberInput
                      label={`Количество: ${item.name}`}
                      isLabelHidden
                      width={130}
                      min={0}
                      isIntegerOnly
                      hasNumberSteppers
                      value={qty}
                      status={
                        isOver
                          ? {type: 'warning', message: `Не хватает ${qty - (free ?? 0)}`}
                          : undefined
                      }
                      onChange={value => onChange(item.id, value)}
                    />
                  </HStack>
                </VStack>
              );
            })}
          </VStack>
        </Card>
      ))}
    </VStack>
  );
}

function SummaryRow({label, value, isStrong}: {label: string; value: string; isStrong?: boolean}) {
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

export default function EventWizard() {
  const {eventId} = useParams();
  const [searchParams] = useSearchParams();
  const isWide = useMediaQuery('(min-width: 1280px)');
  const navigate = useNavigate();
  const {user} = useCurrentUser();
  const {events, reservations, orders, clients, catalog, kits, saveEvent, saveClient} =
    useStore();

  const existing = events.find(event => event.id === eventId);
  const order = orders.find(entry => entry.id === searchParams.get('order'));

  const draftKey = `luma-wizard:${eventId ?? `new:${order?.id ?? ''}`}`;
  const [draft] = useState(() => readDraft(draftKey));

  const [form, setForm] = useState<CateringEvent>(() => {
    if (draft) return draft.form;
    if (existing) return existing;
    const orderClient = order
      ? clients.find(client => client.phone === order.phone)
      : undefined;
    return {
      id: newId('ev'),
      title: order ? `${FORMAT_LABEL[order.format]} — ${order.contactName}` : '',
      clientId: orderClient?.id ?? '',
      format: order?.format ?? 'banquet',
      date: order?.date ?? addDaysISO(14),
      endDate: order?.date ?? addDaysISO(14),
      startTime: '18:00',
      endTime: '23:00',
      venue: '',
      guests: order?.guests ?? 30,
      status: 'draft',
      lines: [],
      discount: 0,
      prepaid: 0,
      notes: order?.comment ?? '',
      responsible: user.name,
      orderId: order?.id ?? null,
      createdAt: todayISO(),
    };
  });
  const [step, setStep] = useState(draft?.step ?? 0);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({form, step}));
    } catch {
      // Без хранилища черновик просто не переживёт перезагрузку.
    }
  }, [draftKey, form, step]);
  const [newClient, setNewClient] = useState<Client | null>(null);

  const patch = (changes: Partial<CateringEvent>) =>
    setForm(prev => ({...prev, ...changes}));

  const quantities = useMemo(
    () => Object.fromEntries(form.lines.map(line => [line.itemId, line.qty])),
    [form.lines],
  );

  const kitQuantities = useMemo(
    () => Object.fromEntries((form.kits ?? []).map(entry => [entry.kitId, entry.qty])),
    [form.kits],
  );

  /** Комплект раскладывается на позиции: они попадают в смету и занимают склад по отдельности. */
  const setKitQty = (kit: Kit, qty: number) =>
    setForm(prev => {
      const current = (prev.kits ?? []).find(entry => entry.kitId === kit.id)?.qty ?? 0;
      const next = Math.max(0, Math.round(qty));
      const delta = next - current;
      if (delta === 0) return prev;
      const amounts = new Map(prev.lines.map(line => [line.itemId, line.qty]));
      for (const entry of kit.items) {
        amounts.set(
          entry.itemId,
          Math.max(0, (amounts.get(entry.itemId) ?? 0) + delta * entry.qty),
        );
      }
      const others = (prev.kits ?? []).filter(entry => entry.kitId !== kit.id);
      return {
        ...prev,
        lines: [...amounts]
          .filter(([, amount]) => amount > 0)
          .map(([itemId, amount]) => ({itemId, qty: amount})),
        kits: next > 0 ? [...others, {kitId: kit.id, qty: next}] : others,
      };
    });

  const setQty = (itemId: string, qty: number) =>
    setForm(prev => {
      const rest = prev.lines.filter(line => line.itemId !== itemId);
      const safe = Number.isFinite(qty) ? Math.max(0, Math.round(qty)) : 0;
      return {...prev, lines: safe > 0 ? [...rest, {itemId, qty: safe}] : rest};
    });

  const available = (item: CatalogItem) =>
    item.stock === null
      ? null
      : freeStock(item, reservations, form.date, eventEnd(form), form.id);

  const totals = eventTotals(form, catalog);
  const byId = new Map(catalog.map(item => [item.id, item]));
  const shortages = form.lines.flatMap(line => {
    const item = byId.get(line.itemId);
    if (!item) return [];
    const free = available(item);
    return free !== null && line.qty > free
      ? [`${item.name}: нужно ${line.qty}, свободно ${Math.max(free, 0)}`]
      : [];
  });

  const errors = {
    title: form.title.trim() ? undefined : 'Назовите мероприятие',
    clientId: form.clientId ? undefined : 'Выберите клиента',
    date: form.date ? undefined : 'Укажите дату',
    guests: form.guests > 0 ? undefined : 'Гостей должно быть больше нуля',
  };
  const isDetailsValid = Object.values(errors).every(error => !error);
  const errorFor = (key: keyof typeof errors) =>
    showErrors && errors[key]
      ? ({type: 'error', message: errors[key]} as const)
      : undefined;

  const goTo = (next: number) => {
    setStep(Math.min(Math.max(next, 0), STEPS.length - 1));
  };

  const save = () => {
    if (!isDetailsValid) {
      // Обязательные поля проверяем только при сохранении, а не при переходах между шагами.
      setShowErrors(true);
      setStep(0);
      return;
    }
    if (isReserving(form.status) && shortages.length > 0) {
      // Нельзя занять больше, чем есть на складе: показываем, чего не хватает.
      setStep(STEPS.length - 1);
      return;
    }
    clearDraft(draftKey);
    saveEvent({...form, title: form.title.trim()});
    navigate(`/events/${form.id}`);
  };

  const countFor = (kind: ItemKind) =>
    form.lines.filter(line => byId.get(line.itemId)?.kind === kind).length;

  const dishLines = form.lines.filter(line => byId.get(line.itemId)?.kind === 'dish');
  const summary = (
    <Card width={isWide ? 320 : '100%'}>
          <VStack gap={3}>
            <Heading level={3}>Смета</Heading>
            <Text type="supporting" color="secondary">
              {form.guests} гостей · {FORMAT_LABEL[form.format]}
            </Text>
            {KIND_ORDER.map(kind => (
              <SummaryRow
                key={kind}
                label={KIND_LABEL[kind]}
                value={money(totals.byKind[kind])}
              />
            ))}
            {form.discount > 0 ? (
              <SummaryRow
                label={`Скидка ${form.discount}%`}
                value={`−${money(totals.discountAmount)}`}
              />
            ) : null}
            <Divider />
            <SummaryRow label="Итого" value={money(totals.total)} isStrong />
            <SummaryRow label="На гостя" value={money(totals.perGuest)} />
            {form.prepaid > 0 ? (
              <SummaryRow label="К доплате" value={money(Math.max(totals.due, 0))} />
            ) : null}
            {dishLines.length > 0 ? (
              <>
                <Divider />
                <Text type="label" color="secondary">
                  Выбранное меню
                </Text>
                {dishLines.map(line => (
                  <HStack key={line.itemId} hAlign="between" gap={2} vAlign="start">
                    <Text type="supporting">
                      {byId.get(line.itemId)?.name} × {line.qty}
                    </Text>
                    <Text type="supporting" color="secondary" hasTabularNumbers>
                      {money((byId.get(line.itemId)?.price ?? 0) * line.qty)}
                    </Text>
                  </HStack>
                ))}
              </>
            ) : null}
          </VStack>
        </Card>
  );
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <PageFrame
      title={existing ? 'Редактирование мероприятия' : 'Новое мероприятие'}
      subtitle={
        order && !existing
          ? `По заявке: ${order.contactName}, ${order.phone}`
          : 'Детали, меню, мебель, посуда и персонал — в одной смете'
      }
      actions={
        <Button
          label="Отмена"
          variant="ghost"
          href={existing ? `/events/${existing.id}` : '/events'}
          onClick={() => clearDraft(draftKey)}
        />
      }>
      <Stepper activeStep={step} onStepClick={goTo} label="Шаги создания мероприятия">
        {STEPS.map((entry, index) => (
          <Step
            key={entry.label}
            step={index}
            label={entry.label}
            description={
              entry.kind && countFor(entry.kind) > 0
                ? `Выбрано: ${countFor(entry.kind)}`
                : undefined
            }
          />
        ))}
      </Stepper>

      <Stack direction={isWide ? 'horizontal' : 'vertical'} gap={6} vAlign="start">
        <StackItem size="fill">
          <VStack gap={4}>
            {step === 0 ? (
              <Card>
                <VStack gap={4}>
                  <Heading level={3}>Детали мероприятия</Heading>
                  <TextInput
                    label="Название"
                    isRequired
                    placeholder="Например: Юбилей компании"
                    value={form.title}
                    status={errorFor('title')}
                    onChange={title => patch({title})}
                  />
                  <HStack gap={3} vAlign="end">
                    <StackItem size="fill">
                      <Selector
                        label="Клиент"
                        isRequired
                        hasSearch
                        placeholder="Выберите клиента"
                        options={clients.map(client => ({
                          value: client.id,
                          label: client.name,
                          description: client.company || client.phone,
                        }))}
                        value={form.clientId}
                        status={errorFor('clientId')}
                        onChange={clientId => patch({clientId})}
                      />
                    </StackItem>
                    <Button
                      label="Новый клиент"
                      variant="secondary"
                      onClick={() =>
                        setNewClient({id: '', name: '', company: '', phone: '', email: ''})
                      }
                    />
                  </HStack>
                  <Grid columns={{minWidth: 200, repeat: 'fit'}} gap={3}>
                    <Selector
                      label="Формат"
                      options={FORMAT_OPTIONS}
                      value={form.format}
                      onChange={format => patch({format: format as EventFormat})}
                    />
                    <NumberInput
                      label="Гостей"
                      isRequired
                      min={1}
                      isIntegerOnly
                      value={form.guests}
                      status={errorFor('guests')}
                      onChange={guests => patch({guests})}
                    />
                  </Grid>
                  <Grid columns={{minWidth: 160, repeat: 'fit'}} gap={3}>
                    <DateInput
                      label="Дата"
                      isRequired
                      value={(form.date || undefined) as ISODate | undefined}
                      status={errorFor('date')}
                      onChange={date =>
                        patch({
                          date: date ?? '',
                          endDate:
                            date && (form.endDate ?? '') >= date
                              ? form.endDate
                              : (date ?? ''),
                        })
                      }
                    />
                    <DateInput
                      label="Дата окончания"
                      description="До неё мебель и посуда заняты"
                      value={(eventEnd(form) || undefined) as ISODate | undefined}
                      min={(form.date || undefined) as ISODate | undefined}
                      onChange={endDate => patch({endDate: endDate ?? form.date})}
                    />
                    <TimeInput
                      label="Начало"
                      hourFormat="24h"
                      value={form.startTime as ISOTime}
                      onChange={startTime => patch({startTime: startTime ?? ''})}
                    />
                    <TimeInput
                      label="Окончание"
                      hourFormat="24h"
                      value={form.endTime as ISOTime}
                      onChange={endTime => patch({endTime: endTime ?? ''})}
                    />
                  </Grid>
                  <TextInput
                    label="Ответственный за мероприятие"
                    description="Он сдаёт акт возврата мебели и посуды после мероприятия"
                    isOptional
                    placeholder="Имя сотрудника"
                    value={form.responsible ?? ''}
                    onChange={responsible => patch({responsible})}
                  />
                  <TextInput
                    label="Площадка"
                    isOptional
                    placeholder="Адрес или название зала"
                    value={form.venue}
                    onChange={venue => patch({venue})}
                  />
                  <TextArea
                    label="Заметки"
                    isOptional
                    placeholder="Аллергии, пожелания, время заезда"
                    value={form.notes}
                    onChange={notes => patch({notes})}
                  />
                </VStack>
              </Card>
            ) : null}

            {/* Шаги с позициями остаются в дереве и только скрываются: поиск и вкладки не сбрасываются. */}
            {STEPS.map(entry =>
              entry.kind ? (
                <div key={entry.kind} hidden={current.kind !== entry.kind}>
                  {entry.kind === 'service' ? (
                    <ItemPicker
                      kind={entry.kind}
                      quantities={quantities}
                      guests={form.guests}
                      available={available}
                      onChange={setQty}
                    />
                  ) : (
                    <ItemGallery
                      kind={entry.kind}
                      title={GALLERY_TITLE[entry.kind]}
                      hint={
                        entry.kind === 'dish'
                          ? STEP_HINT.dish
                          : `Свободно на ${formatDateShort(form.date)}${eventEnd(form) !== form.date ? ` — ${formatDateShort(eventEnd(form))}` : ''} с учётом подтверждённых мероприятий.`
                      }
                      quantities={quantities}
                      guests={form.guests}
                      available={available}
                      onChange={setQty}
                      kits={entry.kind === 'furniture' ? kits : undefined}
                      kitQuantities={kitQuantities}
                      onKitChange={setKitQty}
                    />
                  )}
                </div>
              ) : null,
            )}

            {isLast ? (
              <VStack gap={4}>
                {shortages.length > 0 ? (
                  <Banner
                    status={isReserving(form.status) ? 'error' : 'warning'}
                    title={
                      isReserving(form.status)
                        ? 'Нельзя подтвердить: на эти даты не хватает позиций'
                        : 'На эти даты не хватает позиций со склада'
                    }
                    description={shortages.join(' · ')}
                  />
                ) : null}
                {form.lines.length === 0 ? (
                  <Banner
                    status="info"
                    title="В мероприятии пока нет позиций"
                    description="Его можно сохранить как черновик и заполнить позже."
                  />
                ) : null}
                <Card>
                  <VStack gap={4}>
                    <Heading level={3}>Статус и оплата</Heading>
                    <Grid columns={{minWidth: 200, repeat: 'fit'}} gap={3}>
                      <Selector
                        label="Статус"
                        description="Подтверждённое мероприятие занимает позиции на складе"
                        options={EVENT_STATUS_OPTIONS}
                        value={form.status}
                        onChange={status =>
                          patch({status: status as CateringEvent['status']})
                        }
                      />
                      <NumberInput
                        label="Скидка"
                        min={0}
                        max={100}
                        units="%"
                        value={form.discount}
                        onChange={discount => patch({discount})}
                      />
                      <NumberInput
                        label="Предоплата"
                        min={0}
                        units={CURRENCY}
                        value={form.prepaid}
                        onChange={prepaid => patch({prepaid})}
                      />
                    </Grid>
                  </VStack>
                </Card>
                {KIND_ORDER.map(kind => {
                  const lines = form.lines.filter(
                    line => byId.get(line.itemId)?.kind === kind,
                  );
                  if (lines.length === 0) return null;
                  return (
                    <Card key={kind}>
                      <VStack gap={3}>
                        <HStack hAlign="between" vAlign="center">
                          <Heading level={3}>{KIND_LABEL[kind]}</Heading>
                          <Button
                            label="Изменить"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              goTo(STEPS.findIndex(entry => entry.kind === kind))
                            }
                          />
                        </HStack>
                        {lines.map(line => {
                          const item = byId.get(line.itemId)!;
                          return (
                            <SummaryRow
                              key={line.itemId}
                              label={`${item.name} × ${line.qty} ${item.unit}`}
                              value={money(item.price * line.qty)}
                            />
                          );
                        })}
                      </VStack>
                    </Card>
                  );
                })}
              </VStack>
            ) : null}

            <HStack hAlign="between" vAlign="center">
              <Button
                label="Назад"
                variant="secondary"
                isDisabled={step === 0}
                onClick={() => goTo(step - 1)}
              />
              {isLast ? (
                <Button
                  label={existing ? 'Сохранить изменения' : 'Создать мероприятие'}
                  variant="primary"
                  onClick={save}
                />
              ) : (
                <HStack gap={2}>
                  <Button label="Сохранить и выйти" variant="ghost" onClick={save} />
                  <Button
                    label="Далее"
                    variant="primary"
                    onClick={() => goTo(step + 1)}
                  />
                </HStack>
              )}
            </HStack>
          </VStack>
        </StackItem>
        {summary}
      </Stack>

      <FormDialog
        isOpen={newClient !== null}
        title="Новый клиент"
        submitLabel="Добавить"
        isSubmitDisabled={
          !newClient || !newClient.name.trim() || !newClient.phone.trim()
        }
        onClose={() => setNewClient(null)}
        onSubmit={() => {
          if (!newClient) return;
          const client = {...newClient, id: newId('c')};
          saveClient(client);
          patch({clientId: client.id});
          setNewClient(null);
        }}>
        {newClient ? <ClientFields value={newClient} onChange={setNewClient} /> : null}
      </FormDialog>
    </PageFrame>
  );
}
