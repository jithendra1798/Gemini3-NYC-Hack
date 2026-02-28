import React, { useEffect, useState } from "react";
import { fetchVersions } from "../api/client";

export default function VersionHistory({ jobId, currentVideoUrl, onSelectVersion, onRegenerate, isRegenerating }) {
  const [versions, setVersions] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    fetchVersions(jobId)
      .then((v) => setVersions(v))
      .catch(() => {});
  }, [jobId, currentVideoUrl]); // re-fetch when new video is generated

  if (versions.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/60 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🔄</span>
          <div className="text-left">
            <div className="font-semibold text-gray-100">
              Version History
            </div>
            <div className="text-sm text-gray-400">
              {versions.length} version{versions.length !== 1 ? "s" : ""} generated
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Regenerate button (always visible in header) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRegenerate?.();
            }}
            disabled={isRegenerating}
            className="
              px-4 py-2 rounded-xl text-sm font-medium
              bg-gradient-to-r from-purple-600 to-purple-500
              hover:from-purple-500 hover:to-purple-400
              disabled:opacity-50 disabled:cursor-not-allowed
              text-white transition-all duration-200
            "
          >
            {isRegenerating ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Regenerating…
              </span>
            ) : (
              "✨ Regenerate"
            )}
          </button>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      {/* Version list */}
      {expanded && (
        <div className="px-6 pb-6 space-y-3 border-t border-gray-800 pt-4">
          {versions.map((ver) => {
            const isActive = currentVideoUrl?.includes(`_v${ver.version}`);
            const date = new Date(ver.created_at);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

            return (
              <button
                key={ver.version}
                onClick={() => onSelectVersion?.(ver)}
                className={`
                  w-full text-left p-4 rounded-xl border text-sm transition-all duration-200
                  ${isActive
                    ? "border-brand-500/50 bg-brand-500/10 ring-1 ring-brand-500/30"
                    : "border-gray-700/50 bg-gray-800/30 hover:bg-gray-800/60 hover:border-gray-600"
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                      ${isActive
                        ? "bg-brand-500/30 text-brand-300"
                        : "bg-gray-700 text-gray-400"
                      }
                    `}>
                      v{ver.version}
                    </span>
                    <div>
                      <div className="text-gray-200 font-medium">
                        {ver.title || `Version ${ver.version}`}
                      </div>
                      <div className="text-gray-500 text-xs mt-0.5">
                        {dateStr} at {timeStr} · {ver.model} · {ver.num_clips} clips
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`
                      px-2 py-0.5 rounded-full text-xs font-medium
                      ${ver.status === "complete"
                        ? "bg-green-500/20 text-green-300"
                        : ver.status === "error"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-yellow-500/20 text-yellow-300"
                      }
                    `}>
                      {ver.status === "complete" ? "✓ Complete" : ver.status === "error" ? "✗ Failed" : "⏳ In progress"}
                    </span>
                    {isActive && (
                      <span className="text-brand-400 text-xs font-medium">▶ Playing</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
