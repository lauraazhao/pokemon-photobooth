import { useEffect, useRef, useState } from 'react'

export type CameraStatus = 'starting' | 'live' | 'denied' | 'unavailable'

/** Starts the front camera and plays it into a hidden <video>. */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [status, setStatus] = useState<CameraStatus>('starting')

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    videoRef.current = video

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unavailable')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        })
        if (cancelled) return
        video.srcObject = stream
        await video.play()
        if (!cancelled) setStatus('live')
      } catch (err) {
        if (!cancelled) setStatus((err as DOMException).name === 'NotAllowedError' ? 'denied' : 'unavailable')
      }
    }
    start()
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return { videoRef, status }
}
