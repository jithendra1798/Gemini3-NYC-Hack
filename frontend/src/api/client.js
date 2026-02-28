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
    { stage: "analyzing",  progress: 0.25, message: "Detecting scenes, mood, subjects…" },
    { stage: "scripting",  progress: 0.35, message: "Writing cinematic script…" },
    { stage: "scripting",  progress: 0.50, message: "Generating shot list — 6 shots across 2 scenes…" },
    { stage: "generating", progress: 0.55, message: "Rendering clip 01 / 06 with Veo 3.1…" },
    { stage: "generating", progress: 0.62, message: "Rendering clip 02 / 06…" },
    { stage: "generating", progress: 0.69, message: "Rendering clip 03 / 06…" },
    { stage: "generating", progress: 0.76, message: "Rendering clip 04 / 06…" },
    { stage: "generating", progress: 0.83, message: "Rendering clip 05 / 06…" },
    { stage: "generating", progress: 0.88, message: "Rendering clip 06 / 06…" },
    { stage: "assembling", progress: 0.92, message: "Assembling clips with FFmpeg…" },
    { stage: "assembling", progress: 0.97, message: "Applying crossfade transitions…" },
    {
      stage: "complete",
      progress: 1.0,
      message: "Your film is ready.",
      // Use a public domain sample video for preview
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
      title: "A Day in the City",
      overall_mood: "contemplative",
      music_direction: "Ambient electronic with soft piano undertones",
      shots: [
        { shot_type: "photo", source_photo_id: 1, duration_seconds: 4, camera_direction: "Slow push-in", transition_to_next: "crossfade", narration: "The morning light breaks across the skyline." },
        { shot_type: "generated", duration_seconds: 3, veo_prompt: "Aerial drone shot rising above city rooftops at golden hour", transition_to_next: "fade", narration: null },
        { shot_type: "photo", source_photo_id: 2, duration_seconds: 5, camera_direction: "Pan left", transition_to_next: "wiperight", narration: "Every corner holds a story." },
        { shot_type: "generated", duration_seconds: 3, veo_prompt: "Close-up of hands holding a coffee cup, steam rising", transition_to_next: "crossfade", narration: null },
        { shot_type: "photo", source_photo_id: 3, duration_seconds: 4, camera_direction: "Static wide", transition_to_next: "fade", narration: "The city breathes." },
        { shot_type: "photo", source_photo_id: 4, duration_seconds: 5, camera_direction: "Slow zoom out", transition_to_next: "fade", narration: "And we move with it." },
      ],
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
