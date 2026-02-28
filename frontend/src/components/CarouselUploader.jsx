import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import heic2any from "heic2any";

const MAX_PHOTOS = 10;
const CARD_MAX_H = 260;
const CARD_MAX_W = 300;
const ADD_W = 160;
const ADD_H = 220;

// ── HEIC → JPEG via heic2any ─────────────────────────────────────────────────
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
    const blob = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.88,
    });
    // heic2any may return an array of blobs (for multi-frame) or a single blob
    const resultBlob = Array.isArray(blob) ? blob[0] : blob;
    const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
    return new File([resultBlob], newName, { type: "image/jpeg" });
  } catch (err) {
    console.warn("HEIC conversion failed, trying createImageBitmap fallback:", err);
    // Fallback: try createImageBitmap (works in Safari which supports HEIC natively)
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d").drawImage(bitmap, 0, 0);
      bitmap.close();
      return new Promise((resolve) => {
        canvas.toBlob(
          (b) => resolve(new File([b], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" })),
          "image/jpeg", 0.88
        );
      });
    } catch {
      console.warn("Both HEIC conversions failed — returning original file");
      return file;
    }
  }
}

async function maybeConvertHeic(file) {
  return isHeicFile(file) ? convertHeicToJpeg(file) : file;
}

// ── Stable objectURL map ─────────────────────────────────────────────────────
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

// ── Track natural image dimensions ───────────────────────────────────────────
function useImageDims(urlMap) {
  const [dimMap, setDimMap] = useState(new Map());

  useEffect(() => {
    urlMap.forEach((url) => {
      if (dimMap.has(url)) return;
      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        let w, h;
        if (ratio >= 1) {
          w = Math.min(CARD_MAX_W, Math.round(CARD_MAX_H * ratio));
          h = Math.round(w / ratio);
        } else {
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

// ── 3D Carousel Card ─────────────────────────────────────────────────────────
function PhotoCard({ idx, url, w, h, angle, radius, onRemove, disabled, isAdd, onAdd }) {
  const cosVal = Math.cos((angle * Math.PI) / 180);
  const depthScale   = 0.72 + 0.28 * ((cosVal + 1) / 2);
  const depthOpacity = 0.30 + 0.70 * ((cosVal + 1) / 2);

  const style = {
    width: w,
    height: h,
    marginLeft: -w / 2,
    marginTop: -h / 2,
    transform: `rotateY(${angle}deg) translateZ(${radius}px) scale(${depthScale})`,
    opacity: depthOpacity,
    zIndex: Math.round(depthScale * 100),
  };

  if (isAdd) {
    return (
      <div
        className="carousel-card carousel-card-add flex flex-col items-center justify-center gap-2"
        style={{ ...style, opacity: Math.max(depthOpacity, 0.55) }}
        onClick={onAdd}
      >
        <div className="w-10 h-10 rounded-full border border-dashed border-white/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
        <span className="text-[9px] font-mono text-white/25 tracking-[0.2em] uppercase">Add</span>
      </div>
    );
  }

  return (
    <div className="carousel-card group" style={style}>
      <div className="carousel-card-inner-enter absolute inset-0">
        {url
          ? <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-white/5 shimmer-bg" />
        }
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
        <span className="absolute bottom-2 left-2.5 text-[10px] font-mono text-white/70 tabular-nums leading-none">
          {String(idx + 1).padStart(2, "0")}
        </span>
        {!disabled && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(idx); }}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 backdrop-blur-sm text-white/50 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:text-white hover:bg-black/90"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ── Draggable Reorder Strip ──────────────────────────────────────────────────
function ReorderStrip({ photos, urlMap, onReorder, disabled }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const stripRef = useRef(null);

  const handleDragStart = (e, idx) => {
    if (disabled) return;
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    const ghost = document.createElement("div");
    ghost.style.opacity = "0";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIdx(idx);
  };

  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const reordered = [...photos];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    onReorder(reordered);
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
  };

  // Touch reorder support
  const touchIdx = useRef(null);
  const touchClone = useRef(null);

  const handleTouchStart = (e, idx) => {
    if (disabled) return;
    touchIdx.current = idx;
    const rect = e.currentTarget.getBoundingClientRect();
    const clone = e.currentTarget.cloneNode(true);
    clone.style.cssText = `position:fixed;width:${rect.width}px;height:${rect.height}px;z-index:9999;pointer-events:none;opacity:0.85;transform:scale(1.15);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.6);`;
    document.body.appendChild(clone);
    touchClone.current = clone;
    setDragIdx(idx);
  };

  const handleTouchMove = (e) => {
    if (touchClone.current) {
      const touch = e.touches[0];
      touchClone.current.style.left = touch.clientX - 28 + "px";
      touchClone.current.style.top = touch.clientY - 28 + "px";
      const els = stripRef.current?.querySelectorAll("[data-strip-idx]");
      if (els) {
        els.forEach((el) => {
          const r = el.getBoundingClientRect();
          if (touch.clientX >= r.left && touch.clientX <= r.right && touch.clientY >= r.top && touch.clientY <= r.bottom) {
            setOverIdx(parseInt(el.dataset.stripIdx, 10));
          }
        });
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchClone.current) {
      document.body.removeChild(touchClone.current);
      touchClone.current = null;
    }
    if (touchIdx.current !== null && overIdx !== null && touchIdx.current !== overIdx) {
      const reordered = [...photos];
      const [moved] = reordered.splice(touchIdx.current, 1);
      reordered.splice(overIdx, 0, moved);
      onReorder(reordered);
    }
    touchIdx.current = null;
    setDragIdx(null);
    setOverIdx(null);
  };

  if (photos.length < 2) return null;

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-3 h-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
        <span className="text-[9px] font-mono text-white/20 tracking-[0.2em] uppercase">
          Drag to reorder · clip sequence
        </span>
      </div>
      <div
        ref={stripRef}
        className="flex gap-1.5 p-2 rounded-lg border border-white/[0.06] bg-white/[0.015] overflow-x-auto reorder-strip"
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {photos.map((file, idx) => {
          const url = urlMap.get(file);
          const isDragging = dragIdx === idx;
          const isOver = overIdx === idx && dragIdx !== null && dragIdx !== idx;
          return (
            <div
              key={file.name + file.size + idx}
              data-strip-idx={idx}
              draggable={!disabled}
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, idx)}
              className={`
                relative flex-shrink-0 w-14 h-14 rounded-md overflow-hidden cursor-grab active:cursor-grabbing
                border transition-all duration-200 select-none
                ${isDragging ? "opacity-25 scale-90 border-white/20" : "opacity-100 border-white/[0.08]"}
                ${isOver ? "ring-1 ring-white/40 scale-110 border-white/30" : ""}
                ${!isDragging && !isOver ? "hover:border-white/20 hover:scale-105" : ""}
              `}
            >
              {url && <img src={url} alt="" className="w-full h-full object-cover" draggable={false} />}
              <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-black/70 to-transparent" />
              <span className="absolute bottom-0.5 left-1 text-[7px] font-mono text-white/60 tabular-nums">
                {String(idx + 1).padStart(2, "0")}
              </span>
              {isOver && (
                <div className="absolute inset-0 bg-white/10 flex items-center justify-center">
                  <div className="w-0.5 h-8 bg-white/50 rounded-full" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[8px] font-mono text-white/15 tracking-widest">FIRST</span>
        <div className="flex-1 mx-3 h-px bg-gradient-to-r from-white/8 via-white/[0.03] to-white/8" />
        <span className="text-[8px] font-mono text-white/15 tracking-widest">LAST</span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
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

  const slotCount = photos.length + (photos.length < MAX_PHOTOS ? 1 : 0);
  const angleStep = 360 / slotCount;

  const radius = useMemo(() => {
    let maxW = ADD_W;
    photos.forEach((f) => {
      const url = urlMap.get(f);
      const dim = url ? dimMap.get(url) : null;
      const w = dim ? dim.w : CARD_MAX_H * 0.75;
      if (w > maxW) maxW = w;
    });
    const gap = 24;
    const halfArc = (maxW / 2 + gap / 2);
    const r = halfArc / Math.tan(Math.PI / slotCount);
    return Math.max(r, 180);
  }, [slotCount, photos, urlMap, dimMap]);

  // ── Empty state ─────────────────────────────────────────────────────────
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6 w-full" {...getRootProps()}>
        <input {...getInputProps()} />
        <div
          onClick={open}
          className={`
            w-full max-w-xl border border-dashed rounded-lg
            flex flex-col items-center justify-center gap-5
            py-24 cursor-pointer transition-all duration-300
            group
            ${isDragActive
              ? "border-white/50 bg-white/[0.04] scale-[1.01]"
              : "border-white/12 hover:border-white/30 hover:bg-white/[0.02]"
            }
          `}
        >
          <div className={`transition-transform duration-500 ${isDragActive ? "scale-110 -translate-y-1" : "group-hover:-translate-y-0.5"}`}>
            <svg className="w-12 h-12 text-white/15 group-hover:text-white/25 transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <div className="text-center space-y-2">
            <p className="text-[13px] font-mono text-white/35 tracking-widest uppercase">
              {isDragActive ? "Drop here" : "Drag photos or click to browse"}
            </p>
            <p className="text-[10px] font-mono text-white/15 tracking-wider">
              JPG · PNG · WebP · HEIC · GIF · up to {MAX_PHOTOS} photos
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Carousel + Reorder Strip ────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-4 w-full" {...getRootProps()}>
      <input {...getInputProps()} />

      {isDragActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3 animate-fade-in">
            <div className="w-16 h-16 rounded-full border border-white/20 flex items-center justify-center animate-pulse">
              <svg className="w-7 h-7 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <p className="text-white/50 text-sm font-mono tracking-[0.3em] uppercase">Drop photos</p>
          </div>
        </div>
      )}

      {/* 3D Carousel */}
      <div className="carousel-scene">
        <div className="carousel-ring" style={{ animationPlayState: disabled ? "paused" : "running" }}>
          {photos.map((file, idx) => {
            const url = urlMap.get(file);
            const dim = url ? dimMap.get(url) : null;
            const w = dim ? dim.w : Math.round(CARD_MAX_H * 0.75);
            const h = dim ? dim.h : CARD_MAX_H;
            return (
              <PhotoCard
                key={file.name + file.size}
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

      {/* Reorder Strip */}
      <ReorderStrip
        photos={photos}
        urlMap={urlMap}
        onReorder={setPhotos}
        disabled={disabled}
      />

      {/* Controls */}
      <div className="flex items-center gap-5 text-[10px] font-mono text-white/30 tracking-widest">
        <span className="tabular-nums">{photos.length}/{MAX_PHOTOS}</span>
        <span className="w-px h-3 bg-white/10" />
        <button className="hover:text-white/60 transition-colors uppercase tracking-[0.2em]" onClick={open}>+ Add</button>
        <span className="w-px h-3 bg-white/10" />
        <button className="hover:text-white/60 transition-colors uppercase tracking-[0.2em]" onClick={() => setPhotos([])}>Clear</button>
      </div>
    </div>
  );
}
