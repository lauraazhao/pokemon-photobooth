// Card designs from the Figma section "cards" (node 854:17916).
// Each art PNG is the whole card exported with the three "editable …" layers
// hidden; the app draws the person and the editable text on top of it.
import basic from '../assets/cards/basic.png'
import basicWater from '../assets/cards/basic-water.png'
import basicGrass from '../assets/cards/basic-grass.png'
import basicGround from '../assets/cards/basic-ground.png'
import basicPsychic from '../assets/cards/basic-psychic.png'
import basicNormal from '../assets/cards/basic-normal.png'
import basicMagenta from '../assets/cards/basic-magenta.png'
import basicMidnight from '../assets/cards/basic-midnight.png'
import fireEx from '../assets/cards/fire-ex.png'
import goldEx from '../assets/cards/gold-ex.png'
import darkEx from '../assets/cards/dark-ex.png'
import fairyEx from '../assets/cards/fairy-ex.png'
import skyEx from '../assets/cards/sky-ex.png'

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export type Rarity = 'basic' | 'rare' | 'epic'

export interface CardTemplate {
  id: string
  name: string
  rarity: Rarity
  art: string
  width: number
  height: number
  /** Text color of the editable text. */
  color: string
  /** Where each layer sits on the card, in Figma pixels. */
  photo: Box
  title: Box
  /** The attack name is centered in this box (between the type icons and the damage). */
  ability: Box
  description: Box
  defaults: { name: string; attackName: string; attackText: string }
}

const DESCRIPTION = 'If your opponent’s Active Pokemon is Burned, this attack does 160 more damage.'

// All the designs share one layout. "basic" cards have one type icon and
// HP starting at x 233; "ex" cards have two icons and HP starting at x 218.
// A few ex cards sit 1px higher.
function basicCard(id: string, name: string, art: string): CardTemplate {
  return {
    id,
    name,
    rarity: 'basic',
    art,
    width: 330,
    height: 460,
    color: '#000',
    photo: { x: 29, y: 70, w: 272, h: 185 },
    title: { x: 29, y: 33, w: 196, h: 25 },
    ability: { x: 67, y: 291, w: 192, h: 25 },
    description: { x: 39, y: 320, w: 252, h: 78 },
    defaults: { name: 'Mega Camerupt', attackName: 'Energize', attackText: DESCRIPTION },
  }
}

function exCard(
  id: string,
  name: string,
  art: string,
  opts: { up?: boolean; color?: string; rarity?: Rarity } = {},
): CardTemplate {
  const dy = opts.up ? -1 : 0
  return {
    id,
    name,
    rarity: opts.rarity ?? 'rare',
    art,
    width: 330,
    height: 459,
    color: opts.color ?? '#000',
    photo: { x: 29, y: 70 + dy, w: 272, h: 185 },
    title: { x: 29, y: 33 + dy, w: 181, h: 25 },
    ability: { x: 89, y: 291 + dy, w: 170, h: 25 },
    description: { x: 39, y: 320 + dy, w: 252, h: 78 },
    defaults: { name: 'Mega Camerupt', attackName: 'Volcanic Meteor', attackText: DESCRIPTION },
  }
}

export const CARDS: CardTemplate[] = [
  basicCard('basic', 'Basic', basic),
  basicCard('basic-water', 'Water', basicWater),
  basicCard('basic-grass', 'Grass', basicGrass),
  basicCard('basic-ground', 'Ground', basicGround),
  basicCard('basic-psychic', 'Psychic', basicPsychic),
  basicCard('basic-normal', 'Normal', basicNormal),
  basicCard('basic-magenta', 'Magenta', basicMagenta),
  basicCard('basic-midnight', 'Midnight', basicMidnight),
  exCard('fire-ex', 'Fire ex', fireEx),
  exCard('gold-ex', 'Gold ex', goldEx, { rarity: 'epic' }),
  exCard('dark-ex', 'Dark ex', darkEx, { up: true, color: '#fff' }),
  exCard('fairy-ex', 'Fairy ex', fairyEx, { up: true }),
  exCard('sky-ex', 'Sky ex', skyEx, { up: true }),
]

/** Chance that the rare slot in a pull is the epic card instead. */
export const EPIC_CHANCE = 0.1

function shuffle<T>(items: T[]): T[] {
  const pool = [...items]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool
}

const ofRarity = (r: Rarity) => CARDS.filter((c) => c.rarity === r)

/**
 * A pack pull: two different basic cards, then one rare card last.
 * The rare slot has a 1 in 10 chance of being the epic card.
 */
export function pullCards(): CardTemplate[] {
  const basics = shuffle(ofRarity('basic')).slice(0, 2)
  const epics = ofRarity('epic')
  const pool = epics.length && Math.random() < EPIC_CHANCE ? epics : ofRarity('rare')
  return [...basics, shuffle(pool)[0]]
}
