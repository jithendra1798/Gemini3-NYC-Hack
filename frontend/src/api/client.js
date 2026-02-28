/**
 * CineSnap API client — handles photo upload and SSE progress streaming.
 */

const API_BASE = process.env.REACT_APP_API_URL || "";

// ── Mock mode — set REACT_APP_MOCK=true in .env.local to skip real API ────────
const MOCK = process.env.REACT_APP_MOCK === "true";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generateVideoMock(photos, _opts, onProgress) {
  const steps = [
    { stage: "analyzing",  progress: 0.10, message: `Analyzing ${photos.length} photos with Gemini Vision…` },
    { stage: "analyzing",  progress: 0.25, message: `Found 2 scenes — a story of light and motion across ${photos.length} moments…` },
    { stage: "scripting",  progress: 0.35, message: "Writing cinematic script…" },
    { stage: "scripting",  progress: 0.50, message: "Script ready: \"Golden Hour\" — key frame selected (photo 0)" },
    { stage: "generating", progress: 0.55, message: "Generating preview clip with Veo 3.1 (photo 0)…" },
    { stage: "generating", progress: 0.90, message: "Clip generated — finalising…" },
    {
      stage: "complete",
      progress: 1.0,
      message: "Your cinematic preview is ready!",
      video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      script_id: "mock-job-001",
    },
  ];

  for (const step of steps) {
    await sleep(900);
    onProgress?.(step);
    if (step.stage === "complete") return step;
  }
}

/**
 * Upload photos and stream pipeline progress via SSE.
 *
 * @param {File[]}   photos          Array of image files
 * @param {string}   theme           Theme name (e.g. "cinematic", "auto")
 * @param {number}   durationTarget  Target duration in seconds
 * @param {string}   aspectRatio     "16:9" or "9:16"
 * @param {function} onProgress      Callback receiving each progress update object
 * @returns {Promise<object>}        The final "complete" event (or error)
 */
export async function generateVideo(
  photos,
  { theme = "auto", durationTarget = 30, aspectRatio = "16:9" } = {},
  onProgress
) {
  if (MOCK) return generateVideoMock(photos, { theme, durationTarget, aspectRatio }, onProgress);
  const formData = new FormData();
  photos.forEach((file) => formData.append("photos", file));
  formData.append("theme", theme);
  formData.append("duration_target", String(durationTarget));
  formData.append("aspect_ratio", aspectRatio);

  const response = await fetch(`${API_BASE}/api/generate`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Upload failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastEvent = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE lines
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          lastEvent = data;
          if (onProgress) onProgress(data);
        } catch {
          // ignore parse errors
        }
      }
    }
  }

  return lastEvent;
}

/**
 * Fetch the generated script for a job.
 */
export async function fetchScript(jobId) {
  if (MOCK) {
    return {
      title: "Golden Hour",
      overall_mood: "contemplative",
      music_direction: "Ambient electronic with soft piano undertones, building gently to a warm resolution",
      narrative_summary: "A quiet journey through light and stillness — the photos capture fleeting moments of everyday life rendered extraordinary by golden afternoon light. The figures move unhurried through their world, each frame a breath held just long enough to notice beauty.",
      clip: {
        clip_number: 1,
        key_photo_id: 0,
        veo_prompt: "Camera slowly pulls back from the subject revealing the warm cityscape behind them, golden hour light sweeping across rooftops as a gentle breeze stirs the scene. Shallow depth of field, film grain, anamorphic lens flare.",
        duration_seconds: 8,
        transition_to_next: "fade",
        audio_mood: "warm ambient with distant city hum",
        narration: "Where the light falls, stories begin.",
        scene_description: "The most visually compelling frame — chosen as the emotional anchor for the whole narrative.",
      },
    };
  }
  const res = await fetch(`${API_BASE}/api/scripts/${jobId}`);
  if (!res.ok) throw new Error("Script not found");
  return res.json();
}

/**
 * Build the video URL for a job.
 */
export function videoUrl(jobId) {
  return `${API_BASE}/api/videos/${jobId}.mp4`;
}

// ── Projects & Versions ────────────────────────────────────────────────────

/**
 * Get all versions for a project.
 */
export async function fetchVersions(jobId) {
  const res = await fetch(`${API_BASE}/api/projects/${jobId}/versions`);
  if (!res.ok) return [];
  return res.json();
}

/**
 * Get the full project details.
 */
export async function fetchProject(jobId) {
  const res = await fetch(`${API_BASE}/api/projects/${jobId}`);
  if (!res.ok) throw new Error("Project not found");
  return res.json();
}

/**
 * Get the uploaded photos for a project.
 */
export async function fetchPhotos(jobId) {
  const res = await fetch(`${API_BASE}/api/projects/${jobId}/photos`);
  if (!res.ok) return [];
  return res.json();
}

/**
 * Regenerate video from existing photos — returns SSE stream.
 */
export async function regenerateVideo(
  jobId,
  { theme = "auto", durationTarget = 30, aspectRatio = "16:9" } = {},
  onProgress
) {
  const formData = new FormData();
  formData.append("theme", theme);
  formData.append("duration_target", String(durationTarget));
  formData.append("aspect_ratio", aspectRatio);

  const response = await fetch(`${API_BASE}/api/projects/${jobId}/regenerate`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Regeneration failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastEvent = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          lastEvent = data;
          if (onProgress) onProgress(data);
        } catch {
          // ignore parse errors
        }
      }
    }
  }

  return lastEvent;
}

/**
 * Fetch script for a specific version.
 */
export async function fetchScriptVersion(jobId, version) {
  const res = await fetch(`${API_BASE}/api/scripts/${jobId}/${version}`);
  if (!res.ok) throw new Error("Script not found");
  return res.json();
}

/**
 * List all projects with summary info.
 */
export async function fetchProjects() {
  const res = await fetch(`${API_BASE}/api/projects`);
  if (!res.ok) return [];
  return res.json();
}

/**
 * Check for duplicate project by uploading file metadata.
 * Returns { duplicate: true, job_id: "..." } if match found.
 */
export async function checkDuplicate(photos) {
  const meta = photos.map((f) => ({ name: f.name, size: f.size, lastModified: f.lastModified }));
  const res = await fetch(`${API_BASE}/api/check-duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: meta }),
  });
  if (!res.ok) return { duplicate: false };
  return res.json();
}
