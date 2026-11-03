/** All the text on the card. */
export interface CardData {
  stage: string
  name: string
  hp: string
  attackName: string
  attackDamage: string
  attackText: string
  weakness: string
  footer: string
}

export const DEFAULT_CARD: CardData = {
  stage: 'BASIC',
  name: 'Mega Camerupt',
  hp: '60',
  attackName: 'Energize',
  attackDamage: '80+',
  attackText: 'If your opponent’s Active Pokemon is Burned, this attack does 160 more damage.',
  weakness: '+20',
  footer: '2026 @ laurazhao.com',
}

/** Text people can edit on the card after taking their photo, with limits that fit the layout. */
export const EDITABLE_LIMITS = {
  name: { label: 'Card name', maxLength: 18, multiline: false },
  attackName: { label: 'Attack name', maxLength: 18, multiline: false },
  attackText: { label: 'Attack description', maxLength: 160, multiline: true },
} as const
