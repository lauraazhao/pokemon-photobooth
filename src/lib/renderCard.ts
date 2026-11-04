import { toCanvas } from 'html-to-image'

/**
 * Renders a finished card (art, photo, decorations, text) to a canvas.
 *
 * The art, photo and decorations are drawn directly. Only the text goes
 * through html-to-image, because iPhone Safari often leaves images out of
 * html-to-image's snapshots, which saved the text on a blank card.
 */
export async function renderCard(card: HTMLElement, scale: number): Promise<HTMLCanvasElement> {
  const width = card.offsetWidth
  const height = card.offsetHeight
  const out = document.createElement('canvas')
  out.width = Math.round(width * scale)
  out.height = Math.round(height * scale)
  const ctx = out.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.imageSmoothingQuality = 'high'

  // Art, photo and decorations, in page order (back to front).
  for (const el of Array.from(card.children) as HTMLElement[]) {
    if (el instanceof HTMLImageElement) {
      await el.decode().catch(() => {})
      ctx.drawImage(el, el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight)
    } else if (el instanceof HTMLCanvasElement && el.width > 0) {
      ctx.drawImage(el, el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight)
    }
  }

  // The editable text sits on top of everything.
  const text = await toCanvas(card, {
    pixelRatio: scale,
    width,
    height,
    filter: (node) => !(node instanceof HTMLImageElement || node instanceof HTMLCanvasElement),
  })
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(text, 0, 0, out.width, out.height)
  return out
}

export const canvasToBlob = (canvas: HTMLCanvasElement, type = 'image/png', quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
