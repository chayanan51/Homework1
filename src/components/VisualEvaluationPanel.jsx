import { formatTimestamp } from '../lib/utils'

export default function VisualEvaluationPanel({ evaluation, loading }) {
  if (loading) {
    return (
      <section className="panel">
        <h2>Visual Evaluation</h2>
        <p className="muted">Analyzing your reactions…</p>
      </section>
    )
  }

  if (!evaluation) return null

  return (
    <section className="panel evaluation-panel">
      <h2>Visual Evaluation</h2>
      <p className="engagement-badge">{evaluation.overallEngagement}</p>
      <p className="evaluation-summary">{evaluation.summary}</p>

      <div className="observation-grid">
        {(evaluation.observations ?? []).map((obs, i) => (
          <article key={i} className="observation-card">
            <span className="obs-time">
              {obs.timestampLabel ?? formatTimestamp(obs.timestamp ?? 0)}
            </span>
            <h3>{obs.expression}</h3>
            <p>{obs.interpretation}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
