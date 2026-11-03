/** Everything on the card that will become editable in milestone 3. */
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
