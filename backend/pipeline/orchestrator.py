"""Pipeline Orchestrator — coordinates all four stages and streams progress."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from pathlib import Path
from typing import AsyncGenerator

from ..config import SCRIPTS_DIR, UPLOAD_DIR
from ..datastore import (
    create_project,
    create_version,
    get_project,
    next_version_number,
    update_version,
)
from ..models.schemas import (
    AnalysisResult,
    PipelineStage,
    ProgressUpdate,
    Script,
)
from .analyzer import analyze_photos
from .assembler import assemble_video
from .scriptwriter import generate_script
from .videogen import generate_all_clips

logger = logging.getLogger(__name__)

# In-memory job store (good enough for hackathon — tracks live progress)
_jobs: dict[str, dict] = {}


def create_job() -> str:
    job_id = uuid.uuid4().hex[:12]
    _jobs[job_id] = {
        "stage": PipelineStage.UPLOADING,
        "progress": 0.0,
        "message": "Waiting for photos…",
        "video_url": None,
        "script": None,
        "analysis": None,
        "clip_paths": [],
        "version": None,
    }
    return job_id


def get_job(job_id: str) -> dict | None:
    return _jobs.get(job_id)


def _update(job_id: str, **kwargs):
    if job_id in _jobs:
        _jobs[job_id].update(kwargs)


async def run_pipeline(
    job_id: str,
    photo_paths: list[str],
    theme: str = "auto",
    duration_target: int = 30,
    aspect_ratio: str = "16:9",
    version: int | None = None,
) -> AsyncGenerator[ProgressUpdate, None]:
    """Run the full CineSnap pipeline, yielding progress updates as SSE events.

    If *version* is None a new project is created in the datastore; otherwise
    the existing project is re-used and a new version is appended.
    """

    try:
        # ── Register in datastore ─────────────────────────────────────────
        if version is None:
            create_project(job_id, photo_paths, theme, duration_target, aspect_ratio)
            version = 1
        ver = create_version(job_id, version, theme=theme)
        _update(job_id, version=version)

        # Versioned IDs for file names  (e.g. abc123_v2)
        vid = f"{job_id}_v{version}"

        # ── Stage 1: Analyze ──────────────────────────────────────────────
        update = ProgressUpdate(
            stage=PipelineStage.ANALYZING,
            progress=0.1,
            message=f"Analyzing {len(photo_paths)} photos with Gemini Vision…",
        )
        _update(job_id, stage=update.stage, progress=update.progress, message=update.message)
        yield update

        analysis: AnalysisResult = await analyze_photos(photo_paths)
        _update(job_id, analysis=analysis)
        update_version(job_id, version, analysis=analysis)
        logger.info("Analysis complete: %d photos, %d scenes", len(analysis.photos), len(analysis.scenes))

        # ── Stage 2: Script ───────────────────────────────────────────────
        update = ProgressUpdate(
            stage=PipelineStage.SCRIPTING,
            progress=0.25,
            message="Writing cinematic script…",
        )
        _update(job_id, stage=update.stage, progress=update.progress, message=update.message)
        yield update

        script: Script = await generate_script(analysis, theme=theme, duration_target=duration_target)
        _update(job_id, script=script)
        update_version(job_id, version, script=script)

        # Persist script to disk
        script_path = SCRIPTS_DIR / f"{vid}.json"
        script_path.write_text(script.model_dump_json(indent=2))
        logger.info("Script complete: '%s' — %d clips", script.title, len(script.clips))

        # ── Stage 3: Video Generation ─────────────────────────────────────
        update = ProgressUpdate(
            stage=PipelineStage.GENERATING,
            progress=0.35,
            message=f"Generating clip 1 of {len(script.clips)} with Veo 3.1…",
        )
        _update(job_id, stage=update.stage, progress=update.progress, message=update.message)
        yield update

        # Build photo id → path map
        photo_map = {i: p for i, p in enumerate(photo_paths)}

        async def on_clip_progress(done: int, total: int):
            nonlocal update
            pct = 0.35 + 0.45 * (done / total)
            update = ProgressUpdate(
                stage=PipelineStage.GENERATING,
                progress=round(pct, 2),
                message=f"Generating clip {done} of {total} with Veo 3.1…",
            )
            _update(job_id, progress=update.progress, message=update.message)

        clip_paths = await generate_all_clips(
            script, photo_map, vid,
            aspect_ratio=aspect_ratio,
            on_progress=on_clip_progress,
        )
        _update(job_id, clip_paths=clip_paths)
        update_version(job_id, version, clip_paths=clip_paths)

        # yield the latest generation progress
        yield update

        # ── Stage 4: Assembly ─────────────────────────────────────────────
        update = ProgressUpdate(
            stage=PipelineStage.ASSEMBLING,
            progress=0.85,
            message="Assembling final video with cinematic transitions…",
        )
        _update(job_id, stage=update.stage, progress=update.progress, message=update.message)
        yield update

        final_path = await asyncio.to_thread(assemble_video, clip_paths, script, vid)
        video_url = f"/api/videos/{vid}.mp4"

        # ── Done ──────────────────────────────────────────────────────────
        update = ProgressUpdate(
            stage=PipelineStage.COMPLETE,
            progress=1.0,
            message="Your cinematic video is ready!",
            video_url=video_url,
            script_id=job_id,
        )
        _update(
            job_id,
            stage=update.stage,
            progress=update.progress,
            message=update.message,
            video_url=video_url,
        )
        update_version(
            job_id, version,
            status="complete",
            final_video=str(final_path),
            video_url=video_url,
        )
        yield update

    except Exception as exc:
        logger.exception("Pipeline error for job %s", job_id)
        update = ProgressUpdate(
            stage=PipelineStage.ERROR,
            progress=_jobs.get(job_id, {}).get("progress", 0),
            message=f"Error: {exc}",
        )
        _update(job_id, stage=update.stage, message=update.message)
        if version is not None:
            try:
                update_version(job_id, version, status="error", error=str(exc))
            except Exception:
                pass
        yield update
