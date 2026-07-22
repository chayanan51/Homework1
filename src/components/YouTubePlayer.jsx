import { useEffect, useRef, useState } from 'react'

let apiReadyPromise = null

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiReadyPromise) return apiReadyPromise

  apiReadyPromise = new Promise((resolve) => {
    const finish = () => resolve(window.YT)

    if (window.YT?.Player) {
      finish()
      return
    }

    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      finish()
    }

    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script')
      tag.id = 'youtube-iframe-api'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(tag)
    }
  })

  return apiReadyPromise
}

const EMBED_BLOCKED_CODES = new Set([101, 150])

export default function YouTubePlayer({ videoId, onTimeUpdate, onEnded, onReady, onEmbedBlocked }) {
  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const pollRef = useRef(null)
  const onTimeUpdateRef = useRef(onTimeUpdate)
  const onEndedRef = useRef(onEnded)
  const onReadyRef = useRef(onReady)
  const onEmbedBlockedRef = useRef(onEmbedBlocked)
  const endedRef = useRef(false)
  const [needsPlay, setNeedsPlay] = useState(false)
  const [playerError, setPlayerError] = useState('')

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate
    onEndedRef.current = onEnded
    onReadyRef.current = onReady
    onEmbedBlockedRef.current = onEmbedBlocked
  }, [onTimeUpdate, onEnded, onReady, onEmbedBlocked])

  useEffect(() => {
    let cancelled = false
    endedRef.current = false
    setNeedsPlay(false)
    setPlayerError('')

    async function init() {
      const YT = await loadYouTubeApi()
      if (cancelled || !containerRef.current) return

      const host = containerRef.current
      host.innerHTML = ''

      playerRef.current = new YT.Player(host, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          mute: 1,
          playsinline: 1,
          enablejsapi: 1,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            const player = event.target
            onReadyRef.current?.(player)
            player.playVideo?.()

            pollRef.current = setInterval(() => {
              const time = player.getCurrentTime?.() ?? 0
              onTimeUpdateRef.current?.(time)
            }, 100)

            window.setTimeout(() => {
              const state = player.getPlayerState?.()
              if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING) {
                setNeedsPlay(true)
              }
            }, 1200)
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.PLAYING) {
              setNeedsPlay(false)
            }
            if (event.data === YT.PlayerState.ENDED && !endedRef.current) {
              endedRef.current = true
              onEndedRef.current?.()
            }
          },
          onError: (event) => {
            if (EMBED_BLOCKED_CODES.has(event.data)) {
              onEmbedBlockedRef.current?.()
              return
            }

            const codes = {
              2: 'Invalid video parameter.',
              5: 'HTML5 player error.',
              100: 'Video not found or private.',
            }
            setPlayerError(codes[event.data] ?? `Playback error (${event.data}).`)
          },
        },
      })
    }

    init()

    return () => {
      cancelled = true
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
      try {
        playerRef.current?.destroy?.()
      } catch {
        // ignore destroy errors on cleanup
      }
      playerRef.current = null
    }
  }, [videoId])

  function handleManualPlay() {
    const player = playerRef.current
    if (!player) return
    player.unMute?.()
    player.setVolume?.(100)
    player.playVideo?.()
    setNeedsPlay(false)
  }

  return (
    <div className="youtube-player-shell">
      <div className="youtube-player" ref={containerRef} />
      {needsPlay && !playerError && (
        <button type="button" className="player-overlay-btn" onClick={handleManualPlay}>
          ▶ Play Video
        </button>
      )}
      {playerError && <p className="player-error">{playerError}</p>}
      {!playerError && (
        <p className="player-hint">Video starts muted — click the player or use ▶ Play Video to unmute.</p>
      )}
    </div>
  )
}
