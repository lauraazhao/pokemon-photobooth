import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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
import { renderPhoto, type EffectId } from './lib/effects'
import { detectFaces, loadFaceDetector, type Face } from './lib/faces'
import EffectBar from './components/EffectBar'
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

/** Posing, then editing the photo, then sharing and saving the finished card. */
type Mode = 'live' | 'captured' | 'final'

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

function Booth({ template, onViewGallery, onDone }: { template: CardTemplate; onViewGallery: () => void; onDone: () => void }) {
  const { videoRef, status } = useCamera()
  const cardRef = useRef<HTMLDivElement>(null)
  const photoRef = useRef<HTMLCanvasElement>(null)
  // The latest cutout of the person (live), or the captured one.
  const [cutout] = useState(() => document.createElement('canvas'))
  const maskRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const [segmenter, setSegmenter] = useState<ImageSegmenter | null>(null)
  const [segmenterError, setSegmenterError] = useState(false)
  const [mode, setMode] = useState<Mode>('live')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [cardData, setCardData] = useState(() => cardDataFor(template))
  const [effect, setEffect] = useState<EffectId>('none')
  // How big the card is while posing: its top half as big as fits above the camera button (up to 1.6×).
  const viewRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  // While editing on a phone, the card shrinks so the top of the edit panel shows below it without scrolling.
  const [editZoom, setEditZoom] = useState(1)
  useLayoutEffect(() => {
    // The part of the card shown in full while posing: down to just below the photo.
    const focusH = template.photo.y + template.photo.h + 16
    const fit = () => {
      const top = viewRef.current ? viewRef.current.getBoundingClientRect().top + window.scrollY : 200
      // Leave room for the camera button and its label below the card.
      const byHeight = (window.innerHeight - top - 175) / focusH
      const byWidth = (window.innerWidth - 16) / template.width
      // On short phone screens the card shrinks a little so the button stays on screen.
      setZoom(Math.max(0.75, Math.min(1.6, byHeight, byWidth)))
      // Single-column layout: leave room for Retake/Next and about 170px of the edit panel.
      const stacked = window.innerWidth <= 1120
      const editFit = (window.innerHeight - top - 100 - 170) / template.height
      setEditZoom(stacked ? Math.max(0.6, Math.min(1, editFit, byWidth)) : 1)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [template])
  // Bumped on every capture so the effect previews redraw with the new photo.
  const [shot, setShot] = useState(0)
  // The captured camera frame, for finding faces (the bunny ears and comic rays follow them).
  const [frame] = useState(() => document.createElement('canvas'))
  const [faces, setFaces] = useState<Face[]>([])
  useEffect(() => {
    loadFaceDetector().catch(() => {})
  }, [])
  useEffect(() => {
    if (!shot || !frame.width) return
    let cancelled = false
    detectFaces(frame).then((f) => {
      if (!cancelled) setFaces(f)
    })
    return () => {
      cancelled = true
    }
  }, [shot, frame])
  // The card art, so color effects can tint the photo's background too.
  const [art, setArt] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    const img = new Image()
    img.src = template.art
    img.decode().then(() => setArt(img), () => {})
  }, [template.art])
  const photoBase = useMemo(
    () => ({
      width: template.photo.w,
      height: template.photo.h,
      person: cutout,
      faces,
      art,
      cardWidth: template.width,
      photoBox: template.photo,
    }),
    [template, art, cutout, faces],
  )

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

    if (mode !== 'live') {
      renderPhoto(canvas, { ...photoBase, effect, scale: SCALE })
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
        cutOutPerson(segmenter, video, video.videoWidth, video.videoHeight, cutout, maskRef.current, performance.now())
        draw(cutout)
      } else {
        // Model still loading (or failed): show the plain camera feed.
        draw(video)
      }
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [mode, status, segmenter, template, videoRef, photoBase, effect, shot, cutout])

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
      const video = videoRef.current
      if (video) {
        frame.width = video.videoWidth
        frame.height = video.videoHeight
        frame.getContext('2d')!.drawImage(video, 0, 0)
      }
      setFaces([])
      // Without the model, freeze the raw frame instead of a cutout.
      if (!segmenter && video) {
        const c = cutout
        c.width = video.videoWidth
        c.height = video.videoHeight
        c.getContext('2d')!.drawImage(video, 0, 0)
      }
      setShot((s) => s + 1)
      setMode('captured')
    }, 1000)
  }, [segmenter, videoRef, cutout, frame])

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
  const fileKey = mode === 'final' ? JSON.stringify([cardData, effect, shot, faces]) : null
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
          {/* While posing, the card is enlarged; its lower half sits under the black band with the camera button. */}
          <div
            ref={viewRef}
            className={mode === 'live' ? 'stage-view zoomed' : mode === 'captured' && editZoom < 1 ? 'stage-view fitted' : 'stage-view'}
            style={
              {
                '--card-w': `${template.width}px`,
                '--card-h': `${template.height}px`,
                '--focus-h': `${template.photo.y + template.photo.h + 16}px`,
                '--zoom': zoom,
                '--edit-zoom': editZoom,
              } as CSSProperties
            }
          >
            <div className="stage">
              <Card ref={cardRef} template={template} data={cardData} photoRef={photoRef} />
              {countdown !== null && (
                <div
                  className="countdown"
                  style={{ left: template.photo.x, top: template.photo.y, width: template.photo.w, height: template.photo.h }}
                >
                  {countdown}
                </div>
              )}
            </div>
          </div>
          {mode === 'live' && cameraMessage && (
            <p className={status === 'starting' ? 'notice notice-display' : 'notice'}>{cameraMessage}</p>
          )}
          {mode === 'live' && status === 'live' && !segmenter && (
            <p className="notice">
              {segmenterError ? 'Background removal is unavailable in this browser.' : 'Loading background removal…'}
            </p>
          )}
          <div className={mode === 'live' ? 'actions camera-dock' : 'actions'}>
            {mode === 'live' ? (
              <button className="capture-button" onClick={takePhoto} disabled={status !== 'live' || countdown !== null}>
                <span className="capture-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" fillRule="evenodd">
                    <path d="M9.9 3.5a2 2 0 0 0-1.6.8L6.9 6.2H4.5A2.5 2.5 0 0 0 2 8.7v9.3A2.5 2.5 0 0 0 4.5 20.5h15a2.5 2.5 0 0 0 2.5-2.5V8.7a2.5 2.5 0 0 0-2.5-2.5h-2.4l-1.4-1.9a2 2 0 0 0-1.6-.8zM12 9.2a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4zm0 2a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z" />
                  </svg>
                </span>
                Start countdown
              </button>
            ) : mode === 'captured' ? (
              <>
                <button onClick={() => setMode('live')}>Retake</button>
                <button className="primary" onClick={() => setMode('final')}>
                  Next
                </button>
              </>
            ) : (
              <>
                <button onClick={onDone}>Done</button>
                <button className="primary" onClick={download} disabled={saving}>
                  {saving ? 'Saving…' : canShare ? 'Save photo' : 'Download'}
                </button>
              </>
            )}
          </div>
        </section>
        {mode === 'captured' && (
          <div className="side-panels">
            <CardTextEditor data={cardData} onChange={setCardData}>
              <EffectBar base={photoBase} value={effect} onChange={setEffect} version={shot} />
            </CardTextEditor>
          </div>
        )}
        {mode === 'final' && (
          <div className="side-panels">
            <GallerySubmit cardRef={cardRef} cardId={template.id} onViewGallery={onViewGallery} />
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
  // Finished with the card: back to the start screen with a fresh pack.
  const goHome = () => {
    setShowGallery(false)
    setCard(null)
    setStep('pack')
    window.scrollTo({ top: 0 })
  }
  return (
    <>
      <Meteors />
      <SoundToggle />
      <main className={step === 'pack' ? 'is-start' : undefined}>
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
            {/* Fills the first screen except a sliver at the bottom, where the gallery's dark band peeks in. */}
            <div className="start-hero">
              <PackIntro onOpened={() => setStep('pick')} />
              <a className="gallery-hint" href="#gallery">
                See the gallery
                <span className="gallery-hint-arrow" aria-hidden="true">
                  ↓
                </span>
              </a>
            </div>
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
        {step === 'booth' && card && <Booth template={card} onViewGallery={viewGallery} onDone={goHome} />}
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
