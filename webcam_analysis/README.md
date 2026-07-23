# Webcam Analysis App

A simple React + Vite app that sends a webcam photo to OpenAI and shows what the model sees.

## What it does

1. **Start Camera** — turns on your webcam and shows a live preview  
2. **Capture** — freezes a still frame from the video  
3. **Analyze with AI** — sends that image to OpenAI (`gpt-5.6`) and displays a short text description in a result box below the buttons

## Setup

```bash
npm install
```

Create a `.env` file in the project root:

```
VITE_OPENAI_API_KEY=your-openai-api-key
```

Restart the dev server after changing `.env`.

## Run

```bash
npm run dev
```

Open the local URL (usually `http://localhost:5173`), allow camera access, then capture and analyze.

## Notes

- Do not commit your `.env` file (it is already in `.gitignore`).
- The OpenAI key is used from the browser via Vite’s `VITE_` env vars — fine for a class demo, not for a production public site.
