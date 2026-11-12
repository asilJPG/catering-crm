import {useState} from 'react';
import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Icon} from '@astryxdesign/core/Icon';
import {IconButton} from '@astryxdesign/core/IconButton';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {Text} from '@astryxdesign/core/Text';
import {FileInput} from '@astryxdesign/core/FileInput';
import {Thumbnail} from '@astryxdesign/core/Thumbnail';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import {FormDialog} from '../components/FormDialog';
import {KitsManager} from '../components/KitsManager';
import {PageFrame} from '../components/PageFrame';
import {useCurrentUser} from '../lib/auth';
import {
  CURRENCY,
  KIND_LABEL,
  KIND_ORDER,
  money,
  newId,
  reservedOnDay,
  todayISO,
} from '../lib/format';
import {fileToDataUrl} from '../lib/image';
import {useStore} from '../lib/store';
import {visualFor} from '../lib/visual';
import type {CatalogItem, ItemKind} from '../lib/types';

const hasStock = (kind: ItemKind) => kind === 'furniture' || kind === 'equipment';

export default function Catalog() {
  const {catalog, reservations, saveCatalogItem, removeCatalogItem} = useStore();
  const today = todayISO();
  const {can} = useCurrentUser();
  const [tab, setTab] = useState<ItemKind | 'kits'>('dish');
  const kind: ItemKind = tab === 'kits' ? 'furniture' : tab;
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<CatalogItem | null>(null);
  const [toRemove, setToRemove] = useState<CatalogItem | null>(null);

  const needle = query.trim().toLowerCase();
  const visible = catalog
    .filter(item => item.kind === kind)
    .filter(
      item =>
        !needle ||
        item.name.toLowerCase().includes(needle) ||
        item.category.toLowerCase().includes(needle),
    )
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category, 'ru') ||
        a.name.localeCompare(b.name, 'ru'),
    );

  const categories = [
    ...new Set(catalog.filter(item => item.kind === kind).map(item => item.category)),
  ];

  const startNew = () =>
    setDraft({
      id: '',
      kind,
      category: categories[0] ?? '',
      name: '',
      unit: kind === 'dish' ? 'порц.' : kind === 'service' ? 'чел.' : 'шт.',
      price: 0,
      stock: hasStock(kind) ? 0 : null,
    });

  const patch = (changes: Partial<CatalogItem>) =>
    setDraft(prev => (prev ? {...prev, ...changes} : prev));

  const submit = () => {
    if (!draft) return;
    saveCatalogItem({
      ...draft,
      id: draft.id || newId('it'),
      name: draft.name.trim(),
      category: draft.category.trim() || 'Без категории',
      stock: hasStock(draft.kind) ? (draft.stock ?? 0) : null,
    });
    setDraft(null);
  };

  const columns: TableColumn<CatalogItem>[] = [
    ...(kind !== 'service'
      ? [
          {
            key: 'image',
            header: '',
            width: pixel(72),
            renderCell: item =>
              item.image ? (
                <Thumbnail src={item.image} alt={item.name} label={item.name} />
              ) : (
                <Text size="2xl">{visualFor(item).emoji}</Text>
              ),
          } satisfies TableColumn<CatalogItem>,
        ]
      : []),
    {
      key: 'name',
      header: 'Название',
      width: proportional(3, {minWidth: 240}),
      renderCell: item => (
        <Text type="body" weight="medium">
          {item.name}
        </Text>
      ),
    },
    {key: 'category', header: 'Категория', width: proportional(2, {minWidth: 160})},
    {key: 'unit', header: 'Ед.', width: pixel(90)},
    {
      key: 'price',
      header: 'Цена',
      width: pixel(130),
      align: 'end',
      renderCell: item => money(item.price),
    },
    ...(hasStock(kind)
      ? [
          {
            key: 'stock',
            header: 'Всего',
            width: pixel(90),
            align: 'end',
            renderCell: item => item.stock ?? '—',
          } satisfies TableColumn<CatalogItem>,
          {
            key: 'reserved',
            header: 'Занято сегодня',
            width: pixel(140),
            align: 'end',
            renderCell: item => reservedOnDay(reservations, item.id, today),
          } satisfies TableColumn<CatalogItem>,
          {
            key: 'free',
            header: 'Свободно сегодня',
            width: pixel(150),
            align: 'end',
            renderCell: item => {
              const free = (item.stock ?? 0) - reservedOnDay(reservations, item.id, today);
              return (
                <Badge
                  variant={free <= 0 ? 'error' : 'neutral'}
                  label={String(free)}
                />
              );
            },
          } satisfies TableColumn<CatalogItem>,
        ]
      : []),
    {
      key: 'actions',
      header: '',
      width: pixel(100),
      align: 'end',
      renderCell: item => (
        <HStack gap={1} hAlign="end">
          <IconButton
            label="Изменить позицию"
            variant="ghost"
            size="sm"
            icon={<Icon icon={PencilSquareIcon} size="sm" />}
            onClick={() => setDraft(item)}
          />
          <IconButton
            label="Удалить позицию"
            variant="ghost"
            size="sm"
            icon={<Icon icon={TrashIcon} size="sm" />}
            onClick={() => setToRemove(item)}
          />
        </HStack>
      ),
    },
  ];

  return (
    <PageFrame
      title="Каталог"
      subtitle={
        can.editCatalog
          ? 'Всё, что можно добавить в мероприятие: блюда, мебель, посуда, персонал'
          : 'Каталог и остатки склада — только просмотр'
      }
      actions={
        can.editCatalog && tab !== 'kits' ? (
          <Button
            label="Добавить позицию"
            variant="primary"
            icon={<Icon icon={PlusIcon} size="sm" />}
            onClick={startNew}
          />
        ) : undefined
      }>
      <TabList value={tab} onChange={value => setTab(value as ItemKind | 'kits')}>
        {KIND_ORDER.map(value => (
          <Tab key={value} value={value} label={KIND_LABEL[value]} />
        ))}
        <Tab value="kits" label="Комплекты" />
      </TabList>

      {tab === 'kits' ? <KitsManager canEdit={can.editCatalog} /> : null}

      {tab !== 'kits' ? (
      <HStack>
        <TextInput
          label="Поиск по каталогу"
          isLabelHidden
          type="search"
          width={320}
          placeholder="Название или категория"
          startIcon={MagnifyingGlassIcon}
          hasClear
          value={query}
          onChange={setQuery}
        />
      </HStack>
      ) : null}

      {tab !== 'kits' ? (
      <Card padding={0}>
        {visible.length > 0 ? (
          <Table
            data={visible}
            columns={columns.filter(column => can.editCatalog || column.key !== 'actions')}
            idKey="id"
            hasHover
          />
        ) : (
          <EmptyState
            title="Позиций нет"
            description="Добавьте позицию, чтобы её можно было выбрать в мероприятии."
            actions={
              can.editCatalog ? (
                <Button
                  label="Добавить позицию"
                  variant="secondary"
                  onClick={startNew}
                />
              ) : undefined
            }
          />
        )}
      </Card>
      ) : null}

      <FormDialog
        isOpen={draft !== null}
        title={draft?.id ? 'Позиция каталога' : 'Новая позиция'}
        isSubmitDisabled={!draft || !draft.name.trim()}
        onClose={() => setDraft(null)}
        onSubmit={submit}>
        {draft ? (
          <>
            <Selector
              label="Раздел"
              options={KIND_ORDER.map(value => ({
                value,
                label: KIND_LABEL[value],
              }))}
              value={draft.kind}
              onChange={value => patch({kind: value as ItemKind})}
            />
            <TextInput
              label="Название"
              isRequired
              value={draft.name}
              onChange={name => patch({name})}
            />
            {draft.kind !== 'service' ? (
              <VStack gap={2}>
                {draft.image ? (
                  <Thumbnail
                    src={draft.image}
                    alt={draft.name || 'Фото позиции'}
                    label="Фото позиции"
                    showRemoveOn="always"
                    onRemove={() => patch({image: undefined})}
                  />
                ) : null}
                <FileInput
                  label="Фото"
                  isOptional
                  accept="image/*"
                  placeholder="Выбрать фото"
                  description="Любое фото — оно сожмётся автоматически"
                  value={null}
                  onChange={async file => {
                    const picked = Array.isArray(file) ? file[0] : file;
                    if (!picked) return;
                    try {
                      patch({image: await fileToDataUrl(picked)});
                    } catch {
                      // Не картинка или файл не открылся — оставляем как было.
                    }
                  }}
                />
              </VStack>
            ) : null}
            {draft.kind === 'dish' || draft.kind === 'furniture' ? (
              <TextArea
                label="Описание"
                isOptional
                value={draft.description ?? ''}
                onChange={description => patch({description})}
              />
            ) : null}
            <TextInput
              label="Категория"
              description="Например: Горячее, Столы, Персонал"
              value={draft.category}
              onChange={category => patch({category})}
            />
            <HStack gap={3}>
              <NumberInput
                label="Цена"
                width="100%"
                min={0}
                units={CURRENCY}
                value={draft.price}
                onChange={price => patch({price})}
              />
              <TextInput
                label="Единица"
                width="100%"
                value={draft.unit}
                onChange={unit => patch({unit})}
              />
            </HStack>
            {hasStock(draft.kind) ? (
              <NumberInput
                label="Всего на складе"
                description="Всего единиц в наличии. Подтверждённые мероприятия занимают их на свои даты"
                min={0}
                isIntegerOnly
                value={draft.stock ?? 0}
                onChange={stock => patch({stock})}
              />
            ) : null}
          </>
        ) : null}
      </FormDialog>

      <AlertDialog
        isOpen={toRemove !== null}
        onOpenChange={open => {
          if (!open) setToRemove(null);
        }}
        title="Удалить позицию?"
        description={`«${toRemove?.name ?? ''}» исчезнет из каталога и из всех мероприятий, где она выбрана.`}
        cancelLabel="Отмена"
        actionLabel="Удалить"
        actionVariant="destructive"
        onAction={() => {
          if (toRemove) removeCatalogItem(toRemove.id);
          setToRemove(null);
        }}
      />
    </PageFrame>
  );
}
