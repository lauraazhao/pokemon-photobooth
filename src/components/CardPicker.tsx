import { useState } from 'react'
import Card from './Card'
import { pullCards, type CardTemplate } from '../lib/cards'
import './CardPicker.css'

interface Props {
  onPick: (card: CardTemplate) => void
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Deals the cards pulled from the pack (2 basic + 1 rare); clicking one picks it for the photo. */
export default function CardPicker({ onPick }: Props) {
  const [choices] = useState(pullCards)
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
        Choose a card
      </h2>
      <ul className="picker-cards">
        {choices.map((card, i) => (
          <li key={card.id} style={{ animationDelay: `${i * 140}ms` }}>
            <span className={`picker-void${picked === card.id ? ' is-picked' : ''}`} aria-hidden="true">
              <span className="picker-void-swirl" />
              <span className="picker-void-streaks" />
              <span className="picker-void-core" />
            </span>
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
          </li>
        ))}
      </ul>
    </section>
  )
}
