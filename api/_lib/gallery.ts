// Gallery storage on Vercel Blob. Each submission is a photo plus a small JSON
// entry under gallery/approved/, shown right away. Setting the environment
// variable GALLERY_REQUIRE_APPROVAL to "true" holds new entries under
// gallery/pending/ until they're approved on the admin page.
import { del, list, put, rename } from '@vercel/blob'

export type Status = 'pending' | 'approved'

export interface Entry {
  id: string
  name: string
  note: string
  /** ISO date-time the photo was submitted. */
  date: string
  imageUrl: string
}

export const LIMITS = { name: 40, note: 140, imageBytes: 3_000_000 }
export const IMAGE_TYPES = ['image/webp', 'image/jpeg', 'image/png']

const entryPath = (status: Status, id: string) => `gallery/${status}/${id}.json`
const ID_PATTERN = /^[0-9]{13}-[a-z0-9]{8}$/

export const isValidId = (id: unknown): id is string => typeof id === 'string' && ID_PATTERN.test(id)

export const requiresApproval = () => process.env.GALLERY_REQUIRE_APPROVAL === 'true'

export function newId(): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b % 36).toString(36)).join('')
  return `${Date.now()}-${rand}`
}

export async function saveEntry(image: Blob, name: string, note: string): Promise<{ entry: Entry; status: Status }> {
  const id = newId()
  const ext = image.type.split('/')[1]
  const photo = await put(`gallery/photos/${id}.${ext}`, image, {
    access: 'public',
    contentType: image.type,
    addRandomSuffix: true, // keeps photo URLs unguessable
  })
  const entry: Entry = { id, name, note, date: new Date().toISOString(), imageUrl: photo.url }
  const status: Status = requiresApproval() ? 'pending' : 'approved'
  await put(entryPath(status, id), JSON.stringify(entry), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  })
  return { entry, status }
}

/** Entries with the given status, newest first. */
export async function listEntries(status: Status, max = 200): Promise<Entry[]> {
  const blobs: { url: string }[] = []
  let cursor: string | undefined
  do {
    const page = await list({ prefix: `gallery/${status}/`, cursor, limit: 1000 })
    blobs.push(...page.blobs)
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  const entries = await Promise.all(
    blobs.map(async (b) => {
      try {
        const res = await fetch(b.url)
        return res.ok ? ((await res.json()) as Entry) : null
      } catch {
        return null
      }
    }),
  )
  return entries
    .filter((e): e is Entry => e !== null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, max)
}

async function findEntry(id: string): Promise<{ status: Status; url: string } | null> {
  for (const status of ['pending', 'approved'] as const) {
    const { blobs } = await list({ prefix: entryPath(status, id), limit: 1 })
    if (blobs[0]) return { status, url: blobs[0].url }
  }
  return null
}

export async function approveEntry(id: string): Promise<boolean> {
  const found = await findEntry(id)
  if (!found) return false
  if (found.status === 'pending') {
    await rename(found.url, entryPath('approved', id), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    })
  }
  return true
}

export async function deleteEntry(id: string): Promise<boolean> {
  const found = await findEntry(id)
  if (!found) return false
  const entry = (await (await fetch(found.url)).json()) as Entry
  await del([found.url, entry.imageUrl])
  return true
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

/** Collapses whitespace and trims; returns null if it's empty or too long. */
export function cleanText(value: FormDataEntryValue | null, max: number, required: boolean): string | null {
  if (typeof value !== 'string') return required ? null : ''
  const text = value.replace(/\s+/g, ' ').trim()
  if ((required && !text) || text.length > max) return null
  return text
}
