import React from "react";

const THEMES = [
  { id: "auto",        label: "✨ Auto",        desc: "AI picks the best style" },
  { id: "cinematic",   label: "🎬 Cinematic",   desc: "Hollywood blockbuster feel" },
  { id: "romantic",    label: "💕 Romantic",     desc: "Warm, dreamy, soft focus" },
  { id: "adventure",   label: "🏔️ Adventure",   desc: "Epic, sweeping, dynamic" },
  { id: "horror",      label: "🌑 Horror",      desc: "Dark, suspenseful, eerie" },
  { id: "documentary", label: "📹 Documentary", desc: "Observational, authentic" },
];

export default function ThemeSelector({ theme, setTheme, disabled }) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider">
        Cinematic Theme
      </label>
      <div className="grid grid-cols-3 gap-2.5">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            disabled={disabled}
            className={`
              relative px-4 py-3 rounded-xl text-left transition-all duration-200
              border
              ${theme === t.id
                ? "border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/40"
                : "border-gray-800 bg-gray-900/60 hover:border-gray-600 hover:bg-gray-800/60"
              }
              ${disabled ? "opacity-50 pointer-events-none" : ""}
            `}
          >
            <div className="text-sm font-semibold">{t.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{t.desc}</div>
            {theme === t.id && (
              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-400" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
