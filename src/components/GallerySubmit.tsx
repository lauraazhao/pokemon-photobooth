import { useState, type FormEvent, type RefObject } from 'react'
import { GALLERY_LIMITS, cardImage, submitToGallery } from '../lib/gallery'

interface Props {
  cardRef: RefObject<HTMLDivElement | null>
  /** Go to the start screen's gallery. */
  onViewGallery: () => void
}

type State = { kind: 'idle' } | { kind: 'sending' } | { kind: 'done'; pending: boolean } | { kind: 'error'; message: string }

/** Lets people share their finished card to the public gallery with their name and a note. */
export default function GallerySubmit({ cardRef, onViewGallery }: Props) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [website, setWebsite] = useState('') // honeypot, hidden from people
  const [state, setState] = useState<State>({ kind: 'idle' })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!cardRef.current || !name.trim() || state.kind === 'sending') return
    setState({ kind: 'sending' })
    try {
      const image = await cardImage(cardRef.current)
      if (website) throw new Error('Something went wrong. Try again in a moment.')
      const { pending } = await submitToGallery(image, name, note)
      setState({ kind: 'done', pending })
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' })
    }
  }

  if (state.kind === 'done') {
    return (
      <aside className="panel gallery-submit" aria-live="polite">
        <h2>{state.pending ? 'Sent!' : 'Posted!'}</h2>
        <p className="panel-hint">
          {state.pending ? 'Your card will show in the gallery once it’s approved.' : 'Your card is in the gallery.'}
        </p>
        <button type="button" className="primary" onClick={onViewGallery}>
          See the gallery
        </button>
      </aside>
    )
  }

  return (
    <aside className="panel gallery-submit" aria-label="Share to the gallery">
      <h2>Share to the gallery</h2>
      <p className="panel-hint">Your card will be public on this site.</p>
      <form className="editor" onSubmit={submit}>
        <fieldset disabled={state.kind === 'sending'}>
          <div className="editor-field">
            <label htmlFor="gallery-name">
              Your name
              <span className="editor-count">
                {name.length}/{GALLERY_LIMITS.name}
              </span>
            </label>
            <input
              id="gallery-name"
              type="text"
              required
              autoComplete="given-name"
              maxLength={GALLERY_LIMITS.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="editor-field">
            <label htmlFor="gallery-note">
              Note (optional)
              <span className="editor-count">
                {note.length}/{GALLERY_LIMITS.note}
              </span>
            </label>
            <textarea
              id="gallery-note"
              rows={2}
              maxLength={GALLERY_LIMITS.note}
              value={note}
              onChange={(e) => setNote(e.target.value.replace(/\n/g, ' '))}
            />
          </div>
          <input
            className="visually-hidden"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
          {state.kind === 'error' && (
            <p className="form-error" role="alert">
              {state.message}
            </p>
          )}
          <p className="form-note">
            Please{' '}
            <a href="https://laurazhao.com/" target="_blank" rel="noopener">
              contact me
            </a>{' '}
            if you want your photo removed.
          </p>
          <button type="submit" className="primary" disabled={!name.trim()}>
            {state.kind === 'sending' ? 'Posting…' : 'Post to gallery'}
          </button>
        </fieldset>
      </form>
    </aside>
  )
}
