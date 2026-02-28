import React, { useRef, useState, useEffect } from "react";

export default function VideoPlayer({ videoUrl }) {
  const videoRef = useRef(null);
  const progressRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef(null);

  useEffect(() => {
    // Auto-hide controls after 3s of playing
    if (isPlaying) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    } else {
      setShowControls(true);
    }
    return () => clearTimeout(hideTimer.current);
  }, [isPlaying]);

  if (!videoUrl) return null;

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else          { v.pause(); setIsPlaying(false); }
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (v) setCurrentTime(v.currentTime);
  };

  const handleSeek = (e) => {
    const v = videoRef.current;
    const bar = progressRef.current;
    if (!v || !bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * v.duration;
  };

  const formatTime = (t) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full space-y-3 animate-curtain-lift">
      {/* Video container — clean, no heavy overlays */}
      <div
        className="relative w-full bg-black rounded-lg overflow-hidden cursor-pointer group video-container"
        style={{ paddingBottom: "56.25%" }}
        onClick={togglePlay}
        onMouseMove={() => { setShowControls(true); clearTimeout(hideTimer.current); if (isPlaying) hideTimer.current = setTimeout(() => setShowControls(false), 3000); }}
      >
        <video
          key={videoUrl}
          ref={videoRef}
          src={videoUrl}
          autoPlay
          loop
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration); }}
          className="absolute inset-0 w-full h-full object-contain"
        />

        {/* Minimal play/pause overlay — fades smoothly */}
        <div className={`
          absolute inset-0 flex items-center justify-center
          transition-opacity duration-500
          ${showControls ? "opacity-100" : "opacity-0"}
          ${isPlaying ? "bg-transparent" : "bg-black/10"}
        `}>
          <div className={`
            w-14 h-14 rounded-full flex items-center justify-center
            backdrop-blur-md bg-black/30 border border-white/10
            transition-all duration-300
            ${isPlaying ? "scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100" : "scale-100 opacity-100"}
          `}>
            <div className="relative w-5 h-5">
              <svg
                className={`absolute inset-0 w-5 h-5 text-white/80 transition-opacity duration-200 ${isPlaying ? "opacity-0" : "opacity-100"}`}
                fill="currentColor" viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              <svg
                className={`absolute inset-0 w-5 h-5 text-white/80 transition-opacity duration-200 ${isPlaying ? "opacity-100" : "opacity-0"}`}
                fill="currentColor" viewBox="0 0 24 24"
              >
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            </div>
          </div>
        </div>

        {/* Progress bar — bottom of video */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-8 flex items-end transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        >
          <div className="w-full bg-gradient-to-t from-black/40 to-transparent px-3 pb-2 pt-4">
            <div
              ref={progressRef}
              className="w-full h-1 bg-white/15 rounded-full cursor-pointer group/bar"
              onClick={(e) => { e.stopPropagation(); handleSeek(e); }}
            >
              <div
                className="h-full bg-white/70 rounded-full relative transition-[width] duration-100"
                style={{ width: `${pct}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white opacity-0 group-hover/bar:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3 text-[9px] font-mono text-white/25 tracking-widest tabular-nums">
          <span>{formatTime(currentTime)}</span>
          <span className="text-white/10">/</span>
          <span>{formatTime(duration)}</span>
        </div>
        <a
          href={videoUrl}
          download="cinesnap-film.mp4"
          className="
            inline-flex items-center gap-2 px-4 py-1.5
            text-[10px] font-mono tracking-widest uppercase
            border border-white/10 text-white/40 rounded
            hover:border-white/30 hover:text-white/70
            active:scale-95
            transition-all duration-200
          "
          onClick={(e) => e.stopPropagation()}
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
