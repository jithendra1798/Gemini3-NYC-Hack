import React, { useEffect, useState } from "react";
import { fetchScript } from "../api/client";

export default function ScriptViewer({ jobId }) {
  const [script, setScript] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    fetchScript(jobId).then(setScript).catch(() => {});
  }, [jobId]);

  if (!script) return null;

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/60 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">📜</span>
          <div className="text-left">
            <div className="font-semibold text-gray-100">
              AI-Generated Script
            </div>
            <div className="text-sm text-gray-400">
              "{script.title}" · {script.shots?.length || 0} shots · {script.overall_mood}
            </div>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Script details */}
      {expanded && (
        <div className="px-6 pb-6 space-y-4 border-t border-gray-800">
          {/* Music direction */}
          {script.music_direction && (
            <div className="mt-4 p-3 rounded-lg bg-gray-800/60 text-sm">
              <span className="text-gray-400">🎵 Music: </span>
              <span className="text-gray-200">{script.music_direction}</span>
            </div>
          )}

          {/* Shot list */}
          <div className="space-y-3 mt-4">
            {script.shots?.map((shot, i) => (
              <div
                key={i}
                className={`
                  p-4 rounded-xl border text-sm
                  ${shot.shot_type === "photo"
                    ? "border-blue-500/30 bg-blue-500/5"
                    : "border-purple-500/30 bg-purple-500/5"
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`
                    px-2 py-0.5 rounded-full text-xs font-medium
                    ${shot.shot_type === "photo"
                      ? "bg-blue-500/20 text-blue-300"
                      : "bg-purple-500/20 text-purple-300"
                    }
                  `}>
                    {shot.shot_type === "photo" ? `📷 Photo #${shot.source_photo_id}` : "🎥 AI Generated"}
                  </span>
                  <span className="text-gray-500">{shot.duration_seconds}s</span>
                  <span className="text-gray-600">→ {shot.transition_to_next}</span>
                </div>

                <div className="text-gray-300">
                  {shot.veo_prompt || shot.camera_direction}
                </div>

                {shot.narration && (
                  <div className="mt-2 text-gray-400 italic">"{shot.narration}"</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
