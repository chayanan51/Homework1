import { useCallback, useRef, useState } from 'react'
import { sendInterviewMessage } from '../api/client'
import ErrorBanner from './ErrorBanner'
import PopcornExplosion from './PopcornExplosion'

export default function InterviewChat({
  videoMetadata,
  visualEvaluation,
  messages,
  onMessagesChange,
  onEndChat,
  active,
}) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [explosion, setExplosion] = useState(null)
  const endBtnRef = useRef(null)
  const bottomRef = useRef(null)

  const finishExplosion = useCallback(() => {
    setExplosion(null)
    onEndChat()
  }, [onEndChat])

  function handleEndChat() {
    if (loading || explosion) return

    const rect = endBtnRef.current?.getBoundingClientRect()
    if (rect) {
      setExplosion({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })
    } else {
      onEndChat()
    }
  }

  if (!active) return null

  async function sendMessage(text) {
    if (!text.trim() || loading) return

    const userMessage = { role: 'user', content: text.trim() }
    const nextMessages = [...messages, userMessage]
    onMessagesChange(nextMessages)
    setInput('')
    setLoading(true)
    setError('')

    try {
      const { reply } = await sendInterviewMessage(
        nextMessages,
        videoMetadata,
        visualEvaluation,
      )
      onMessagesChange([...nextMessages, { role: 'assistant', content: reply }])
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <section className="panel interview-panel">
        <div className="panel-header">
          <h2>The Interviewer</h2>
          <button
            ref={endBtnRef}
            type="button"
            className="btn btn-danger btn-end-chat"
            onClick={handleEndChat}
            disabled={loading || Boolean(explosion)}
          >
            End Chat 🍿
          </button>
        </div>

        <div className="chat-log">
          {messages.map((msg, i) => (
            <div key={i} className={msg.role === 'assistant' ? 'chat-ai' : 'chat-user'}>
              <span className="chat-label">
                {msg.role === 'assistant' ? 'Insight Observer' : 'You'}
              </span>
              <p>{msg.content}</p>
            </div>
          ))}
          {loading && (
            <div className="chat-ai">
              <span className="chat-label">Insight Observer</span>
              <p className="muted">Thinking…</p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="chat-input-row"
          onSubmit={(e) => {
            e.preventDefault()
            sendMessage(input)
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Share what you liked or disliked…"
            disabled={loading}
          />
          <button type="submit" className="btn" disabled={loading || !input.trim()}>
            Send
          </button>
        </form>

        <ErrorBanner message={error} />
      </section>

      {explosion && <PopcornExplosion origin={explosion} onDone={finishExplosion} />}
    </>
  )
}
