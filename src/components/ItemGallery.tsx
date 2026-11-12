import {useMemo, useState} from 'react';
import {AspectRatio} from '@astryxdesign/core/AspectRatio';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Center} from '@astryxdesign/core/Center';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Grid} from '@astryxdesign/core/Grid';
import {Icon} from '@astryxdesign/core/Icon';
import {IconButton} from '@astryxdesign/core/IconButton';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {Heading, Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {
  MagnifyingGlassIcon,
  MinusIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import {kitPrice, money} from '../lib/format';
import {useStore} from '../lib/store';
import type {CatalogItem, ItemKind, Kit} from '../lib/types';
import {visualFor} from '../lib/visual';

function Photo({item}: {item: CatalogItem}) {
  if (item.image) {
    return (
      <AspectRatio ratio={4 / 3} fit="cover">
        <img src={item.image} alt={item.name} />
      </AspectRatio>
    );
  }
  const visual = visualFor(item);
  return (
    <AspectRatio ratio={4 / 3}>
      <Card variant={visual.tone} padding={0} width="100%" height="100%">
        <Center height="100%">
          <Text size="4xl">{visual.emoji}</Text>
        </Center>
      </Card>
    </AspectRatio>
  );
}

function KitCard({
  kit,
  qty,
  more,
  onChange,
}: {
  kit: Kit;
  qty: number;
  /** Сколько ещё таких комплектов можно взять, пока хватает склада. */
  more: number;
  onChange: (qty: number) => void;
}) {
  const {catalog} = useStore();
  const names = new Map(catalog.map(item => [item.id, item.name]));
  const isChosen = qty > 0;
  return (
    <Card padding={0} variant={isChosen ? 'blue' : 'default'}>
      <VStack gap={0}>
        {kit.image ? (
          <AspectRatio ratio={4 / 3} fit="cover">
            <img src={kit.image} alt={kit.name} />
          </AspectRatio>
        ) : (
          <AspectRatio ratio={4 / 3}>
            <Card variant="purple" padding={0} width="100%" height="100%">
              <Center height="100%">
                <Text size="4xl">🪑</Text>
              </Center>
            </Card>
          </AspectRatio>
        )}
        <VStack gap={3} padding={4}>
          <VStack gap={1}>
            <HStack gap={2} vAlign="center">
              <Text type="body" weight="semibold">
                {kit.name}
              </Text>
              <Badge variant="purple" label="Комплект" />
            </HStack>
            {kit.description ? (
              <Text type="supporting" color="secondary" maxLines={2}>
                {kit.description}
              </Text>
            ) : null}
          </VStack>
          <VStack gap={0.5}>
            {kit.items.map(entry => (
              <Text key={entry.itemId} type="supporting" color="secondary">
                {names.get(entry.itemId) ?? '—'} × {entry.qty}
              </Text>
            ))}
          </VStack>
          <HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
            <Text type="body" weight="semibold" hasTabularNumbers>
              {money(kitPrice(kit, catalog))}
            </Text>
            <Badge
              variant={more <= 0 ? 'warning' : 'neutral'}
              label={more <= 0 ? 'Склад исчерпан' : `Ещё можно: ${more}`}
            />
          </HStack>
          {isChosen ? (
            <HStack gap={2} vAlign="center" hAlign="between">
              <IconButton
                label="Убрать один комплект"
                variant="secondary"
                icon={<Icon icon={MinusIcon} size="sm" />}
                onClick={() => onChange(qty - 1)}
              />
              <Text type="body" weight="semibold" hasTabularNumbers>
                {qty} · {money(qty * kitPrice(kit, catalog))}
              </Text>
              <IconButton
                label="Добавить ещё комплект"
                variant="secondary"
                icon={<Icon icon={PlusIcon} size="sm" />}
                onClick={() => onChange(qty + 1)}
              />
            </HStack>
          ) : (
            <Button
              label="Добавить комплект"
              variant="primary"
              width="100%"
              onClick={() => onChange(1)}
            />
          )}
        </VStack>
      </VStack>
    </Card>
  );
}

function ItemCard({
  item,
  qty,
  guests,
  free,
  showPerGuest,
  onChange,
}: {
  item: CatalogItem;
  qty: number;
  guests: number;
  free: number | null;
  showPerGuest: boolean;
  onChange: (qty: number) => void;
}) {
  const isChosen = qty > 0;
  const shortage = free !== null && qty > free ? qty - Math.max(free, 0) : 0;
  return (
    <Card padding={0} variant={isChosen ? 'blue' : 'default'}>
      <VStack gap={0}>
        <Photo item={item} />
        <VStack gap={3} padding={4}>
          <VStack gap={1}>
            <Text type="body" weight="semibold">
              {item.name}
            </Text>
            {item.description ? (
              <Text type="supporting" color="secondary" maxLines={3}>
                {item.description}
              </Text>
            ) : null}
          </VStack>
          <HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
            <Text type="body" weight="semibold" hasTabularNumbers>
              {money(item.price)}{' '}
              <Text type="supporting" color="secondary">
                / {item.unit}
              </Text>
            </Text>
            {free !== null ? (
              <Badge
                variant={shortage > 0 ? 'warning' : 'neutral'}
                label={
                  shortage > 0
                    ? `Не хватает ${shortage}`
                    : `Свободно ${Math.max(free, 0)}`
                }
              />
            ) : null}
          </HStack>
          {isChosen ? (
            <HStack gap={2} vAlign="center" hAlign="between">
              <IconButton
                label="Убрать одну"
                variant="secondary"
                icon={<Icon icon={MinusIcon} size="sm" />}
                onClick={() => onChange(qty - 1)}
              />
              <Text type="body" weight="semibold" hasTabularNumbers>
                {qty} · {money(qty * item.price)}
              </Text>
              <IconButton
                label="Добавить ещё"
                variant="secondary"
                icon={<Icon icon={PlusIcon} size="sm" />}
                onClick={() => onChange(qty + 1)}
              />
            </HStack>
          ) : (
            <VStack gap={2}>
              <Button
                label="Добавить"
                variant="primary"
                width="100%"
                onClick={() => onChange(1)}
              />
              {showPerGuest ? (
                <Button
                  label={`На всех гостей (${guests})`}
                  variant="ghost"
                  width="100%"
                  onClick={() => onChange(guests)}
                />
              ) : null}
            </VStack>
          )}
        </VStack>
      </VStack>
    </Card>
  );
}

/** Каталог с фото в виде галереи: клиент листает категории и добавляет позиции в заказ. */
export function ItemGallery({
  kind,
  title,
  hint,
  quantities,
  guests,
  available,
  onChange,
  kits,
  kitQuantities,
  onKitChange,
}: {
  kind: ItemKind;
  title: string;
  hint: string;
  quantities: Record<string, number>;
  guests: number;
  available: (item: CatalogItem) => number | null;
  onChange: (itemId: string, qty: number) => void;
  /** Комплекты показываются отдельной вкладкой (для мебели). */
  kits?: Kit[];
  kitQuantities?: Record<string, number>;
  onKitChange?: (kit: Kit, qty: number) => void;
}) {
  const {catalog} = useStore();
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();

  const items = useMemo(
    () => catalog.filter(item => item.kind === kind),
    [catalog, kind],
  );
  const categories = useMemo(
    () => [...new Set(items.map(item => item.category))],
    [items],
  );

  const groups = categories
    .filter(name => category === 'all' || category === name)
    .map(name => ({
      name,
      items: items.filter(
        item =>
          item.category === name &&
          (!needle ||
            item.name.toLowerCase().includes(needle) ||
            item.description?.toLowerCase().includes(needle)),
      ),
    }))
    .filter(group => group.items.length > 0);

  const showKits = !!kits && kits.length > 0 && !!onKitChange;
  const visibleKits = showKits && (category === 'all' || category === 'kits')
    ? kits!.filter(kit => !needle || kit.name.toLowerCase().includes(needle))
    : [];
  const byId = new Map(catalog.map(item => [item.id, item]));
  const moreKits = (kit: Kit) =>
    Math.min(
      ...kit.items.map(entry => {
        const item = byId.get(entry.itemId);
        const free = item ? available(item) : null;
        if (free === null) return Number.POSITIVE_INFINITY;
        return Math.floor((free - (quantities[entry.itemId] ?? 0)) / entry.qty);
      }),
    );

  const countIn = (name: string) =>
    items
      .filter(item => item.category === name)
      .reduce((sum, item) => sum + (quantities[item.id] ?? 0), 0);

  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Heading level={3}>{title}</Heading>
        <Text type="supporting" color="secondary">
          {hint}
        </Text>
      </VStack>

      <TabList value={category} onChange={setCategory} overflow="scroll">
        <Tab value="all" label="Все" />
        {showKits ? (
          <Tab
            value="kits"
            label="Комплекты"
            endContent={
              (kitQuantities && Object.values(kitQuantities).some(q => q > 0)) ? (
                <Text type="supporting" color="accent">
                  {Object.values(kitQuantities).reduce((a, b) => a + b, 0)}
                </Text>
              ) : undefined
            }
          />
        ) : null}
        {categories.map(name => (
          <Tab
            key={name}
            value={name}
            label={name}
            endContent={
              countIn(name) > 0 ? (
                <Text type="supporting" color="accent">
                  {countIn(name)}
                </Text>
              ) : undefined
            }
          />
        ))}
      </TabList>

      <TextInput
        label="Поиск"
        isLabelHidden
        type="search"
        placeholder="Найти позицию"
        startIcon={MagnifyingGlassIcon}
        hasClear
        value={query}
        onChange={setQuery}
      />

      {visibleKits.length > 0 ? (
        <VStack gap={3}>
          <Heading level={4}>Комплекты</Heading>
          <Grid columns={{minWidth: 240, repeat: 'fill'}} gap={3}>
            {visibleKits.map(kit => (
              <KitCard
                key={kit.id}
                kit={kit}
                qty={kitQuantities?.[kit.id] ?? 0}
                more={moreKits(kit)}
                onChange={qty => onKitChange!(kit, qty)}
              />
            ))}
          </Grid>
        </VStack>
      ) : null}

      {groups.length === 0 && visibleKits.length === 0 ? (
        <Card>
          <EmptyState
            isCompact
            title="Ничего не найдено"
            description="Измените запрос или добавьте позицию в каталог."
            actions={
              <Button label="Открыть каталог" variant="secondary" href="/catalog" />
            }
          />
        </Card>
      ) : null}

      {groups.map(group => (
        <VStack gap={3} key={group.name}>
          <Heading level={4}>{group.name}</Heading>
          <Grid columns={{minWidth: 240, repeat: 'fill'}} gap={3}>
            {group.items.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                qty={quantities[item.id] ?? 0}
                guests={guests}
                free={available(item)}
                showPerGuest={kind === 'dish' || item.category === 'Стулья'}
                onChange={qty => onChange(item.id, qty)}
              />
            ))}
          </Grid>
        </VStack>
      ))}
    </VStack>
  );
}
