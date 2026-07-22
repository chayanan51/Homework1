import { useCallback, useEffect, useRef, useState } from 'react'
import {
  checkHealth,
  fetchYouTubeMetadata,
  generateFinalReport,
  runVisualEvaluation,
  sendInterviewMessage,
} from './api/client'
import ErrorBanner from './components/ErrorBanner'
import FinalReport from './components/FinalReport'
import InterviewChat from './components/InterviewChat'
import VisualEvaluationPanel from './components/VisualEvaluationPanel'
import DirectVideoPlayer from './components/DirectVideoPlayer'
import RestrictedVideoPanel from './components/RestrictedVideoPanel'
import LiveTranscript from './components/LiveTranscript'
import YouTubePlayer from './components/YouTubePlayer'
import { useWebcamSampler } from './hooks/useWebcamSampler'
import { extractVideoId, formatTimestamp } from './lib/utils'

const PHASES = {
  SETUP: 'setup',
  WATCHING: 'watching',
  EVALUATION: 'evaluation',
  INTERVIEW: 'interview',
  REPORT: 'report',
}

export default function App() {
  const [phase, setPhase] = useState(PHASES.SETUP)
  const [url, setUrl] = useState('')
  const [metadata, setMetadata] = useState(null)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [error, setError] = useState('')
  const [apiReady, setApiReady] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [visualEvaluation, setVisualEvaluation] = useState(null)
  const [evaluating, setEvaluating] = useState(false)
  const [interviewMessages, setInterviewMessages] = useState([])
  const [interviewStarted, setInterviewStarted] = useState(false)
  const [startingInterview, setStartingInterview] = useState(false)
  const [finalReport, setFinalReport] = useState(null)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [embedBlocked, setEmbedBlocked] = useState(false)
  const [directPlaybackFailed, setDirectPlaybackFailed] = useState(false)
  const [continuing, setContinuing] = useState(false)

  const currentTimeRef = useRef(0)
  const getCurrentTime = useCallback(() => currentTimeRef.current, [])

  const useDirectPlayback = Boolean(metadata?.playbackRestricted || embedBlocked)
  const readingModeFallback = useDirectPlayback && directPlaybackFailed

  const {
    videoRef,
    sampleCount,
    maxSamples,
    error: webcamError,
    ready: webcamReady,
    captureNow,
    getSamples,
  } = useWebcamSampler({
    enabled: phase === PHASES.WATCHING,
    getCurrentTime,
    duration: metadata?.duration ?? 0,
    noTimestamp: phase === PHASES.WATCHING && readingModeFallback,
  })

  useEffect(() => {
    checkHealth()
      .then(({ apiKeyConfigured }) => setApiReady(apiKeyConfigured))
      .catch(() => setApiReady(false))
  }, [])

  async function handleLoadMetadata() {
    setError('')
    if (!extractVideoId(url)) {
      setError('Enter a valid YouTube URL.')
      return
    }

    setLoadingMeta(true)
    try {
      const data = await fetchYouTubeMetadata(url)
      setMetadata(data)
    } catch (err) {
      setError(err.message)
      setMetadata(null)
    } finally {
      setLoadingMeta(false)
    }
  }

  function handleStartWatching() {
    setVisualEvaluation(null)
    setInterviewMessages([])
    setInterviewStarted(false)
    setFinalReport(null)
    setCurrentTime(0)
    currentTimeRef.current = 0
    setEmbedBlocked(false)
    setDirectPlaybackFailed(false)
    setPhase(PHASES.WATCHING)
  }

  const handleEmbedBlocked = useCallback(() => {
    setEmbedBlocked(true)
  }, [])

  const handleDirectPlaybackError = useCallback(() => {
    setDirectPlaybackFailed(true)
  }, [])

  async function finishWatching() {
    setPhase(PHASES.EVALUATION)
    setEvaluating(true)
    setError('')

    let frames = getSamples()
    if (frames.length === 0) {
      captureNow()
      frames = getSamples()
    }

    if (frames.length === 0) {
      setError('Allow webcam access and wait for a capture, or click Capture now.')
      setPhase(PHASES.WATCHING)
      setEvaluating(false)
      setContinuing(false)
      return
    }

    try {
      const evaluation = await runVisualEvaluation(
        frames,
        { ...metadata, playbackRestricted: readingModeFallback },
      )
      setVisualEvaluation(evaluation)
    } catch (err) {
      setError(err.message)
      setPhase(PHASES.WATCHING)
    } finally {
      setEvaluating(false)
      setContinuing(false)
    }
  }

  async function handleVideoEnded() {
    await finishWatching()
  }

  async function handleContinueWatching() {
    setContinuing(true)
    await finishWatching()
  }

  const handleTimeUpdate = useCallback((time) => {
    currentTimeRef.current = time
    setCurrentTime(time)
  }, [])

  async function handleStartInterview() {
    setStartingInterview(true)
    setError('')
    setInterviewStarted(true)
    setPhase(PHASES.INTERVIEW)

    try {
      const { reply } = await sendInterviewMessage(
        [{ role: 'user', content: 'The video just ended. Please begin the interview.' }],
        metadata,
        visualEvaluation,
      )
      setInterviewMessages([{ role: 'assistant', content: reply }])
    } catch (err) {
      setError(err.message)
    } finally {
      setStartingInterview(false)
    }
  }

  async function handleEndChat() {
    setGeneratingReport(true)
    setPhase(PHASES.REPORT)
    setError('')

    try {
      const report = await generateFinalReport(interviewMessages, metadata, visualEvaluation)
      setFinalReport(report)
    } catch (err) {
      setError(err.message)
    } finally {
      setGeneratingReport(false)
    }
  }

  function handleReset() {
    setPhase(PHASES.SETUP)
    setMetadata(null)
    setUrl('')
    setVisualEvaluation(null)
    setInterviewMessages([])
    setInterviewStarted(false)
    setFinalReport(null)
    setEmbedBlocked(false)
    setDirectPlaybackFailed(false)
    setError('')
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">🍿 POPCORN OBSERVER</p>
          <h1>Watch. React. Uncover Your Insights.</h1>
          <p className="subtitle">
            Paste any YouTube link, let our AI analyze your real-time facial expressions, chat
            about your experience, and get a tailored sentiment breakdown.
          </p>
        </div>
        <div className="status-pill">
          {apiReady ? '🔴 LIVE AI OBSERVER' : '🔑 Add OPENAI_API_KEY to .env'}
        </div>
      </header>

      {phase === PHASES.SETUP && (
        <section className="panel">
          <h2>🎬 Now Showing</h2>
          <label htmlFor="youtube-url">YouTube URL</label>
          <div className="input-row">
            <input
              id="youtube-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <button
              type="button"
              className="btn"
              onClick={handleLoadMetadata}
              disabled={loadingMeta || !url.trim()}
            >
              {loadingMeta ? 'Loading…' : '🍿 Start Movie Night'}
            </button>
          </div>

          {metadata && (
            <div className="metadata-card">
              <h3>{metadata.title}</h3>
              <dl className="metadata-grid">
                <div>
                  <dt>Duration</dt>
                  <dd>
                    {metadata.duration}s ({metadata.durationLabel ?? formatTimestamp(metadata.duration)})
                  </dd>
                </div>
                <div>
                  <dt>Video ID</dt>
                  <dd>{metadata.videoId}</dd>
                </div>
                {metadata.playbackRestricted && (
                  <div>
                    <dt>Playback</dt>
                    <dd>Direct on-site playback (embedding disabled)</dd>
                  </div>
                )}
              </dl>
              <button type="button" className="btn btn-large" onClick={handleStartWatching}>
                Start Watching
              </button>
            </div>
          )}
        </section>
      )}

      {phase === PHASES.WATCHING && metadata && (
        <section className="panel watch-panel">
          <h2>Now Watching</h2>
          <p className="watch-title">{metadata.title}</p>
          <p className="muted">
            {readingModeFallback
              ? 'Direct playback failed for this clip. Read the transcript on-site while we capture your reactions.'
              : useDirectPlayback
                ? 'Playing on-site via direct stream. Your webcam captures reactions with transcript sync.'
                : `Your webcam is on. Insight Observer captures up to ${maxSamples} reaction snapshots.`}
          </p>

          <div className="watch-grid">
            <div className="player-wrap">
              {readingModeFallback ? (
                <RestrictedVideoPanel
                  videoId={metadata.videoId}
                  title={metadata.title}
                  sampleCount={sampleCount}
                  maxSamples={maxSamples}
                  onCaptureNow={captureNow}
                  onContinue={handleContinueWatching}
                  continuing={continuing}
                />
              ) : useDirectPlayback ? (
                <DirectVideoPlayer
                  videoId={metadata.videoId}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleVideoEnded}
                  onError={handleDirectPlaybackError}
                />
              ) : (
                <YouTubePlayer
                  videoId={metadata.videoId}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleVideoEnded}
                  onEmbedBlocked={handleEmbedBlocked}
                />
              )}
            </div>

            <div className="webcam-wrap">
              <video ref={videoRef} muted playsInline className="webcam-feed" />
              <div className="sample-meter">
                <span>
                  Captures: {sampleCount} / {maxSamples}
                </span>
                {!readingModeFallback && (
                  <span>Video time: {formatTimestamp(currentTime)}</span>
                )}
              </div>
              {!webcamReady && !webcamError && <p className="muted">Starting webcam…</p>}
              <ErrorBanner message={webcamError} />
            </div>
          </div>

          <div className="watch-details">
            <details className="watch-details-block">
              <summary>Description</summary>
              <p>{metadata.description || 'No description available.'}</p>
            </details>
            <details className="watch-details-block">
              <summary>Transcript</summary>
              <LiveTranscript
                segments={metadata.transcriptSegments}
                currentTime={currentTime}
                fallbackText={metadata.transcript}
                syncPlayback={!readingModeFallback}
                showTimestamps={!readingModeFallback}
              />
            </details>
          </div>
        </section>
      )}

      {(phase === PHASES.EVALUATION || phase === PHASES.INTERVIEW || phase === PHASES.REPORT) && (
        <>
          <VisualEvaluationPanel evaluation={visualEvaluation} loading={evaluating} />

          {phase === PHASES.EVALUATION && !evaluating && visualEvaluation && !interviewStarted && (
            <section className="panel action-panel">
              <button
                type="button"
                className="btn btn-large"
                onClick={handleStartInterview}
                disabled={startingInterview}
              >
                {startingInterview ? 'Opening interview…' : '🍿 Begin Interview'}
              </button>
            </section>
          )}

          <InterviewChat
            active={interviewStarted && phase !== PHASES.REPORT}
            videoMetadata={metadata}
            visualEvaluation={visualEvaluation}
            messages={interviewMessages}
            onMessagesChange={setInterviewMessages}
            onEndChat={handleEndChat}
          />

          <FinalReport report={finalReport} loading={generatingReport} videoMetadata={metadata} />

          {phase === PHASES.REPORT && finalReport && !generatingReport && (
            <section className="panel action-panel">
              <button type="button" className="btn btn-secondary" onClick={handleReset}>
                Watch Another Video
              </button>
            </section>
          )}
        </>
      )}

      <ErrorBanner message={error} />
    </div>
  )
}
