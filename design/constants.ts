/**
 * CRATEDIG Brand Constants
 * Dark Vinyl — Record Store Noir
 */
export const BRAND = {
  name: 'CrateDig',
  tagline: 'Dig deeper into your collection',
} as const;

export const COLORS = {
  orange: {
    500: '#F97316',
    600: '#EA580C',
    700: '#C2410C',
    400: '#FB923C',
  },
  bg: '#0A0A0A',
  card: '#111111',
  border: '#222222',
  groove: '#333333',
  success: '#22C55E',
  warning: '#EAB308',
  error: '#EF4444',
} as const;

export const DICE_MODES = [
  { key: 'random', emoji: '🎲', label: 'RANDOM', description: 'Pure random seed selection' },
  { key: 'genre',  emoji: '🎯', label: 'GENRE',  description: 'Seeds from your dominant genre' },
  { key: 'era',    emoji: '⏰', label: 'ERA',    description: 'Seeds from a specific decade' },
  { key: 'deep',   emoji: '🔥', label: 'DEEP',   description: 'Obscure deep cuts from your library' },
] as const;

export const OUTPUT_RANGE = {
  min: 10,
  max: 100,
  step: 10,
  default: 50,
} as const;

export const FONTS = {
  display: "'Bebas Neue', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
} as const;

export const PAGES = [
  { path: '/roll', label: 'ROLL' },
  { path: '/library', label: 'LIBRARY' },
  { path: '/history', label: 'HISTORY' },
] as const;
