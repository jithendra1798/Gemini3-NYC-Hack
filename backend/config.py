"""CineSnap configuration — API keys, paths, settings.

All values are read from environment variables.
A `.env` file in the project root is loaded automatically via python-dotenv.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# ── Load .env file (project root) ────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# ── API Keys ──────────────────────────────────────────────────────────────────
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

# ── Paths ─────────────────────────────────────────────────────────────────────
UPLOAD_DIR = BASE_DIR / "uploads"
CLIPS_DIR = BASE_DIR / "outputs" / "clips"
FINAL_DIR = BASE_DIR / "outputs" / "finals"
SCRIPTS_DIR = BASE_DIR / "outputs" / "scripts"

for d in (UPLOAD_DIR, CLIPS_DIR, FINAL_DIR, SCRIPTS_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ── Dev / Prod Mode ───────────────────────────────────────────────────────────
# DEV_MODE=true  → uses fast (less rate-limited) models for iteration
# DEV_MODE=false → uses full-quality models for final demos
DEV_MODE: bool = os.getenv("DEV_MODE", "true").lower() in ("true", "1", "yes")

# ── Model Config (overridable via env) ────────────────────────────────────────
GEMINI_VISION_MODEL: str = os.getenv("GEMINI_VISION_MODEL", "gemini-2.5-flash")
GEMINI_TEXT_MODEL: str = os.getenv("GEMINI_TEXT_MODEL", "gemini-2.5-flash")
VEO_MODEL_FULL: str = os.getenv("VEO_MODEL", "veo-3.1-generate-preview")
VEO_MODEL_FAST: str = os.getenv("VEO_FAST_MODEL", "veo-3.1-fast-generate-preview")

# Active Veo model — switches automatically based on DEV_MODE
VEO_MODEL: str = VEO_MODEL_FAST if DEV_MODE else VEO_MODEL_FULL

# ── Pipeline Defaults (overridable via env) ───────────────────────────────────
DEFAULT_ASPECT_RATIO: str = os.getenv("DEFAULT_ASPECT_RATIO", "16:9")
DEFAULT_DURATION_TARGET: int = int(os.getenv("DEFAULT_DURATION_TARGET", "30"))
MAX_PHOTOS: int = int(os.getenv("MAX_PHOTOS", "10"))
VEO_POLL_INTERVAL: int = int(os.getenv("VEO_POLL_INTERVAL", "10"))
CROSSFADE_DURATION: float = float(os.getenv("CROSSFADE_DURATION", "0.8"))

# ── Server ────────────────────────────────────────────────────────────────────
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8000"))
