import { useRef, type CSSProperties } from 'react'
import { useHoloTilt } from '../lib/useHoloTilt'
import './HoloCard.css'

/**
 * A card image that tilts toward the pointer (or finger, or phone tilt) with a rainbow foil
 * and a glare that follow it, like holding a real holo card under a light.
 */
export default function HoloCard({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useHoloTilt(ref, { touch: true })
  return (
    <div className="holo" ref={ref} style={{ '--mx': '50%', '--my': '50%' } as CSSProperties}>
      <div className="holo-tilt">
        <img src={src} alt={alt} width={330} height={460} draggable={false} />
        <div className="holo-foil" aria-hidden="true" />
        <div className="holo-glare" aria-hidden="true" />
      </div>
    </div>
  )
}
