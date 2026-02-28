import React, { useEffect, useState } from "react";
import { fetchProjects, fetchPhotos } from "../api/client";

const API_BASE = process.env.REACT_APP_API_URL || "";

export default function ProjectGallery({ onSelectProject, onClose }) {
  const [projects, setProjects] = useState([]);
  const [thumbnails, setThumbnails] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchProjects()
      .then(async (projs) => {
        setProjects(projs);
        // Load first thumbnail for each project
        const thumbMap = {};
        await Promise.all(
          projs.map(async (p) => {
            try {
              const photos = await fetchPhotos(p.job_id);
              if (photos.length > 0) {
                thumbMap[p.job_id] = {
                  url: `${API_BASE}${photos[0].url}`,
                  count: photos.length,
                };
              }
            } catch {
              // skip
            }
          })
        );
        setThumbnails(thumbMap);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 animate-fade-in">
        <div className="w-5 h-5 border border-white/30 border-t-white rounded-full animate-spin" />
        <p className="text-[10px] font-mono text-white/30 tracking-widest">LOADING PROJECTS…</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 animate-fade-in">
        <p className="text-[11px] font-mono text-white/30 tracking-widest">NO PROJECTS YET</p>
        <button
          onClick={onClose}
          className="text-[10px] font-mono text-white/40 hover:text-white/70 tracking-widest uppercase transition-colors border border-white/10 hover:border-white/30 px-4 py-1.5"
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto animate-fade-in">
      {/* Gallery header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono text-white/30 tracking-widest uppercase">Projects</span>
          <span className="text-[11px] font-mono text-white/40">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[10px] font-mono text-white/30 hover:text-white/70 tracking-widest uppercase transition-colors border border-white/10 hover:border-white/30 px-3 py-1.5"
        >
          ← Back
        </button>
      </div>

      {/* Project cards */}
      <div className="space-y-2">
        {projects.map((proj) => {
          const thumb = thumbnails[proj.job_id];
          const date = new Date(proj.created_at);
          const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
          const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

          return (
            <button
              key={proj.job_id}
              onClick={() => onSelectProject(proj)}
              className="
                w-full text-left border border-white/8 hover:border-white/20
                bg-black hover:bg-white/[0.02]
                transition-all duration-200 group
                flex items-stretch overflow-hidden
              "
            >
              {/* Thumbnail */}
              <div className="w-24 h-24 flex-shrink-0 bg-white/5 overflow-hidden">
                {thumb ? (
                  <img
                    src={thumb.url}
                    alt=""
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-90 transition-opacity duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-[10px] font-mono text-white/15">—</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 px-4 py-3 flex flex-col justify-between min-w-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-white/70 truncate">
                      {proj.latest_title || proj.job_id.slice(0, 8)}
                    </span>
                    <span className={`
                      text-[8px] font-mono tracking-widest uppercase flex-shrink-0
                      ${proj.latest_status === "complete"
                        ? "text-white/40"
                        : proj.latest_status === "error"
                          ? "text-white/25"
                          : "text-white/20"
                      }
                    `}>
                      {proj.latest_status === "complete" ? "✓" : proj.latest_status === "error" ? "✗" : "◌"}
                    </span>
                  </div>
                  <p className="text-[9px] font-mono text-white/20 tracking-wider">
                    {dateStr} {timeStr}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-[9px] font-mono text-white/20 tracking-wider">
                  <span>{proj.num_photos} photo{proj.num_photos !== 1 ? "s" : ""}</span>
                  <span className="text-white/10">·</span>
                  <span>{proj.num_versions} version{proj.num_versions !== 1 ? "s" : ""}</span>
                  <span className="text-white/10">·</span>
                  <span>{proj.theme}</span>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex items-center px-4 flex-shrink-0">
                <span className="text-[10px] font-mono text-white/15 group-hover:text-white/40 transition-colors">
                  →
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
