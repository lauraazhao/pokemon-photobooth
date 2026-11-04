// Photo effects people can pick after taking their photo. Everything is drawn
// into the card's photo canvas, so saving, sharing and the gallery pick it up.
import type { Box } from './cards'
import type { Face } from './faces'

export type EffectId = 'none' | 'bw' | 'bunny' | 'comic'

export const EFFECTS: { id: EffectId; label: string }[] = [
  { id: 'none', label: 'Original' },
  { id: 'bw', label: 'B&W' },
  { id: 'bunny', label: 'Bunny' },
  { id: 'comic', label: 'Comic' },
]

export interface PhotoOptions {
  /** Size of the photo area in CSS pixels. */
  width: number
  height: number
  /** The captured person (cut out, or the raw frame). Drawn mirrored like the preview. */
  person: HTMLCanvasElement
  /** Faces found in the captured frame, in the same pixels as `person`. */
  faces: Face[]
  /** Device pixels per CSS pixel to render at. */
  scale: number
  effect: EffectId
  /** The card art and where the photo sits on it, so B&W can tint the background too. */
  art: HTMLImageElement | null
  cardWidth: number
  photoBox: Box
}

/** Small seeded random numbers, so doodles look the same on every redraw. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** How the captured frame maps onto the photo canvas: cover-fit (mirroring is done separately). */
function coverTransform(sw: number, sh: number, w: number, h: number) {
  const k = Math.max(w / sw, h / sh)
  return { k, ox: (w - sw * k) / 2, oy: (h - sh * k) / 2 }
}

function drawArtBackground(ctx: CanvasRenderingContext2D, o: PhotoOptions, w: number, h: number) {
  if (!o.art || !o.art.naturalWidth) return
  const k = o.art.naturalWidth / o.cardWidth
  const b = o.photoBox
  ctx.drawImage(o.art, b.x * k, b.y * k, b.w * k, b.h * k, 0, 0, w, h)
}

interface Mask {
  w: number
  h: number
  solid: (x: number, y: number) => boolean
  /** False when there's no cutout (the whole frame is opaque). */
  cut: boolean
}

function readMask(person: HTMLCanvasElement): Mask {
  const w = person.width
  const h = person.height
  const data = person.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data
  const solid = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false
    return data[((y | 0) * w + (x | 0)) * 4 + 3] > 128
  }
  // A frame without a cutout is opaque at its corners.
  const cut = !(solid(1, 1) && solid(w - 2, 1) && solid(1, h - 2) && solid(w - 2, h - 2))
  return { w, h, solid, cut }
}

interface Head {
  /** Centre of the top of the head. */
  x: number
  top: number
  width: number
  /** Tilt in radians, clockwise on screen. */
  roll: number
  /** Middle of the face, for aiming the comic rays. */
  cy: number
}

/** Each person's head on the photo canvas: from the faces, with the cutout finding the top of the hair. */
function findHeads(o: PhotoOptions, mask: Mask): Head[] {
  const { k, ox, oy } = coverTransform(o.person.width, o.person.height, mask.w, mask.h)
  const heads: Head[] = []
  for (const f of o.faces) {
    // Mirrored like the photo.
    const cx = mask.w - (ox + (f.x + f.w / 2) * k)
    const fy = oy + f.y * k
    const fw = f.w * k
    const fh = f.h * k
    let top = fy - fh * 0.45
    if (mask.cut) {
      // Walk up from the face until we leave the person: that's the top of their hair.
      let y = fy + fh * 0.2
      const minY = fy - fh * 1.1
      while (y > minY && (mask.solid(cx, y) || mask.solid(cx - fw * 0.15, y) || mask.solid(cx + fw * 0.15, y))) y -= 1
      top = Math.max(minY, y)
    }
    heads.push({ x: cx, top, width: fw * 1.15, roll: -f.roll, cy: fy + fh / 2 })
  }
  if (heads.length || !mask.cut) return heads
  // No face found: use the top of the cutout.
  const minRun = Math.max(3, Math.round(mask.w * 0.02))
  for (let y = 0; y < mask.h; y++) {
    let n = 0
    let l = -1
    let r = -1
    for (let x = 0; x < mask.w; x++) {
      if (mask.solid(x, y)) {
        n++
        if (l < 0) l = x
        r = x
      }
    }
    if (n >= minRun) {
      const width = Math.max(mask.w * 0.14, Math.min(mask.w * 0.4, r - l))
      return [{ x: (l + r) / 2, top: y, width, roll: 0, cy: y + width * 0.6 }]
    }
  }
  return []
}

/** A hand-drawn looking closed shape: points pushed around a little, drawn twice. */
function sketchShape(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  rand: () => number,
  jitter: number,
  fill: string | null,
  line: number,
) {
  const trace = (j: number) => {
    ctx.beginPath()
    points.forEach(([x, y], i) => {
      const px = x + (rand() - 0.5) * j
      const py = y + (rand() - 0.5) * j
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.closePath()
  }
  if (fill) {
    trace(0)
    ctx.fillStyle = fill
    ctx.fill()
  }
  ctx.strokeStyle = '#111'
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.lineWidth = line
  trace(jitter)
  ctx.stroke()
  ctx.lineWidth = line * 0.5
  trace(jitter * 1.6)
  ctx.stroke()
}

function ellipsePoints(cx: number, cy: number, rx: number, ry: number, angle: number, n = 28): [number, number][] {
  const pts: [number, number][] = []
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const x = Math.cos(t) * rx
    const y = Math.sin(t) * ry
    pts.push([cx + x * c - y * s, cy + x * s + y * c])
  }
  return pts
}

/** Two doodled ears standing on top of the head, following its tilt. */
function drawEars(ctx: CanvasRenderingContext2D, head: Head, u: number, seed: number) {
  const rand = rng(seed)
  const hw = head.width
  const earH = hw * 0.55
  const earW = hw * 0.16
  ctx.save()
  ctx.translate(head.x, head.top)
  ctx.rotate(head.roll)
  for (const side of [-1, 1]) {
    const tilt = side * 0.2
    // The base sits a little below the top of the head, so the hair covers the join.
    const bx = side * hw * 0.22
    const by = hw * 0.1
    const cx = bx + Math.sin(tilt) * earH
    const cy = by - Math.cos(tilt) * earH
    sketchShape(ctx, ellipsePoints(cx, cy, earW, earH, tilt), rand, 1.6 * u, '#fff', 2.2 * u)
    sketchShape(ctx, ellipsePoints(cx, cy + earH * 0.06, earW * 0.48, earH * 0.7, tilt), rand, 1.2 * u, '#ffaec9', 1.4 * u)
  }
  ctx.restore()
}

/** Manga-style rays that start at the edge of the people and shoot outward. */
function drawComicRays(ctx: CanvasRenderingContext2D, w: number, h: number, mask: Mask, heads: Head[], u: number) {
  const rand = rng(3)
  ctx.fillStyle = '#fffaf0'
  ctx.fillRect(0, 0, w, h)

  // Aim from the middle of the faces (or the middle of the photo).
  let cx = w / 2
  let cy = h / 2
  if (heads.length) {
    cx = heads.reduce((a, hd) => a + hd.x, 0) / heads.length
    cy = heads.reduce((a, hd) => a + hd.cy, 0) / heads.length
  }
  const far = Math.hypot(w, h)
  const fallback = Math.min(w, h) * 0.3
  const step = Math.max(1, u)
  ctx.fillStyle = '#111'
  const count = 84
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.05
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    // Start where this ray leaves the people: the last solid pixel along it.
    let edge = fallback
    if (mask.cut) {
      // Rays that miss everyone (between two people) still leave a clear burst in the middle.
      edge = heads.length ? heads[0].width * 0.7 : fallback
      for (let r = 0; r < far; r += step) {
        if (mask.solid(cx + dx * r, cy + dy * r)) edge = r
      }
    }
    const r0 = edge + (5 + rand() * 16) * u
    const half = 0.006 + rand() * 0.016
    ctx.beginPath()
    ctx.moveTo(cx + dx * r0, cy + dy * r0)
    ctx.lineTo(cx + Math.cos(a - half) * far, cy + Math.sin(a - half) * far)
    ctx.lineTo(cx + Math.cos(a + half) * far, cy + Math.sin(a + half) * far)
    ctx.closePath()
    ctx.fill()
  }
}

function blackAndWhite(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    // A little extra contrast so it reads like a black and white print.
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = d[i + 1] = d[i + 2] = Math.min(255, Math.max(0, (y - 128) * 1.12 + 128))
  }
  ctx.putImageData(img, 0, 0)
}

/** Draws the captured photo with an effect into the card's photo canvas. */
export function renderPhoto(canvas: HTMLCanvasElement, o: PhotoOptions) {
  const W = Math.round(o.width * o.scale)
  const H = Math.round(o.height * o.scale)
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W
    canvas.height = H
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.clearRect(0, 0, W, H)
  // One unit is a CSS pixel on the card, so line widths look the same at any scale.
  const u = o.scale

  const person = document.createElement('canvas')
  person.width = W
  person.height = H
  if (o.person.width && o.person.height) {
    const { k, ox, oy } = coverTransform(o.person.width, o.person.height, W, H)
    const pctx = person.getContext('2d', { willReadFrequently: true })!
    pctx.translate(W, 0)
    pctx.scale(-1, 1)
    pctx.drawImage(o.person, ox, oy, o.person.width * k, o.person.height * k)
  }

  switch (o.effect) {
    case 'bw':
      drawArtBackground(ctx, o, W, H)
      ctx.drawImage(person, 0, 0)
      blackAndWhite(ctx, W, H)
      break
    case 'comic': {
      const mask = readMask(person)
      drawComicRays(ctx, W, H, mask, findHeads(o, mask), u)
      ctx.drawImage(person, 0, 0)
      break
    }
    case 'bunny': {
      const mask = readMask(person)
      const heads = findHeads(o, mask)
      // Ears go behind each person so their hair covers the join; without a cutout they'd be hidden, so they go in front.
      if (mask.cut) heads.forEach((head, i) => drawEars(ctx, head, u, 7 + i))
      ctx.drawImage(person, 0, 0)
      if (!mask.cut) heads.forEach((head, i) => drawEars(ctx, head, u, 7 + i))
      break
    }
    default:
      ctx.drawImage(person, 0, 0)
  }
}
