import type { CardTemplate } from './cards'

/** The text people can change on the card. Everything else is part of the card art. */
export interface CardData {
  name: string
  attackName: string
  attackText: string
}

export const cardDataFor = (template: CardTemplate): CardData => ({ ...template.defaults })

/** Fields people can edit after taking their photo, with limits that fit the card layout. */
export const EDITABLE_FIELDS = [
  { key: 'name', label: 'Name', maxLength: 18, multiline: false },
  { key: 'attackName', label: 'Attack', maxLength: 18, multiline: false },
  { key: 'attackText', label: 'Description', maxLength: 160, multiline: true },
] as const satisfies readonly { key: keyof CardData; label: string; maxLength: number; multiline: boolean }[]
