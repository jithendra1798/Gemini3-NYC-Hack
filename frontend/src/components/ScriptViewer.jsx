import React, { useEffect, useState } from "react";
import { fetchScript, fetchScriptVersion } from "../api/client";

export default function ScriptViewer({ jobId, activeVersion }) {
  const [script, setScript] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    const loader = activeVersion
      ? fetchScriptVersion(jobId, activeVersion)
      : fetchScript(jobId);
    loader.then(setScript).catch(() => {});
  }, [jobId, activeVersion]);

  if (!script) return null;

  // Support both single-clip (mock) and multi-clip (real API) formats
  const clips = script.clips || (script.clip ? [script.clip] : []);

  return (
    <div className="w-full border border-white/10 rounded bg-black overflow-hidden script-panel animate-fade-in">

      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono text-white/30 tracking-widest uppercase">Script</span>
          <span className="text-[11px] font-mono text-white/60">
            "{script.title}"
          </span>
          <span className="text-[9px] font-mono text-white/25">
            {clips.length} clip{clips.length !== 1 ? "s" : ""} · {script.overall_mood}
          </span>
        </div>
        <span className={`text-[10px] font-mono text-white/30 transition-transform duration-200 ${expanded ? "rotate-180 inline-block" : ""}`}>
          ▾
        </span>
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-white/8 px-4 py-4 space-y-4">

          {/* Narrative summary */}
          {script.narrative_summary && (
            <div className="text-[11px] text-white/50 leading-relaxed border-l border-white/10 pl-3">
              {script.narrative_summary}
            </div>
          )}

          {/* Music */}
          {script.music_direction && (
            <div className="flex gap-3">
              <span className="text-white/25 flex-shrink-0">♩</span>
              <span className="text-[11px] text-white/40 italic">{script.music_direction}</span>
            </div>
          )}

          {/* Clip details */}
          {clips.map((clip, idx) => (
            <div key={idx} className="grid grid-cols-[32px_60px_1fr] gap-3 py-2.5 border-t border-white/5">
              {/* Shot number */}
              <span className="text-[9px] text-white/25 tabular-nums pt-0.5">
                {String(idx + 1).padStart(2, "0")}
              </span>

              {/* Type badge */}
              <span className="text-[8px] tracking-widest uppercase self-start mt-0.5 px-1.5 py-0.5 rounded-sm border border-white/20 text-white/50">
                KEY
              </span>

              {/* Details */}
              <div className="space-y-0.5 min-w-0">
                <div className="text-[11px] text-white/60 leading-relaxed">
                  {clip.veo_prompt}
                </div>
                <div className="flex items-center gap-3 text-[9px] text-white/25">
                  <span>{clip.duration_seconds}s</span>
                  <span>photo #{clip.key_photo_id}</span>
                  {clip.transition_to_next && (
                    <span>→ {clip.transition_to_next}</span>
                  )}
                  {clip.audio_mood && (
                    <span>♩ {clip.audio_mood}</span>
                  )}
                </div>
                {clip.scene_description && (
                  <div className="text-[10px] text-white/35 pt-0.5">
                    {clip.scene_description}
                  </div>
                )}
                {clip.narration && (
                  <div className="text-[10px] text-white/30 italic pt-0.5">
                    "{clip.narration}"
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
