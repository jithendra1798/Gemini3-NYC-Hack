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
  }, [jobId, currentVideoUrl]);

  if (versions.length === 0) return null;

  return (
    <div className="w-full border border-white/10 rounded bg-black overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <span className="text-[9px] font-mono text-white/30 tracking-widest uppercase">Versions</span>
          <span className="text-[11px] font-mono text-white/50">
            {versions.length} generation{versions.length !== 1 ? "s" : ""}
          </span>
          <span className={`text-[10px] font-mono text-white/30 transition-transform duration-200 ${expanded ? "rotate-180 inline-block" : ""}`}>
            ▾
          </span>
        </button>

        {/* Regenerate button */}
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="
            px-4 py-1.5 text-[10px] font-mono tracking-[0.15em] uppercase
            border border-white/20 text-white/60
            hover:border-white/50 hover:text-white hover:bg-white/5
            disabled:opacity-30 disabled:cursor-not-allowed
            transition-all duration-200
          "
        >
          {isRegenerating ? (
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" />
              Regenerating…
            </span>
          ) : (
            "↻ Regenerate"
          )}
        </button>
      </div>

      {/* Version list */}
      {expanded && (
        <div className="border-t border-white/8 divide-y divide-white/5">
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
                  w-full text-left px-4 py-3 flex items-center justify-between transition-all duration-150
                  ${isActive
                    ? "bg-white/8"
                    : "hover:bg-white/[0.03]"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  {/* Version badge */}
                  <span className={`
                    text-[10px] font-mono tracking-wider tabular-nums
                    ${isActive ? "text-white" : "text-white/30"}
                  `}>
                    v{ver.version}
                  </span>

                  {/* Title + meta */}
                  <div className="space-y-0.5">
                    <span className={`text-[11px] font-mono ${isActive ? "text-white/80" : "text-white/50"}`}>
                      {ver.title || `Version ${ver.version}`}
                    </span>
                    <div className="text-[9px] font-mono text-white/20 tracking-wider">
                      {dateStr} {timeStr} · {ver.model} · {ver.num_clips} clip{ver.num_clips !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Status */}
                  <span className={`
                    text-[9px] font-mono tracking-widest uppercase
                    ${ver.status === "complete"
                      ? "text-white/40"
                      : ver.status === "error"
                        ? "text-white/30"
                        : "text-white/20 animate-pulse"
                    }
                  `}>
                    {ver.status === "complete" ? "✓ Done" : ver.status === "error" ? "✗ Err" : "◌ …"}
                  </span>

                  {/* Playing indicator */}
                  {isActive && (
                    <span className="text-[9px] font-mono text-white/50 tracking-widest">▶</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
