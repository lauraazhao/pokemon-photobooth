// GET: approved gallery entries. POST: submit a photo (multipart form: image, name, note, card).
import { IMAGE_TYPES, LIMITS, cleanText, json, listEntries, requiresApproval, saveEntry } from './_lib/gallery.js'

export async function GET() {
  const entries = await listEntries('approved')
  // Cache briefly at the edge so a busy gallery doesn't hit storage on every visit.
  return json({ entries }, 200, { 'cache-control': 'public, s-maxage=30, stale-while-revalidate=300' })
}

export async function POST(request: Request) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json({ error: 'Expected a form upload.' }, 400)
  }
  // Honeypot: a hidden field people never fill in, but simple bots do.
  if (form.get('website')) return json({ ok: true, pending: true })

  const image = form.get('image')
  if (!(image instanceof Blob) || !IMAGE_TYPES.includes(image.type)) return json({ error: 'Missing photo.' }, 400)
  if (image.size > LIMITS.imageBytes) return json({ error: 'That photo is too large.' }, 413)
  const name = cleanText(form.get('name'), LIMITS.name, true)
  if (name === null) return json({ error: `Add your name (up to ${LIMITS.name} characters).` }, 400)
  const note = cleanText(form.get('note'), LIMITS.note, false)
  if (note === null) return json({ error: `Keep the note under ${LIMITS.note} characters.` }, 400)

  // The card design's id, for showing its rarity. Optional, and ignored if it doesn't look like one.
  const card = form.get('card')
  const cardId = typeof card === 'string' && /^[a-z0-9-]{1,40}$/.test(card) ? card : undefined

  const { entry, status } = await saveEntry(image, name, note, cardId)
  return json({ ok: true, pending: status === 'pending' && requiresApproval(), entry }, 201)
}
