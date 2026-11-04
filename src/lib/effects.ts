// Photo effects people can pick after taking their photo. Everything is drawn
// into the card's photo canvas, so saving, sharing and the gallery pick it up.
import type { Box } from './cards'

export type EffectId = 'none' | 'bw' | 'sepia' | 'bunny' | 'comic' | 'sparkle'

export const EFFECTS: { id: EffectId; label: string }[] = [
  { id: 'none', label: 'Original' },
  { id: 'bw', label: 'B&W' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'bunny', label: 'Bunny' },
  { id: 'comic', label: 'Comic' },
  { id: 'sparkle', label: 'Sparkle' },
]

export interface PhotoOptions {
  /** Size of the photo area in CSS pixels. */
  width: number
  height: number
  /** The captured person (cut out, or the raw frame). Drawn mirrored like the preview. */
  person: HTMLCanvasElement
  /** Device pixels per CSS pixel to render at. */
  scale: number
  effect: EffectId
  /** The card art and where the photo sits on it, so color filters can tint the background too. */
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

function drawPersonCover(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, w: number, h: number) {
  if (!src.width || !src.height) return
  const k = Math.max(w / src.width, h / src.height)
  const dw = src.width * k
  const dh = src.height * k
  ctx.save()
  ctx.translate(w, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh)
  ctx.restore()
}

function drawArtBackground(ctx: CanvasRenderingContext2D, o: PhotoOptions, w: number, h: number) {
  if (!o.art || !o.art.naturalWidth) return
  const k = o.art.naturalWidth / o.cardWidth
  const b = o.photoBox
  ctx.drawImage(o.art, b.x * k, b.y * k, b.w * k, b.h * k, 0, 0, w, h)
}

/** Where the person's head is, from the cutout's transparency. */
function findHead(person: HTMLCanvasElement) {
  const w = person.width
  const h = person.height
  const data = person.getContext('2d')!.getImageData(0, 0, w, h).data
  const solid = (x: number, y: number) => data[(y * w + x) * 4 + 3] > 128
  let top = -1
  const minRun = Math.max(3, Math.round(w * 0.02))
  for (let y = 0; y < h && top < 0; y++) {
    let n = 0
    for (let x = 0; x < w; x++) if (solid(x, y)) n++
    if (n >= minRun) top = y
  }
  if (top < 0) return { x: w / 2, top: h * 0.15, width: w * 0.3 }
  // Measure the head a little below its top.
  const y2 = Math.min(h - 1, top + Math.round(h * 0.1))
  let l = -1
  let r = -1
  for (let x = 0; x < w; x++) {
    if (solid(x, y2)) {
      if (l < 0) l = x
      r = x
    }
  }
  if (l < 0) return { x: w / 2, top, width: w * 0.3 }
  const width = Math.min(w * 0.5, Math.max(w * 0.14, r - l))
  return { x: (l + r) / 2, top, width }
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

/** Draws the ears. Returns false if the head is too close to the top for them to show behind it. */
function drawBunnyEars(ctx: CanvasRenderingContext2D, head: ReturnType<typeof findHead>, u: number, front: boolean) {
  const rand = rng(7)
  const hw = head.width
  const earH = hw * 0.62
  const earW = hw * 0.18
  // Ears are ~2 ear-lengths tall above their base; keep the tips on the photo.
  const minBase = earH * 1.9 + 3 * u
  const tooHigh = head.top + hw * 0.12 < minBase
  if (tooHigh && !front) return false
  for (const side of [-1, 1]) {
    const tilt = side * 0.22
    const baseX = head.x + side * hw * 0.24
    const baseY = Math.max(head.top + hw * 0.12, front ? minBase : 0)
    // Centre of the ear, up and slightly outward from where it meets the head.
    const cx = baseX + Math.sin(tilt) * earH
    const cy = baseY - Math.cos(tilt) * earH
    sketchShape(ctx, ellipsePoints(cx, cy, earW, earH, tilt), rand, 1.6 * u, '#fff', 2.2 * u)
    sketchShape(ctx, ellipsePoints(cx, cy + earH * 0.08, earW * 0.48, earH * 0.7, tilt), rand, 1.2 * u, '#ffaec9', 1.4 * u)
  }
  return true
}

function drawComicLines(ctx: CanvasRenderingContext2D, w: number, h: number, cx: number, cy: number, u: number) {
  const rand = rng(3)
  ctx.fillStyle = '#fffaf0'
  ctx.fillRect(0, 0, w, h)
  const far = Math.hypot(w, h)
  const inner = Math.min(w, h) * 0.32
  ctx.fillStyle = '#111'
  const count = 72
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.05
    const r0 = inner * (0.75 + rand() * 0.6)
    const half = (0.006 + rand() * 0.014) * (1 + u * 0.15)
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
    ctx.lineTo(cx + Math.cos(a - half) * far, cy + Math.sin(a - half) * far)
    ctx.lineTo(cx + Math.cos(a + half) * far, cy + Math.sin(a + half) * far)
    ctx.closePath()
    ctx.fill()
  }
}

function starPoints(cx: number, cy: number, r: number): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.32
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
  }
  return pts
}

function heartPoints(cx: number, cy: number, r: number): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2
    const x = 16 * Math.sin(t) ** 3
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
    pts.push([cx + (x / 17) * r, cy + (y / 17) * r])
  }
  return pts
}

function drawSparkles(ctx: CanvasRenderingContext2D, w: number, h: number, head: ReturnType<typeof findHead>, u: number) {
  const rand = rng(11)
  const spots: [number, number, number, 'star' | 'heart'][] = [
    [-0.95, -0.35, 0.16, 'star'],
    [0.9, -0.55, 0.13, 'heart'],
    [-0.75, 0.55, 0.1, 'heart'],
    [1.05, 0.35, 0.15, 'star'],
    [-0.3, -0.85, 0.08, 'star'],
    [0.45, -0.9, 0.07, 'star'],
  ]
  const hw = Math.max(head.width, w * 0.22)
  const cy = head.top + hw * 0.45
  for (const [dx, dy, s, kind] of spots) {
    const x = Math.min(w - 8 * u, Math.max(8 * u, head.x + dx * hw))
    const y = Math.min(h - 8 * u, Math.max(8 * u, cy + dy * hw))
    const r = s * hw * 1.6
    if (kind === 'star') sketchShape(ctx, starPoints(x, y, r), rand, 1 * u, '#ffd84a', 1.8 * u)
    else sketchShape(ctx, heartPoints(x, y, r), rand, 1 * u, '#ff7aa8', 1.8 * u)
  }
}

function recolor(ctx: CanvasRenderingContext2D, w: number, h: number, effect: 'bw' | 'sepia') {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    if (effect === 'bw') {
      // A little extra contrast so it reads like a black and white print.
      const y = 0.299 * r + 0.587 * g + 0.114 * b
      const v = Math.min(255, Math.max(0, (y - 128) * 1.12 + 128))
      d[i] = d[i + 1] = d[i + 2] = v
    } else {
      d[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b)
      d[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b)
      d[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b)
    }
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
  drawPersonCover(person.getContext('2d', { willReadFrequently: true })!, o.person, W, H)

  switch (o.effect) {
    case 'bw':
    case 'sepia':
      drawArtBackground(ctx, o, W, H)
      ctx.drawImage(person, 0, 0)
      recolor(ctx, W, H, o.effect)
      break
    case 'comic': {
      const head = findHead(person)
      drawComicLines(ctx, W, H, head.x, Math.min(H * 0.6, head.top + head.width * 0.6), u)
      ctx.drawImage(person, 0, 0)
      break
    }
    case 'bunny': {
      // Ears go behind the person so their hair covers where the ears join.
      // If the head is cut off at the top, they're drawn in front, lower down, so they still show.
      const head = findHead(person)
      const behind = drawBunnyEars(ctx, head, u, false)
      ctx.drawImage(person, 0, 0)
      if (!behind) drawBunnyEars(ctx, head, u, true)
      break
    }
    case 'sparkle':
      ctx.drawImage(person, 0, 0)
      drawSparkles(ctx, W, H, findHead(person), u)
      break
    default:
      ctx.drawImage(person, 0, 0)
  }
}
