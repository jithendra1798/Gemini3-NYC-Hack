import React, { useEffect, useRef, useState } from "react";

const STAGES = [
  {
    key: "analyzing",
    num: "01",
    label: "ANALYZING",
    desc: "Gemini Vision reads your photos — detecting scenes, mood, subjects, and story.",
  },
  {
    key: "scripting",
    num: "02",
    label: "SCRIPTING",
    desc: "Writing a shot-by-shot cinematic script that connects your moments.",
  },
  {
    key: "generating",
    num: "03",
    label: "GENERATING",
    desc: "Veo 3.1 renders AI video clips for each script shot.",
  },
  {
    key: "assembling",
    num: "04",
    label: "ASSEMBLING",
    desc: "FFmpeg stitches clips together with cinematic transitions.",
  },
  {
    key: "complete",
    num: "05",
    label: "COMPLETE",
    desc: "Your film is ready.",
  },
];

// ── Per-stage preview panel ───────────────────────────────────────────────────
function StagePreview({ stageKey, photos, message }) {
  const [visibleLines, setVisibleLines] = useState([]);
  const linesRef = useRef([]);
  const timerRef = useRef(null);

  // For scripting: simulate script lines appearing one by one
  useEffect(() => {
    if (stageKey !== "scripting") return;
    const lines = [
      "INT. SCENE 01 — ESTABLISHING",
      "  camera: slow push-in · duration: 4s",
      "  mood: contemplative",
      "  transition: fade →",
      "",
      "INT. SCENE 02 — MEDIUM SHOT",
      "  camera: pan left · duration: 3s",
      "  subjects: identified in frame",
      "  transition: crossfade →",
      "",
      "EXT. SCENE 03 — WIDE",
      "  camera: crane up · duration: 5s",
      "  audio: ambient + score",
      "  transition: wipe →",
    ];
    linesRef.current = lines;
    let i = 0;
    timerRef.current = setInterval(() => {
      if (i < lines.length) {
        setVisibleLines((prev) => [...prev, lines[i]]);
        i++;
      } else {
        setVisibleLines([]);
        i = 0;
      }
    }, 180);
    return () => clearInterval(timerRef.current);
  }, [stageKey]);

  if (stageKey === "analyzing") {
    return (
      <div className="relative w-full h-36 rounded border border-white/8 bg-black overflow-hidden flex flex-wrap gap-1 p-2">
        <div className="scan-line" />
        {photos.length > 0 ? (
          photos.slice(0, 6).map((file, i) => (
            <div key={i} className="relative flex-1 min-w-[60px] h-full rounded overflow-hidden">
              <img
                src={URL.createObjectURL(file)}
                alt=""
                className="w-full h-full object-cover opacity-70"
              />
              <div className="absolute inset-0 flex items-end p-1">
                <span className="text-[8px] font-mono text-white/50 bg-black/60 px-1 rounded">
                  FRAME {String(i + 1).padStart(2, "0")}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[10px] font-mono text-white/20 tracking-widest">PROCESSING FRAMES</span>
          </div>
        )}
      </div>
    );
  }

  if (stageKey === "scripting") {
    return (
      <div className="w-full h-36 rounded border border-white/8 bg-black overflow-hidden p-3 script-panel">
        {visibleLines.map((line, i) => (
          <div key={i} className={line === "" ? "h-2" : "text-white/50"}>
            {line}
          </div>
        ))}
        <span className="inline-block w-1.5 h-3 bg-white/40 animate-pulse" />
      </div>
    );
  }

  if (stageKey === "generating") {
    // Show a grid of clip placeholders
    const clipCount = Math.max(3, Math.min(6, (photos?.length || 0) + 2));
    return (
      <div className="w-full h-36 rounded border border-white/8 bg-black overflow-hidden p-2">
        <div className="grid grid-cols-3 gap-1 h-full">
          {Array.from({ length: clipCount }).map((_, i) => (
            <div
              key={i}
              className="relative rounded bg-white/5 overflow-hidden flex items-center justify-center"
            >
              <div className="shimmer-bg absolute inset-0" />
              <span className="text-[8px] font-mono text-white/20 z-10 tracking-widest">
                CLIP {String(i + 1).padStart(2, "0")}
              </span>
              {/* Fake progress bar at bottom */}
              <div className="absolute bottom-0 left-0 h-px bg-white/20 w-full">
                <div
                  className="h-full bg-white/60 transition-all duration-1000"
                  style={{ width: i < 2 ? "100%" : i === 2 ? "60%" : "0%" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stageKey === "assembling") {
    // Timeline strip
    const clipCount = Math.max(3, Math.min(8, (photos?.length || 0) + 2));
    return (
      <div className="w-full h-36 rounded border border-white/8 bg-black overflow-hidden p-3 flex flex-col justify-center gap-3">
        <span className="text-[9px] font-mono text-white/30 tracking-widest uppercase">Timeline</span>
        <div className="flex items-center gap-1">
          {Array.from({ length: clipCount }).map((_, i) => (
            <React.Fragment key={i}>
              <div
                className="h-8 rounded flex-1 flex items-center justify-center transition-all duration-500"
                style={{
                  background: i < Math.ceil(clipCount / 2) ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span className="text-[7px] font-mono text-white/30">{String(i + 1).padStart(2, "0")}</span>
              </div>
              {i < clipCount - 1 && (
                <div className="w-1 h-px bg-white/20 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="h-px bg-white/8 relative overflow-hidden rounded">
          <div className="absolute inset-y-0 left-0 bg-white/40 transition-all duration-700" style={{ width: "65%" }} />
        </div>
      </div>
    );
  }

  if (stageKey === "complete") {
    return (
      <div className="w-full h-36 rounded border border-white/8 bg-black overflow-hidden flex items-center justify-center">
        <div className="text-center space-y-1">
          <div className="text-2xl font-light text-white/80 tracking-widest">■</div>
          <span className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Film ready</span>
        </div>
      </div>
    );
  }

  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProgressTracker({ progress, photos }) {
  if (!progress) return null;

  const { stage, progress: pct, message } = progress;
  const percentage = Math.round((pct || 0) * 100);
  const isError = stage === "error";

  const currentIdx = STAGES.findIndex((s) => s.key === stage);
  const activeStage = STAGES[currentIdx] || STAGES[0];

  return (
    <div className="w-full space-y-8 animate-fade-in">

      {/* Stage timeline — vertical on left, preview on right */}
      <div className="grid grid-cols-[200px_1fr] gap-6">

        {/* Left: stage list */}
        <div className="space-y-0 border-l border-white/8">
          {STAGES.map((s, idx) => {
            const isActive = s.key === stage;
            const isDone = currentIdx > idx || stage === "complete";
            return (
              <div key={s.key} className="flex items-start gap-3 py-3 pl-4 relative">
                {/* Connector dot */}
                <div className={`
                  absolute -left-[5px] top-[18px] w-2.5 h-2.5 rounded-full border flex-shrink-0
                  transition-all duration-500
                  ${isDone
                    ? "border-white bg-white"
                    : isActive
                      ? "border-white bg-transparent animate-pulse"
                      : "border-white/20 bg-transparent"
                  }
                `} />
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-mono ${isDone || isActive ? "text-white/50" : "text-white/15"}`}>
                      {s.num}
                    </span>
                    <span className={`text-[11px] font-mono tracking-widest
                      ${isDone ? "text-white/50 line-through" : isActive ? "text-white" : "text-white/20"}
                    `}>
                      {s.label}
                    </span>
                    {isActive && (
                      <span className="text-[8px] font-mono text-white/30 animate-pulse">▶</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: active stage preview */}
        <div className="flex flex-col gap-3">
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[9px] font-mono text-white/30">{activeStage.num}</span>
              <span className="text-sm font-mono tracking-widest text-white">
                {isError ? "ERROR" : activeStage.label}
              </span>
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed">
              {isError ? message : activeStage.desc}
            </p>
          </div>

          {!isError && (
            <StagePreview stageKey={stage} photos={photos || []} message={message} />
          )}

          {isError && (
            <div className="w-full h-36 rounded border border-white/20 bg-black flex items-center justify-center p-4">
              <p className="text-[11px] font-mono text-white/50 text-center leading-relaxed">{message}</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="h-px bg-white/8 relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-white transition-all duration-700 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-mono text-white/30 tracking-widest truncate max-w-xs">
            {message}
          </span>
          <span className="text-[10px] font-mono text-white/40 tabular-nums flex-shrink-0 ml-4">
            {percentage}%
          </span>
        </div>
      </div>

    </div>
  );
}
