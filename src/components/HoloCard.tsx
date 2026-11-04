import { useEffect, useRef, type CSSProperties } from 'react'

/**
 * A card image that tilts toward the pointer (or finger, or phone tilt) with a rainbow foil
 * and a glare that follow it, like holding a real holo card under a light.
 */
export default function HoloCard({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    // x and y are where the light hits, 0..1 across the card.
    const set = (x: number, y: number, active: boolean) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const dx = x - 0.5
        const dy = y - 0.5
        el.style.setProperty('--mx', `${x * 100}%`)
        el.style.setProperty('--my', `${y * 100}%`)
        el.style.setProperty('--rx', `${reduced ? 0 : -dy * 26}deg`)
        el.style.setProperty('--ry', `${reduced ? 0 : dx * 26}deg`)
        // How far from the centre: the foil and glare get stronger toward the edges.
        el.style.setProperty('--hyp', `${Math.min(1, Math.hypot(dx, dy) * 2)}`)
        el.classList.toggle('is-active', active)
      })
    }
    const fromPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      set(
        Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
        Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
        true,
      )
    }
    const reset = () => set(0.5, 0.5, false)
    // Phones that report their tilt without asking (most Android browsers).
    const fromTilt = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null || el.classList.contains('is-touching')) return
      const x = 0.5 + Math.max(-0.5, Math.min(0.5, e.gamma / 40))
      const y = 0.5 + Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 40))
      set(x, y, true)
    }
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') el.classList.add('is-touching')
      fromPointer(e)
    }
    const up = () => {
      el.classList.remove('is-touching')
      reset()
    }
    el.addEventListener('pointermove', fromPointer)
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerleave', up)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    window.addEventListener('deviceorientation', fromTilt)
    reset()
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointermove', fromPointer)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointerleave', up)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      window.removeEventListener('deviceorientation', fromTilt)
    }
  }, [])

  return (
    <div className="holo-card" ref={ref} style={{ '--mx': '50%', '--my': '50%' } as CSSProperties}>
      <div className="holo-card-tilt">
        <img src={src} alt={alt} width={330} height={460} draggable={false} />
        <div className="holo-card-foil" aria-hidden="true" />
        <div className="holo-card-glare" aria-hidden="true" />
      </div>
    </div>
  )
}
