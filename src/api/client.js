async function postJson(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Request failed.')
  return data
}

export async function checkHealth() {
  const res = await fetch('/api/health')
  return res.json()
}

export function fetchYouTubeMetadata(url) {
  return postJson('/api/youtube-metadata', { url })
}

export function runVisualEvaluation(images, videoMetadata) {
  return postJson('/api/visual-evaluation', { images, videoMetadata })
}

export function sendInterviewMessage(messages, videoMetadata, visualEvaluation) {
  return postJson('/api/interview', { messages, videoMetadata, visualEvaluation })
}

export function generateFinalReport(chatHistory, videoMetadata, visualEvaluation) {
  return postJson('/api/final-report', { chatHistory, videoMetadata, visualEvaluation })
}
