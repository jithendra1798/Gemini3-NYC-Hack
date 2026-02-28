import React from "react";

const STAGES = [
  { key: "analyzing",  label: "Analyzing Photos",    icon: "🔍" },
  { key: "scripting",  label: "Writing Script",      icon: "📝" },
  { key: "generating", label: "Generating Video",    icon: "🎥" },
  { key: "assembling", label: "Assembling Film",     icon: "✂️" },
  { key: "complete",   label: "Complete",            icon: "✅" },
];

export default function ProgressTracker({ progress }) {
  if (!progress) return null;

  const { stage, progress: pct, message } = progress;
  const percentage = Math.round(pct * 100);
  const isError = stage === "error";

  const currentIdx = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="space-y-6">
      {/* Stage indicators */}
      <div className="flex items-center justify-between gap-1">
        {STAGES.map((s, idx) => {
          const isActive = s.key === stage;
          const isDone = currentIdx > idx || stage === "complete";
          return (
            <div key={s.key} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-lg
                  transition-all duration-500
                  ${isDone
                    ? "bg-green-500/20 ring-2 ring-green-500"
                    : isActive
                      ? "bg-brand-500/20 ring-2 ring-brand-400 animate-pulse-slow"
                      : "bg-gray-800 ring-1 ring-gray-700"
                  }
                `}
              >
                {s.icon}
              </div>
              <span
                className={`text-[10px] font-medium tracking-wide ${
                  isDone ? "text-green-400" : isActive ? "text-brand-300" : "text-gray-600"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`
            absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out
            ${isError
              ? "bg-red-500"
              : stage === "complete"
                ? "bg-green-500"
                : "bg-gradient-to-r from-brand-600 to-brand-400"
            }
          `}
          style={{ width: `${percentage}%` }}
        />
        {!isError && stage !== "complete" && (
          <div
            className="absolute inset-y-0 left-0 rounded-full shimmer-bg animate-shimmer"
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>

      {/* Message */}
      <div className="flex items-center justify-between text-sm">
        <span className={isError ? "text-red-400" : "text-gray-300"}>
          {message}
        </span>
        <span className="text-gray-500 tabular-nums">{percentage}%</span>
      </div>
    </div>
  );
}
