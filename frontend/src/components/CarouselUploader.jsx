import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";

const MAX_PHOTOS = 10;
const CARD_MAX_H = 280;   // max card height px — wider than before
const CARD_MAX_W = 320;   // max card width  px
const ADD_W = 180;
const ADD_H = 240;

// ── HEIC → JPEG via canvas ────────────────────────────────────────────────────
function isHeicFile(file) {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif")
  );
}

async function convertHeicToJpeg(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    bitmap.close();
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" })),
        "image/jpeg", 0.88
      );
    });
  } catch {
    return file; // Safari handles HEIC natively in <img>
  }
}

async function maybeConvertHeic(file) {
  return isHeicFile(file) ? convertHeicToJpeg(file) : file;
}

// ── Stable objectURL map, keyed by File instance ─────────────────────────────
function useObjectUrls(files) {
  const [urlMap, setUrlMap] = useState(new Map());

  useEffect(() => {
    setUrlMap((prev) => {
      const next = new Map();
      const stale = new Set(prev.keys());
      files.forEach((f) => {
        next.set(f, prev.has(f) ? prev.get(f) : URL.createObjectURL(f));
        stale.delete(f);
      });
      stale.forEach((f) => URL.revokeObjectURL(prev.get(f)));
      return next;
    });
  }, [files]);

  useEffect(() => () => setUrlMap((prev) => { prev.forEach((u) => URL.revokeObjectURL(u)); return new Map(); }), []);

  return urlMap;
}

// ── Track natural image dimensions for every URL ──────────────────────────────
function useImageDims(urlMap) {
  const [dimMap, setDimMap] = useState(new Map()); // url → {w, h}

  useEffect(() => {
    urlMap.forEach((url) => {
      if (dimMap.has(url)) return;
      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        // Fit inside CARD_MAX_W × CARD_MAX_H preserving aspect ratio
        let w, h;
        if (ratio >= 1) {
          // landscape or square
          w = Math.min(CARD_MAX_W, Math.round(CARD_MAX_H * ratio));
          h = Math.round(w / ratio);
        } else {
          // portrait
          h = CARD_MAX_H;
          w = Math.round(h * ratio);
        }
        setDimMap((prev) => new Map(prev).set(url, { w, h }));
      };
      img.src = url;
    });
  }, [urlMap, dimMap]);

  return dimMap;
}

// ── Single card — no hooks ────────────────────────────────────────────────────
function PhotoCard({ idx, url, w, h, angle, radius, onRemove, disabled, isAdd, onAdd }) {
  const cosVal = Math.cos((angle * Math.PI) / 180);
  const depthScale   = 0.70 + 0.30 * ((cosVal + 1) / 2);  // 0.70 … 1.0
  const depthOpacity = 0.35 + 0.65 * ((cosVal + 1) / 2);  // 0.35 … 1.0

  const style = {
    width:      w,
    height:     h,
    marginLeft: -w / 2,
    marginTop:  -h / 2,
    transform:  `rotateY(${angle}deg) translateZ(${radius}px) scale(${depthScale})`,
    opacity:    depthOpacity,
    zIndex:     Math.round(depthScale * 100),
  };

  if (isAdd) {
    return (
      <div
        className="carousel-card flex flex-col items-center justify-center gap-2 hover:border-white/40 transition-colors"
        style={{ ...style, opacity: Math.max(depthOpacity, 0.55) }}
        onClick={onAdd}
      >
        <svg className="w-8 h-8 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        <span className="text-[10px] font-mono text-white/25 tracking-widest uppercase">Add photo</span>
      </div>
    );
  }

  return (
    <div className="carousel-card group" style={style}>
      {/* Inner wrapper animates independently — outer div's 3D transform is untouched */}
      <div className="carousel-card-inner-enter absolute inset-0">
        {url
          ? <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-white/5 shimmer-bg" />
        }
        <span className="absolute bottom-2 left-2 text-[9px] font-mono bg-black/70 text-white/60 px-1.5 py-0.5 rounded leading-none">
          {String(idx + 1).padStart(2, "0")}
        </span>
        {!disabled && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(idx); }}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/80 text-white/60 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CarouselUploader({ photos, setPhotos, disabled }) {
  const onDrop = useCallback(async (accepted) => {
    const converted = await Promise.all(accepted.map(maybeConvertHeic));
    setPhotos((prev) => [...prev, ...converted].slice(0, MAX_PHOTOS));
  }, [setPhotos]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png":  [".png"],
      "image/webp": [".webp"],
      "image/gif":  [".gif"],
      "image/tiff": [".tiff", ".tif"],
      "image/bmp":  [".bmp"],
      "image/heic": [".heic"],
      "image/heif": [".heif"],
    },
    maxFiles: MAX_PHOTOS,
    disabled,
    noClick: true,
  });

  const removePhoto = (idx) => setPhotos((prev) => prev.filter((_, i) => i !== idx));

  const urlMap = useObjectUrls(photos);
  const dimMap = useImageDims(urlMap);

  // Total slots = photos + 1 add card
  const slotCount = photos.length + (photos.length < MAX_PHOTOS ? 1 : 0);
  const angleStep = 360 / slotCount;

  // Exact polygon radius: places each card so neighbours just touch (+ small gap).
  // Formula: r = (halfCardWidth + gap/2) / tan(π / slotCount)
  const radius = useMemo(() => {
    // Use the max card width in the current set so no card ever overlaps its neighbour
    let maxW = ADD_W;
    photos.forEach((f) => {
      const url = urlMap.get(f);
      const dim = url ? dimMap.get(url) : null;
      const w = dim ? dim.w : CARD_MAX_H * 0.75;
      if (w > maxW) maxW = w;
    });
    const gap = 20; // px gap between adjacent card edges
    const halfArc = (maxW / 2 + gap / 2);
    const r = halfArc / Math.tan(Math.PI / slotCount);
    return Math.max(r, 160); // floor so single-card case doesn't collapse
  }, [slotCount, photos, urlMap, dimMap]);

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6 w-full" {...getRootProps()}>
        <input {...getInputProps()} />
        <div
          onClick={open}
          className={`
            w-full max-w-xl border border-dashed rounded-sm
            flex flex-col items-center justify-center gap-4
            py-24 cursor-pointer transition-all duration-200
            ${isDragActive
              ? "border-white/50 bg-white/5"
              : "border-white/15 hover:border-white/35 hover:bg-white/[0.03]"
            }
          `}
        >
          <svg className="w-10 h-10 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <div className="text-center space-y-1.5">
            <p className="text-[13px] font-mono text-white/40 tracking-widest uppercase">
              {isDragActive ? "Drop here" : "Drag photos or click to browse"}
            </p>
            <p className="text-[10px] font-mono text-white/20 tracking-widest">
              JPG · PNG · WebP · HEIC · GIF · TIFF · up to {MAX_PHOTOS} photos
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Carousel ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-6 w-full" {...getRootProps()}>
      <input {...getInputProps()} />

      {isDragActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 pointer-events-none">
          <p className="text-white text-xl font-mono tracking-[0.3em] uppercase border border-white/20 px-8 py-4">
            Drop photos
          </p>
        </div>
      )}

      <div className="carousel-scene">
        <div className="carousel-ring" style={{ animationPlayState: disabled ? "paused" : "running" }}>

          {photos.map((file, idx) => {
            const url = urlMap.get(file);
            const dim = url ? dimMap.get(url) : null;
            const w = dim ? dim.w : Math.round(CARD_MAX_H * 0.75); // fallback portrait ratio while loading
            const h = dim ? dim.h : CARD_MAX_H;
            return (
              <PhotoCard
                key={file}
                idx={idx}
                url={url}
                w={w}
                h={h}
                angle={angleStep * idx}
                radius={radius}
                onRemove={removePhoto}
                disabled={disabled}
              />
            );
          })}

          {photos.length < MAX_PHOTOS && (
            <PhotoCard
              key="add"
              isAdd
              w={ADD_W}
              h={ADD_H}
              angle={angleStep * photos.length}
              radius={radius}
              onAdd={open}
              disabled={disabled}
            />
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-[10px] font-mono text-white/35 tracking-widest">
        <span>{photos.length} / {MAX_PHOTOS} PHOTOS</span>
        <span className="w-px h-3 bg-white/15" />
        <span className="cursor-pointer hover:text-white/65 transition-colors uppercase" onClick={open}>+ Add</span>
        <span className="w-px h-3 bg-white/15" />
        <span className="cursor-pointer hover:text-white/65 transition-colors uppercase" onClick={() => setPhotos([])}>Clear all</span>
      </div>
    </div>
  );
}
