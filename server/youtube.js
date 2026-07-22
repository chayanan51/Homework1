import { Innertube, Platform } from 'youtubei.js'
import { YoutubeTranscript } from 'youtube-transcript'

Platform.shim.eval = async (data, env) => {
  const properties = []

  if (env?.n) {
    properties.push(`n: exportedVars.nFunction("${env.n}")`)
  }

  if (env?.sig) {
    properties.push(`sig: exportedVars.sigFunction("${env.sig}")`)
  }

  const code = `${data.output}\nreturn { ${properties.join(', ')} }`
  return new Function(code)()
}

async function createInnertube() {
  return Innertube.create({ generate_session_locally: true })
}

export function extractVideoId(url) {
  const trimmed = url.trim()
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]
  for (const pattern of patterns) {
    const match = trimmed.match(pattern)
    if (match) return match[1]
  }
  return null
}

function formatTimestamp(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function segmentsToText(segments) {
  return segments
    .map((segment) => segment.text?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function usesMilliseconds(segments) {
  if (!segments.length) return false
  const maxEnd = Math.max(
    ...segments.map((segment) => (segment.offset ?? 0) + (segment.duration ?? 0)),
  )
  return maxEnd > 10_000 || segments.some((segment) => segment.offset > 1_000)
}

function normalizePackageSegments(rawSegments) {
  const isMs = usesMilliseconds(rawSegments)

  return rawSegments
    .map((segment) => {
      const start = isMs ? segment.offset / 1000 : segment.offset
      const duration = isMs ? segment.duration / 1000 : segment.duration
      const text = segment.text?.trim() ?? ''

      if (!text) return null

      return { text, start, duration }
    })
    .filter(Boolean)
}

function normalizeInnertubeSegments(rawSegments) {
  return rawSegments
    .map((segment) => {
      const text =
        segment?.snippet?.text ??
        (typeof segment?.snippet?.toString === 'function' ? segment.snippet.toString() : '') ??
        segment?.text ??
        ''

      const trimmed = text.trim()
      if (!trimmed) return null

      const startMs = segment.start_ms ?? segment.startMs ?? 0
      const endMs = segment.end_ms ?? segment.endMs ?? startMs

      return {
        text: trimmed,
        start: startMs / 1000,
        duration: Math.max((endMs - startMs) / 1000, 0.1),
      }
    })
    .filter(Boolean)
}

async function fetchTranscriptFromPackage(videoId) {
  const attempts = [
    () => YoutubeTranscript.fetchTranscript(videoId),
    () => YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' }),
  ]

  for (const attempt of attempts) {
    try {
      const rawSegments = await attempt()
      const segments = normalizePackageSegments(rawSegments)
      const text = segmentsToText(segments)
      if (text) return { text, segments }
    } catch {
      // fall through
    }
  }

  return { text: '', segments: [] }
}

async function fetchTranscriptFromInnertube(info) {
  try {
    const transcriptData = await info.getTranscript()
    const page = transcriptData?.transcript?.content
    const rawSegments = page?.body?.initial_segments ?? page?.body?.segments ?? []
    const segments = normalizeInnertubeSegments(rawSegments)
    const text = segmentsToText(segments)
    if (text) return { text, segments }

    if (typeof transcriptData?.transcript?.selectLanguage === 'function') {
      const selected = await transcriptData.transcript.selectLanguage('English')
      const selectedSegments = normalizeInnertubeSegments(
        selected?.content?.body?.initial_segments ?? [],
      )
      const selectedText = segmentsToText(selectedSegments)
      if (selectedText) return { text: selectedText, segments: selectedSegments }
    }
  } catch {
    // fall through
  }

  return { text: '', segments: [] }
}

const streamCache = new Map()
const STREAM_TTL_MS = 5 * 60 * 1000

export async function getVideoStreamUrl(videoId) {
  const cached = streamCache.get(videoId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url
  }

  const yt = await createInnertube()
  const format = await yt.getStreamingData(videoId, {
    type: 'video+audio',
    quality: '360p',
    format: 'mp4',
  })

  if (!format.url) {
    throw new Error('No playable stream found for this video.')
  }

  streamCache.set(videoId, {
    url: format.url,
    expiresAt: Date.now() + STREAM_TTL_MS,
  })

  return format.url
}

export async function fetchYouTubeMetadata(videoId) {
  const yt = await createInnertube()
  const info = await yt.getInfo(videoId)

  const packageTranscript = await fetchTranscriptFromPackage(videoId)
  const innertubeTranscript =
    packageTranscript.text ? { text: '', segments: [] } : await fetchTranscriptFromInnertube(info)

  const transcriptText = packageTranscript.text || innertubeTranscript.text
  const transcriptSegments = packageTranscript.segments.length
    ? packageTranscript.segments
    : innertubeTranscript.segments

  const duration = Number(info.basic_info.duration ?? 0)
  const embeddable = info.playability_status?.embeddable !== false

  return {
    videoId,
    title: info.basic_info.title ?? 'Unknown title',
    duration,
    durationLabel: formatTimestamp(duration),
    description: info.basic_info.short_description ?? '',
    transcript: transcriptText || 'Transcript unavailable for this video.',
    transcriptSegments,
    embeddable,
    playbackRestricted: !embeddable,
  }
}
