import { useCallback, useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import type { ImageSegmenter } from '@mediapipe/tasks-vision'
import Card from './components/Card'
import CardTextEditor from './components/CardTextEditor'
import PackIntro from './components/PackIntro'
import CardPicker from './components/CardPicker'
import { cardDataFor } from './lib/cardData'
import type { CardTemplate } from './lib/cards'
import { useCamera } from './lib/useCamera'
import { cutOutPerson, loadSegmenter } from './lib/segmenter'
import { renderPerson } from './lib/photoArea'

/** Render scale for the photo. Also used for the downloaded PNG. */
const SCALE = Math.max(2, Math.ceil(window.devicePixelRatio || 1))

type Mode = 'live' | 'captured'

function Booth({ template }: { template: CardTemplate }) {
  const { videoRef, status } = useCamera()
  const cardRef = useRef<HTMLDivElement>(null)
  const photoRef = useRef<HTMLCanvasElement>(null)
  const cutoutRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const maskRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const [segmenter, setSegmenter] = useState<ImageSegmenter | null>(null)
  const [segmenterError, setSegmenterError] = useState(false)
  const [mode, setMode] = useState<Mode>('live')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [cardData, setCardData] = useState(() => cardDataFor(template))

  useEffect(() => {
    loadSegmenter().then(setSegmenter, (e) => {
      console.error('Could not load person cutout model', e)
      setSegmenterError(true)
    })
  }, [])

  // Draw the card photo: live while posing, frozen after capture.
  useEffect(() => {
    const canvas = photoRef.current
    if (!canvas) return
    const draw = (person: HTMLCanvasElement | HTMLVideoElement | null) =>
      renderPerson(canvas, { width: template.photo.w, height: template.photo.h, person, mirror: true, scale: SCALE })

    if (mode === 'captured') {
      draw(cutoutRef.current)
      return
    }
    let raf = 0
    let lastTime = -1
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const video = videoRef.current
      if (status !== 'live' || !video || video.readyState < 2) {
        draw(null)
        return
      }
      if (video.currentTime === lastTime) return
      lastTime = video.currentTime
      if (segmenter) {
        cutOutPerson(segmenter, video, video.videoWidth, video.videoHeight, cutoutRef.current, maskRef.current, performance.now())
        draw(cutoutRef.current)
      } else {
        // Model still loading (or failed): show the plain camera feed.
        draw(video)
      }
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [mode, status, segmenter, template, videoRef])

  const takePhoto = useCallback(() => {
    let n = 3
    setCountdown(n)
    const id = setInterval(() => {
      n -= 1
      if (n > 0) return setCountdown(n)
      clearInterval(id)
      setCountdown(null)
      // Without the model, freeze the raw frame instead of a cutout.
      const video = videoRef.current
      if (!segmenter && video) {
        const c = cutoutRef.current
        c.width = video.videoWidth
        c.height = video.videoHeight
        c.getContext('2d')!.drawImage(video, 0, 0)
      }
      setMode('captured')
    }, 1000)
  }, [segmenter, videoRef])

  const download = useCallback(async () => {
    if (!cardRef.current) return
    setSaving(true)
    try {
      const url = await toPng(cardRef.current, { pixelRatio: SCALE, cacheBust: true })
      const a = document.createElement('a')
      a.href = url
      a.download = 'photobooth-card.png'
      a.click()
    } finally {
      setSaving(false)
    }
  }, [])

  const cameraMessage =
    status === 'starting'
      ? 'Starting camera…'
      : status === 'denied'
        ? 'Camera access was blocked. Allow it in your browser settings and reload.'
        : status === 'unavailable'
          ? 'No camera found. The camera needs HTTPS or localhost.'
          : null

  return (
    <>
      <div className="workspace fade-in">
        <section className="booth">
          <div className="stage">
            <Card ref={cardRef} template={template} data={cardData} photoRef={photoRef} />
            {countdown !== null && <div className="countdown">{countdown}</div>}
          </div>
          {mode === 'live' && cameraMessage && <p className="notice">{cameraMessage}</p>}
          {mode === 'live' && status === 'live' && !segmenter && (
            <p className="notice">
              {segmenterError ? 'Background removal is unavailable in this browser.' : 'Loading background removal…'}
            </p>
          )}
          <div className="actions">
            {mode === 'live' ? (
              <button className="primary" onClick={takePhoto} disabled={status !== 'live' || countdown !== null}>
                Take photo
              </button>
            ) : (
              <>
                <button onClick={() => setMode('live')}>Retake</button>
                <button className="primary" onClick={download} disabled={saving}>
                  {saving ? 'Saving…' : 'Download'}
                </button>
              </>
            )}
          </div>
        </section>
        {mode === 'captured' && <CardTextEditor data={cardData} onChange={setCardData} />}
      </div>
    </>
  )
}

type Step = 'pack' | 'pick' | 'booth'

export default function App() {
  const [step, setStep] = useState<Step>('pack')
  const [card, setCard] = useState<CardTemplate | null>(null)
  useEffect(() => {
    // Start downloading the cutout model while the pack is on screen.
    loadSegmenter().catch(() => {})
  }, [])
  return (
    <main>
      <h1>Card Photobooth</h1>
      {step === 'pack' && <PackIntro onOpened={() => setStep('pick')} />}
      {step === 'pick' && (
        <CardPicker
          onPick={(c) => {
            setCard(c)
            setStep('booth')
          }}
        />
      )}
      {step === 'booth' && card && <Booth template={card} />}
    </main>
  )
}
