"""Pydantic models for CineSnap data contracts."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Enums ─────────────────────────────────────────────────────────────────────

class Theme(str, Enum):
    CINEMATIC = "cinematic"
    ROMANTIC = "romantic"
    ADVENTURE = "adventure"
    HORROR = "horror"
    DOCUMENTARY = "documentary"
    AUTO = "auto"


class Transition(str, Enum):
    CROSSFADE = "crossfade"
    CUT = "cut"
    ZOOM_THROUGH = "zoom_through"
    MATCH_CUT = "match_cut"
    WHIP_PAN = "whip_pan"
    WIPE = "wipe"
    FADE = "fade"


class PipelineStage(str, Enum):
    UPLOADING = "uploading"
    ANALYZING = "analyzing"
    SCRIPTING = "scripting"
    GENERATING = "generating"
    ASSEMBLING = "assembling"
    COMPLETE = "complete"
    ERROR = "error"


# ── Stage 1: Scene Analysis Models ───────────────────────────────────────────

class PhotoAnalysis(BaseModel):
    id: int
    scene_id: int
    location_type: str = ""
    time_of_day: str = ""
    weather: str = ""
    mood: str = ""
    subjects: str = ""
    key_details: str = ""
    energy_level: str = "medium"
    suggested_camera_movement: str = "slow_pan"


class Scene(BaseModel):
    id: int
    name: str = ""
    photo_ids: list[int] = Field(default_factory=list)
    overall_mood: str = ""


class AnalysisResult(BaseModel):
    photos: list[PhotoAnalysis] = Field(default_factory=list)
    scenes: list[Scene] = Field(default_factory=list)
    suggested_narrative_arc: str = ""


# ── Stage 2: Script Models ───────────────────────────────────────────────────

class Clip(BaseModel):
    """One video clip = 1 key photo + 1 Veo generation.

    The LLM picks the best photo from the scene to serve as the visual
    anchor (first frame / reference) and writes a rich Veo prompt that
    describes the cinematic motion starting from that photo.
    """
    clip_number: int
    key_photo_id: int                       # which uploaded photo anchors this clip
    veo_prompt: str                         # detailed Veo prompt (camera, motion, mood, audio)
    duration_seconds: int = 8               # target duration
    transition_to_next: Transition = Transition.CROSSFADE
    audio_mood: str = ""
    narration: Optional[str] = None         # optional voice-over / text overlay
    scene_description: str = ""             # human-readable description for ScriptViewer


class Script(BaseModel):
    title: str = ""
    overall_mood: str = ""
    music_direction: str = ""
    narrative_summary: str = ""   # full story summary across all photos
    clips: list[Clip] = Field(default_factory=list)


class SingleClipScript(BaseModel):
    """Simplified script: Gemini summarizes all photos into one narrative
    and picks a single best key image to generate one Veo preview clip."""
    title: str = ""
    overall_mood: str = ""
    music_direction: str = ""
    narrative_summary: str = ""   # full story summary across all photos
    clip: Clip                    # the single clip to generate


# ── Pipeline Progress ────────────────────────────────────────────────────────

class ProgressUpdate(BaseModel):
    stage: PipelineStage
    progress: float = Field(ge=0.0, le=1.0)
    message: str = ""
    video_url: Optional[str] = None
    script_id: Optional[str] = None


# ── API Request / Response ────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    theme: Theme = Theme.AUTO
    duration_target: int = 30
    aspect_ratio: str = "16:9"


class JobStatus(BaseModel):
    job_id: str
    stage: PipelineStage
    progress: float
    message: str = ""
    video_url: Optional[str] = None
    script: Optional[Script] = None
