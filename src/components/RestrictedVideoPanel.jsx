export default function RestrictedVideoPanel({
  videoId,
  title,
  sampleCount,
  maxSamples,
  onCaptureNow,
  onContinue,
  continuing,
}) {
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`

  return (
    <div className="restricted-video-panel">
      <img src={thumbnailUrl} alt="" className="restricted-video-thumb" />
      <div className="restricted-video-body">
        <p className="restricted-video-badge">On-site reading mode</p>
        <h3 className="restricted-video-title">{title}</h3>
        <p className="restricted-video-copy">
          This clip cannot be embedded, so playback stays on this page through the transcript
          below. Your webcam will capture reactions automatically — no video timestamps needed.
        </p>

        <div className="restricted-video-stats">
          <span>
            Captures: {sampleCount} / {maxSamples}
          </span>
        </div>

        <div className="restricted-video-actions">
          <button type="button" className="btn btn-secondary" onClick={onCaptureNow}>
            Capture now
          </button>
          <button type="button" className="btn" onClick={onContinue} disabled={continuing}>
            {continuing ? 'Continuing…' : 'Continue to evaluation'}
          </button>
        </div>
      </div>
    </div>
  )
}
