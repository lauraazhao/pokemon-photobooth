// Helpers to reproduce Figma linear gradients exactly on a 2D canvas.
//
// Figma stores a gradient as a 2x3 `gradientTransform` that maps the node's
// normalized box (0..1 on both axes) into gradient space, where the gradient
// runs from (0, 0.5) to (1, 0.5). We invert that transform to find the start
// and end points in normalized node space, then draw with the canvas scaled
// to the node size so the gradient's perpendiculars match Figma's.

export type Transform2x3 = [[number, number, number], [number, number, number]]
export interface Stop {
  /** 0..1 */
  position: number
  color: string
}

function invertPoint(t: Transform2x3, gx: number, gy: number): [number, number] {
  const [[a, b, c], [d, e, f]] = t
  const det = a * e - b * d
  const x = gx - c
  const y = gy - f
  return [(e * x - b * y) / det, (-d * x + a * y) / det]
}

/** Creates a gradient in normalized (0..1) node coordinates. */
export function figmaLinearGradient(
  ctx: CanvasRenderingContext2D,
  transform: Transform2x3,
  stops: Stop[],
): CanvasGradient {
  const [x0, y0] = invertPoint(transform, 0, 0.5)
  const [x1, y1] = invertPoint(transform, 1, 0.5)
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  for (const s of stops) g.addColorStop(Math.min(1, Math.max(0, s.position)), s.color)
  return g
}
