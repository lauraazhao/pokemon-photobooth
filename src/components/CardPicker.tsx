import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Card from './Card'
import { useHoloTilt } from '../lib/useHoloTilt'
import './HoloCard.css'
import { pullCards, type CardTemplate } from '../lib/cards'
import { playLand, playSelect, startVoid } from '../lib/sfx'
import './CardPicker.css'

interface Props {
  onPick: (card: CardTemplate) => void
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Deals the cards pulled from the pack (2 basic + 1 rare); clicking one picks it for the photo. */
export default function CardPicker({ onPick }: Props) {
  const [choices] = useState(pullCards)
  const [picked, setPicked] = useState<string | null>(null)
  const stopVoid = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Each card lands about 0.37s into its drop (see the land animation), 110ms apart.
    if (!reducedMotion()) choices.forEach((_, i) => playLand(0.37 + i * 0.11))
    return () => stopVoid.current?.()
  }, [choices])

  const openVoid = (card: CardTemplate) => {
    if (picked) return
    stopVoid.current?.()
    stopVoid.current = startVoid(card.rarity === 'epic')
  }
  const closeVoid = () => {
    if (picked) return
    stopVoid.current?.()
    stopVoid.current = null
  }

  const pick = (card: CardTemplate) => {
    if (picked) return
    setPicked(card.id)
    playSelect(card.rarity === 'epic')
    // The void hum fades as the portal collapses.
    const stop = stopVoid.current
    stopVoid.current = null
    setTimeout(() => stop?.(), 450)
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
          <li key={card.id} style={{ animationDelay: `${i * 110}ms`, '--spin': `${[-16, 9, 18][i]}deg` } as CSSProperties}>
            <span
              className={`picker-void is-${card.rarity}${picked === card.id ? ' is-picked' : ''}`}
              aria-hidden="true"
            >
              <span className="picker-void-swirl" />
              <span className="picker-void-streaks" />
              <span className="picker-void-core" />
            </span>
            <button
              type="button"
              className={`picker-card is-${card.rarity}${picked === card.id ? ' is-picked' : ''}`}
              onClick={() => pick(card)}
              onPointerEnter={(e) => e.pointerType === 'mouse' && openVoid(card)}
              onPointerLeave={closeVoid}
              onFocus={() => openVoid(card)}
              onBlur={closeVoid}
              disabled={picked !== null}
              aria-label={`Use the ${card.name} card`}
            >
              <PickerTilt>
                <span className="picker-card-scale" style={{ width: card.width, height: card.height }}>
                  <Card template={card} />
                </span>
              </PickerTilt>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The same 3D tilt and foil as the gallery's enlarged card, following the mouse while hovering. */
function PickerTilt({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useHoloTilt(ref, { touch: false })
  return (
    <div className="holo" ref={ref}>
      <div className="holo-tilt">
        {children}
        <div className="holo-foil" aria-hidden="true" />
        <div className="holo-glare" aria-hidden="true" />
      </div>
    </div>
  )
}
