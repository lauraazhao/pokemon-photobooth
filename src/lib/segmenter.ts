// Person cutout using MediaPipe's selfie segmentation model. Runs entirely in
// the browser; the model (~250 KB) and WASM runtime are served from /public.
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'

let segmenterPromise: Promise<ImageSegmenter> | null = null

async function create(delegate: 'GPU' | 'CPU') {
  const fileset = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}mediapipe`)
  return ImageSegmenter.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: `${import.meta.env.BASE_URL}models/selfie_segmenter.tflite`,
      delegate,
    },
    runningMode: 'VIDEO',
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  })
}

export function loadSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = create('GPU').catch(() => create('CPU'))
  }
  return segmenterPromise
}

/**
 * Cuts the person out of `source`, writing the result into `out` (resized to
 * the source size). Pixels that aren't the person become transparent.
 */
export function cutOutPerson(
  segmenter: ImageSegmenter,
  source: HTMLVideoElement | HTMLCanvasElement,
  width: number,
  height: number,
  out: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  timestamp: number,
) {
  segmenter.segmentForVideo(source, timestamp, (result) => {
    const masks = result.confidenceMasks
    if (!masks?.length) return
    // The selfie model returns one mask: the probability that a pixel is a person.
    const mask = masks[masks.length - 1]
    const mw = mask.width
    const mh = mask.height
    const conf = mask.getAsFloat32Array()

    if (maskCanvas.width !== mw || maskCanvas.height !== mh) {
      maskCanvas.width = mw
      maskCanvas.height = mh
    }
    const mctx = maskCanvas.getContext('2d')!
    const img = mctx.createImageData(mw, mh)
    for (let i = 0; i < conf.length; i++) {
      // Tighten the soft edge a little so the background doesn't bleed through.
      const t = Math.min(1, Math.max(0, (conf[i] - 0.3) / 0.4))
      img.data[i * 4 + 3] = t * t * (3 - 2 * t) * 255
    }
    mctx.putImageData(img, 0, 0)

    if (out.width !== width || out.height !== height) {
      out.width = width
      out.height = height
    }
    const ctx = out.getContext('2d')!
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(source, 0, 0, width, height)
    ctx.globalCompositeOperation = 'destination-in'
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(maskCanvas, 0, 0, width, height)
    ctx.globalCompositeOperation = 'source-over'
  })
}
