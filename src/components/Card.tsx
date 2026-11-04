import { forwardRef, type CSSProperties, type Ref } from 'react'
import type { Box, CardTemplate } from '../lib/cards'
import type { CardData } from '../lib/cardData'
import { useFitText } from '../lib/useFitText'
import './Card.css'

interface CardProps {
  template: CardTemplate
  /** Leave out to show the card as it comes, with its sample text and no photo. */
  data?: CardData
  photoRef?: Ref<HTMLCanvasElement>
}

const place = (b: Box): CSSProperties => ({ left: b.x, top: b.y, width: b.w, height: b.h })

/** The shimmer covers the card's shape (masked by the art) with a hole over the photo. */
function holoStyle(t: CardTemplate): CSSProperties {
  const { x, y, w, h } = t.photo
  const W = t.width
  const H = t.height
  return {
    WebkitMaskImage: `url(${t.art})`,
    maskImage: `url(${t.art})`,
    clipPath: `polygon(evenodd, 0 0, ${W}px 0, ${W}px ${H}px, 0 ${H}px, 0 0, ${x}px ${y}px, ${x}px ${y + h}px, ${x + w}px ${y + h}px, ${x + w}px ${y}px, ${x}px ${y}px)`,
  }
}

/** A card design from Figma: the card art, the person on the photo area, and the editable text on top. */
const Card = forwardRef<HTMLDivElement, CardProps>(function Card({ template: t, data, photoRef }, ref) {
  const text = data ?? t.defaults
  // Long text shrinks to fit instead of spilling out of its spot.
  const nameRef = useFitText<HTMLParagraphElement>(text.name, 16, 9, 'width')
  const attackRef = useFitText<HTMLParagraphElement>(text.attackName, 16, 9, 'width')
  const textRef = useFitText<HTMLParagraphElement>(text.attackText, 11, 7, 'height')
  return (
    <div className="card" ref={ref} style={{ width: t.width, height: t.height, color: t.color }}>
      <img className="card-art" src={t.art} alt="" draggable={false} />
      {photoRef && <canvas className="card-photo" ref={photoRef} style={place(t.photo)} />}
      {t.front && <img className="card-art" src={t.front} alt="" draggable={false} />}
      {/* Rare and epic cards shimmer like a holo card. Shown on screen only (saving skips it); the photo stays clear. */}
      {t.rarity !== 'basic' && <div className={`card-holo is-${t.rarity}`} style={holoStyle(t)} aria-hidden="true" />}
      <p className="card-text font-title card-name" ref={nameRef} style={place(t.title)}>
        {text.name}
      </p>
      <p className="card-text font-title card-attack-name" ref={attackRef} style={place(t.ability)}>
        {text.attackName}
      </p>
      <p className="card-text card-attack-text" ref={textRef} style={place(t.description)}>
        {text.attackText}
      </p>
    </div>
  )
})

export default Card
