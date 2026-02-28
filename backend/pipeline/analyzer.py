"""Stage 1 — Scene Analysis using Gemini 2.5 Flash (multimodal)."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from google import genai
from google.genai import types

from ..config import GEMINI_API_KEY, GEMINI_VISION_MODEL
from ..models.prompts import ANALYSIS_PROMPT
from ..models.schemas import AnalysisResult

logger = logging.getLogger(__name__)


def _get_client() -> genai.Client:
    return genai.Client(api_key=GEMINI_API_KEY)


async def analyze_photos(photo_paths: list[str | Path]) -> AnalysisResult:
    """Analyze all photos with Gemini Vision and group them into scenes.

    Sends every image in a single multimodal request so the model can
    reason across the full collection at once.
    """
    client = _get_client()

    # Build multimodal parts: [image, label, image, label, …, prompt]
    parts: list[types.Part] = []
    for idx, path in enumerate(photo_paths):
        raw = Path(path).read_bytes()
        # Detect mime type
        suffix = Path(path).suffix.lower()
        mime = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".heic": "image/heic",
        }.get(suffix, "image/jpeg")

        parts.append(types.Part.from_bytes(data=raw, mime_type=mime))
        parts.append(types.Part.from_text(text=f"[Photo {idx}]"))

    parts.append(types.Part.from_text(text=ANALYSIS_PROMPT))

    logger.info("Sending %d photos to %s for analysis…", len(photo_paths), GEMINI_VISION_MODEL)

    response = client.models.generate_content(
        model=GEMINI_VISION_MODEL,
        contents=parts,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    raw_json = response.text
    logger.debug("Raw analysis response: %s", raw_json[:500])

    data = json.loads(raw_json)
    return AnalysisResult(**data)
