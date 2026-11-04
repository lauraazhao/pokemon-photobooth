import { useEffect, useState, type CSSProperties } from 'react'
import './Meteors.css'

interface Meteor {
  id: number
  x: number // start, % of viewport width
  y: number // start, % of viewport height
  angle: number // degrees below horizontal; negative heads left
  length: number // tail length in px
  duration: number // seconds
}

let nextId = 0
const rand = (min: number, max: number) => min + Math.random() * (max - min)

function makeMeteor(): Meteor {
  const toLeft = Math.random() < 0.5
  return {
    id: nextId++,
    x: toLeft ? rand(40, 100) : rand(0, 60),
    y: rand(-5, 35),
    angle: (toLeft ? 180 - rand(18, 38) : rand(18, 38)),
    length: rand(120, 200),
    duration: rand(0.9, 1.5),
  }
}

/** A meteor shoots across the starfield every few seconds, behind everything else. */
export default function Meteors() {
  const [meteors, setMeteors] = useState<Meteor[]>([])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let timer: number
    const schedule = (delay: number) => {
      timer = window.setTimeout(() => {
        // Skip while the tab is hidden so meteors don't pile up.
        if (!document.hidden) setMeteors((m) => [...m, makeMeteor()])
        schedule(rand(4000, 9000))
      }, delay)
    }
    schedule(rand(1500, 3500))
    return () => window.clearTimeout(timer)
  }, [])

  const remove = (id: number) => setMeteors((m) => m.filter((x) => x.id !== id))

  return (
    <div className="meteors" aria-hidden="true">
      {meteors.map((m) => (
        <span
          key={m.id}
          className="meteor"
          onAnimationEnd={() => remove(m.id)}
          style={
            {
              left: `${m.x}%`,
              top: `${m.y}%`,
              '--angle': `${m.angle}deg`,
              '--len': `${m.length}px`,
              animationDuration: `${m.duration}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
