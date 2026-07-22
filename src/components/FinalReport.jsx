function sentimentToScore(sentiment) {
  const map = { positive: 8.4, mixed: 6.5, negative: 4.2, neutral: 5.5 }
  return map[sentiment] ?? 7.0
}

function RatingGauge({ score, label }) {
  const normalized = Math.max(0, Math.min(10, Number(score) || 0))
  const pct = normalized / 10
  const angle = pct * 180

  return (
    <div className="rating-gauge">
      <svg viewBox="0 0 200 120" className="gauge-svg" aria-hidden="true">
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E50914" />
            <stop offset="50%" stopColor="#ff3355" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(angle / 180) * 251} 251`}
        />
        <circle
          cx={100 + 80 * Math.cos(Math.PI - (angle * Math.PI) / 180)}
          cy={100 - 80 * Math.sin((angle * Math.PI) / 180)}
          r="7"
          fill="#E50914"
        />
      </svg>
      <div className="gauge-center">
        <span className="gauge-score">{normalized.toFixed(1)}</span>
        <span className="gauge-label">{label ?? 'Your Rating'}</span>
      </div>
    </div>
  )
}

function ScoreCard({ icon, value, label }) {
  return (
    <article className="score-card">
      <span className="score-icon">{icon}</span>
      <span className="score-value">{value}%</span>
      <span className="score-name">{label}</span>
    </article>
  )
}

function Stars({ count = 5 }) {
  return (
    <span className="star-row" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < count ? 'star filled' : 'star'}>
          ★
        </span>
      ))}
    </span>
  )
}

export default function FinalReport({ report, loading, videoMetadata }) {
  if (loading) {
    return (
      <section className="panel report-panel cinema-report">
        <div className="report-header">
          <h2>Reviews</h2>
        </div>
        <p className="muted">Composing your emotional viewing report… 🍿</p>
      </section>
    )
  }

  if (!report) return null

  const overallScore =
    report.overallScore ?? sentimentToScore(report.overallSentiment)
  const scores = report.scores ?? {}
  const criticReviews = report.criticReviews ?? []
  const fallbackReview = report.headline
    ? [{ author: 'Insight Observer', timeAgo: 'Just now', rating: 5, text: report.headline }]
    : []

  return (
    <section className="panel report-panel cinema-report">
      <div className="report-header">
        <div>
          <p className="report-eyebrow">🎬 Final Synthesis · {videoMetadata?.title ?? 'Your Viewing'}</p>
          <h2>Reviews</h2>
        </div>
        <div className="report-actions" aria-hidden="true">
          <span>↗</span>
          <span>♡</span>
          <span>⋯</span>
        </div>
      </div>

      <RatingGauge score={overallScore} label={report.ratedLabel ?? 'Your Rating'} />

      <div className="score-cards-row">
        <ScoreCard
          icon="🍿"
          value={scores.engagement?.value ?? 85}
          label={scores.engagement?.label ?? 'Engagement'}
        />
        <ScoreCard
          icon="🎬"
          value={scores.visual?.value ?? 78}
          label={scores.visual?.label ?? 'Visual React'}
        />
        <ScoreCard
          icon="🎟️"
          value={scores.verbal?.value ?? 82}
          label={scores.verbal?.label ?? 'Verbal Review'}
        />
      </div>

      <div className="report-section-head">
        <h3>Critic Reviews</h3>
        <span className="see-all">See all</span>
      </div>

      {(criticReviews.length > 0 ? criticReviews : fallbackReview).map((review, i) => (
        <article key={i} className="critic-card">
          <div className="critic-top">
            <div className="critic-author">
              <span className="critic-avatar">🎥</span>
              <div>
                <strong>{review.author ?? 'Insight Observer'}</strong>
                <span className="critic-time">{review.timeAgo ?? 'Just now'}</span>
              </div>
            </div>
            <Stars count={review.rating ?? 5} />
          </div>
          <p className="critic-text">{review.text}</p>
          {report.viewerQuote && i === 0 && (
            <blockquote className="viewer-quote">"{report.viewerQuote}"</blockquote>
          )}
        </article>
      ))}

      <div className="report-body-block">
        <h3>How You Felt</h3>
        {(report.emotionalSummary ?? '').split('\n').filter(Boolean).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <div className="report-columns">
        <div className="likes-block">
          <h4>👍 Liked</h4>
          <ul>
            {(report.likes ?? []).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="dislikes-block">
          <h4>👎 Disliked</h4>
          <ul>
            {(report.dislikes ?? []).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {(report.keyMoments ?? []).length > 0 && (
        <>
          <div className="report-section-head">
            <h3>Key Moments</h3>
          </div>
          <div className="observation-grid">
            {report.keyMoments.map((moment, i) => (
              <article key={i} className="observation-card">
                <span className="obs-time">{moment.timestampLabel}</span>
                <h4>{moment.reaction}</h4>
                <p>{moment.meaning}</p>
              </article>
            ))}
          </div>
        </>
      )}

      {report.recommendations && (
        <p className="recommendations">
          <strong>🎬 Recommendations:</strong> {report.recommendations}
        </p>
      )}
    </section>
  )
}
