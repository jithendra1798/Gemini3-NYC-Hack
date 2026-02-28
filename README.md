# 🎬 CineSnap — AI Photo-to-Cinema Pipeline

> **Turn your photo album into a cinematic experience — AI writes the story between your moments.**

Built for the **Gemini 3 NYC Hackathon** · Track: Gemini and Film

---

## What It Does

CineSnap transforms a collection of photos into a professional cinematic short film. Upload photos → AI analyzes them as one unified story → generates a cinematic script → produces video clips from each photo → assembles everything into a seamless film with smooth transitions.

**The AI doesn't just animate photos — it fills in the gaps.** If you upload 5 photos from a beach trip, Gemini analyzes the entire collection as ONE continuous narrative, finds visual bridges between images (shared colors, subjects, lighting), writes connecting beats, and Veo generates transitional footage. Your photos become anchor points in an AI-directed short film — not a slideshow of separate clips.

---

## Architecture

```
Photos → Gemini Vision (analyze) → Gemini (unified script) → Veo 3.1 (generate) → FFmpeg (assemble) → Film
```

### 4-Stage Pipeline

| Stage | Model / Tool | Progress | What Happens |
|-------|-------------|----------|-------------|
| **1. Analyze** | Gemini 2.5 Flash (multimodal) | 5% → 15% | All photos sent in one request → extracts mood, subjects, lighting, visual bridges → groups into unified scene |
| **2. Script** | Gemini 2.5 Flash (text) | 20% → 30% | Generates 1 clip per photo with Veo prompt, camera motion, transitions, audio — all as ONE continuous story |
| **3. Generate** | Veo 3.1 (image-to-video) | 35% → 80% | Each photo becomes the anchor frame for a video clip; sequential generation with RAI safety handling + 3-retry logic |
| **4. Assemble** | FFmpeg | 85% → 95% | Clips stitched with xfade transitions (crossfade, dissolve, wipe, etc.), audio merged, H.264 High / CRF 20 |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.14, FastAPI, Uvicorn |
| **AI Models** | Gemini 2.5 Flash (vision + text), Veo 3.1 (image-to-video) |
| **Video** | FFmpeg (xfade transitions, H.264 encoding) |
| **Frontend** | React 18, Tailwind CSS 3.4 |
| **Streaming** | Server-Sent Events (real-time progress) |
| **Storage** | JSON file datastore, filesystem for media |

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- FFmpeg installed (`brew install ffmpeg` on macOS)
- Gemini API key with Veo access

### 1. Clone & Setup Backend

```bash
cd Gemini3-NYC-Hack
python -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your-api-key-here
DEV_MODE=true
DEFAULT_DURATION_TARGET=6
CROSSFADE_DURATION=0.8
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

---

## Key Features

- **3D Carousel Upload** — Photos orbit in a 3D ring with perspective transforms; drag-to-reorder strip below sets the clip sequence
- **6 Cinematic Themes** — cinematic, romantic, adventure, horror, documentary, or auto-detect
- **Unified Scene AI** — Prompts force Gemini to treat all photos as one flowing narrative, not separate scenes
- **Real-Time Progress** — SSE streaming updates the UI at every pipeline step with per-clip progress
- **HEIC Support** — Apple HEIC/HEIF photos auto-converted to JPEG via `heic2any`
- **Versioning** — Regenerate with different themes; browse version history, switch between outputs
- **Project Gallery** — All past projects persisted; re-open, regenerate, or delete
- **Duplicate Detection** — SHA-256 fingerprint prevents re-uploading identical photo sets
- **Veo Safety** — Regex-based name sanitization protects 40+ place names while stripping personal names
- **Smooth Transitions** — 0.8s crossfade default, 7 transition types, visual continuity baked into prompts

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/check-duplicate` | Detect duplicate photo uploads via SHA-256 fingerprinting |
| `POST` | `/api/generate` | Upload photos + start pipeline → returns SSE stream |
| `GET` | `/api/jobs/{id}` | Check in-memory job status |
| `GET` | `/api/videos/{name}` | Serve final MP4 video files |
| `GET` | `/api/scripts/{id}` | Get AI-generated script JSON |
| `GET` | `/api/scripts/{id}/v/{version}` | Get script for specific version |
| `GET` | `/api/projects` | List all projects |
| `GET` | `/api/projects/{id}` | Full project details |
| `GET` | `/api/projects/{id}/versions` | List all versions |
| `GET` | `/api/projects/{id}/versions/{v}` | Get specific version |
| `POST` | `/api/projects/{id}/regenerate` | Regenerate from existing photos → SSE stream |
| `GET` | `/api/projects/{id}/photos` | Get uploaded photo metadata + URLs |
| `DELETE` | `/api/projects/{id}` | Delete project + all files |
| `GET` | `/api/uploads/{id}/{filename}` | Serve individual uploaded photos |

---

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `GEMINI_API_KEY` | — | Google Gemini / Veo API key (required) |
| `DEV_MODE` | `true` | `true` = fast Veo model, `false` = full-quality |
| `DEFAULT_DURATION_TARGET` | `30` | Target video duration in seconds |
| `CROSSFADE_DURATION` | `0.8` | Transition overlap duration (seconds) |
| `MAX_PHOTOS` | `10` | Maximum photos per upload |
| `VEO_POLL_INTERVAL` | `10` | Veo completion polling interval (seconds) |
| `GEMINI_VISION_MODEL` | `gemini-2.5-flash` | Multimodal analysis model |
| `GEMINI_TEXT_MODEL` | `gemini-2.5-flash` | Script generation model |
| `VEO_MODEL` | `veo-3.1-generate-preview` | Full-quality video model |
| `VEO_FAST_MODEL` | `veo-3.1-fast-generate-preview` | Fast (dev) video model |

---

## Project Structure

```
Gemini3-NYC-Hack/
├── .env                              # Environment variables
├── README.md
├── backend/
│   ├── main.py                       # FastAPI app + 15 routes
│   ├── config.py                     # Env-driven configuration
│   ├── datastore.py                  # JSON-based persistent storage
│   ├── pipeline/
│   │   ├── orchestrator.py           # Coordinates 4 stages + SSE streaming
│   │   ├── analyzer.py               # Stage 1: Gemini Vision analysis
│   │   ├── scriptwriter.py           # Stage 2: Gemini script generation
│   │   ├── videogen.py               # Stage 3: Veo 3.1 image-to-video
│   │   └── assembler.py              # Stage 4: FFmpeg assembly
│   └── models/
│       ├── schemas.py                # Pydantic data models
│       └── prompts.py                # Gemini prompt templates
├── frontend/
│   ├── .env.local                    # Frontend env (API URL)
│   ├── tailwind.config.js            # Custom animations + theme
│   └── src/
│       ├── App.jsx                   # Root state machine (upload/process/result/gallery)
│       ├── index.css                 # 3D carousel CSS, keyframes, animations
│       ├── api/client.js             # SSE streaming client + mock mode
│       └── components/
│           ├── CarouselUploader.jsx   # 3D carousel + drag-to-reorder strip
│           ├── ThemeSelector.jsx      # 6-theme pill picker
│           ├── ProgressTracker.jsx    # Real-time pipeline progress
│           ├── VideoPlayer.jsx        # Clean video player + seek bar
│           ├── ScriptViewer.jsx       # Expandable AI script display
│           ├── VersionHistory.jsx     # Version browsing + regeneration
│           └── ProjectGallery.jsx     # Past project cards + delete
├── uploads/                          # Uploaded photos by job ID
└── outputs/
    ├── datastore.json                # Persistent project database
    ├── clips/                        # Individual Veo-generated clips
    ├── finals/                       # Assembled final MP4 films
    └── scripts/                      # AI-generated script JSONs
```

---

## How It Works

```
User drops photos onto 3D Carousel
         │
         ▼
┌─────────────────────────────────────┐
│  DUPLICATE CHECK                    │
│  SHA-256 fingerprint of file set    │
│  Match → regenerate existing        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  STAGE 1: ANALYZE                   │
│  Gemini 2.5 Flash (multimodal)      │
│  All photos → unified scene         │
│  analysis with visual bridges       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  STAGE 2: SCRIPT                    │
│  Gemini 2.5 Flash (text)            │
│  1 clip per photo, continuous       │
│  narrative, visual continuity       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  STAGE 3: GENERATE                  │
│  Veo 3.1 (image-to-video)           │
│  Each photo = anchor frame          │
│  Sequential + RAI safety retry      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  STAGE 4: ASSEMBLE                  │
│  FFmpeg xfade transitions           │
│  Audio merge, H.264 encode          │
│  → Final MP4 film                   │
└─────────────────────────────────────┘
```

---

## Team

Built at Gemini 3 NYC Hackathon 🏗️
