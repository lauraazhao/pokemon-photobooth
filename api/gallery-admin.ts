// Moderation for the gallery. Every request needs the GALLERY_ADMIN_KEY
// (set in Vercel's environment variables) in the x-admin-key header.
// GET: pending and approved entries. POST { id, action: 'approve' | 'delete' }.
import { timingSafeEqual } from 'node:crypto'
import { approveEntry, deleteEntry, isValidId, json, listEntries, requiresApproval } from './_lib/gallery.js'

function authorized(request: Request): boolean {
  const expected = process.env.GALLERY_ADMIN_KEY
  const given = request.headers.get('x-admin-key')
  if (!expected || !given) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  if (!authorized(request)) return json({ error: 'Wrong admin key.' }, 401)
  const [pending, approved] = await Promise.all([listEntries('pending'), listEntries('approved')])
  return json({ pending, approved, requiresApproval: requiresApproval() }, 200, { 'cache-control': 'no-store' })
}

export async function POST(request: Request) {
  if (!authorized(request)) return json({ error: 'Wrong admin key.' }, 401)
  const body = (await request.json().catch(() => null)) as { id?: unknown; action?: unknown } | null
  if (!body || !isValidId(body.id)) return json({ error: 'Unknown entry.' }, 400)
  const done =
    body.action === 'approve' ? await approveEntry(body.id) : body.action === 'delete' ? await deleteEntry(body.id) : null
  if (done === null) return json({ error: 'Unknown action.' }, 400)
  return done ? json({ ok: true }) : json({ error: 'Entry not found.' }, 404)
}
