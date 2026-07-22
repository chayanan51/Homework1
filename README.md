# Insight Observer

A React + Vite app where the user watches a YouTube video while the AI watches them via webcam. After the video, the AI runs a live interview and produces a final emotional report.

## Features

- **YouTube Video Metadata** — paste a URL to fetch title, duration (seconds), description, and transcript
- **Visual Evaluation** — webcam captures up to 20 reaction snapshots during playback
- **The Interviewer** — post-video chatbot referencing video content and facial expressions
- **Final Synthesis** — end chat to generate a formatted emotional viewing report
- **Model** — all AI processing uses `gpt-5.6`

## Setup

```bash
npm install
cp .env.example .env
# Add OPENAI_API_KEY to .env
npm run dev
```

Open the URL shown in the terminal (usually http://localhost:5173).

## Flow

1. Paste a YouTube URL and click **Load Video**
2. Click **Start Watching** — allow webcam access
3. When the video ends, the app runs visual evaluation
4. Click **Start Interview** to chat with Insight Observer
5. Click **End Chat** to generate the final report

## API endpoints

- `GET /api/health`
- `POST /api/youtube-metadata`
- `POST /api/visual-evaluation`
- `POST /api/interview`
- `POST /api/final-report`
