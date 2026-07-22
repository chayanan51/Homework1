import { useEffect, useRef, useState } from 'react'

export default function DirectVideoPlayer({ videoId, onTimeUpdate, onEnded, onError }) {
  const videoRef = useRef(null)
  const endedRef = useRef(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const streamUrl = `/api/youtube-stream/${videoId}/play`

  useEffect(() => {
    endedRef.current = false
    setLoading(true)
    setError('')

    const video = videoRef.current
    if (!video) return undefined

    function handleTimeUpdate() {
      onTimeUpdate?.(video.currentTime)
    }

    function handleEnded() {
      if (endedRef.current) return
      endedRef.current = true
      onEnded?.()
    }

    function handleLoaded() {
      setLoading(false)
    }

    function handleError() {
      const message = 'Could not play this video on-site.'
      setError(message)
      setLoading(false)
      onError?.(message)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('loadeddata', handleLoaded)
    video.addEventListener('error', handleError)

    video.load()

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('loadeddata', handleLoaded)
      video.removeEventListener('error', handleError)
    }
  }, [videoId, onTimeUpdate, onEnded, onError])

  return (
    <div className="direct-video-shell">
      <video
        ref={videoRef}
        src={streamUrl}
        controls
        playsInline
        preload="metadata"
        className="direct-video"
      />
      {loading && !error && <p className="player-hint">Loading video…</p>}
      {error && <p className="player-error">{error}</p>}
      {!error && !loading && (
        <p className="player-hint">Direct playback mode — embedding is disabled for this clip.</p>
      )}
    </div>
  )
}
