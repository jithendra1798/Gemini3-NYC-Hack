"""CineSnap — FastAPI Application Entry Point."""

from __future__ import annotations

import json
import logging
import shutil
import uuid
from pathlib import Path
from typing import List

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .config import FINAL_DIR, SCRIPTS_DIR, UPLOAD_DIR
from .models.schemas import GenerateRequest, PipelineStage, Theme
from .pipeline.orchestrator import create_job, get_job, run_pipeline

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-28s | %(levelname)-5s | %(message)s",
)
logger = logging.getLogger("cinesnap")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CineSnap",
    description="AI Photo-to-Cinema Pipeline — turn your photo album into a cinematic experience.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "CineSnap"}


@app.post("/api/generate")
async def generate(
    photos: List[UploadFile] = File(...),
    theme: str = Form("auto"),
    duration_target: int = Form(30),
    aspect_ratio: str = Form("16:9"),
):
    """Upload photos and start the CineSnap pipeline. Returns an SSE stream of progress updates."""

    if not photos:
        raise HTTPException(status_code=400, detail="At least 1 photo is required.")
    if len(photos) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 photos allowed.")

    # Validate theme
    try:
        theme_enum = Theme(theme)
    except ValueError:
        theme_enum = Theme.AUTO

    # Create job & save uploads
    job_id = create_job()
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    photo_paths: list[str] = []
    for i, photo in enumerate(photos):
        ext = Path(photo.filename or "photo.jpg").suffix or ".jpg"
        dest = job_dir / f"photo_{i:03d}{ext}"
        with open(dest, "wb") as f:
            shutil.copyfileobj(photo.file, f)
        photo_paths.append(str(dest))

    logger.info("Job %s: saved %d photos to %s", job_id, len(photo_paths), job_dir)

    # Return SSE stream
    async def event_stream():
        async for update in run_pipeline(
            job_id=job_id,
            photo_paths=photo_paths,
            theme=theme_enum.value,
            duration_target=duration_target,
            aspect_ratio=aspect_ratio,
        ):
            data = update.model_dump_json()
            yield f"data: {data}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Job-Id": job_id,
        },
    )


@app.get("/api/jobs/{job_id}")
async def job_status(job_id: str):
    """Check current status of a pipeline job."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job_id,
        "stage": job["stage"].value if isinstance(job["stage"], PipelineStage) else job["stage"],
        "progress": job["progress"],
        "message": job["message"],
        "video_url": job["video_url"],
    }


@app.get("/api/videos/{filename}")
async def get_video(filename: str):
    """Serve a generated video file."""
    path = FINAL_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Video not found")
    return FileResponse(
        path,
        media_type="video/mp4",
        filename=filename,
    )


@app.get("/api/scripts/{job_id}")
async def get_script(job_id: str):
    """Return the AI-generated cinematic script for a job."""
    path = SCRIPTS_DIR / f"{job_id}.json"
    if not path.exists():
        # Try from memory
        job = get_job(job_id)
        if job and job.get("script"):
            return job["script"].model_dump()
        raise HTTPException(status_code=404, detail="Script not found")
    return json.loads(path.read_text())


# ── Serve frontend static files in production ─────────────────────────────────
frontend_build = Path(__file__).resolve().parent.parent / "frontend" / "build"
if frontend_build.exists():
    app.mount("/", StaticFiles(directory=str(frontend_build), html=True), name="frontend")
