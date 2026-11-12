import type {CatalogItem} from './types';

type Tone = 'green' | 'orange' | 'red' | 'pink' | 'blue' | 'yellow' | 'purple' | 'teal' | 'gray';

const BY_CATEGORY: Record<string, {emoji: string; tone: Tone}> = {
  'Холодные закуски': {emoji: '🥗', tone: 'green'},
  Салаты: {emoji: '🥬', tone: 'green'},
  Горячее: {emoji: '🍖', tone: 'orange'},
  Десерты: {emoji: '🍰', tone: 'pink'},
  Напитки: {emoji: '🥂', tone: 'blue'},
  Столы: {emoji: '🍽️', tone: 'yellow'},
  Стулья: {emoji: '🪑', tone: 'orange'},
  'Мягкая мебель': {emoji: '🛋️', tone: 'purple'},
  'Шатры и зоны': {emoji: '⛺', tone: 'teal'},
  Посуда: {emoji: '🍴', tone: 'blue'},
  Текстиль: {emoji: '🧺', tone: 'pink'},
  Оборудование: {emoji: '☕', tone: 'gray'},
};

const BY_KIND: Record<CatalogItem['kind'], {emoji: string; tone: Tone}> = {
  dish: {emoji: '🍽️', tone: 'green'},
  furniture: {emoji: '🪑', tone: 'orange'},
  equipment: {emoji: '🍴', tone: 'blue'},
  service: {emoji: '🧑‍🍳', tone: 'gray'},
};

/** Заглушка для позиции без фото: эмодзи и цвет по категории. */
export function visualFor(item: Pick<CatalogItem, 'category' | 'kind'>) {
  return BY_CATEGORY[item.category] ?? BY_KIND[item.kind];
}
