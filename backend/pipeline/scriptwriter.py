"""Stage 2 — Cinematic Script Generation using Gemini 2.5 Flash."""

from __future__ import annotations

import json
import logging
import re

from google import genai
from google.genai import types

from ..config import GEMINI_API_KEY, GEMINI_TEXT_MODEL
from ..models.prompts import build_script_prompt
from ..models.schemas import AnalysisResult, Script

logger = logging.getLogger(__name__)


def _get_client() -> genai.Client:
    return genai.Client(api_key=GEMINI_API_KEY)


def _parse_json_resilient(raw: str) -> dict:
    """Parse JSON from Gemini, handling common formatting issues."""
    # 1. Strip markdown code fences if present
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)

    # 2. Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 3. Fix trailing commas before } or ]
    cleaned = re.sub(r",\s*([}\]])", r"\1", text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # 4. Try to extract the first valid JSON object from the text
    depth = 0
    start = None
    for i, ch in enumerate(text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start is not None:
                candidate = text[start : i + 1]
                candidate = re.sub(r",\s*([}\]])", r"\1", candidate)
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    pass

    # 5. Give up — raise with the original text for debugging
    logger.error("Failed to parse JSON from Gemini. Raw (first 1000 chars): %s", text[:1000])
    raise json.JSONDecodeError("Could not parse Gemini response as JSON", text, 0)


async def generate_script(
    analysis: AnalysisResult,
    theme: str = "auto",
    duration_target: int = 30,
) -> Script:
    """Generate a multi-clip cinematic script — one clip per photo."""
    client = _get_client()

    analysis_json = analysis.model_dump_json(indent=2)
    num_photos = len(analysis.photos)
    prompt = build_script_prompt(
        analysis_json,
        theme=theme,
        duration_target=duration_target,
        num_photos=num_photos,
    )

    logger.info("Generating multi-clip script with %s (theme=%s, %d photos → %d clips)…",
                GEMINI_TEXT_MODEL, theme, num_photos, num_photos)

    response = client.models.generate_content(
        model=GEMINI_TEXT_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    raw_json = response.text
    logger.debug("Raw script response: %s", raw_json[:500])

    data = _parse_json_resilient(raw_json)
    script = Script(**data)

    # Validate: every photo ID should appear exactly once
    used_ids = {clip.key_photo_id for clip in script.clips}
    expected_ids = set(range(num_photos))
    if used_ids != expected_ids:
        logger.warning(
            "Script uses photo IDs %s but expected %s — some photos may be missing from the film",
            sorted(used_ids), sorted(expected_ids),
        )

    logger.info("Script complete: '%s' — %d clips", script.title, len(script.clips))
    return script
