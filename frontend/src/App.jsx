import React, { useState } from "react";
import CarouselUploader from "./components/CarouselUploader";
import ThemeSelector from "./components/ThemeSelector";
import ProgressTracker from "./components/ProgressTracker";
import VideoPlayer from "./components/VideoPlayer";
import ScriptViewer from "./components/ScriptViewer";
import VersionHistory from "./components/VersionHistory";
import { generateVideo, regenerateVideo } from "./api/client";

export default function App() {
  const [photos, setPhotos] = useState([]);
  const [theme, setTheme] = useState("auto");
  const [progress, setProgress] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [activeVersion, setActiveVersion] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    if (photos.length === 0) return;
    setIsProcessing(true);
    setProgress(null);
    setFinalVideoUrl(null);
    setJobId(null);
    setError(null);

    try {
      const result = await generateVideo(
        photos,
        { theme, durationTarget: 30, aspectRatio: "16:9" },
        (update) => {
          setProgress(update);
          if (update.video_url) setFinalVideoUrl(update.video_url);
          if (update.script_id) setJobId(update.script_id);
        }
      );
      if (result?.stage === "error") setError(result.message);
    } catch (err) {
      setError(err.message);
      setProgress({ stage: "error", progress: 0, message: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setPhotos([]);
    setTheme("auto");
    setProgress(null);
    setIsProcessing(false);
    setIsRegenerating(false);
    setFinalVideoUrl(null);
    setJobId(null);
    setActiveVersion(null);
    setError(null);
  };

  const handleRegenerate = async () => {
    if (!jobId) return;

    setIsRegenerating(true);
    setIsProcessing(true);
    setProgress(null);
    setError(null);

    try {
      const result = await regenerateVideo(
        jobId,
        { theme, durationTarget: 30, aspectRatio: "16:9" },
        (update) => {
          setProgress(update);
          if (update.video_url) {
            setFinalVideoUrl(update.video_url);
          }
        }
      );

      if (result?.stage === "error") {
        setError(result.message);
      }
    } catch (err) {
      setError(err.message);
      setProgress({ stage: "error", progress: 0, message: err.message });
    } finally {
      setIsProcessing(false);
      setIsRegenerating(false);
    }
  };

  const handleSelectVersion = (ver) => {
    if (ver.video_url && ver.status === "complete") {
      setFinalVideoUrl(ver.video_url);
      setActiveVersion(ver.version);
    }
  };

  const showUpload = !isProcessing && !finalVideoUrl;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-white/8 flex-shrink-0">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-mono tracking-[0.3em] text-white/80 uppercase">
              CineSnap
            </span>
            <span className="text-white/15 text-xs">|</span>
            <span className="text-[10px] font-mono text-white/25 tracking-widest">
              AI Photo-to-Cinema
            </span>
          </div>

          {(isProcessing || finalVideoUrl) && (
            <button
              onClick={handleReset}
              className="text-[10px] font-mono text-white/30 hover:text-white/70 tracking-widest uppercase transition-colors border border-white/10 hover:border-white/30 px-3 py-1.5 rounded-sm"
            >
              ← Restart
            </button>
          )}
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12 flex flex-col gap-12">

        {/* ── UPLOAD STATE ─────────────────────────────────────────────────── */}
        {showUpload && (
          <div className="flex flex-col items-center gap-10 animate-fade-in">

            {/* Hero */}
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-light tracking-tight text-white">
                Turn photos into film.
              </h1>
              <p className="text-sm font-mono text-white/30 tracking-widest">
                Gemini Vision · Veo 3.1 · FFmpeg
              </p>
            </div>

            {/* 3D Carousel */}
            <CarouselUploader
              photos={photos}
              setPhotos={setPhotos}
              disabled={isProcessing}
            />

            {/* Theme + Generate — appear after first photo */}
            {photos.length > 0 && (
              <div className="flex flex-col items-center gap-6 w-full animate-fade-in">
                <ThemeSelector
                  theme={theme}
                  setTheme={setTheme}
                  disabled={isProcessing}
                />

                <button
                  onClick={handleGenerate}
                  disabled={photos.length === 0 || isProcessing}
                  className="
                    px-10 py-3 text-[11px] font-mono tracking-[0.25em] uppercase
                    border border-white text-white bg-black
                    hover:bg-white hover:text-black
                    active:scale-[0.97] active:opacity-80
                    disabled:opacity-30 disabled:cursor-not-allowed
                    transition-all duration-200
                  "
                >
                  Create Film &nbsp;·&nbsp; {photos.length} photo{photos.length !== 1 ? "s" : ""}
                </button>
              </div>
            )}

            {photos.length === 0 && (
              <p className="text-[10px] font-mono text-white/20 tracking-widest text-center">
                Click the + card or drag photos onto the carousel to begin
              </p>
            )}
          </div>
        )}

        {/* ── PROCESSING STATE ─────────────────────────────────────────────── */}
        {isProcessing && (
          <div className="max-w-3xl w-full mx-auto animate-shutter-drop">
            {progress ? (
              <ProgressTracker progress={progress} photos={photos} />
            ) : (
              <div className="flex flex-col items-center gap-4 py-16">
                <div className="w-6 h-6 border border-white/30 border-t-white rounded-full animate-spin" />
                <p className="text-[10px] font-mono text-white/30 tracking-widest">UPLOADING PHOTOS…</p>
              </div>
            )}
          </div>
        )}

        {/* ── RESULT STATE ─────────────────────────────────────────────────── */}
        {finalVideoUrl && !isProcessing && (
          <div className="max-w-3xl w-full mx-auto space-y-6 animate-fade-in">
            <VideoPlayer videoUrl={finalVideoUrl} />
            <VersionHistory
              jobId={jobId}
              currentVideoUrl={finalVideoUrl}
              onSelectVersion={handleSelectVersion}
              onRegenerate={handleRegenerate}
              isRegenerating={isRegenerating}
            />
            <ScriptViewer jobId={jobId} activeVersion={activeVersion} />
          </div>
        )}

        {/* ── ERROR ────────────────────────────────────────────────────────── */}
        {error && (
          <div className="max-w-3xl w-full mx-auto">
            <div className="border border-white/20 rounded-sm px-4 py-3 flex items-center justify-between">
              <span className="text-[11px] font-mono text-white/50">
                <span className="text-white/30">ERR&nbsp;</span>{error}
              </span>
              <button
                onClick={handleReset}
                className="text-[10px] font-mono text-white/30 hover:text-white/70 tracking-widest uppercase ml-6 flex-shrink-0 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/8 flex-shrink-0">
        <div className="max-w-5xl mx-auto px-6 py-4 text-[9px] font-mono text-white/15 tracking-widest flex items-center justify-between">
          <span>GEMINI 3 NYC HACKATHON</span>
          <span>GEMINI 2.5 FLASH · VEO 3.1 · FFMPEG</span>
        </div>
      </footer>

    </div>
  );
}
