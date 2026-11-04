import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchGallery, formatDate, type GalleryEntry } from '../lib/gallery'
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
                <time className="gallery-date" dateTime={e.date}>
                  {formatDate(e.date)}
                </time>
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
        <img src={entry.imageUrl} alt={`Card by ${entry.name}`} width={330} height={460} />
        <figcaption className="gallery-caption">
          <p className="gallery-name">{entry.name}</p>
          {entry.note && <p className="gallery-note">{entry.note}</p>}
          <time className="gallery-date" dateTime={entry.date}>
            {formatDate(entry.date)}
          </time>
        </figcaption>
      </figure>
      <button ref={closeRef} type="button" className="lightbox-close" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>,
    document.body,
  )
}
