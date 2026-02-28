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
    <div className="w-full space-y-4 animate-fade-in">
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

        {/* Play/pause overlay — shows briefly on click */}
        <div className={`
          absolute inset-0 flex items-center justify-center
          bg-black/20 transition-opacity duration-300
          ${isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"}
        `}>
          <div className="w-14 h-14 rounded-full border border-white/30 flex items-center justify-center bg-black/50">
            {isPlaying ? (
              <svg className="w-5 h-5 text-white/70" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white/70 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
        </div>

        {/* Corner label */}
        <div className="absolute top-3 left-3 text-[9px] font-mono text-white/30 tracking-widest bg-black/60 px-2 py-0.5 rounded">
          CINESNAP
        </div>
      </div>
    </div>
  );
}
