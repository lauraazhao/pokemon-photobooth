/**
 * Renders a finished card (art, photo, decorations, text) to a canvas by
 * drawing each layer directly. No DOM snapshot library is involved, because
 * iPhone browsers drop or mis-size parts of those snapshots.
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
  await document.fonts?.ready

  // Layers in page order, back to front: art, photo, decorations, text.
  for (const el of Array.from(card.children) as HTMLElement[]) {
    if (el instanceof HTMLImageElement) {
      await el.decode().catch(() => {})
      ctx.drawImage(el, el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight)
    } else if (el instanceof HTMLCanvasElement) {
      if (el.width > 0) ctx.drawImage(el, el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight)
    } else if (el.classList.contains('card-text')) {
      drawText(ctx, card, el)
    }
  }
  return out
}

/**
 * Draws a text element where the browser laid it out: each line is found from
 * the characters' on-screen positions, so wrapping and size match the card exactly.
 */
function drawText(ctx: CanvasRenderingContext2D, card: HTMLElement, el: HTMLElement) {
  const node = el.firstChild
  if (!(node instanceof Text) || !node.data) return
  const style = getComputedStyle(el)
  const origin = card.getBoundingClientRect()
  const box = el.getBoundingClientRect()

  // Group characters into lines by their vertical position.
  const lines: { text: string; x: number; top: number }[] = []
  const range = document.createRange()
  for (let i = 0; i < node.data.length; i++) {
    range.setStart(node, i)
    range.setEnd(node, i + 1)
    const rect = Array.from(range.getClientRects()).find((r) => r.width > 0 || r.height > 0)
    if (!rect) continue // collapsed whitespace or a line break
    const top = Math.round(rect.top)
    const line = lines[lines.length - 1]
    if (line && Math.abs(line.top - top) < 2) line.text += node.data[i]
    else lines.push({ text: node.data[i], x: rect.left, top })
  }

  ctx.save()
  // The element hides overflow, so clip to its box.
  ctx.beginPath()
  ctx.rect(box.left - origin.left, box.top - origin.top, box.width, box.height)
  ctx.clip()
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  ctx.fillStyle = style.color
  ctx.textBaseline = 'alphabetic'
  const upper = style.textTransform === 'uppercase'
  for (const line of lines) {
    const text = (upper ? line.text.toUpperCase() : line.text).replace(/\s+$/, '')
    // A character's box starts at the font's ascent above the baseline.
    const ascent = ctx.measureText(text).fontBoundingBoxAscent
    ctx.fillText(text, line.x - origin.left, line.top - origin.top + ascent)
  }
  ctx.restore()
}

export const canvasToBlob = (canvas: HTMLCanvasElement, type = 'image/png', quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
