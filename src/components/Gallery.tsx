import { useEffect, useRef, useState } from 'react'
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
              <a href={e.imageUrl} target="_blank" rel="noopener" className="gallery-photo">
                <img src={e.imageUrl} alt={`Card by ${e.name}`} loading="lazy" width={330} height={460} />
              </a>
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
    </section>
  )
}
