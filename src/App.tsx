import { useCallback, useEffect, useRef, useState } from 'react'
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
import logoUrl from './assets/brand/photomon-logo.png'
import Meteors from './components/Meteors'
import { canvasToBlob, renderCard } from './lib/renderCard'
import SoundToggle from './components/SoundToggle'
import { playShutter, playTick } from './lib/sfx'
import Gallery from './components/Gallery'
import GallerySubmit from './components/GallerySubmit'
import GalleryAdmin from './components/GalleryAdmin'

/** Render scale for the photo. Also used for the downloaded PNG. */
const SCALE = Math.max(2, Math.ceil(window.devicePixelRatio || 1))

type Mode = 'live' | 'captured'

const FILE_NAME = 'photomon-card.png'

/** True on phones and tablets that can share image files (iOS Safari, Android Chrome). */
function useCanShareFiles() {
  const [can] = useState(() => {
    const touch = window.matchMedia('(pointer: coarse)').matches
    if (!touch || !navigator.canShare) return false
    try {
      return navigator.canShare({ files: [new File([''], FILE_NAME, { type: 'image/png' })] })
    } catch {
      return false
    }
  })
  return can
}

/** Opens the share sheet. False if sharing failed (so the caller can download instead); true if shared or cancelled. */
async function shareFile(file: File): Promise<boolean> {
  try {
    await navigator.share({ files: [file] })
    return true
  } catch (err) {
    // Closing the sheet without picking anything isn't an error.
    return err instanceof DOMException && err.name === 'AbortError'
  }
}

function Booth({ template, onViewGallery }: { template: CardTemplate; onViewGallery: () => void }) {
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
    playTick()
    const id = setInterval(() => {
      n -= 1
      if (n > 0) {
        playTick()
        return setCountdown(n)
      }
      clearInterval(id)
      setCountdown(null)
      playShutter()
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

  const renderCardFile = useCallback(async (): Promise<File | null> => {
    if (!cardRef.current) return null
    const blob = await canvasToBlob(await renderCard(cardRef.current, SCALE))
    return blob ? new File([blob], FILE_NAME, { type: 'image/png' }) : null
  }, [])

  // Phones save through the share sheet ("Save Image" puts it in the camera roll),
  // since websites can't write to the photo library directly.
  const canShare = useCanShareFiles()
  // The share sheet has to open right after the tap, so on phones the PNG is
  // rendered ahead of time (and again whenever the text changes).
  const [readyFile, setReadyFile] = useState<{ file: File; key: string } | null>(null)
  const fileKey = mode === 'captured' ? JSON.stringify(cardData) : null
  useEffect(() => {
    if (!canShare || !fileKey) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const file = await renderCardFile()
      if (!cancelled && file) setReadyFile({ file, key: fileKey })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [canShare, fileKey, renderCardFile])

  const download = useCallback(async () => {
    if (!cardRef.current) return
    setSaving(true)
    try {
      if (canShare) {
        const file = readyFile?.key === fileKey ? readyFile.file : await renderCardFile()
        if (file && (await shareFile(file))) return
      }
      const blob = await canvasToBlob(await renderCard(cardRef.current, SCALE))
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = FILE_NAME
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } finally {
      setSaving(false)
    }
  }, [canShare, readyFile, fileKey, renderCardFile])

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
                  {saving ? 'Saving…' : canShare ? 'Save photo' : 'Download'}
                </button>
              </>
            )}
          </div>
        </section>
        {mode === 'captured' && (
          <div className="side-panels">
            <CardTextEditor data={cardData} onChange={setCardData} />
            <GallerySubmit cardRef={cardRef} onViewGallery={onViewGallery} />
          </div>
        )}
      </div>
    </>
  )
}

type Step = 'pack' | 'pick' | 'booth'

function Photobooth() {
  const [step, setStep] = useState<Step>('pack')
  const [card, setCard] = useState<CardTemplate | null>(null)
  // Set after sharing a card: back on the start screen, jump to the (freshly loaded) gallery.
  const [showGallery, setShowGallery] = useState(false)
  useEffect(() => {
    // Start downloading the cutout model while the pack is on screen.
    loadSegmenter().catch(() => {})
  }, [])
  const viewGallery = () => {
    setShowGallery(true)
    setStep('pack')
  }
  return (
    <>
      <Meteors />
      <SoundToggle />
      <main>
        {/* The pack already shows the logo, so the header only appears after it's opened. */}
        {step === 'pack' ? (
          <h1 className="visually-hidden">Photomon!</h1>
        ) : (
          <h1 className="logo fade-in">
            <img src={logoUrl} alt="Photomon!" width={420} height={102} />
          </h1>
        )}
        {step === 'pack' && (
          <>
            <PackIntro onOpened={() => setStep('pick')} />
            <a className="gallery-hint" href="#gallery">
              See the gallery
              <span className="gallery-hint-arrow" aria-hidden="true">
                ↓
              </span>
            </a>
            <Gallery fresh={showGallery} />
          </>
        )}
        {step === 'pick' && (
          <CardPicker
            onPick={(c) => {
              setCard(c)
              setStep('booth')
            }}
          />
        )}
        {step === 'booth' && card && <Booth template={card} onViewGallery={viewGallery} />}
      </main>
      <a className="site-credit" href="https://laurazhao.com/" target="_blank" rel="noopener">
        laurazhao.com
      </a>
    </>
  )
}

/** The photobooth, or the gallery admin page at /#admin. */
export default function App() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return hash === '#admin' ? <GalleryAdmin /> : <Photobooth />
}
