import React, { useRef, useState } from "react";

export default function VideoPlayer({ videoUrl }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  if (!videoUrl) return null;

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else          { v.pause(); setIsPlaying(false); }
  };

  return (
    <div className="w-full space-y-4 animate-curtain-lift">
      <div className="text-[10px] font-mono text-white/30 tracking-widest uppercase mb-2">
        Film Preview
      </div>

      {/* Video container */}
      <div
        className="relative w-full bg-black rounded border border-white/10 overflow-hidden cursor-pointer group"
        style={{ paddingBottom: "56.25%" }}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay
          loop
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="absolute inset-0 w-full h-full object-contain"
        />

        {/* Play/pause overlay */}
        <div className={`
          absolute inset-0 flex items-center justify-center
          bg-black/20 transition-opacity duration-300
          ${isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"}
        `}>
          <div className="w-14 h-14 rounded-full border border-white/30 flex items-center justify-center bg-black/50 transition-transform duration-150 active:scale-90">
            {/* Both icons always in DOM — crossfade via opacity */}
            <div className="relative w-5 h-5">
              <svg
                className={`absolute inset-0 w-5 h-5 text-white/70 transition-opacity duration-200 ${isPlaying ? "opacity-0" : "opacity-100"}`}
                fill="currentColor" viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              <svg
                className={`absolute inset-0 w-5 h-5 text-white/70 transition-opacity duration-200 ${isPlaying ? "opacity-100" : "opacity-0"}`}
                fill="currentColor" viewBox="0 0 24 24"
              >
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            </div>
          </div>
        </div>

        {/* Corner label */}
        <div className="absolute top-3 left-3 text-[9px] font-mono text-white/30 tracking-widest bg-black/60 px-2 py-0.5 rounded">
          CINESNAP
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-between">
        <div className="text-[9px] font-mono text-white/20 tracking-widest">
          Click to play / pause
        </div>
        <a
          href={videoUrl}
          download="cinesnap-film.mp4"
          className="
            inline-flex items-center gap-2 px-4 py-1.5
            text-[10px] font-mono tracking-widest uppercase
            border border-white/20 text-white/50
            hover:border-white/50 hover:text-white/80
            active:scale-95
            transition-all duration-150
          "
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download
        </a>
      </div>
    </div>
  );
}
