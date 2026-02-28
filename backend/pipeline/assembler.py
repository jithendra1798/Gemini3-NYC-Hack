"""Stage 4 — FFmpeg Video Assembly with cinematic transitions."""

from __future__ import annotations

import logging
import subprocess
from pathlib import Path

from ..config import CROSSFADE_DURATION, FINAL_DIR
from ..models.schemas import Script, Transition

logger = logging.getLogger(__name__)

# Map CineSnap transitions → FFmpeg xfade filter names
_XFADE_MAP: dict[Transition, str] = {
    Transition.CROSSFADE: "fade",
    Transition.CUT: "fade",
    Transition.ZOOM_THROUGH: "circlecrop",
    Transition.MATCH_CUT: "fade",
    Transition.WHIP_PAN: "slideleft",
    Transition.WIPE: "wiperight",
    Transition.FADE: "fade",
}


def _probe_duration(path: str) -> float:
    """Get the duration of a video file in seconds via ffprobe."""
    result = subprocess.run(
        [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            path,
        ],
        capture_output=True,
        text=True,
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 8.0  # fallback


def assemble_video(
    clip_paths: list[str],
    script: Script,
    job_id: str,
) -> str:
    """Stitch clips into a single MP4 with crossfade transitions and merged audio."""
    output_path = FINAL_DIR / f"{job_id}.mp4"
    n = len(clip_paths)

    if n == 0:
        raise ValueError("No clips to assemble")

    # ── Single clip — just copy ───────────────────────────────────────────
    if n == 1:
        cmd = [
            "ffmpeg", "-y", "-i", clip_paths[0],
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high",
            "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart",
            str(output_path),
        ]
        logger.info("Single clip, copying: %s", " ".join(cmd))
        subprocess.run(cmd, check=True, capture_output=True)
        return str(output_path)

    # ── Multiple clips — build xfade filter chain ─────────────────────────
    inputs: list[str] = []
    for path in clip_paths:
        inputs.extend(["-i", path])

    td = CROSSFADE_DURATION
    durations = [_probe_duration(p) for p in clip_paths]

    # Video filter: chain of xfade transitions
    video_filters: list[str] = []
    offset_acc = durations[0] - td  # first transition starts near end of clip 0

    for i in range(1, n):
        prev = "[0:v]" if i == 1 else f"[vtmp{i - 1}]"
        out = f"[vtmp{i}]" if i < n - 1 else "[outv]"

        # Pick transition type from script (default fade)
        transition = Transition.CROSSFADE
        if i < len(script.shots):
            transition = script.shots[i].transition_to_next
        xfade = _XFADE_MAP.get(transition, "fade")

        video_filters.append(
            f"{prev}[{i}:v]xfade=transition={xfade}:duration={td}:offset={offset_acc}{out}"
        )

        if i < n - 1:
            offset_acc += durations[i] - td

    # Audio filter: concatenate all audio tracks
    audio_inputs = "".join(f"[{i}:a]" for i in range(n))
    audio_filter = f"{audio_inputs}concat=n={n}:v=0:a=1[outa]"

    full_filter = ";".join(video_filters) + ";" + audio_filter

    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", full_filter,
        "-map", "[outv]",
        "-map", "[outa]",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-profile:v", "high",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        str(output_path),
    ]
    logger.info("Assembling %d clips → %s", n, output_path)
    logger.debug("FFmpeg cmd: %s", " ".join(cmd))

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        logger.error("FFmpeg stderr: %s", result.stderr)
        # Fallback: simple concat without transitions
        return _fallback_concat(clip_paths, str(output_path))

    return str(output_path)


def _fallback_concat(clip_paths: list[str], output_path: str) -> str:
    """Simple concatenation without transitions as a fallback."""
    import tempfile

    list_file = Path(tempfile.mktemp(suffix=".txt"))
    list_file.write_text(
        "\n".join(f"file '{p}'" for p in clip_paths)
    )

    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", str(list_file),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-profile:v", "high",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        output_path,
    ]
    logger.warning("Using fallback concat: %s", " ".join(cmd))
    subprocess.run(cmd, check=True, capture_output=True)
    list_file.unlink(missing_ok=True)
    return output_path
