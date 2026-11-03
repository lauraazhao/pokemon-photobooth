import { useState } from 'react'
import packUrl from '../assets/pack/card-pack.png'
import './PackIntro.css'

/** Pack size in Figma ("card pack", node 843:16734). */
const PACK_W = 392
const PACK_H = 571
/** The tear runs just under the striped top seam (21px tall in Figma). */
const SEAM_Y = 24

type Phase = 'idle' | 'ripping' | 'fading'

/** Jagged tear line across the pack, as [x%, y%] points from left to right. */
function tearLine(): [number, number][] {
  const pts: [number, number][] = []
  const steps = 22
  for (let i = 0; i <= steps; i++) {
    // Deterministic zig-zag with a little variation so it looks torn, not sawn.
    const wobble = (i % 2 === 0 ? -1 : 1) * (2.2 + ((i * 37) % 5) * 0.6)
    pts.push([(i / steps) * 100, ((SEAM_Y + wobble) / PACK_H) * 100])
  }
  return pts
}

const TEAR = tearLine()
// The top strip and the body share the same jagged edge.
const TOP_CLIP = `polygon(0% 0%, 100% 0%, ${[...TEAR].reverse().map((p) => pt(p)).join(', ')})`
const BODY_CLIP = `polygon(${TEAR.map((p) => pt(p)).join(', ')}, 100% 100%, 0% 100%)`

function pt([x, y]: [number, number]) {
  return `${x.toFixed(2)}% ${y.toFixed(2)}%`
}

interface Props {
  /** Called once the pack has ripped and faded out. */
  onOpened: () => void
}

/** The sealed card pack shown when the photobooth starts. */
export default function PackIntro({ onOpened }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')

  const rip = () => {
    if (phase !== 'idle') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setPhase('ripping')
    // Timings match the CSS animations in PackIntro.css.
    setTimeout(() => setPhase('fading'), reduced ? 0 : 900)
    setTimeout(onOpened, reduced ? 0 : 1500)
  }

  const layer = { backgroundImage: `url(${packUrl})` }

  return (
    <div className={`pack-intro pack-${phase}`}>
      <div className="pack" style={{ aspectRatio: `${PACK_W} / ${PACK_H}` }} role="img" aria-label="Sealed Photomon card pack">
        <div className="pack-layer pack-body" style={{ ...layer, clipPath: BODY_CLIP }} />
        <div className="pack-layer pack-top" style={{ ...layer, clipPath: TOP_CLIP }} />
      </div>
      <button className="primary" onClick={rip} disabled={phase !== 'idle'}>
        Rip open
      </button>
    </div>
  )
}
