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
    <div className="w-full border border-white/10 rounded bg-black overflow-hidden script-panel animate-fade-in">

      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3">

        {/* Left: label + toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 hover:opacity-70 transition-opacity text-left"
        >
          <span className="text-[9px] font-mono text-white/30 tracking-widest uppercase">Versions</span>
          <span className="text-[11px] font-mono text-white/40">
            {versions.length} generated
          </span>
          <span className={`text-[10px] font-mono text-white/30 transition-transform duration-200 ${expanded ? "rotate-180 inline-block" : ""}`}>
            ▾
          </span>
        </button>

        {/* Right: Regenerate */}
        <button
          onClick={() => onRegenerate?.()}
          disabled={isRegenerating}
          className="
            flex items-center gap-2
            px-3 py-1.5 text-[10px] font-mono tracking-widest uppercase
            border border-white/20 text-white/50
            hover:border-white/50 hover:text-white/80
            active:scale-95
            disabled:opacity-30 disabled:cursor-not-allowed
            transition-all duration-150
          "
        >
          {isRegenerating ? (
            <>
              <span className="w-2.5 h-2.5 border border-white/30 border-t-white rounded-full animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Regenerate
            </>
          )}
        </button>
      </div>

      {/* Version list */}
      {expanded && (
        <div className="border-t border-white/8 divide-y divide-white/5">
          {versions.map((ver) => {
            const isActive = currentVideoUrl?.includes(`_v${ver.version}`);
            const date = new Date(ver.created_at);
            const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });

            return (
              <button
                key={ver.version}
                onClick={() => onSelectVersion?.(ver)}
                disabled={ver.status !== "complete"}
                className={`
                  w-full text-left px-4 py-3 flex items-center justify-between
                  transition-colors duration-150
                  ${isActive ? "bg-white/5" : "hover:bg-white/[0.03]"}
                  disabled:opacity-40 disabled:cursor-not-allowed
                `}
              >
                {/* Left: version number + meta */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`
                    text-[10px] font-mono tabular-nums flex-shrink-0
                    ${isActive ? "text-white" : "text-white/35"}
                  `}>
                    V{String(ver.version).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <div className={`text-[11px] font-mono truncate ${isActive ? "text-white/80" : "text-white/45"}`}>
                      {ver.title || `Version ${ver.version}`}
                    </div>
                    <div className="text-[9px] font-mono text-white/20 tracking-widest">
                      {dateStr} · {timeStr}
                      {ver.num_clips > 0 && <> · {ver.num_clips} clip{ver.num_clips !== 1 ? "s" : ""}</>}
                    </div>
                  </div>
                </div>

                {/* Right: status + playing indicator */}
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className={`
                    text-[8px] font-mono tracking-widest uppercase
                    ${ver.status === "complete" ? "text-white/40" : ver.status === "error" ? "text-white/30" : "text-white/20"}
                  `}>
                    {ver.status === "complete" ? "DONE" : ver.status === "error" ? "ERR" : "…"}
                  </span>
                  {isActive && (
                    <span className="text-[8px] font-mono text-white/50 tracking-widest uppercase border border-white/20 px-1.5 py-0.5">
                      Playing
                    </span>
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
