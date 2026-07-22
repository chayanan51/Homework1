import 'dotenv/config'
import express from 'express'
import { Readable } from 'node:stream'
import { saveAiGradingArtifacts } from './aiGrading.js'
import { fetchYouTubeMetadata, extractVideoId, getVideoStreamUrl } from './youtube.js'

const app = express()
const port = process.env.PORT || 3003
const MODEL = 'gpt-5.6'

const FINAL_REPORT_SYSTEM_PROMPT = `You synthesize a final emotional viewing report styled like a movie review page.
Return ONLY valid JSON:
{
  "headline": "short evocative review headline about how the user felt",
  "overallScore": 0-10 number with one decimal (e.g. 7.8),
  "overallSentiment": "positive | mixed | negative | neutral",
  "ratedLabel": "short label e.g. Based on 20 reaction captures",
  "emotionalSummary": "2-3 paragraphs on how the user felt watching the video",
  "scores": {
    "engagement": { "value": 0-100, "label": "Engagement" },
    "visual": { "value": 0-100, "label": "Visual React" },
    "verbal": { "value": 0-100, "label": "Verbal Review" }
  },
  "keyMoments": [
    { "timestampLabel": "M:SS", "reaction": "...", "meaning": "..." }
  ],
  "likes": ["..."],
  "dislikes": ["..."],
  "criticReviews": [
    {
      "author": "Insight Observer",
      "timeAgo": "Just now",
      "rating": 1-5,
      "text": "A punchy 1-2 sentence review summary pulling from interview + visual data"
    }
  ],
  "viewerQuote": "One memorable quote paraphrased from the user's interview answers",
  "recommendations": "1-2 sentences"
}`

app.use(express.json({ limit: '25mb' }))

async function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is missing. Add it to your .env file and restart the server.',
    )
  }
  const { default: OpenAI } = await import('openai')
  return new OpenAI({ apiKey })
}

function extractJsonBlock(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced) return JSON.parse(fenced[1])

  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) {
    return JSON.parse(text.slice(start, end + 1))
  }

  throw new Error('Model response did not contain valid JSON.')
}

function formatTimestamp(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function metadataBlock(metadata) {
  return `
Title: ${metadata.title}
Duration: ${metadata.duration}s (${metadata.durationLabel ?? formatTimestamp(metadata.duration)})
Description: ${metadata.description}
Transcript excerpt: ${(metadata.transcript ?? '').slice(0, 4000)}
`.trim()
}

function visualEvalBlock(evaluation) {
  if (!evaluation) return 'No visual evaluation available.'
  if (typeof evaluation === 'string') return evaluation

  const observations = (evaluation.observations ?? [])
    .map(
      (o) =>
        `- ${o.timestampLabel ?? formatTimestamp(o.timestamp ?? 0)}: ${o.expression} — ${o.interpretation}`,
    )
    .join('\n')

  return `
Overall engagement: ${evaluation.overallEngagement ?? 'Unknown'}
Summary: ${evaluation.summary ?? ''}
Observations:
${observations || 'None recorded'}
`.trim()
}

app.get('/api/health', (_req, res) => {
  res.json({
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    model: MODEL,
  })
})

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><title>Insight Observer API</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; line-height: 1.6;">
  <h1>Insight Observer API</h1>
  <p>This port (<code>${port}</code>) is the backend only — not the app UI.</p>
  <p>Open the frontend at <a href="http://localhost:5176">http://localhost:5176</a> after running <code>npm run dev</code>.</p>
  <p>Health check: <a href="/api/health">/api/health</a></p>
</body>
</html>`)
})

app.post('/api/youtube-metadata', async (req, res) => {
  const { url } = req.body
  if (!url?.trim()) {
    return res.status(400).json({ error: 'YouTube URL is required.' })
  }

  const videoId = extractVideoId(url)
  if (!videoId) {
    return res.status(400).json({ error: 'Could not parse a valid YouTube video ID.' })
  }

  try {
    const metadata = await fetchYouTubeMetadata(videoId)
    res.json(metadata)
  } catch (err) {
    console.error('YouTube metadata failed:', err)
    res.status(500).json({ error: err.message ?? 'Failed to fetch YouTube metadata.' })
  }
})

app.get('/api/youtube-stream/:videoId/play', async (req, res) => {
  const { videoId } = req.params

  if (!videoId?.trim()) {
    return res.status(400).json({ error: 'Video ID is required.' })
  }

  try {
    const upstreamUrl = await getVideoStreamUrl(videoId)
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: 'https://www.youtube.com/',
      Origin: 'https://www.youtube.com',
    }

    if (req.headers.range) {
      headers.Range = req.headers.range
    }

    const upstream = await fetch(upstreamUrl, { headers })
    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).json({ error: 'Failed to load video stream.' })
    }

    res.status(upstream.status)
    res.set('Content-Type', upstream.headers.get('content-type') || 'video/mp4')
    res.set('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes')

    const contentRange = upstream.headers.get('content-range')
    const contentLength = upstream.headers.get('content-length')
    if (contentRange) res.set('Content-Range', contentRange)
    if (contentLength) res.set('Content-Length', contentLength)

    if (!upstream.body) {
      return res.status(502).json({ error: 'Empty stream response.' })
    }

    Readable.fromWeb(upstream.body).pipe(res)
  } catch (err) {
    console.error('YouTube stream proxy failed:', err)
    res.status(500).json({ error: err.message ?? 'Failed to proxy video stream.' })
  }
})

app.post('/api/visual-evaluation', async (req, res) => {
  const { images, videoMetadata } = req.body

  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'At least one webcam image is required.' })
  }
  if (images.length > 20) {
    return res.status(400).json({ error: 'Maximum 20 images allowed.' })
  }

  try {
    const openai = await getOpenAI()

    const imageContent = images.map((img) => ({
      type: 'image_url',
      image_url: { url: img.dataUrl, detail: 'low' },
    }))

    const restricted = Boolean(videoMetadata?.playbackRestricted)
    const timestampList = images
      .map(
        (img, index) =>
          restricted
            ? `${img.timestampLabel ?? `Capture ${index + 1}`} (reaction snapshot ${index + 1})`
            : `Image at ${img.timestampLabel ?? formatTimestamp(img.timestamp ?? 0)} (${img.timestamp ?? 0}s)`,
      )
      .join('\n')

    const systemPrompt = restricted
      ? `You analyze facial expressions and engagement while someone reviews a video on-site without embedded playback.
Return ONLY valid JSON with this schema:
{
  "overallEngagement": "brief overall assessment",
  "summary": "2-3 sentence narrative of emotional journey",
  "observations": [
    {
      "timestamp": number (capture order index, starting at 1),
      "timestampLabel": "Capture N",
      "expression": "e.g. smile, furrowed brow, surprise",
      "interpretation": "what this likely indicates"
    }
  ]
}
Use capture order instead of video timestamps.`
      : `You analyze facial expressions and engagement while someone watches a video.
Return ONLY valid JSON with this schema:
{
  "overallEngagement": "brief overall assessment",
  "summary": "2-3 sentence narrative of emotional journey",
  "observations": [
    {
      "timestamp": number (seconds),
      "timestampLabel": "M:SS",
      "expression": "e.g. smile, furrowed brow, surprise",
      "interpretation": "what this likely indicates"
    }
  ]
}
Match observation timestamps to the provided capture times.`

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Video being watched:
${metadataBlock(videoMetadata ?? {})}

${restricted ? 'Capture order:' : 'Capture timestamps:'}
${timestampList}

Analyze these ${images.length} webcam captures in order.`,
            },
            ...imageContent,
          ],
        },
      ],
    })

    const content = response.choices[0]?.message?.content ?? ''
    const evaluation = extractJsonBlock(content)
    res.json(evaluation)
  } catch (err) {
    console.error('Visual evaluation failed:', err)
    res.status(500).json({ error: err.message ?? 'Visual evaluation failed.' })
  }
})

app.post('/api/interview', async (req, res) => {
  const { messages, videoMetadata, visualEvaluation } = req.body

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages are required.' })
  }

  try {
    const openai = await getOpenAI()

    const systemPrompt = `You are Insight Observer, a warm post-viewing interviewer.
The user just finished watching a YouTube video while you observed their reactions via webcam.

VIDEO METADATA:
${metadataBlock(videoMetadata ?? {})}

VISUAL EVALUATION (facial expressions while watching):
${visualEvalBlock(visualEvaluation)}

Your goals:
- Ask what they liked and disliked about the video.
- Reference specific facial expressions at timestamps (e.g. "I noticed you smiled at 1:23, what caused that?").
- Ask follow-up questions based on their answers.
- Keep questions conversational, one at a time.
- Be curious, not judgmental.`

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    })

    const reply = (response.choices[0]?.message?.content ?? '').trim()
    res.json({ reply })
  } catch (err) {
    console.error('Interview failed:', err)
    res.status(500).json({ error: err.message ?? 'Interview request failed.' })
  }
})

app.post('/api/final-report', async (req, res) => {
  const { chatHistory, videoMetadata, visualEvaluation } = req.body

  if (!Array.isArray(chatHistory)) {
    return res.status(400).json({ error: 'Chat history is required.' })
  }

  try {
    const openai = await getOpenAI()

    const transcript = chatHistory
      .map((m) => `${m.role === 'assistant' ? 'Interviewer' : 'User'}: ${m.content}`)
      .join('\n\n')

    const userPrompt = `VIDEO METADATA:
${metadataBlock(videoMetadata ?? {})}

VISUAL EVALUATION:
${visualEvalBlock(visualEvaluation)}

INTERVIEW TRANSCRIPT:
${transcript || 'No interview conducted.'}

Write the final synthesis report.`

    const finalPrompt = `=== SYSTEM ===
${FINAL_REPORT_SYSTEM_PROMPT}

=== USER ===
${userPrompt}`

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: FINAL_REPORT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    })

    const content = response.choices[0]?.message?.content ?? ''
    const report = extractJsonBlock(content)

    await saveAiGradingArtifacts({
      finalPrompt,
      videoMetadata,
      visualEvaluation,
      finalReport: report,
    })

    res.json({ ...report, gradingSaved: true })
  } catch (err) {
    console.error('Final report failed:', err)
    res.status(500).json({ error: err.message ?? 'Final report generation failed.' })
  }
})

app.listen(port, () => {
  console.log(`Insight Observer API running at http://localhost:${port}`)
  console.log(`Open the app at http://localhost:5176`)
})
