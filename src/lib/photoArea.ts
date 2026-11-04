// Draws the person onto the card's "photobooth picture" area. The card art
// already contains the dithered background and frame, so this canvas is
// transparent except for the person, who stays sharp (not dithered).

export type ImageLike = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement

function sizeOf(src: ImageLike): [number, number] {
  if (src instanceof HTMLVideoElement) return [src.videoWidth, src.videoHeight]
  if (src instanceof HTMLImageElement) return [src.naturalWidth, src.naturalHeight]
  return [src.width, src.height]
}

/** Draws `src` to cover the box (like CSS object-fit: cover), optionally mirrored. */
function drawCover(ctx: CanvasRenderingContext2D, src: ImageLike, w: number, h: number, mirror = false) {
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

export interface PersonOptions {
  /** Size of the photo area in CSS pixels. */
  width: number
  height: number
  /** The person, already cut out (transparent background), or the raw camera frame. */
  person: ImageLike | null
  /** Mirror horizontally, like a selfie preview. */
  mirror: boolean
  /** Device pixels per CSS pixel to render at. */
  scale: number
}

export function renderPerson(canvas: HTMLCanvasElement, o: PersonOptions) {
  const W = Math.round(o.width * o.scale)
  const H = Math.round(o.height * o.scale)
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W
    canvas.height = H
  }
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, W, H)
  if (o.person) drawCover(ctx, o.person, W, H, o.mirror)
}
