import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";

const MAX_PHOTOS = 10;

export default function PhotoUploader({ photos, setPhotos, disabled }) {
  const onDrop = useCallback(
    (accepted) => {
      const next = [...photos, ...accepted].slice(0, MAX_PHOTOS);
      setPhotos(next);
    },
    [photos, setPhotos]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"] },
    maxFiles: MAX_PHOTOS,
    disabled,
  });

  const removePhoto = (idx) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer
          transition-all duration-300
          ${isDragActive
            ? "border-brand-400 bg-brand-500/10 scale-[1.02]"
            : "border-gray-700 hover:border-gray-500 bg-gray-900/50"
          }
          ${disabled ? "opacity-50 pointer-events-none" : ""}
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-3">
          {/* Camera icon */}
          <svg
            className={`w-12 h-12 ${isDragActive ? "text-brand-400" : "text-gray-500"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
          </svg>

          <div>
            <p className="text-lg font-semibold text-gray-200">
              {isDragActive ? "Drop your photos here" : "Drag & drop your photos"}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              or click to browse · up to {MAX_PHOTOS} photos · JPG, PNG, WebP
            </p>
          </div>
        </div>
      </div>

      {/* Thumbnails */}
      {photos.length > 0 && (
        <div className="grid grid-cols-5 gap-3">
          {photos.map((file, idx) => (
            <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-800">
              <img
                src={URL.createObjectURL(file)}
                alt={`Upload ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              {!disabled && (
                <button
                  onClick={() => removePhoto(idx)}
                  className="
                    absolute top-1.5 right-1.5 w-6 h-6 rounded-full
                    bg-black/70 text-white text-xs flex items-center justify-center
                    opacity-0 group-hover:opacity-100 transition-opacity
                    hover:bg-red-600
                  "
                >
                  ✕
                </button>
              )}
              <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-black/60 px-1.5 py-0.5 rounded-full text-gray-300">
                {idx + 1}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
