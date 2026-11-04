import { canvasToBlob as toBlob, renderCard } from './renderCard'

export interface GalleryEntry {
  id: string
  name: string
  note: string
  date: string
  imageUrl: string
}

export const GALLERY_LIMITS = { name: 40, note: 140 }

/** `fresh` skips the short server cache, e.g. right after posting a card. */
export async function fetchGallery(fresh = false): Promise<GalleryEntry[]> {
  const res = await fetch(fresh ? `/api/gallery?t=${Date.now()}` : '/api/gallery')
  if (!res.ok) throw new Error(`Gallery request failed (${res.status})`)
  return ((await res.json()) as { entries: GalleryEntry[] }).entries
}

/** Renders the finished card to a compact image for upload (WebP, or JPEG where WebP isn't supported). */
export async function cardImage(card: HTMLElement): Promise<Blob> {
  const canvas = await renderCard(card, 2)
  const webp = await toBlob(canvas, 'image/webp', 0.9)
  if (webp && webp.type === 'image/webp') return webp
  // JPEG has no transparency, so fill the rounded corners with the page color.
  const flat = document.createElement('canvas')
  flat.width = canvas.width
  flat.height = canvas.height
  const ctx = flat.getContext('2d')!
  ctx.fillStyle = '#070b24'
  ctx.fillRect(0, 0, flat.width, flat.height)
  ctx.drawImage(canvas, 0, 0)
  const jpeg = await toBlob(flat, 'image/jpeg', 0.9)
  if (!jpeg) throw new Error('Could not render the card')
  return jpeg
}

export async function submitToGallery(image: Blob, name: string, note: string): Promise<{ pending: boolean }> {
  const form = new FormData()
  form.append('image', image, `card.${image.type.split('/')[1]}`)
  form.append('name', name)
  form.append('note', note)
  const res = await fetch('/api/gallery', { method: 'POST', body: form })
  const body = (await res.json().catch(() => ({}))) as { error?: string; pending?: boolean }
  if (!res.ok) throw new Error(body.error ?? 'Something went wrong. Try again in a moment.')
  return { pending: Boolean(body.pending) }
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
