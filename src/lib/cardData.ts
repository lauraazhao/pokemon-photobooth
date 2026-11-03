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

/** Fields people can edit after taking their photo, with limits that fit the card layout. */
export const EDITABLE_FIELDS = [
  { key: 'name', label: 'Name', maxLength: 18, multiline: false },
  { key: 'attackName', label: 'Attack', maxLength: 18, multiline: false },
  { key: 'attackText', label: 'Description', maxLength: 160, multiline: true },
] as const satisfies readonly { key: keyof CardData; label: string; maxLength: number; multiline: boolean }[]
