import type { ConstructionActionId } from '../types/crew';

export const ANIMAL_OPTIONS = ['🐱', '🐶', '🐰', '🦊', '🐻', '🐼', '🐹', '🐯'] as const;

export const NAME_OPTIONS = ['小橘', '阿灰', '奶糖', '豆包', '栗子', '麻糬', 'Mumu', 'Yuki', '布丁', '小麥', '米米', '阿福'] as const;

export const CONSTRUCTION_ACTION_IDS: ConstructionActionId[] = [
  'hammering',
  'carrying-wood',
  'painting',
  'carrying-box',
  'screwing',
];

export const CONSTRUCTION_ACTIONS: Record<ConstructionActionId, { emoji: string; label: string }> = {
  hammering: { emoji: '🔨', label: '敲東西' },
  'carrying-wood': { emoji: '🪵', label: '搬木板' },
  painting: { emoji: '🖌️', label: '刷牆' },
  'carrying-box': { emoji: '📦', label: '搬箱子' },
  screwing: { emoji: '🪛', label: '鎖螺絲' },
};
