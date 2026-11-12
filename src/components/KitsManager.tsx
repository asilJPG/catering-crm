import {useState} from 'react';
import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {FileInput} from '@astryxdesign/core/FileInput';
import {Icon} from '@astryxdesign/core/Icon';
import {IconButton} from '@astryxdesign/core/IconButton';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {Selector} from '@astryxdesign/core/Selector';
import {StackItem} from '@astryxdesign/core/Stack';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {Text} from '@astryxdesign/core/Text';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Thumbnail} from '@astryxdesign/core/Thumbnail';
import {PencilSquareIcon, PlusIcon, TrashIcon} from '@heroicons/react/24/outline';
import {kitPrice, money, newId} from '../lib/format';
import {fileToDataUrl} from '../lib/image';
import {useStore} from '../lib/store';
import type {Kit} from '../lib/types';
import {FormDialog} from './FormDialog';

export function kitContents(kit: Kit, names: Map<string, string>): string {
  return kit.items
    .map(entry => `${names.get(entry.itemId) ?? '—'} × ${entry.qty}`)
    .join(', ');
}

export function KitsManager({canEdit}: {canEdit: boolean}) {
  const {kits, catalog, saveKit, removeKit} = useStore();
  const [draft, setDraft] = useState<Kit | null>(null);
  const [toRemove, setToRemove] = useState<Kit | null>(null);

  const stockItems = catalog.filter(item => item.stock !== null);
  const names = new Map(catalog.map(item => [item.id, item.name]));
  const options = stockItems
    .sort((a, b) => a.category.localeCompare(b.category, 'ru') || a.name.localeCompare(b.name, 'ru'))
    .map(item => ({value: item.id, label: item.name, description: item.category}));

  const startNew = () =>
    setDraft({id: '', name: '', description: '', items: [{itemId: stockItems[0]?.id ?? '', qty: 1}]});

  const patch = (changes: Partial<Kit>) =>
    setDraft(prev => (prev ? {...prev, ...changes} : prev));

  const setItem = (index: number, changes: Partial<Kit['items'][number]>) =>
    setDraft(prev =>
      prev
        ? {
            ...prev,
            items: prev.items.map((entry, i) => (i === index ? {...entry, ...changes} : entry)),
          }
        : prev,
    );

  const isValid =
    !!draft &&
    draft.name.trim().length > 0 &&
    draft.items.length > 0 &&
    draft.items.every(entry => entry.itemId && entry.qty > 0);

  const submit = () => {
    if (!draft) return;
    saveKit({...draft, id: draft.id || newId('k'), name: draft.name.trim()});
    setDraft(null);
  };

  const columns: TableColumn<Kit>[] = [
    {
      key: 'image',
      header: '',
      width: pixel(72),
      renderCell: kit =>
        kit.image ? (
          <Thumbnail src={kit.image} alt={kit.name} label={kit.name} />
        ) : (
          <Text size="2xl">🪑</Text>
        ),
    },
    {
      key: 'name',
      header: 'Комплект',
      width: proportional(2, {minWidth: 200}),
      renderCell: kit => (
        <VStack gap={0.5}>
          <Text type="body" weight="medium">
            {kit.name}
          </Text>
          {kit.description ? (
            <Text type="supporting" color="secondary">
              {kit.description}
            </Text>
          ) : null}
        </VStack>
      ),
    },
    {
      key: 'items',
      header: 'Состав',
      width: proportional(3, {minWidth: 260}),
      renderCell: kit => kitContents(kit, names),
    },
    {
      key: 'price',
      header: 'Стоимость',
      width: pixel(140),
      align: 'end',
      renderCell: kit => money(kitPrice(kit, catalog)),
    },
    ...(canEdit
      ? [
          {
            key: 'actions',
            header: '',
            width: pixel(100),
            align: 'end',
            renderCell: kit => (
              <HStack gap={1} hAlign="end">
                <IconButton
                  label="Изменить комплект"
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon={PencilSquareIcon} size="sm" />}
                  onClick={() => setDraft(kit)}
                />
                <IconButton
                  label="Удалить комплект"
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon={TrashIcon} size="sm" />}
                  onClick={() => setToRemove(kit)}
                />
              </HStack>
            ),
          } satisfies TableColumn<Kit>,
        ]
      : []),
  ];

  return (
    <VStack gap={4}>
      <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
        <Text type="supporting" color="secondary">
          Комплект добавляет в мероприятие всё, что внутри, и занимает эти позиции на складе.
        </Text>
        {canEdit ? (
          <Button
            label="Новый комплект"
            variant="secondary"
            icon={<Icon icon={PlusIcon} size="sm" />}
            onClick={startNew}
          />
        ) : null}
      </HStack>

      <Card padding={0}>
        {kits.length > 0 ? (
          <Table data={kits} columns={columns} idKey="id" hasHover />
        ) : (
          <EmptyState
            title="Комплектов пока нет"
            description="Соберите стол со стульями и скатертью в один комплект."
          />
        )}
      </Card>

      <FormDialog
        isOpen={draft !== null}
        width={600}
        title={draft?.id ? 'Комплект' : 'Новый комплект'}
        isSubmitDisabled={!isValid}
        onClose={() => setDraft(null)}
        onSubmit={submit}>
        {draft ? (
          <>
            <TextInput
              label="Название"
              isRequired
              placeholder="Например: Банкетный стол на 10 персон"
              value={draft.name}
              onChange={name => patch({name})}
            />
            <TextArea
              label="Описание"
              isOptional
              value={draft.description ?? ''}
              onChange={description => patch({description})}
            />
            <VStack gap={2}>
              {draft.image ? (
                <Thumbnail
                  src={draft.image}
                  alt={draft.name || 'Фото комплекта'}
                  label="Фото комплекта"
                  showRemoveOn="always"
                  onRemove={() => patch({image: undefined})}
                />
              ) : null}
              <FileInput
                label="Фото"
                isOptional
                accept="image/*"
                placeholder="Выбрать фото"
                value={null}
                onChange={async file => {
                  const picked = Array.isArray(file) ? file[0] : file;
                  if (!picked) return;
                  try {
                    patch({image: await fileToDataUrl(picked)});
                  } catch {
                    // Не картинка — оставляем как было.
                  }
                }}
              />
            </VStack>
            <VStack gap={2}>
              <Text type="label" color="secondary">
                Что входит в комплект
              </Text>
              {draft.items.map((entry, index) => (
                <HStack key={index} gap={2} vAlign="end">
                  <StackItem size="fill">
                    <Selector
                      label={`Позиция ${index + 1}`}
                      isLabelHidden
                      hasSearch
                      options={options}
                      value={entry.itemId}
                      onChange={itemId => setItem(index, {itemId})}
                    />
                  </StackItem>
                  <NumberInput
                    label={`Количество ${index + 1}`}
                    isLabelHidden
                    width={110}
                    min={1}
                    isIntegerOnly
                    hasNumberSteppers
                    value={entry.qty}
                    onChange={qty => setItem(index, {qty})}
                  />
                  <IconButton
                    label="Убрать из комплекта"
                    variant="ghost"
                    icon={<Icon icon={TrashIcon} size="sm" />}
                    isDisabled={draft.items.length === 1}
                    onClick={() =>
                      patch({items: draft.items.filter((_, i) => i !== index)})
                    }
                  />
                </HStack>
              ))}
              <HStack>
                <Button
                  label="Добавить позицию"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    patch({items: [...draft.items, {itemId: stockItems[0]?.id ?? '', qty: 1}]})
                  }
                />
              </HStack>
            </VStack>
            <Text type="supporting" color="secondary">
              Стоимость: {money(kitPrice(draft, catalog))}
            </Text>
          </>
        ) : null}
      </FormDialog>

      <AlertDialog
        isOpen={toRemove !== null}
        onOpenChange={open => {
          if (!open) setToRemove(null);
        }}
        title="Удалить комплект?"
        description={`«${toRemove?.name ?? ''}» исчезнет из каталога. Уже созданные мероприятия не изменятся.`}
        cancelLabel="Отмена"
        actionLabel="Удалить"
        actionVariant="destructive"
        onAction={() => {
          if (toRemove) removeKit(toRemove.id);
          setToRemove(null);
        }}
      />
    </VStack>
  );
}
