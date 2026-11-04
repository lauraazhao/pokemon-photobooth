// Finds faces in the captured photo (MediaPipe BlazeFace, runs in the browser),
// so effects like bunny ears can sit on each person's head.
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'

export interface Face {
  /** Bounding box in the source image's pixels. */
  x: number
  y: number
  w: number
  h: number
  /** Head tilt in radians (0 = upright), from the eyes. */
  roll: number
}

let detectorPromise: Promise<FaceDetector> | null = null

async function create(delegate: 'GPU' | 'CPU') {
  const fileset = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}mediapipe`)
  return FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: `${import.meta.env.BASE_URL}models/face_detector.tflite`, delegate },
    runningMode: 'IMAGE',
    minDetectionConfidence: 0.5,
  })
}

export function loadFaceDetector(): Promise<FaceDetector> {
  if (!detectorPromise) detectorPromise = create('GPU').catch(() => create('CPU'))
  return detectorPromise
}

function facesIn(detector: FaceDetector, image: HTMLCanvasElement, ox: number, oy: number): Face[] {
  const faces: Face[] = []
  for (const d of detector.detect(image).detections) {
    const b = d.boundingBox
    if (!b) continue
    let roll = 0
    const [e1, e2] = d.keypoints
    if (e1 && e2) {
      roll = Math.atan2((e2.y - e1.y) * image.height, (e2.x - e1.x) * image.width)
      // The two eyes can come in either order.
      if (roll > Math.PI / 2) roll -= Math.PI
      if (roll < -Math.PI / 2) roll += Math.PI
    }
    faces.push({ x: b.originX + ox, y: b.originY + oy, w: b.width, h: b.height, roll })
  }
  return faces
}

function overlap(a: Face, b: Face) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  return (x * y) / Math.min(a.w * a.h, b.w * b.h)
}

/**
 * Faces in `image`, biggest first. Empty if the detector can't load.
 * The model works on a small version of the picture, so people further back
 * are found by also looking at each quarter of the frame up close.
 */
export async function detectFaces(image: HTMLCanvasElement): Promise<Face[]> {
  try {
    const detector = await loadFaceDetector()
    const all = facesIn(detector, image, 0, 0)
    const tw = Math.round(image.width * 0.6)
    const th = Math.round(image.height * 0.6)
    const tile = document.createElement('canvas')
    tile.width = tw
    tile.height = th
    const tctx = tile.getContext('2d')!
    for (const ox of [0, image.width - tw]) {
      for (const oy of [0, image.height - th]) {
        tctx.clearRect(0, 0, tw, th)
        tctx.drawImage(image, ox, oy, tw, th, 0, 0, tw, th)
        all.push(...facesIn(detector, tile, ox, oy))
      }
    }
    // The same face is often found more than once: keep the biggest of each.
    all.sort((a, b) => b.w * b.h - a.w * a.h)
    const faces: Face[] = []
    for (const f of all) if (!faces.some((g) => overlap(f, g) > 0.4)) faces.push(f)
    return faces
  } catch (e) {
    console.error('Face detection failed', e)
    return []
  }
}
