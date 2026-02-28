# 🎬 CineSnap — AI Photo-to-Cinema Pipeline

> **Turn your photo album into a cinematic experience — AI writes the story between your moments.**

Built for the **Gemini 3 NYC Hackathon** · Track: Gemini and Film

---

## What It Does

CineSnap takes a collection of your photos and transforms them into a narrative movie clip with cinematic transitions, AI-generated video segments, and mood-matched audio.

**The AI doesn't just animate photos — it fills in the gaps.** If you upload 5 photos from a beach trip, Gemini analyzes the scene progression, writes connecting narrative beats, and Veo generates the transitional footage. Your photos become anchor points in an AI-directed short film.

## Architecture

```
Photos → Gemini Vision (analyze) → Gemini (script) → Veo 3.1 (generate) → FFmpeg (assemble) → Film
```

| Stage | Model | Purpose |
|-------|-------|---------|
| 1. Analyze | Gemini 2.5 Flash | Extract metadata, group into scenes |
| 2. Script | Gemini 2.5 Flash | Write shot-by-shot cinematic script |
| 3. Generate | Veo 3.1 | Create video clips (image-to-video + text-to-video) |
| 4. Assemble | FFmpeg | Stitch clips with transitions + audio |

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- FFmpeg installed (`brew install ffmpeg` on macOS)
- Gemini API key with Veo access

### 1. Clone & Setup Backend

```bash
cd cinesnap
python -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

### 2. Set API Key

```bash
export GEMINI_API_KEY="your-api-key-here"
```

### 3. Start Backend

```bash
uvicorn backend.main:app --reload --port 8000
```

### 4. Setup & Start Frontend

```bash
cd frontend
npm install
npm start
```

The app will be running at `http://localhost:3000` with the API at `http://localhost:8000`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/generate` | Upload photos + start pipeline (returns SSE stream) |
| `GET` | `/api/jobs/{id}` | Check job status |
| `GET` | `/api/videos/{id}.mp4` | Download final video |
| `GET` | `/api/scripts/{id}` | Get the AI-generated script JSON |
| `GET` | `/api/health` | Health check |

## Tech Stack

- **Backend:** FastAPI (Python) + async pipeline
- **AI Vision/Script:** Gemini 2.5 Flash
- **AI Video:** Veo 3.1 (`veo-3.1-generate-preview`)
- **Video Assembly:** FFmpeg
- **Frontend:** React + Tailwind CSS
- **Audio:** Veo 3.1 native audio generation

## Project Structure

```
cinesnap/
├── backend/
│   ├── main.py              # FastAPI app + routes
│   ├── config.py            # API keys, paths, settings
│   ├── pipeline/
│   │   ├── orchestrator.py  # Coordinates all 4 stages
│   │   ├── analyzer.py      # Stage 1: Gemini scene analysis
│   │   ├── scriptwriter.py  # Stage 2: Gemini script generation
│   │   ├── videogen.py      # Stage 3: Veo 3.1 video generation
│   │   └── assembler.py     # Stage 4: FFmpeg assembly
│   └── models/
│       ├── schemas.py       # Pydantic data models
│       └── prompts.py       # Gemini prompt templates
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── PhotoUploader.jsx
│       │   ├── ThemeSelector.jsx
│       │   ├── ProgressTracker.jsx
│       │   ├── VideoPlayer.jsx
│       │   └── ScriptViewer.jsx
│       └── api/client.js
├── outputs/                  # Generated videos
└── README.md
```

## Team

Built at Gemini 3 NYC Hackathon 🏗️
