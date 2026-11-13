import type {CatalogItem} from './types';

type Tone = 'green' | 'orange' | 'red' | 'pink' | 'blue' | 'yellow' | 'purple' | 'teal' | 'gray';

const BY_CATEGORY: Record<string, {emoji: string; tone: Tone}> = {
  Горячее: {emoji: '🍖', tone: 'orange'},
  'Ассорти и плато': {emoji: '🥩', tone: 'red'},
  'Канапе и брускетты': {emoji: '🥖', tone: 'yellow'},
  Салаты: {emoji: '🥗', tone: 'green'},
  'Фрукты и ягоды': {emoji: '🍓', tone: 'red'},
  'Орехи и сладости': {emoji: '🥜', tone: 'orange'},
  Десерты: {emoji: '🍰', tone: 'pink'},
  Напитки: {emoji: '🥂', tone: 'blue'},
  'Посуда и оборудование': {emoji: '🍴', tone: 'blue'},
  'Мебель и текстиль': {emoji: '🪑', tone: 'orange'},
  Персонал: {emoji: '🧑‍🍳', tone: 'gray'},
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
