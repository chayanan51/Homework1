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

Open **http://localhost:5176** in your browser after `npm run dev`.

- **Frontend (the app):** http://localhost:5176
- **API (backend only):** http://localhost:3003 — do not open this for the UI

> Port 5173 may be used by another project on your machine (e.g. Beach Pose AI). This app always uses **5176**.

## Flow

1. Paste a YouTube URL and click **Start Movie Night**
2. Click **Start Watching** — allow webcam access
3. When the video ends, the app runs visual evaluation
4. Click **Start Interview** to chat with Insight Observer
5. Click **End Chat** to generate the final report

## AI grading artifacts

When you click **End Chat 🍿**, the app automatically saves grading files to `ai_grading/`:

- `final_prompt.txt`
- `visual_evaluation.txt`
- `video_metadata.json`
- `final_report.txt`

Commit and push that folder after one full test run for submission.

## API endpoints

- `GET /api/health`
- `POST /api/youtube-metadata`
- `POST /api/visual-evaluation`
- `POST /api/interview`
- `POST /api/final-report`
