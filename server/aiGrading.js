import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const GRADING_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ai_grading')

function formatVisualEvaluation(evaluation) {
  if (!evaluation) return 'No visual evaluation available.'

  if (typeof evaluation === 'string') return evaluation

  const observations = (evaluation.observations ?? [])
    .map(
      (o) =>
        `[${o.timestampLabel ?? o.timestamp ?? '?'}] ${o.expression}: ${o.interpretation}`,
    )
    .join('\n')

  return [
    `Overall engagement: ${evaluation.overallEngagement ?? 'Unknown'}`,
    '',
    'Summary:',
    evaluation.summary ?? '',
    '',
    'Observations:',
    observations || 'None recorded',
  ].join('\n')
}

function formatFinalReport(report) {
  if (!report) return 'No final report generated.'

  const lines = [
    report.headline ?? 'Untitled Report',
    `Score: ${report.overallScore ?? 'N/A'} | Sentiment: ${report.overallSentiment ?? 'N/A'}`,
    report.ratedLabel ?? '',
    '',
    'Emotional Summary:',
    report.emotionalSummary ?? '',
    '',
    'Scores:',
    `- Engagement: ${report.scores?.engagement?.value ?? 'N/A'}%`,
    `- Visual React: ${report.scores?.visual?.value ?? 'N/A'}%`,
    `- Verbal Review: ${report.scores?.verbal?.value ?? 'N/A'}%`,
    '',
    'Key Moments:',
  ]

  for (const moment of report.keyMoments ?? []) {
    lines.push(`- ${moment.timestampLabel ?? '?'}: ${moment.reaction} — ${moment.meaning}`)
  }

  lines.push('', 'Likes:', ...(report.likes ?? []).map((item) => `- ${item}`))
  lines.push('', 'Dislikes:', ...(report.dislikes ?? []).map((item) => `- ${item}`))

  if (report.viewerQuote) {
    lines.push('', `Viewer quote: "${report.viewerQuote}"`)
  }

  if (report.recommendations) {
    lines.push('', 'Recommendations:', report.recommendations)
  }

  for (const review of report.criticReviews ?? []) {
    lines.push('', `${review.author} (${review.rating}/5): ${review.text}`)
  }

  return lines.join('\n')
}

export async function saveAiGradingArtifacts({
  finalPrompt,
  videoMetadata,
  visualEvaluation,
  finalReport,
}) {
  await fs.mkdir(GRADING_DIR, { recursive: true })

  await Promise.all([
    fs.writeFile(path.join(GRADING_DIR, 'final_prompt.txt'), finalPrompt, 'utf8'),
    fs.writeFile(
      path.join(GRADING_DIR, 'visual_evaluation.txt'),
      formatVisualEvaluation(visualEvaluation),
      'utf8',
    ),
    fs.writeFile(
      path.join(GRADING_DIR, 'video_metadata.json'),
      `${JSON.stringify(videoMetadata, null, 2)}\n`,
      'utf8',
    ),
    fs.writeFile(
      path.join(GRADING_DIR, 'final_report.txt'),
      formatFinalReport(finalReport),
      'utf8',
    ),
  ])

  return GRADING_DIR
}
