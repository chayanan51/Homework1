import { useEffect, useMemo, useRef } from 'react'
import { formatTimestamp } from '../lib/utils'

// YouTube caption timestamps often lag behind speech; auto-generated tracks need more lead.
const SYNC_LEAD_SECONDS = 2.25

function findActiveIndex(segments, currentTime, leadSeconds = SYNC_LEAD_SECONDS) {
  const t = currentTime + leadSeconds

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i]
    const end = segment.start + segment.duration
    if (t >= segment.start && t < end) return i
  }

  for (let i = segments.length - 1; i >= 0; i -= 1) {
    if (t >= segments[i].start) return i
  }

  return -1
}

export default function LiveTranscript({
  segments = [],
  currentTime = 0,
  fallbackText = '',
  syncPlayback = true,
  showTimestamps = true,
}) {
  const containerRef = useRef(null)
  const activeIndex = useMemo(
    () => (syncPlayback ? findActiveIndex(segments, currentTime) : -1),
    [segments, currentTime, syncPlayback],
  )

  useEffect(() => {
    if (!syncPlayback || activeIndex < 0 || !containerRef.current) return

    const activeEl = containerRef.current.querySelector('[data-active="true"]')
    activeEl?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
  }, [activeIndex, syncPlayback])

  if (!segments.length) {
    return <p className="transcript">{fallbackText || 'Transcript unavailable for this video.'}</p>
  }

  if (!syncPlayback) {
    return (
      <div className="transcript live-transcript">
        {segments.map((segment, index) => (
          <p key={`${segment.start}-${index}`} className="transcript-segment">
            {showTimestamps && (
              <span className="transcript-time">{formatTimestamp(segment.start)}</span>
            )}
            <span className="transcript-text">{segment.text}</span>
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="transcript live-transcript" ref={containerRef}>
      {segments.map((segment, index) => {
        const isActive = index === activeIndex

        return (
          <p
            key={`${segment.start}-${index}`}
            className={`transcript-segment${isActive ? ' active' : ''}`}
            data-active={isActive ? 'true' : 'false'}
          >
            <span className="transcript-time">{formatTimestamp(segment.start)}</span>
            <span className="transcript-text">{segment.text}</span>
          </p>
        )
      })}
    </div>
  )
}
