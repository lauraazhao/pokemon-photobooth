// CPU port of the "Dither" shader effect applied to the photobooth picture in
// Figma (ordered Bayer dithering). The math mirrors the WGSL shader that Figma
// exported for this node, so the result matches the design pixel for pixel.

export interface DitherParams {
  /** Bayer tile size: 2, 4, 8 or 16 */
  bayer: 2 | 4 | 8 | 16
  levels: number
  /** Figma brightness slider, 100 = neutral */
  brightness: number
  contrast: number
  /** true = single-colour output using `monoColor` */
  mono: boolean
  monoColor: [number, number, number]
}

/** Values copied from the shader settings on the "photobooth picture" layer. */
export const CARD_DITHER: DitherParams = {
  bayer: 16,
  levels: 2,
  brightness: 111,
  contrast: 1.0799999237060547,
  mono: false,
  monoColor: [1, 1, 1],
}

function bayerMatrix(n: number): number[][] {
  if (n === 1) return [[0]]
  const small = bayerMatrix(n / 2)
  const m = n / 2
  const out: number[][] = []
  for (let y = 0; y < n; y++) {
    out[y] = new Array(n)
    for (let x = 0; x < n; x++) {
      const v = small[y % m][x % m] * 4
      const qx = Math.floor(x / m)
      const qy = Math.floor(y / m)
      const qoff = qy === 0 && qx === 0 ? 0 : qy === 0 && qx === 1 ? 2 : qy === 1 && qx === 0 ? 3 : 1
      out[y][x] = v + qoff
    }
  }
  return out
}

const tileCache = new Map<number, Float32Array>()
function bayerTile(n: number): Float32Array {
  let t = tileCache.get(n)
  if (!t) {
    const m = bayerMatrix(n)
    t = new Float32Array(n * n)
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) t[y * n + x] = (m[y][x] + 0.5) / (n * n)
    tileCache.set(n, t)
  }
  return t
}

/** Dithers the image data in place. Alpha is preserved. */
export function ditherImageData(img: ImageData, p: DitherParams = CARD_DITHER) {
  const { data, width, height } = img
  const n = p.bayer
  const tile = bayerTile(n)
  const L = p.levels - 1
  const bright = (p.brightness - 100) / 200
  const contrast = p.contrast
  const quantize = (c: number, th: number) => {
    const v = Math.round((c + (th - 0.5) / L) * L) / L
    return v < 0 ? 0 : v > 1 ? 1 : v
  }
  const adjust = (c: number) => {
    const v = (c - 0.5) * contrast + 0.5 + bright
    return v < 0 ? 0 : v > 1 ? 1 : v
  }
  for (let y = 0; y < height; y++) {
    const row = (y % n) * n
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] === 0) continue
      const th = tile[row + (x % n)]
      const r = adjust(data[i] / 255)
      const g = adjust(data[i + 1] / 255)
      const b = adjust(data[i + 2] / 255)
      if (p.mono) {
        const q = quantize(0.2126 * r + 0.7152 * g + 0.0722 * b, th)
        data[i] = p.monoColor[0] * q * 255
        data[i + 1] = p.monoColor[1] * q * 255
        data[i + 2] = p.monoColor[2] * q * 255
      } else {
        data[i] = quantize(r, th) * 255
        data[i + 1] = quantize(g, th) * 255
        data[i + 2] = quantize(b, th) * 255
      }
    }
  }
}
