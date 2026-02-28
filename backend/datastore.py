"""Persistent JSON-based data store for CineSnap projects and versions.

Each project maps to one set of uploaded photos and can have multiple
video generation versions (different scripts, models, themes, etc.).
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from .config import BASE_DIR, VEO_MODEL

logger = logging.getLogger(__name__)

STORE_PATH = BASE_DIR / "outputs" / "datastore.json"


def _load() -> dict[str, Any]:
    """Load the entire datastore from disk."""
    if STORE_PATH.exists():
        try:
            return json.loads(STORE_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            logger.warning("Corrupt datastore — starting fresh")
    return {"projects": {}}


def _save(store: dict[str, Any]) -> None:
    """Persist the datastore to disk."""
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STORE_PATH.write_text(json.dumps(store, indent=2, default=str))


# ── Project CRUD ──────────────────────────────────────────────────────────────

def create_project(
    job_id: str,
    photo_paths: list[str],
    theme: str = "auto",
    duration_target: int = 30,
    aspect_ratio: str = "16:9",
) -> dict:
    """Register a new project in the store. Returns the project dict."""
    store = _load()
    project = {
        "job_id": job_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "photo_paths": photo_paths,
        "theme": theme,
        "duration_target": duration_target,
        "aspect_ratio": aspect_ratio,
        "versions": [],
    }
    store["projects"][job_id] = project
    _save(store)
    logger.info("Datastore: created project %s (%d photos)", job_id, len(photo_paths))
    return project


def get_project(job_id: str) -> Optional[dict]:
    """Retrieve a project by ID."""
    store = _load()
    return store["projects"].get(job_id)


def list_projects() -> list[dict]:
    """Return all projects (summary form — latest version info, no full scripts)."""
    store = _load()
    summaries = []
    for proj in store["projects"].values():
        latest = proj["versions"][-1] if proj["versions"] else None
        summaries.append({
            "job_id": proj["job_id"],
            "created_at": proj["created_at"],
            "num_photos": len(proj["photo_paths"]),
            "theme": proj["theme"],
            "num_versions": len(proj["versions"]),
            "latest_video_url": latest["video_url"] if latest else None,
            "latest_status": latest["status"] if latest else "pending",
            "latest_title": latest.get("script", {}).get("title", "") if latest else "",
        })
    return sorted(summaries, key=lambda s: s["created_at"], reverse=True)


# ── Version Management ────────────────────────────────────────────────────────

def next_version_number(job_id: str) -> int:
    """Return the next version number for a project."""
    store = _load()
    proj = store["projects"].get(job_id)
    if not proj:
        return 1
    return len(proj["versions"]) + 1


def create_version(
    job_id: str,
    version: int,
    theme: str = "auto",
) -> dict:
    """Create a new in-progress version record. Returns the version dict."""
    store = _load()
    proj = store["projects"].get(job_id)
    if not proj:
        raise KeyError(f"Project {job_id} not found in datastore")

    ver = {
        "version": version,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "model": VEO_MODEL,
        "theme": theme,
        "status": "generating",
        "script": None,
        "analysis": None,
        "clip_paths": [],
        "final_video": None,
        "video_url": None,
        "error": None,
    }
    proj["versions"].append(ver)
    _save(store)
    logger.info("Datastore: created version %d for project %s", version, job_id)
    return ver


def update_version(job_id: str, version: int, **fields) -> dict:
    """Update fields on a specific version. Returns updated version."""
    store = _load()
    proj = store["projects"].get(job_id)
    if not proj:
        raise KeyError(f"Project {job_id} not found")

    for ver in proj["versions"]:
        if ver["version"] == version:
            # Serialize Pydantic models if needed
            for k, v in fields.items():
                if hasattr(v, "model_dump"):
                    fields[k] = v.model_dump()
            ver.update(fields)
            _save(store)
            return ver

    raise KeyError(f"Version {version} not found for project {job_id}")


def get_version(job_id: str, version: int) -> Optional[dict]:
    """Get a specific version of a project."""
    store = _load()
    proj = store["projects"].get(job_id)
    if not proj:
        return None
    for ver in proj["versions"]:
        if ver["version"] == version:
            return ver
    return None


def get_all_versions(job_id: str) -> list[dict]:
    """Get all versions for a project (summary — no full scripts)."""
    store = _load()
    proj = store["projects"].get(job_id)
    if not proj:
        return []
    summaries = []
    for ver in proj["versions"]:
        summaries.append({
            "version": ver["version"],
            "created_at": ver["created_at"],
            "model": ver["model"],
            "theme": ver["theme"],
            "status": ver["status"],
            "video_url": ver["video_url"],
            "title": ver.get("script", {}).get("title", "") if ver.get("script") else "",
            "num_clips": len(ver.get("script", {}).get("clips", [])) if ver.get("script") else 0,
        })
    return summaries


# ── Duplicate Detection ───────────────────────────────────────────────────────

def store_photo_fingerprint(job_id: str, fingerprint: str) -> None:
    """Store a SHA-256 fingerprint for the project's photo set."""
    store = _load()
    proj = store["projects"].get(job_id)
    if proj:
        proj["photo_fingerprint"] = fingerprint
        _save(store)
        logger.info("Datastore: stored fingerprint %s… for project %s", fingerprint[:12], job_id)


def find_duplicate_project(fingerprint: str) -> Optional[str]:
    """Find a project with the same photo fingerprint. Returns job_id or None."""
    store = _load()
    for job_id, proj in store["projects"].items():
        if proj.get("photo_fingerprint") == fingerprint:
            return job_id
    return None
