import React, { useRef } from "react";

export default function VideoPlayer({ videoUrl }) {
  const videoRef = useRef(null);

  if (!videoUrl) return null;

  return (
    <div className="space-y-4">
      <div className="relative rounded-2xl overflow-hidden bg-black shadow-2xl shadow-brand-500/10 ring-1 ring-gray-800">
        {/* Cinematic aspect ratio container */}
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            autoPlay
            className="absolute inset-0 w-full h-full object-contain"
          >
            Your browser does not support video playback.
          </video>
        </div>
      </div>

      {/* Download button */}
      <div className="flex justify-center">
        <a
          href={videoUrl}
          download="cinesnap-film.mp4"
          className="
            inline-flex items-center gap-2 px-6 py-2.5 rounded-xl
            bg-brand-600 hover:bg-brand-500 text-white font-medium
            transition-colors duration-200
          "
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download Film
        </a>
      </div>
    </div>
  );
}
