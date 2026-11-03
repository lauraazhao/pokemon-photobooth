// Draws the "photobooth picture" layer of the card onto a canvas:
// background photo (75%) + blue-to-white overlay (50%), framed by the 4px
// metallic outside stroke, dithered like in Figma. The person cutout is drawn
// on top afterwards so they stay sharp (not dithered).
import { ditherImageData } from './dither'
import { figmaLinearGradient, type Transform2x3 } from './figmaGradient'

/** Size of the layer in Figma, in CSS pixels. */
export const PHOTO_W = 272
export const PHOTO_H = 185
/** Outside stroke width. The canvas extends past the layer by this much. */
export const PHOTO_STROKE = 4

const OVERLAY_TRANSFORM: Transform2x3 = [
  [6.123234262925839e-17, 1, 0],
  [-1, 6.123234262925839e-17, 1],
]
const OVERLAY_STOPS = [
  { position: 0, color: 'rgb(33, 42, 143)' },
  { position: 1, color: 'rgb(255, 255, 255)' },
]

const STROKE_TRANSFORM: Transform2x3 = [
  [0.6970353126525879, 0.4321123957633972, -0.07356514781713486],
  [-0.4321123957633972, 0.2503180503845215, 0.5726277232170105],
]
const g = (v: number) => Math.round(v * 255)
const grey = (v: number) => `rgb(${g(v)}, ${g(v)}, ${g(v)})`
const STROKE_STOPS = [
  { position: 0, color: grey(0.20192307233810425) },
  { position: 0.11538461595773697, color: grey(0.4) },
  { position: 0.2884615361690521, color: grey(0.9607843160629272) },
  { position: 0.42307692766189575, color: grey(0.4) },
  { position: 0.567307710647583, color: grey(0.20192307233810425) },
  { position: 0.7019230723381042, color: grey(0.4) },
  { position: 0.8365384340286255, color: 'rgb(204, 203, 203)' },
  { position: 0.9855769276618958, color: grey(0.4) },
]

export type ImageLike = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement

function sizeOf(src: ImageLike): [number, number] {
  if (src instanceof HTMLVideoElement) return [src.videoWidth, src.videoHeight]
  if (src instanceof HTMLImageElement) return [src.naturalWidth, src.naturalHeight]
  return [src.width, src.height]
}

/** Draws `src` to cover the box (like CSS object-fit: cover), optionally mirrored. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  src: ImageLike,
  w: number,
  h: number,
  mirror = false,
) {
  const [sw, sh] = sizeOf(src)
  if (!sw || !sh) return
  const scale = Math.max(w / sw, h / sh)
  const dw = sw * scale
  const dh = sh * scale
  ctx.save()
  if (mirror) {
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh)
  ctx.restore()
}

export interface PhotoAreaOptions {
  background: HTMLImageElement | null
  /** The person, already cut out (transparent background). */
  person: ImageLike | null
  /** Mirror the person horizontally, like a selfie preview. */
  mirror: boolean
  /** Device pixels per CSS pixel to render at. */
  scale: number
  /** Dither the background and frame (the person is never dithered). */
  dither: boolean
}

export function renderPhotoArea(canvas: HTMLCanvasElement, o: PhotoAreaOptions) {
  const s = o.scale
  const W = Math.round((PHOTO_W + PHOTO_STROKE * 2) * s)
  const H = Math.round((PHOTO_H + PHOTO_STROKE * 2) * s)
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W
    canvas.height = H
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, W, H)

  const iw = PHOTO_W * s
  const ih = PHOTO_H * s
  const off = PHOTO_STROKE * s

  // Inside the frame: background photo, then overlay.
  ctx.save()
  ctx.translate(off, off)
  ctx.beginPath()
  ctx.rect(0, 0, iw, ih)
  ctx.clip()
  if (o.background) {
    ctx.globalAlpha = 0.75
    drawCover(ctx, o.background, iw, ih)
    ctx.globalAlpha = 1
  }
  ctx.save()
  ctx.scale(iw, ih)
  ctx.globalAlpha = 0.5
  ctx.fillStyle = figmaLinearGradient(ctx, OVERLAY_TRANSFORM, OVERLAY_STOPS)
  ctx.fillRect(0, 0, 1, 1)
  ctx.restore()
  ctx.restore()

  // Metallic 4px stroke outside the layer bounds.
  ctx.save()
  ctx.translate(off, off)
  ctx.scale(iw, ih)
  const sx = off / iw
  const sy = off / ih
  ctx.beginPath()
  ctx.rect(-sx, -sy, 1 + 2 * sx, 1 + 2 * sy)
  ctx.rect(0, 0, 1, 1)
  ctx.fillStyle = figmaLinearGradient(ctx, STROKE_TRANSFORM, STROKE_STOPS)
  ctx.fill('evenodd')
  ctx.restore()

  if (o.dither) {
    const img = ctx.getImageData(0, 0, W, H)
    ditherImageData(img)
    ctx.putImageData(img, 0, 0)
  }

  // The person goes on top of the dithered background, clipped to the frame.
  if (o.person) {
    ctx.save()
    ctx.translate(off, off)
    ctx.beginPath()
    ctx.rect(0, 0, iw, ih)
    ctx.clip()
    drawCover(ctx, o.person, iw, ih, o.mirror)
    ctx.restore()
  }
}
