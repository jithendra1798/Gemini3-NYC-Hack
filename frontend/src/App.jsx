import React, { useState } from "react";
import PhotoUploader from "./components/PhotoUploader";
import ThemeSelector from "./components/ThemeSelector";
import ProgressTracker from "./components/ProgressTracker";
import VideoPlayer from "./components/VideoPlayer";
import ScriptViewer from "./components/ScriptViewer";
import VersionHistory from "./components/VersionHistory";
import { generateVideo, regenerateVideo, videoUrl } from "./api/client";

export default function App() {
  // ── State ────────────────────────────────────────────────────────────────
  const [photos, setPhotos] = useState([]);
  const [theme, setTheme] = useState("auto");
  const [progress, setProgress] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [activeVersion, setActiveVersion] = useState(null);
  const [error, setError] = useState(null);

  // ── Handlers ─────────────────────────────────────────────────────────────
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
          if (update.video_url) {
            setFinalVideoUrl(update.video_url);
          }
          if (update.script_id) {
            setJobId(update.script_id);
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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800/60">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎬</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
                CineSnap
              </h1>
              <p className="text-xs text-gray-500">AI Photo-to-Cinema Pipeline</p>
            </div>
          </div>
          {(isProcessing || finalVideoUrl) && (
            <button
              onClick={handleReset}
              className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
            >
              ← Start Over
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">

        {/* Hero text — only before processing */}
        {!isProcessing && !finalVideoUrl && (
          <div className="text-center space-y-3 pb-4">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-100">
              Turn your photos into a<br />
              <span className="bg-gradient-to-r from-brand-400 to-pink-400 bg-clip-text text-transparent">
                cinematic experience
              </span>
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              Upload your photos and CineSnap will analyze them, write a cinematic script
              connecting the moments, and generate a short film with AI video and audio.
            </p>
          </div>
        )}

        {/* Upload & Theme (hidden once processing or complete) */}
        {!isProcessing && !finalVideoUrl && (
          <div className="space-y-8">
            <PhotoUploader
              photos={photos}
              setPhotos={setPhotos}
              disabled={isProcessing}
            />

            {photos.length > 0 && (
              <>
                <ThemeSelector
                  theme={theme}
                  setTheme={setTheme}
                  disabled={isProcessing}
                />

                <div className="flex justify-center pt-2">
                  <button
                    onClick={handleGenerate}
                    disabled={photos.length === 0 || isProcessing}
                    className="
                      px-8 py-3.5 rounded-2xl font-semibold text-white
                      bg-gradient-to-r from-brand-600 to-brand-500
                      hover:from-brand-500 hover:to-brand-400
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-all duration-200 transform hover:scale-[1.02]
                      shadow-lg shadow-brand-500/25
                    "
                  >
                    🎬 Create My Film
                    <span className="ml-2 text-sm opacity-70">
                      ({photos.length} photo{photos.length !== 1 ? "s" : ""})
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Progress */}
        {isProcessing && (
          <div className="max-w-2xl mx-auto space-y-6">
            {progress ? (
              <ProgressTracker progress={progress} />
            ) : (
              <div className="flex flex-col items-center gap-4 py-12">
                <div className="w-12 h-12 border-4 border-brand-500/30 border-t-brand-400 rounded-full animate-spin" />
                <p className="text-gray-400 text-sm">Uploading photos…</p>
              </div>
            )}
          </div>
        )}

        {/* Result — Video + Version History + Script */}
        {finalVideoUrl && !isProcessing && (
          <div className="space-y-8">
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

        {/* Error */}
        {error && (
          <div className="max-w-2xl mx-auto p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            <div className="flex items-center justify-between">
              <span><strong>Error:</strong> {error}</span>
              <button
                onClick={handleReset}
                className="ml-4 px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/40 mt-20">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center text-xs text-gray-600">
          Built with Gemini 2.5 Flash · Veo 3.1 · FFmpeg — Gemini 3 NYC Hackathon
        </div>
      </footer>
    </div>
  );
}
