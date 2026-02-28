"""Stage 3 — Video Generation using Veo 3.1 (image-to-video for every clip)."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from google import genai
from google.genai import types

from ..config import (
    CLIPS_DIR,
    GEMINI_API_KEY,
    VEO_MODEL,
    VEO_POLL_INTERVAL,
)
from ..models.prompts import enhance_veo_prompt, sanitize_veo_prompt
from ..models.schemas import Clip, Script

logger = logging.getLogger(__name__)

MAX_RETRIES = 3


def _get_client() -> genai.Client:
    return genai.Client(api_key=GEMINI_API_KEY)


async def generate_clip(
    clip: Clip,
    photo_paths: dict[int, str],
    job_id: str,
    aspect_ratio: str = "16:9",
) -> str:
    """Generate a single video clip using image-to-video. Returns the output path."""
    client = _get_client()
    output_path = CLIPS_DIR / f"{job_id}_clip_{clip.clip_number:03d}.mp4"

    # ── Load the key photo as the anchor frame ────────────────────────────
    photo_file = photo_paths[clip.key_photo_id]
    image_data = Path(photo_file).read_bytes()

    suffix = Path(photo_file).suffix.lower()
    mime = {".png": "image/png", ".webp": "image/webp"}.get(suffix, "image/jpeg")
    image = types.Image(image_bytes=image_data, mime_type=mime)

    prompt = enhance_veo_prompt(clip.veo_prompt, audio_mood=clip.audio_mood)

    logger.info(
        "Clip %d → image-to-video (key photo %d) [%s]",
        clip.clip_number,
        clip.key_photo_id,
        VEO_MODEL,
    )
    logger.info("Clip %d prompt: %.300s", clip.clip_number, prompt)

    last_error: Exception | None = None
    rai_filtered = False

    for attempt in range(1, MAX_RETRIES + 1):
        # If previous attempt was RAI-filtered, sanitize the prompt
        if rai_filtered and attempt > 1:
            prompt = sanitize_veo_prompt(prompt)
            logger.info("Clip %d: using sanitized prompt: %.300s", clip.clip_number, prompt)

        try:
            operation = client.models.generate_videos(
                model=VEO_MODEL,
                prompt=prompt,
                image=image,
                config=types.GenerateVideosConfig(
                    aspectRatio=aspect_ratio,
                    numberOfVideos=1,
                ),
            )

            # ── Poll until generation is complete ─────────────────────────
            logger.info("Polling for clip %d completion (attempt %d/%d)…", clip.clip_number, attempt, MAX_RETRIES)
            while not operation.done:
                await asyncio.sleep(VEO_POLL_INTERVAL)
                operation = client.operations.get(operation)

            # ── Inspect the completed operation ───────────────────────────
            if not operation.response:
                logger.error(
                    "Clip %d: operation completed but response is None. "
                    "Operation name=%s, done=%s, error=%s, metadata=%s",
                    clip.clip_number,
                    getattr(operation, "name", "?"),
                    operation.done,
                    getattr(operation, "error", None),
                    getattr(operation, "metadata", None),
                )
                raise RuntimeError(
                    f"Veo returned no response for clip {clip.clip_number}. "
                    f"Operation error: {getattr(operation, 'error', 'none')}"
                )

            # ── Check for RAI content filtering ───────────────────────────
            resp = operation.response
            rai_count = getattr(resp, "rai_media_filtered_count", 0) or 0
            rai_reasons = getattr(resp, "rai_media_filtered_reasons", None) or []

            if not resp.generated_videos:
                if rai_count > 0 or rai_reasons:
                    rai_filtered = True
                    logger.warning(
                        "Clip %d: RAI filtered (count=%d, reasons=%s). "
                        "Will sanitize prompt and retry.",
                        clip.clip_number, rai_count, rai_reasons,
                    )
                    raise RuntimeError(
                        f"Clip {clip.clip_number} blocked by Veo safety filter: "
                        f"{'; '.join(rai_reasons)}. Sanitizing prompt and retrying."
                    )
                else:
                    logger.error(
                        "Clip %d: response exists but generated_videos is empty. "
                        "Response: %s",
                        clip.clip_number, resp,
                    )
                    raise RuntimeError(
                        f"Veo returned empty video list for clip {clip.clip_number}."
                    )

            generated_video = resp.generated_videos[0]

            # Download video using the SDK's authenticated download method
            logger.info("Downloading video for clip %d…", clip.clip_number)
            video_bytes = client.files.download(file=generated_video)
            output_path.write_bytes(video_bytes)

            size = output_path.stat().st_size
            logger.info("Clip %d saved → %s (%d bytes)", clip.clip_number, output_path, size)
            return str(output_path)

        except Exception as exc:
            last_error = exc
            if attempt < MAX_RETRIES:
                wait = 5 if rai_filtered else 10 * attempt
                logger.warning(
                    "Clip %d failed (attempt %d/%d): %s — retrying in %ds…",
                    clip.clip_number, attempt, MAX_RETRIES, exc, wait,
                )
                await asyncio.sleep(wait)
            else:
                logger.error("Clip %d failed after %d attempts: %s", clip.clip_number, MAX_RETRIES, exc)

    raise RuntimeError(
        f"Clip {clip.clip_number} failed after {MAX_RETRIES} attempts: {last_error}"
    )


async def generate_all_clips(
    script: Script,
    photo_paths: dict[int, str],
    job_id: str,
    aspect_ratio: str = "16:9",
    on_progress: callable = None,
) -> list[str]:
    """Generate every clip sequentially (safer for rate limits) and return clip paths."""
    clip_paths: list[str] = []
    total = len(script.clips)

    for i, clip in enumerate(script.clips):
        path = await generate_clip(clip, photo_paths, job_id, aspect_ratio)
        clip_paths.append(path)

        if on_progress:
            await on_progress(i + 1, total)

    return clip_paths
