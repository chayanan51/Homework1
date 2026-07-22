import { useCallback, useEffect, useRef, useState } from 'react'
import { formatTimestamp } from '../lib/utils'

const MAX_SAMPLES = 20
const NO_TIMESTAMP_INTERVAL_MS = 3000

export function useWebcamSampler({ enabled, getCurrentTime, duration, noTimestamp = false }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const samplesRef = useRef([])
  const lastCaptureMsRef = useRef(0)
  const [samples, setSamples] = useState([])
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  const getSamples = useCallback(() => samplesRef.current, [])

  const startCamera = useCallback(async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setReady(true)
    } catch (err) {
      setError(err.message ?? 'Could not access webcam.')
      setReady(false)
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setReady(false)
  }, [])

  const captureFrame = useCallback(
    (force = false) => {
      const video = videoRef.current
      if (!video || !video.videoWidth) return null

      const now = Date.now()
      if (
        !force &&
        noTimestamp &&
        lastCaptureMsRef.current &&
        now - lastCaptureMsRef.current < 1500
      ) {
        return null
      }

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0)

      const captureIndex = samplesRef.current.length + 1
      const timestamp = noTimestamp
        ? captureIndex
        : Math.floor(getCurrentTime?.() ?? 0)

      lastCaptureMsRef.current = now

      return {
        timestamp,
        timestampLabel: noTimestamp
          ? `Capture ${captureIndex}`
          : formatTimestamp(timestamp),
        dataUrl: canvas.toDataURL('image/jpeg', 0.72),
      }
    },
    [getCurrentTime, noTimestamp],
  )

  const tryCapture = useCallback(
    (force = false) => {
      if (samplesRef.current.length >= MAX_SAMPLES) return false

      const frame = captureFrame(force)
      if (!frame) return false

      const last = samplesRef.current.at(-1)
      if (!noTimestamp && last && Math.abs(last.timestamp - frame.timestamp) < 3) return false

      samplesRef.current = [...samplesRef.current, frame]
      setSamples([...samplesRef.current])
      return true
    },
    [captureFrame, noTimestamp],
  )

  const captureNow = useCallback(() => tryCapture(true), [tryCapture])

  useEffect(() => {
    if (!enabled) return undefined

    samplesRef.current = []
    lastCaptureMsRef.current = 0
    setSamples([])
    startCamera()

    const intervalMs = noTimestamp
      ? NO_TIMESTAMP_INTERVAL_MS
      : duration > 0
        ? Math.max((duration / MAX_SAMPLES) * 1000, 3000)
        : 5000

    const id = setInterval(() => tryCapture(false), intervalMs)
    return () => {
      clearInterval(id)
      stopCamera()
    }
  }, [enabled, duration, noTimestamp, startCamera, stopCamera, tryCapture])

  useEffect(() => {
    if (!enabled || !noTimestamp || !ready) return undefined

    const id = window.setTimeout(() => tryCapture(true), 800)
    return () => window.clearTimeout(id)
  }, [enabled, noTimestamp, ready, tryCapture])

  return {
    videoRef,
    samples,
    sampleCount: samples.length,
    maxSamples: MAX_SAMPLES,
    error,
    ready,
    captureNow,
    getSamples,
  }
}
