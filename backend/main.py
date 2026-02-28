"""CineSnap — FastAPI Application Entry Point."""

from __future__ import annotations

import hashlib
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
from pydantic import BaseModel

from .config import FINAL_DIR, SCRIPTS_DIR, UPLOAD_DIR
from .datastore import (
    delete_project,
    get_all_versions,
    get_project,
    get_version,
    list_projects,
    next_version_number,
    find_duplicate_project,
    store_photo_fingerprint,
)
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


# ── Duplicate detection ───────────────────────────────────────────────────────

class FileMeta(BaseModel):
    name: str
    size: int
    lastModified: int | float = 0

class DuplicateCheckRequest(BaseModel):
    files: list[FileMeta]


@app.post("/api/check-duplicate")
async def check_duplicate(req: DuplicateCheckRequest):
    """Check if an identical set of photos was already uploaded.

    Compares a fingerprint derived from the sorted file names + sizes.
    Returns { duplicate: true, job_id: "..." } if found.
    """
    fingerprint = _compute_fingerprint(req.files)
    match_id = find_duplicate_project(fingerprint)
    if match_id:
        logger.info("Duplicate detected for fingerprint %s → project %s", fingerprint[:12], match_id)
        return {"duplicate": True, "job_id": match_id}
    return {"duplicate": False}


def _compute_fingerprint(files: list[FileMeta]) -> str:
    """Produce a stable hash from sorted file name+size pairs."""
    parts = sorted(f"{f.name}:{f.size}" for f in files)
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode()).hexdigest()


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

    # Create job directory immediately — file saving happens inside the stream
    job_id = create_job()
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    # Read all file bytes into memory NOW (before the async generator),
    # while the UploadFile objects are still valid.
    raw_files: list[tuple[str, bytes]] = []
    for i, photo in enumerate(photos):
        ext = Path(photo.filename or "photo.jpg").suffix or ".jpg"
        raw_files.append((f"photo_{i:03d}{ext}", await photo.read()))

    # Return SSE stream — first event fires immediately so the UI shows progress
    async def event_stream():
        import asyncio

        # ── 1. Announce upload received ──────────────────────────────────────
        n = len(raw_files)
        yield f"data: {{\"stage\":\"analyzing\",\"progress\":0.05,\"message\":\"Received {n} photo{'s' if n != 1 else ''} — saving…\"}}\n\n"

        # ── 2. Save files to disk (offload blocking I/O) ──────────────────────
        photo_paths: list[str] = []
        for filename, data in raw_files:
            dest = job_dir / filename
            await asyncio.to_thread(dest.write_bytes, data)
            photo_paths.append(str(dest))

        # ── 3. Store fingerprint for duplicate detection ──────────────────────
        file_metas = [
            FileMeta(name=photos[i].filename or f"photo_{i}.jpg", size=len(data))
            for i, (_, data) in enumerate(raw_files)
        ]
        fingerprint = _compute_fingerprint(file_metas)
        store_photo_fingerprint(job_id, fingerprint)

        logger.info("Job %s: saved %d photos to %s", job_id, len(photo_paths), job_dir)

        # ── 4. Stream pipeline progress ──────────────────────────────────────
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
        # Try versioned file name (latest version)
        proj = get_project(job_id)
        if proj and proj["versions"]:
            latest_v = proj["versions"][-1]["version"]
            versioned_path = SCRIPTS_DIR / f"{job_id}_v{latest_v}.json"
            if versioned_path.exists():
                return json.loads(versioned_path.read_text())
        # Try from memory
        job = get_job(job_id)
        if job and job.get("script"):
            return job["script"].model_dump()
        raise HTTPException(status_code=404, detail="Script not found")
    return json.loads(path.read_text())


@app.get("/api/scripts/{job_id}/{version}")
async def get_script_version(job_id: str, version: int):
    """Return the script for a specific version."""
    path = SCRIPTS_DIR / f"{job_id}_v{version}.json"
    if not path.exists():
        ver = get_version(job_id, version)
        if ver and ver.get("script"):
            return ver["script"]
        raise HTTPException(status_code=404, detail="Script not found")
    return json.loads(path.read_text())


# ── Projects & Versions ──────────────────────────────────────────────────────

@app.get("/api/projects")
async def list_all_projects():
    """List all CineSnap projects with summary info."""
    return list_projects()


@app.get("/api/projects/{job_id}")
async def get_project_detail(job_id: str):
    """Get full project details including all versions."""
    proj = get_project(job_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj


@app.get("/api/projects/{job_id}/versions")
async def get_project_versions(job_id: str):
    """List all versions for a project."""
    versions = get_all_versions(job_id)
    if not versions:
        raise HTTPException(status_code=404, detail="Project not found or has no versions")
    return versions


@app.get("/api/projects/{job_id}/versions/{version}")
async def get_project_version(job_id: str, version: int):
    """Get a specific version of a project."""
    ver = get_version(job_id, version)
    if not ver:
        raise HTTPException(status_code=404, detail="Version not found")
    return ver


@app.post("/api/projects/{job_id}/regenerate")
async def regenerate(
    job_id: str,
    theme: str = Form("auto"),
    duration_target: int = Form(30),
    aspect_ratio: str = Form("16:9"),
):
    """Regenerate video from existing photos — creates a new version.

    Returns an SSE stream of progress updates, just like /api/generate.
    """
    proj = get_project(job_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    photo_paths = proj["photo_paths"]
    if not photo_paths:
        raise HTTPException(status_code=400, detail="No photos found for this project")

    # Validate theme
    try:
        theme_enum = Theme(theme)
    except ValueError:
        theme_enum = Theme.AUTO

    # Determine next version number
    version = next_version_number(job_id)

    # Re-use the same job_id in the in-memory store for progress tracking
    from .pipeline.orchestrator import _jobs, _update
    _jobs[job_id] = {
        "stage": PipelineStage.UPLOADING,
        "progress": 0.0,
        "message": "Starting regeneration…",
        "video_url": None,
        "script": None,
        "analysis": None,
        "clip_paths": [],
        "version": version,
    }

    logger.info("Regenerating job %s → version %d (theme=%s)", job_id, version, theme_enum.value)

    async def event_stream():
        async for update in run_pipeline(
            job_id=job_id,
            photo_paths=photo_paths,
            theme=theme_enum.value,
            duration_target=duration_target,
            aspect_ratio=aspect_ratio,
            version=version,
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
            "X-Version": str(version),
        },
    )


@app.get("/api/projects/{job_id}/photos")
async def get_project_photos(job_id: str):
    """Return metadata for the uploaded photos of a project."""
    proj = get_project(job_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    photos = []
    for i, p in enumerate(proj["photo_paths"]):
        path = Path(p)
        photos.append({
            "id": i,
            "filename": path.name,
            "url": f"/api/uploads/{job_id}/{path.name}",
        })
    return photos


@app.delete("/api/projects/{job_id}")
async def delete_project_endpoint(job_id: str):
    """Delete a project and its associated files."""
    proj = get_project(job_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    # Remove uploaded photos
    job_dir = UPLOAD_DIR / job_id
    if job_dir.exists():
        shutil.rmtree(job_dir, ignore_errors=True)

    # Remove generated clips and final videos
    for ver in proj.get("versions", []):
        for clip_path in ver.get("clip_paths", []):
            p = Path(clip_path)
            if p.exists():
                p.unlink(missing_ok=True)
        if ver.get("final_video"):
            p = Path(ver["final_video"])
            if p.exists():
                p.unlink(missing_ok=True)

    # Remove script files
    for f in SCRIPTS_DIR.glob(f"{job_id}*"):
        f.unlink(missing_ok=True)

    # Remove from datastore
    delete_project(job_id)

    logger.info("Deleted project %s and all associated files", job_id)
    return {"status": "deleted", "job_id": job_id}


@app.get("/api/uploads/{job_id}/{filename}")
async def get_upload(job_id: str, filename: str):
    """Serve an uploaded photo."""
    path = UPLOAD_DIR / job_id / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Photo not found")
    suffix = path.suffix.lower()
    mime = {".png": "image/png", ".webp": "image/webp", ".gif": "image/gif"}.get(suffix, "image/jpeg")
    return FileResponse(path, media_type=mime)


# ── Serve frontend static files in production ─────────────────────────────────
frontend_build = Path(__file__).resolve().parent.parent / "frontend" / "build"
if frontend_build.exists():
    app.mount("/", StaticFiles(directory=str(frontend_build), html=True), name="frontend")
