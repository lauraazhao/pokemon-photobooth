import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { formatDate, type GalleryEntry } from '../lib/gallery'
import './Gallery.css'

const KEY_STORAGE = 'photomon-admin-key'

const readKey = () => {
  try {
    return sessionStorage.getItem(KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

interface AdminData {
  pending: GalleryEntry[]
  approved: GalleryEntry[]
  requiresApproval: boolean
}

type LoadResult =
  | { kind: 'ok'; data: AdminData }
  | { kind: 'unauthorized'; message: string }
  | { kind: 'error'; message: string }

async function fetchAdmin(adminKey: string): Promise<LoadResult> {
  try {
    const res = await fetch('/api/gallery-admin', { headers: { 'x-admin-key': adminKey } })
    if (res.status === 401) return { kind: 'unauthorized', message: 'That key didn’t work.' }
    if (!res.ok) return { kind: 'error', message: `Couldn’t load the gallery (${res.status}).` }
    return { kind: 'ok', data: (await res.json()) as AdminData }
  } catch {
    return { kind: 'error', message: 'Couldn’t reach the server.' }
  }
}

/** Moderation page at /#admin: delete gallery photos (and approve them, if approval is turned on). */
export default function GalleryAdmin() {
  const [key, setKey] = useState(readKey)
  const [draft, setDraft] = useState('')
  const [data, setData] = useState<AdminData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback((adminKey: string) => {
    fetchAdmin(adminKey).then((result) => {
      if (result.kind === 'unauthorized') setKey('')
      setError(result.kind === 'ok' ? null : result.message)
      if (result.kind === 'ok') setData(result.data)
    })
  }, [])

  useEffect(() => {
    if (key) load(key)
  }, [key, load])

  const signIn = (e: FormEvent) => {
    e.preventDefault()
    try {
      sessionStorage.setItem(KEY_STORAGE, draft)
    } catch {
      // Not saved; the key still works until the page is closed.
    }
    setKey(draft)
  }

  const act = async (entry: GalleryEntry, action: 'approve' | 'delete') => {
    if (action === 'delete' && !window.confirm(`Delete the card from ${entry.name}? This can’t be undone.`)) return
    setBusy(entry.id)
    try {
      const res = await fetch('/api/gallery-admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ id: entry.id, action }),
      })
      if (!res.ok) setError(`That didn’t work (${res.status}).`)
      load(key)
    } finally {
      setBusy(null)
    }
  }

  if (!key) {
    return (
      <main>
        <section className="panel">
          <h2>Gallery admin</h2>
          <p className="panel-hint">Enter the admin key to manage gallery photos.</p>
          <form className="editor" onSubmit={signIn}>
            <fieldset>
              <div className="editor-field">
                <label htmlFor="admin-key">Admin key</label>
                <input id="admin-key" type="password" value={draft} onChange={(e) => setDraft(e.target.value)} />
              </div>
              {error && <p className="form-error">{error}</p>}
              <button type="submit" className="primary" disabled={!draft}>
                Sign in
              </button>
            </fieldset>
          </form>
        </section>
      </main>
    )
  }

  const section = (title: string, entries: GalleryEntry[], canApprove: boolean) => (
    <section className="gallery" aria-label={title}>
      <h2 className="gallery-title">
        {title} ({entries.length})
      </h2>
      {entries.length === 0 ? (
        <p className="notice">Nothing here.</p>
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
              <div className="actions">
                {canApprove && (
                  <button className="primary" disabled={busy === e.id} onClick={() => act(e, 'approve')}>
                    Approve
                  </button>
                )}
                <button disabled={busy === e.id} onClick={() => act(e, 'delete')}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  return (
    <main>
      <h1>Gallery admin</h1>
      {error && <p className="notice">{error}</p>}
      {!data ? (
        <p className="notice">Loading…</p>
      ) : (
        <>
          {(data.requiresApproval || data.pending.length > 0) && section('Waiting for approval', data.pending, true)}
          {section('In the gallery', data.approved, false)}
        </>
      )}
    </main>
  )
}
