"""Stage 3 — Video Generation using Veo 3.1."""

from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path

from google import genai
from google.genai import types

from ..config import (
    CLIPS_DIR,
    GEMINI_API_KEY,
    VEO_MODEL,
    VEO_POLL_INTERVAL,
)
from ..models.prompts import enhance_veo_prompt
from ..models.schemas import Script, Shot, ShotType

logger = logging.getLogger(__name__)


def _get_client() -> genai.Client:
    return genai.Client(api_key=GEMINI_API_KEY)


async def generate_shot(
    shot: Shot,
    photo_paths: dict[int, str],
    job_id: str,
    aspect_ratio: str = "16:9",
) -> str:
    """Generate a single video clip for a shot. Returns the output file path."""
    client = _get_client()
    output_path = CLIPS_DIR / f"{job_id}_shot_{shot.shot_number:03d}.mp4"

    if shot.shot_type == ShotType.PHOTO and shot.source_photo_id is not None:
        # ── Image-to-video: animate the user's photo ──────────────────────
        photo_file = photo_paths[shot.source_photo_id]
        image_data = Path(photo_file).read_bytes()

        suffix = Path(photo_file).suffix.lower()
        mime = {".png": "image/png", ".webp": "image/webp"}.get(suffix, "image/jpeg")
        image = types.Image(image_bytes=image_data, mime_type=mime)

        prompt = enhance_veo_prompt(
            f"{shot.camera_direction}. {shot.veo_prompt or ''}",
            audio_mood=shot.audio_mood,
        )

        logger.info("Shot %d → image-to-video (photo %d)", shot.shot_number, shot.source_photo_id)

        operation = client.models.generate_videos(
            model=VEO_MODEL,
            prompt=prompt,
            image=image,
            config=types.GenerateVideosConfig(
                aspectRatio=aspect_ratio,
                numberOfVideos=1,
            ),
        )

    else:
        # ── Text-to-video: fully generated transition / establishing shot ─
        prompt = enhance_veo_prompt(
            shot.veo_prompt or shot.camera_direction,
            audio_mood=shot.audio_mood,
        )

        config_kwargs: dict = {
            "aspectRatio": aspect_ratio,
            "numberOfVideos": 1,
        }

        # Add reference images from adjacent photos for visual consistency
        if shot.reference_photo_ids:
            ref_images = []
            for pid in shot.reference_photo_ids[:3]:
                if pid in photo_paths:
                    ref_data = Path(photo_paths[pid]).read_bytes()
                    ref_images.append(
                        types.VideoGenerationReferenceImage(
                            image=types.Image(
                                image_bytes=ref_data, mime_type="image/jpeg"
                            ),
                        )
                    )
            if ref_images:
                config_kwargs["referenceImages"] = ref_images

        logger.info("Shot %d → text-to-video (generated)", shot.shot_number)

        operation = client.models.generate_videos(
            model=VEO_MODEL,
            prompt=prompt,
            config=types.GenerateVideosConfig(**config_kwargs),
        )

    # ── Poll until generation is complete ─────────────────────────────────
    logger.info("Polling for shot %d completion…", shot.shot_number)
    while not operation.done:
        await asyncio.sleep(VEO_POLL_INTERVAL)
        operation = client.operations.get(operation)

    if not operation.response or not operation.response.generated_videos:
        raise RuntimeError(f"Veo returned no video for shot {shot.shot_number}")

    generated_video = operation.response.generated_videos[0]

    # Download video using the SDK's authenticated download method
    logger.info("Downloading video for shot %d…", shot.shot_number)
    video_bytes = client.files.download(file=generated_video)
    output_path.write_bytes(video_bytes)

    size = output_path.stat().st_size
    logger.info("Shot %d saved → %s (%d bytes)", shot.shot_number, output_path, size)
    return str(output_path)


async def generate_all_shots(
    script: Script,
    photo_paths: dict[int, str],
    job_id: str,
    aspect_ratio: str = "16:9",
    on_progress: callable = None,
) -> list[str]:
    """Generate every shot sequentially (safer for rate limits) and return clip paths."""
    clip_paths: list[str] = []
    total = len(script.shots)

    for i, shot in enumerate(script.shots):
        path = await generate_shot(shot, photo_paths, job_id, aspect_ratio)
        clip_paths.append(path)

        if on_progress:
            await on_progress(i + 1, total)

    return clip_paths
