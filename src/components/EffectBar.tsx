import { useEffect, useRef } from 'react'
import { EFFECTS, renderPhoto, type EffectId, type PhotoOptions } from '../lib/effects'
import { playSelect } from '../lib/sfx'

type Base = Omit<PhotoOptions, 'effect' | 'scale'>

/** A small preview of the photo with one effect, on the card's background. */
function Thumb({ base, effect, version }: { base: Base; effect: EffectId; version: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const scale = (64 * (window.devicePixelRatio || 1)) / base.height
    const photo = document.createElement('canvas')
    renderPhoto(photo, { ...base, effect, scale })
    canvas.width = photo.width
    canvas.height = photo.height
    const ctx = canvas.getContext('2d')!
    // Show the card's own background behind the person, as on the card.
    if (base.art?.naturalWidth) {
      const k = base.art.naturalWidth / base.cardWidth
      const b = base.photoBox
      ctx.drawImage(base.art, b.x * k, b.y * k, b.w * k, b.h * k, 0, 0, canvas.width, canvas.height)
    }
    ctx.drawImage(photo, 0, 0)
  }, [base, effect, version])
  return <canvas ref={ref} className="effect-thumb" style={{ aspectRatio: `${base.width} / ${base.height}` }} />
}

interface Props {
  base: Base
  value: EffectId
  onChange: (e: EffectId) => void
  /** Changes whenever a new photo is taken, so the previews redraw. */
  version: number
}

export default function EffectBar({ base, value, onChange, version }: Props) {
  return (
    <div className="effect-bar" role="radiogroup" aria-label="Photo effects">
      {EFFECTS.map((e) => (
        <button
          key={e.id}
          type="button"
          role="radio"
          aria-checked={value === e.id}
          className={value === e.id ? 'effect-option selected' : 'effect-option'}
          onClick={() => {
            if (value !== e.id) playSelect()
            onChange(e.id)
          }}
        >
          <Thumb base={base} effect={e.id} version={version} />
          <span>{e.label}</span>
        </button>
      ))}
    </div>
  )
}
