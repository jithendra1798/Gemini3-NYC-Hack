import React from "react";

const THEMES = [
  { id: "auto",        label: "AUTO" },
  { id: "cinematic",   label: "CINEMATIC" },
  { id: "romantic",    label: "ROMANTIC" },
  { id: "adventure",   label: "ADVENTURE" },
  { id: "horror",      label: "HORROR" },
  { id: "documentary", label: "DOCUMENTARY" },
];

export default function ThemeSelector({ theme, setTheme, disabled }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-[10px] font-mono text-white/30 tracking-widest uppercase">
        Cinematic Theme
      </span>
      <div className="flex flex-wrap justify-center gap-px border border-white/10 rounded-sm overflow-hidden">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            disabled={disabled}
            className={`
              px-4 py-2 text-[11px] font-mono tracking-widest uppercase
              transition-all duration-150 active:scale-95
              ${theme === t.id
                ? "bg-white text-black scale-[1.03]"
                : "bg-black text-white/40 hover:text-white/80 hover:bg-white/5"
              }
              ${disabled ? "opacity-40 pointer-events-none" : "cursor-pointer"}
            `}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
