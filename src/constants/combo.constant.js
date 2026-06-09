export const PRODUCT_STYLES = ['minimalist', 'modern', 'vintage', 'luxury', 'korean', 'bohemian']

export const ROOM_TYPES = ['bedroom', 'living_room', 'kitchen', 'workspace']

export const COLOR_TONES = ['warm', 'cool', 'neutral', 'dark', 'bright']

export const DECOR_ROLES = ['main_item', 'lighting', 'wall_decor', 'textile', 'accent_item', 'fragrance']

export const COMBO_TYPES = [
  { comboType: 'Basic', budgetRatio: 0.7, itemReduction: 2 },
  { comboType: 'Standard', budgetRatio: 0.9, itemReduction: 1 },
  { comboType: 'Premium', budgetRatio: 1, itemReduction: 0 },
]

// Single source of truth cho label – import vào options.service thay vì hardcode ở đó
export const COMBO_LABELS = {
  minimalist: 'Minimalist',
  modern: 'Modern',
  vintage: 'Vintage',
  luxury: 'Luxury',
  korean: 'Korean',
  bohemian: 'Bohemian',
  bedroom: 'Bedroom',
  living_room: 'Living Room',
  kitchen: 'Kitchen',
  workspace: 'Workspace',
  warm: 'Warm',
  cool: 'Cool',
  neutral: 'Neutral',
  dark: 'Dark',
  bright: 'Bright',
}

// Single source of truth cho constraints – import vào validation thay vì hardcode số
export const COMBO_CONSTRAINTS = {
  budgetMin: 1000,
  maxItemsMin: 2,
  maxItemsMax: 10,
  maxItemsDefault: 5,
}
