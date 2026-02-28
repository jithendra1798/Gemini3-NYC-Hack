"""Stage 2 — Cinematic Script Generation using Gemini 2.5 Flash."""

from __future__ import annotations

import json
import logging

from google import genai
from google.genai import types

from ..config import GEMINI_API_KEY, GEMINI_TEXT_MODEL
from ..models.prompts import build_script_prompt
from ..models.schemas import AnalysisResult, Script

logger = logging.getLogger(__name__)


def _get_client() -> genai.Client:
    return genai.Client(api_key=GEMINI_API_KEY)


async def generate_script(
    analysis: AnalysisResult,
    theme: str = "auto",
    duration_target: int = 30,
) -> Script:
    """Generate a shot-by-shot cinematic script from the scene analysis."""
    client = _get_client()

    analysis_json = analysis.model_dump_json(indent=2)
    num_photos = len(analysis.photos)
    prompt = build_script_prompt(
        analysis_json,
        theme=theme,
        duration_target=duration_target,
        num_photos=num_photos,
    )

    logger.info("Generating cinematic script with %s (theme=%s, target=%ds)…",
                GEMINI_TEXT_MODEL, theme, duration_target)

    response = client.models.generate_content(
        model=GEMINI_TEXT_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    raw_json = response.text
    logger.debug("Raw script response: %s", raw_json[:500])

    data = json.loads(raw_json)
    return Script(**data)
