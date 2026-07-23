import { useEffect, useRef, useState } from 'react'
import OpenAI from 'openai'
import LabubuAvatar from './LabubuAvatar'
import './App.css'

const MODEL = 'gpt-5.6'

function App() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const [cameraOn, setCameraOn] = useState(false)
  const [capturedImage, setCapturedImage] = useState(null)
  const [analysis, setAnalysis] = useState('')
  const [status, setStatus] = useState('Start the camera, capture a frame, then ask the AI.')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  async function startCamera() {
    try {
      setStatus('Starting camera…')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true)
      setCapturedImage(null)
      setAnalysis('')
      setStatus('Camera is live. Capture a photo when you are ready.')
    } catch (error) {
      setStatus('Could not access the webcam. Check browser permissions.')
      console.error(error)
    }
  }

  function capturePhoto() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !cameraOn) {
      setStatus('Start the camera before capturing.')
      return
    }

    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) {
      setStatus('Camera is still warming up. Try again in a second.')
      return
    }

    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedImage(dataUrl)
    setAnalysis('')
    setStatus('Photo captured. Press the magic wand to analyze it.')
  }

  async function analyzeImage() {
    if (!capturedImage) {
      setStatus('Capture a photo first.')
      return
    }

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) {
      setStatus('Add your API key to .env as VITE_OPENAI_API_KEY, then restart npm run dev.')
      return
    }

    setLoading(true)
    setStatus('Sending image to OpenAI…')
    setAnalysis('')

    try {
      const client = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true,
      })

      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Describe what you see in this webcam image in 2-4 vivid sentences. Mention people, objects, setting, mood, and anything notable.',
              },
              {
                type: 'image_url',
                image_url: { url: capturedImage },
              },
            ],
          },
        ],
      })

      const text = response.choices[0]?.message?.content?.trim() || 'No response from the model.'
      setAnalysis(text)
      setStatus('Analysis complete.')
    } catch (error) {
      console.error(error)
      setStatus(error?.message || 'OpenAI request failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="hero">
        <LabubuAvatar color="#9ca3af" size="sm" className="labubu-title labubu-title--left" />
        <div className="hero-copy">
          <p className="eyebrow">Webcam Analyzer</p>
          <h1>See what the AI sees</h1>
          <p className="subtitle">Start your webcam, snap a frame, and let GPT describe it.</p>
        </div>
        <LabubuAvatar color="#ff4fa3" size="sm" className="labubu-title labubu-title--right" />
      </header>

      <section className="stage">
        <div className="preview-card">
          {capturedImage ? (
            <img src={capturedImage} alt="Captured webcam frame" className="preview-media" />
          ) : (
            <video ref={videoRef} className="preview-media" playsInline muted />
          )}
          {!cameraOn && !capturedImage && (
            <div className="preview-placeholder">Camera preview appears here</div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden-canvas" />
      </section>

      <section className="controls">
        <button type="button" className="btn btn-camera" onClick={startCamera}>
          <span aria-hidden="true">📷</span>
          Start Camera
        </button>
        <button type="button" className="btn btn-capture" onClick={capturePhoto} disabled={!cameraOn}>
          <span aria-hidden="true">⏺</span>
          Capture
        </button>
        <button
          type="button"
          className="btn btn-ai"
          onClick={analyzeImage}
          disabled={!capturedImage || loading}
        >
          <span aria-hidden="true">🪄</span>
          {loading ? 'Analyzing…' : 'Analyze with AI'}
        </button>
      </section>

      <p className="status">{status}</p>

      <section className={`result-box ${analysis ? 'has-content' : ''}`}>
        <div className="result-label">AI Vision</div>
        <p className="result-text">
          {analysis || 'Your analysis will land here after you press the magic wand.'}
        </p>
      </section>

      <footer className="footer">© 2026 Tauhid Zaman</footer>
    </div>
  )
}

export default App
