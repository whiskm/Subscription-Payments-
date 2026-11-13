import type { Category } from './types';

/** Built-in categories; their names are translated, the rest is editable. */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'video', builtin: 'video', emoji: '🎬', color: '#D8493A', order: 0 },
  { id: 'music', builtin: 'music', emoji: '🎧', color: '#2E9E63', order: 1 },
  { id: 'ai', builtin: 'ai', emoji: '✨', color: '#8257D9', order: 2 },
  { id: 'work', builtin: 'work', emoji: '🧰', color: '#2F6BDE', order: 3 },
  { id: 'cloud', builtin: 'cloud', emoji: '☁️', color: '#1D9BB8', order: 4 },
  { id: 'games', builtin: 'games', emoji: '🎮', color: '#5B5BD6', order: 5 },
  { id: 'reading', builtin: 'reading', emoji: '📚', color: '#B5651D', order: 6 },
  { id: 'education', builtin: 'education', emoji: '🎓', color: '#7A9A1E', order: 7 },
  { id: 'health', builtin: 'health', emoji: '💪', color: '#D6457A', order: 8 },
  { id: 'security', builtin: 'security', emoji: '🔐', color: '#4A6274', order: 9 },
  { id: 'utilities', builtin: 'utilities', emoji: '📶', color: '#D98A00', order: 10 },
  { id: 'shopping', builtin: 'shopping', emoji: '🛍️', color: '#C2410C', order: 11 },
  { id: 'other', builtin: 'other', emoji: '🗂️', color: '#7C7466', order: 12 },
];

export const FALLBACK_CATEGORY = 'other';

export const SWATCHES = [
  '#D8493A', '#E4572E', '#D98A00', '#B5651D', '#7A9A1E', '#2E9E63', '#1D9BB8', '#2F6BDE',
  '#5B5BD6', '#8257D9', '#D6457A', '#4A6274', '#7C7466', '#1A1814',
];
