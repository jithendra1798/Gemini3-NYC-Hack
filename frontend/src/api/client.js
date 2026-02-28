/**
 * CineSnap API client — handles photo upload and SSE progress streaming.
 */

const API_BASE = process.env.REACT_APP_API_URL || "";

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
