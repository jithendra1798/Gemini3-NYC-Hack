"""Pipeline Orchestrator — coordinates all stages and streams progress."""

from __future__ import annotations

import asyncio
import logging
import shutil
import uuid
from pathlib import Path
from typing import AsyncGenerator

from ..config import FINAL_DIR, SCRIPTS_DIR, TEST_MODE, TEST_VIDEO_PATH
from ..datastore import (
    create_project,
    create_version,
    get_project,
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


async def _run_test_pipeline(
    job_id: str,
    photo_paths: list[str],
    version: int | None,
) -> AsyncGenerator[ProgressUpdate, None]:
    """Instant mock pipeline — replays pre-baked video so the full UI can be tested
    without spending Gemini / Veo quota or waiting for real generation."""
    if version is None:
        version = 1
    _update(job_id, version=version)
    vid = f"{job_id}_v{version}"

    steps = [
        (PipelineStage.ANALYZING,   0.10, "🧪 [TEST] Analyzing photos (mock)…"),
        (PipelineStage.ANALYZING,   0.15, f"🧪 [TEST] Found {len(photo_paths)} photo(s) — 1 scene"),
        (PipelineStage.SCRIPTING,   0.25, "🧪 [TEST] Writing cinematic script (mock)…"),
        (PipelineStage.SCRIPTING,   0.35, "🧪 [TEST] Script ready: \"Test Demo\" — 1 clip planned"),
        (PipelineStage.GENERATING,  0.50, "🧪 [TEST] Generating clip 1/1 (mock — no Veo call)…"),
        (PipelineStage.GENERATING,  0.80, "🧪 [TEST] All 1 clip(s) generated!"),
        (PipelineStage.ASSEMBLING,  0.88, "🧪 [TEST] Assembling final film (mock)…"),
        (PipelineStage.ASSEMBLING,  0.95, "🧪 [TEST] Film encoded — preparing for playback…"),
    ]

    for stage, progress, message in steps:
        _update(job_id, stage=stage, progress=progress, message=message)
        yield ProgressUpdate(stage=stage, progress=progress, message=message)
        await asyncio.sleep(0.4)  # short delay so the UI progress bar animates

    # ── Copy / symlink the pre-baked video into the expected output path ──────
    src = Path(TEST_VIDEO_PATH)
    dest = FINAL_DIR / f"{vid}.mp4"

    if not src.exists():
        # No test video found — emit an error so the user knows to drop a file
        err_msg = (
            f"🧪 [TEST] No demo video found at {src}. "
            "Drop a test_demo.mp4 into outputs/finals/ and retry."
        )
        _update(job_id, stage=PipelineStage.ERROR, message=err_msg)
        yield ProgressUpdate(stage=PipelineStage.ERROR, progress=0.95, message=err_msg)
        return

    if not dest.exists():
        shutil.copy2(str(src), str(dest))

    video_url = f"/api/videos/{vid}.mp4"
    _update(
        job_id,
        stage=PipelineStage.COMPLETE,
        progress=1.0,
        message="🧪 [TEST] Your cinematic film is ready! (test mode)",
        video_url=video_url,
    )
    yield ProgressUpdate(
        stage=PipelineStage.COMPLETE,
        progress=1.0,
        message="🧪 [TEST] Your cinematic film is ready! (test mode)",
        video_url=video_url,
        script_id=job_id,
    )


async def run_pipeline(
    job_id: str,
    photo_paths: list[str],
    theme: str = "auto",
    duration_target: int = 30,
    aspect_ratio: str = "16:9",
    version: int | None = None,
) -> AsyncGenerator[ProgressUpdate, None]:
    """Run the full CineSnap pipeline: analyze → script → generate ALL clips → assemble → done.

    Yields SSE progress updates at each stage.
    """

    # ── TEST MODE: replay pre-baked video, skip all API calls ────────────────
    if TEST_MODE:
        async for update in _run_test_pipeline(job_id, photo_paths, version):
            yield update
        return

    try:
        # ── Register in datastore ─────────────────────────────────────────
        if version is None:
            create_project(job_id, photo_paths, theme, duration_target, aspect_ratio)
            version = 1
        create_version(job_id, version, theme=theme)
        _update(job_id, version=version)

        vid = f"{job_id}_v{version}"
        num_photos = len(photo_paths)

        # ── Stage 1: Analyze ──────────────────────────────────────────────
        update = ProgressUpdate(
            stage=PipelineStage.ANALYZING,
            progress=0.05,
            message=f"Analyzing {num_photos} photos with Gemini Vision…",
        )
        _update(job_id, stage=update.stage, progress=update.progress, message=update.message)
        yield update

        analysis: AnalysisResult = await analyze_photos(photo_paths)
        _update(job_id, analysis=analysis)
        update_version(job_id, version, analysis=analysis)
        logger.info("Analysis complete: %d photos, %d scenes", len(analysis.photos), len(analysis.scenes))

        update = ProgressUpdate(
            stage=PipelineStage.ANALYZING,
            progress=0.15,
            message=f"Found {len(analysis.scenes)} scene(s) — {analysis.suggested_narrative_arc[:80]}…",
        )
        _update(job_id, progress=update.progress, message=update.message)
        yield update

        # ── Stage 2: Script ───────────────────────────────────────────────
        update = ProgressUpdate(
            stage=PipelineStage.SCRIPTING,
            progress=0.20,
            message=f"Writing cinematic script for {num_photos} clips…",
        )
        _update(job_id, stage=update.stage, progress=update.progress, message=update.message)
        yield update

        script: Script = await generate_script(
            analysis, theme=theme, duration_target=duration_target
        )
        _update(job_id, script=script)
        update_version(job_id, version, script=script)

        # Persist script to disk
        script_path = SCRIPTS_DIR / f"{vid}.json"
        script_path.write_text(script.model_dump_json(indent=2))
        logger.info("Script complete: '%s' — %d clips", script.title, len(script.clips))

        update = ProgressUpdate(
            stage=PipelineStage.SCRIPTING,
            progress=0.30,
            message=f"Script ready: \"{script.title}\" — {len(script.clips)} clips planned",
        )
        _update(job_id, progress=update.progress, message=update.message)
        yield update

        # ── Stage 3: Generate ALL clips ───────────────────────────────────
        total_clips = len(script.clips)
        update = ProgressUpdate(
            stage=PipelineStage.GENERATING,
            progress=0.35,
            message=f"Generating {total_clips} video clips with Veo 3.1…",
        )
        _update(job_id, stage=update.stage, progress=update.progress, message=update.message)
        yield update

        photo_map = {i: p for i, p in enumerate(photo_paths)}

        # Progress callback — update after each clip finishes
        async def on_clip_progress(completed: int, total: int):
            frac = completed / total
            # Scale progress: clip generation spans 0.35 → 0.80
            pct = 0.35 + frac * 0.45
            msg = f"Clip {completed}/{total} generated"
            if completed < total:
                msg += f" — rendering clip {completed + 1}…"
            up = ProgressUpdate(
                stage=PipelineStage.GENERATING,
                progress=round(pct, 2),
                message=msg,
            )
            _update(job_id, progress=up.progress, message=up.message)
            # We can't yield from a callback, but we send via a side-channel
            nonlocal _pending_updates
            _pending_updates.append(up)

        _pending_updates: list[ProgressUpdate] = []

        clip_paths = await generate_all_clips(
            script=script,
            photo_paths=photo_map,
            job_id=vid,
            aspect_ratio=aspect_ratio,
            on_progress=on_clip_progress,
        )

        # Flush any pending progress updates
        for pending in _pending_updates:
            yield pending
        _pending_updates.clear()

        _update(job_id, clip_paths=clip_paths)
        update_version(job_id, version, clip_paths=clip_paths)

        update = ProgressUpdate(
            stage=PipelineStage.GENERATING,
            progress=0.80,
            message=f"All {total_clips} clips generated!",
        )
        _update(job_id, progress=update.progress, message=update.message)
        yield update

        # ── Stage 4: Assemble ─────────────────────────────────────────────
        update = ProgressUpdate(
            stage=PipelineStage.ASSEMBLING,
            progress=0.85,
            message=f"Assembling {total_clips} clips with cinematic transitions…",
        )
        _update(job_id, stage=update.stage, progress=update.progress, message=update.message)
        yield update

        final_path_str = assemble_video(
            clip_paths=clip_paths,
            script=script,
            job_id=vid,
        )
        final_path = Path(final_path_str)

        update = ProgressUpdate(
            stage=PipelineStage.ASSEMBLING,
            progress=0.95,
            message="Final film encoded — preparing for playback…",
        )
        _update(job_id, progress=update.progress, message=update.message)
        yield update

        # ── Done ──────────────────────────────────────────────────────────
        video_url = f"/api/videos/{vid}.mp4"

        update = ProgressUpdate(
            stage=PipelineStage.COMPLETE,
            progress=1.0,
            message="Your cinematic film is ready!",
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
