import { useCallback, useEffect, useRef, useState } from 'react'

type Status = 'starting' | 'live' | 'denied' | 'unavailable'

interface CameraProps {
  onCapture: (dataUrl: string) => void
}

export default function Camera({ onCapture }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<Status>('starting')
  const [countdown, setCountdown] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unavailable')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setStatus('live')
      } catch (err) {
        const name = (err as DOMException).name
        setStatus(name === 'NotAllowedError' ? 'denied' : 'unavailable')
      }
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const snap = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    // Mirror so the photo matches the selfie-style preview.
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    onCapture(canvas.toDataURL('image/png'))
  }, [onCapture])

  const startCountdown = () => {
    let n = 3
    setCountdown(n)
    const id = setInterval(() => {
      n -= 1
      if (n === 0) {
        clearInterval(id)
        setCountdown(null)
        snap()
      } else {
        setCountdown(n)
      }
    }, 1000)
  }

  return (
    <div className="camera">
      <div className="viewport">
        <video ref={videoRef} autoPlay playsInline muted />
        {countdown !== null && <div className="countdown">{countdown}</div>}
        {status === 'starting' && <p className="notice">Starting camera…</p>}
        {status === 'denied' && (
          <p className="notice">Camera access was blocked. Allow it in your browser settings and reload.</p>
        )}
        {status === 'unavailable' && (
          <p className="notice">No camera found. The camera needs HTTPS or localhost.</p>
        )}
      </div>
      <button className="primary" onClick={startCountdown} disabled={status !== 'live' || countdown !== null}>
        Take photo
      </button>
    </div>
  )
}
