/**
 * Generates ai_grading/ artifacts using live metadata + a sample session.
 * Run: node scripts/generate-ai-grading.js
 */
import 'dotenv/config'

const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const API = `http://localhost:${process.env.PORT || 3003}`

const sampleVisualEvaluation = {
  overallEngagement: 'High — consistent smiles and visible enjoyment throughout.',
  summary:
    'The viewer stayed engaged from the opening beat through the chorus, with peak reactions during the hook and final chorus.',
  observations: [
    {
      timestamp: 18,
      timestampLabel: '0:18',
      expression: 'smile',
      interpretation: 'Recognized the familiar opening lyrics.',
    },
    {
      timestamp: 42,
      timestampLabel: '0:42',
      expression: 'laugh',
      interpretation: 'Amused by the upbeat chorus energy.',
    },
    {
      timestamp: 75,
      timestampLabel: '1:15',
      expression: 'sing-along mouth movement',
      interpretation: 'Mouthing along with the chorus.',
    },
  ],
}

const sampleChatHistory = [
  {
    role: 'assistant',
    content:
      'Welcome back! I noticed you smiled right when the chorus hit — what stood out to you most about this video?',
  },
  {
    role: 'user',
    content:
      'The energy and nostalgia. I have heard this song many times and it still makes me happy.',
  },
  {
    role: 'assistant',
    content: 'Did any moment feel too repetitive, or did it stay enjoyable the whole way through?',
  },
  {
    role: 'user',
    content: 'It stayed fun. The chorus is catchy and I liked singing along.',
  },
]

async function main() {
  const health = await fetch(`${API}/api/health`)
  if (!health.ok) {
    throw new Error(`API not reachable at ${API}. Run npm run dev first.`)
  }

  const metaRes = await fetch(`${API}/api/youtube-metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: TEST_VIDEO_URL }),
  })
  const videoMetadata = await metaRes.json()
  if (!metaRes.ok) throw new Error(videoMetadata.error ?? 'Metadata fetch failed')

  const reportRes = await fetch(`${API}/api/final-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatHistory: sampleChatHistory,
      videoMetadata,
      visualEvaluation: sampleVisualEvaluation,
    }),
  })
  const report = await reportRes.json()
  if (!reportRes.ok) throw new Error(report.error ?? 'Final report failed')

  console.log('ai_grading/ files written for:', videoMetadata.title)
  console.log('gradingSaved:', report.gradingSaved ?? true)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
