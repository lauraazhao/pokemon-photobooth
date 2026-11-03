import { forwardRef, type Ref } from 'react'
import { PHOTO_H, PHOTO_STROKE, PHOTO_W } from '../lib/photoArea'
import typeIcon from '../assets/card/type-lightning.png'
import weaknessIcon from '../assets/card/type-fire.png'
import type { CardData } from '../lib/cardData'
import { useFitText } from '../lib/useFitText'
import './Card.css'

interface CardProps {
  data: CardData
  photoRef: Ref<HTMLCanvasElement>
}

/** The "basic water" card from Figma (node 847:17182), 330 × 460. */
const Card = forwardRef<HTMLDivElement, CardProps>(function Card({ data, photoRef }, ref) {
  // Long text shrinks to fit instead of pushing the layout around.
  const nameRef = useFitText<HTMLParagraphElement>(data.name, 16, 9, 'width')
  const attackRef = useFitText<HTMLParagraphElement>(data.attackName, 16, 9, 'width')
  const textRef = useFitText<HTMLParagraphElement>(data.attackText, 11, 7, 'height')
  return (
    <div className="card" ref={ref}>
      <div className="card-border">
        <div className="card-bg">
          <div className="card-stats">
            <div className="card-header">
              <p className="font-title card-name" ref={nameRef}>
                {data.name}
              </p>
              <div className="card-hp">
                <span className="card-hp-number">
                  <span className="card-hp-label">HP</span>
                  <span className="card-hp-value">{data.hp}</span>
                </span>
                <img className="card-type-icon" src={typeIcon} alt="" />
              </div>
            </div>
            <div className="card-photo" style={{ width: PHOTO_W, height: PHOTO_H }}>
              <canvas
                ref={photoRef}
                style={{
                  left: -PHOTO_STROKE,
                  top: -PHOTO_STROKE,
                  width: PHOTO_W + PHOTO_STROKE * 2,
                  height: PHOTO_H + PHOTO_STROKE * 2,
                }}
              />
            </div>
          </div>
          <div className="card-divider" />
          <div className="card-description">
            <div className="card-power">
              <div className="card-power-icon">
                <img src={typeIcon} alt="" />
              </div>
              <p className="font-title card-attack-name" ref={attackRef}>
                {data.attackName}
              </p>
              <p className="card-damage">{data.attackDamage}</p>
            </div>
            <p className="card-attack-text" ref={textRef}>
              {data.attackText}
            </p>
          </div>
          <div className="card-weakness">
            <span>weakness</span>
            <span className="card-weakness-value">
              <img src={weaknessIcon} alt="" />
              {data.weakness}
            </span>
          </div>
          <p className="card-footer">{data.footer}</p>
        </div>
      </div>
      <div className="card-stage">{data.stage}</div>
    </div>
  )
})

export default Card
