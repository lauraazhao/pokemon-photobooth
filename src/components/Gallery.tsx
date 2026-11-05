import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchGallery, formatDate, type GalleryEntry } from '../lib/gallery'
import HoloCard from './HoloCard'
import { CARDS, pullRate, type Rarity } from '../lib/cards'
import './Gallery.css'

/**
 * Photos people shared from the booth, newest first. Sits below the pack on the start screen.
 * `fresh` (right after someone posts) skips the server cache and scrolls here once loaded.
 */
export default function Gallery({ fresh = false }: { fresh?: boolean }) {
  const [entries, setEntries] = useState<GalleryEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLElement>(null)
  // The card shown big in an overlay, if any.
  const [open, setOpen] = useState<GalleryEntry | null>(null)

  useEffect(() => {
    fetchGallery(fresh).then(setEntries, (e) => {
      console.error(e)
      setFailed(true)
    })
  }, [fresh])

  useEffect(() => {
    if (fresh && (entries || failed)) requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: 'smooth' }))
  }, [fresh, entries, failed])

  return (
    <section ref={ref} className="gallery" id="gallery" aria-labelledby="gallery-title">
      <h2 id="gallery-title" className="gallery-title">
        Gallery
      </h2>
      <p className="gallery-removal">
        Please{' '}
        <a href="https://laurazhao.com/" target="_blank" rel="noopener">
          contact me
        </a>{' '}
        if you want your photo removed.
      </p>
      {failed ? (
        <p className="notice">The gallery couldn’t load right now.</p>
      ) : entries === null ? (
        <p className="notice">Loading photos…</p>
      ) : entries.length === 0 ? (
        <p className="notice">No photos yet. Rip open a pack and be the first!</p>
      ) : (
        <ul className="gallery-grid">
          {entries.map((e) => (
            <li key={e.id} className="gallery-item">
              <button type="button" className="gallery-photo" onClick={() => setOpen(e)} aria-label={`View card by ${e.name}`}>
                <img src={e.imageUrl} alt={`Card by ${e.name}`} loading="lazy" width={330} height={460} />
              </button>
              <div className="gallery-caption">
                <p className="gallery-name">{e.name}</p>
                {e.note && <p className="gallery-note">{e.note}</p>}
                <GalleryMeta entry={e} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && <Lightbox entry={open} onClose={() => setOpen(null)} />}
    </section>
  )
}

/** A shared card shown big over the page. Closes on the background, the button, or Escape. */
function Lightbox({ entry, onClose }: { entry: GalleryEntry; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    const overflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = overflow
    }
  }, [onClose])
  // On the body, so it covers everything (the gallery section is its own layer).
  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Card by ${entry.name}`} onClick={onClose}>
      <figure className="lightbox-figure" onClick={(e) => e.stopPropagation()}>
        <HoloCard src={entry.imageUrl} alt={`Card by ${entry.name}`} />
        <figcaption className="gallery-caption">
          <p className="gallery-name">{entry.name}</p>
          {entry.note && <p className="gallery-note">{entry.note}</p>}
          <GalleryMeta entry={entry} />
        </figcaption>
      </figure>
      <button ref={closeRef} type="button" className="lightbox-close" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>,
    document.body,
  )
}

/**
 * Posts made before the card design was recorded, labelled by hand (by the name on the post).
 * Only used for posts from before that change, so a new post with the same name isn't mistaken for one.
 */
const EARLY_POSTS: Record<string, Rarity> = { mike: 'epic', 'sleep paralysis': 'rare', loro: 'rare', lini: 'basic' }
const EARLY_POSTS_BEFORE = '2026-11-05T02:00:00Z'

function rarityOf(entry: GalleryEntry): Rarity | null {
  if (entry.cardId) return CARDS.find((c) => c.id === entry.cardId)?.rarity ?? null
  if (entry.date >= EARLY_POSTS_BEFORE) return null
  return EARLY_POSTS[entry.name.trim().toLowerCase()] ?? null
}

/** The date on the left and, when known, how likely the card was to be pulled on the right. */
function GalleryMeta({ entry }: { entry: GalleryEntry }) {
  const rarity = rarityOf(entry)
  const rate = rarity ? pullRate(rarity) : null
  return (
    <div className="gallery-meta">
      <time className="gallery-date" dateTime={entry.date}>
        {formatDate(entry.date)}
      </time>
      {rarity && rate !== null && (
        <span className={`gallery-rarity is-${rarity}`} title={`Found in ${formatRate(rate)} of packs`}>
          {rarity === 'basic' ? '' : '★ '}
          {formatRate(rate)} pull rate
        </span>
      )}
    </div>
  )
}

const formatRate = (rate: number) => `${Number((rate * 100).toFixed(1))}%`
