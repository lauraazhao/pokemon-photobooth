import { useState } from 'react'
import Card from './Card'
import { CARDS, pickRandomCards, type CardTemplate } from '../lib/cards'
import './CardPicker.css'

interface Props {
  onPick: (card: CardTemplate) => void
  /** How many cards to offer. */
  count?: number
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Shows a few random cards from the pack; clicking one picks it for the photo. */
export default function CardPicker({ onPick, count = 3 }: Props) {
  const [choices] = useState(() => pickRandomCards(Math.min(count, CARDS.length)))
  const [picked, setPicked] = useState<string | null>(null)

  const pick = (card: CardTemplate) => {
    if (picked) return
    setPicked(card.id)
    // Let the chosen card lift and the others fade before moving on.
    setTimeout(() => onPick(card), reducedMotion() ? 0 : 650)
  }

  return (
    <section className={`picker${picked ? ' has-pick' : ''}`} aria-labelledby="picker-title">
      <h2 id="picker-title" className="picker-title">
        Choose your card
      </h2>
      <p className="picker-hint">You pulled {choices.length} cards. Pick one for your photo.</p>
      <ul className="picker-cards">
        {choices.map((card, i) => (
          <li key={card.id} style={{ animationDelay: `${i * 140}ms` }}>
            <button
              type="button"
              className={`picker-card${picked === card.id ? ' is-picked' : ''}`}
              onClick={() => pick(card)}
              disabled={picked !== null}
              aria-label={`Use the ${card.name} card`}
            >
              <span className="picker-card-scale" style={{ width: card.width, height: card.height }}>
                <Card template={card} />
              </span>
            </button>
            <span className="picker-card-name">{card.name}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
