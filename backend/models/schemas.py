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


class ShotType(str, Enum):
    PHOTO = "photo"
    GENERATED = "generated"


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

class Shot(BaseModel):
    shot_number: int
    shot_type: ShotType
    source_photo_id: Optional[int] = None
    veo_prompt: Optional[str] = None
    duration_seconds: int = 5
    camera_direction: str = ""
    transition_to_next: Transition = Transition.CROSSFADE
    audio_mood: str = ""
    narration: Optional[str] = None
    reference_photo_ids: list[int] = Field(default_factory=list)


class Script(BaseModel):
    title: str = ""
    overall_mood: str = ""
    music_direction: str = ""
    shots: list[Shot] = Field(default_factory=list)


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
