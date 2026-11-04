import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { playRip, playWhoosh, startTear, unlockAudio } from '../lib/sfx'
import packUrl from '../assets/pack/card-pack.png'
import './Card.css'
import './PackIntro.css'

/** Pack size in Figma ("card pack", node 843:16734). */
const PACK_W = 392
const PACK_H = 571
/** The tear runs right under the hole punch (which ends at y = 51 in Figma). */
const SEAM_Y = 60
const SEAM_PCT = (SEAM_Y / PACK_H) * 100
/** How far (as a share of the pack width) a swipe must travel to rip it open. */
const RIP_DISTANCE = 0.55

type Phase = 'idle' | 'dragging' | 'ripped' | 'pulling' | 'fading'

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
const pt = ([x, y]: [number, number]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`
// The top strip and the body share the same jagged edge.
const TOP_CLIP = `polygon(0% 0%, 100% 0%, ${[...TEAR].reverse().map(pt).join(', ')})`
const BODY_CLIP = `polygon(${TEAR.map(pt).join(', ')}, 100% 100%, 0% 100%)`

/** The parts of the pointing-hand icon; the index fingertip is at (11.5, 1). */
function HandShapes() {
  return (
    <>
      <rect x="9" y="1" width="5" height="17" rx="2.5" />
      <rect x="13.4" y="10" width="4.6" height="9" rx="2.3" />
      <rect x="17.4" y="11.4" width="4.3" height="8.4" rx="2.15" />
      <rect x="21" y="13.2" width="3.7" height="7.4" rx="1.85" />
      <rect x="8" y="15" width="16.6" height="14" rx="5" />
      <rect x="3.2" y="14" width="4.2" height="10" rx="2.1" transform="rotate(-32 5.3 19)" />
    </>
  )
}

interface Props {
  /** Called once the pack has ripped and faded out. */
  onOpened: () => void
}

/**
 * The sealed card pack shown when the photobooth starts. Swipe across the
 * seam (either direction) to rip the top off; the strip peels up as you drag.
 */
export default function PackIntro({ onOpened }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const drag = useRef<{ id: number; startX: number; lastX: number; width: number } | null>(null)
  const tear = useRef<ReturnType<typeof startTear> | null>(null)
  const tearIdle = useRef(0)

  const stopTear = () => {
    window.clearTimeout(tearIdle.current)
    tear.current?.stop()
    tear.current = null
  }

  const finish = (direction: 1 | -1) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    drag.current = null
    stopTear()
    playRip()
    setDir(direction)
    setProgress(1)
    setPhase('ripped')
    // Timings match the animations in PackIntro.css: the strip flies off,
    // three cards shoot up out of the pack too fast to see, then the pack fades.
    if (reduced) return setTimeout(onOpened, 0)
    setTimeout(() => {
      setPhase('pulling')
      playWhoosh()
    }, 300)
    setTimeout(() => setPhase('fading'), 800)
    setTimeout(onOpened, 1150)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (phase !== 'idle') return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, startX: e.clientX, lastX: e.clientX, width: e.currentTarget.getBoundingClientRect().width }
    setPhase('dragging')
    unlockAudio()
    tear.current = startTear()
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.startX
    const p = Math.min(1, Math.abs(dx) / (d.width * RIP_DISTANCE))
    const direction = dx >= 0 ? 1 : -1
    if (p >= 1) return finish(direction)
    // The tearing sound follows how fast the finger moves, and goes quiet when it stops.
    // (Measured from clientX: touch screens don't report movementX.)
    tear.current?.set(Math.abs(e.clientX - d.lastX) / 8)
    d.lastX = e.clientX
    window.clearTimeout(tearIdle.current)
    tearIdle.current = window.setTimeout(() => tear.current?.set(0), 80)
    setDir(direction)
    setProgress(p)
  }

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    // Not far enough: the strip settles back into place.
    drag.current = null
    stopTear()
    setProgress(0)
    setPhase('idle')
  }

  // The torn strip pivots on the end that is still attached.
  const topStyle: CSSProperties = {
    backgroundImage: `url(${packUrl})`,
    clipPath: TOP_CLIP,
    transformOrigin: `${dir === 1 ? 100 : 0}% ${SEAM_PCT}%`,
    transform:
      phase === 'ripped' || phase === 'pulling' || phase === 'fading'
        ? `translate(${dir * 150}px, -110px) rotate(${dir * 30}deg)`
        : `translateY(${-3 * progress}px) rotate(${dir * 7 * progress}deg)`,
  }

  return (
    <div className={`pack-intro pack-${phase}`}>
      <p className="pack-prompt">
        {/* Arched like the Photomon! logo, on a curved ribbon banner. */}
        <svg className="pack-title" viewBox="0 0 800 200" role="img" aria-label="Trading Card Photobooth">
          <g className="ribbon" aria-hidden="true">
            {/* Forked tails tucked behind each end, with a darker fold where the band turns under. */}
            {[false, true].map((flip) => (
              <g key={String(flip)} transform={flip ? 'matrix(-1 0 0 1 800 0)' : undefined}>
                <g transform="rotate(-10 84 130)">
                  <path className="ribbon-tail" d="M 120 122 L 18 122 L 44 154 L 18 186 L 120 186 Z" />
                  <path className="ribbon-fold" d="M 82 166 L 120 160 L 120 186 Z" />
                </g>
              </g>
            ))}
            <path className="ribbon-band" d="M 80 98 Q 400 8 720 98 L 720 168 Q 400 78 80 168 Z" />
            <path className="ribbon-stitch" d="M 88 108 Q 400 18 712 108" />
            <path className="ribbon-stitch" d="M 88 158 Q 400 68 712 158" />
          </g>
          <path id="pack-title-arc" d="M 70 142 Q 400 50 730 142" fill="none" />
          <text textAnchor="middle">
            <textPath href="#pack-title-arc" startOffset="50%">
              Trading Card Photobooth
            </textPath>
          </text>
        </svg>
        <strong>Rip open the pack to start</strong>
      </p>
      <div
        className="pack"
        style={{ aspectRatio: `${PACK_W} / ${PACK_H}`, '--seam': `${SEAM_PCT}%` } as CSSProperties}
        role="button"
        tabIndex={0}
        aria-label="Rip open the pack (swipe across the top, or press Enter)"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={(e) => {
          if (phase === 'idle' && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            finish(1)
          }
        }}
      >
 {/* Cards that whoosh out of the opening; behind the pack body so they rise out of it. */}
        <div className="pack-pull" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="pack-pull-card" style={{ '--i': i } as CSSProperties} />
          ))}
          <span className="pack-pull-flash" />
        </div>
        <div className="pack-layer pack-body" style={{ backgroundImage: `url(${packUrl})`, clipPath: BODY_CLIP }} />
        <div className="pack-layer pack-top" style={topStyle} />
        {/* The same holo sweep as the rare cards (styles in Card.css), shaped to the pack; gone once you start ripping. */}
        <div
          className="card-holo pack-holo"
          style={{ WebkitMaskImage: `url(${packUrl})`, maskImage: `url(${packUrl})` }}
          aria-hidden="true"
        />
        <div className="pack-hint" aria-hidden="true">
          <div className="pack-hint-line" />
          <svg className="pack-hint-finger" viewBox="0 0 26 32" width="36" height="44">
            {/* Pointing hand: shapes drawn once as an outline, then filled on top so they merge. */}
            <g fill="#1d1d1f" stroke="#1d1d1f" strokeWidth="2.6" strokeLinejoin="round">
              <HandShapes />
            </g>
            <g fill="#fff">
              <HandShapes />
            </g>
          </svg>
        </div>
      </div>
    </div>
  )
}
