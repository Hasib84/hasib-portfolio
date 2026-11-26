import { useState } from "react";
import { parseVideo, youtubeThumb } from "../lib/video";

// One video slot in the site's player/card design. Empty link → the designed
// placeholder frame. With a link → a click-to-load facade (fast page, no
// heavy embeds until the visitor actually presses play).
export function VideoSlot({
  url,
  title,
  tag,
  thumbnailUrl,
  frameLabel,
  onPlay,
  tabIndex,
  hideOverlayMeta,
}: {
  url: string;
  title: string;
  tag?: string;
  thumbnailUrl?: string;
  frameLabel: string;
  onPlay?: () => void;
  tabIndex?: number;
  hideOverlayMeta?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const video = parseVideo(url);
  const resolvedThumb =
    thumbnailUrl?.trim() || (video?.kind === "youtube" ? youtubeThumb(video.id) : "");

  if (!video) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden bg-[#101013] p-3 text-center">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background:repeating-linear-gradient(0deg,transparent,transparent_10px,rgba(255,255,255,0.03)_10px,rgba(255,255,255,0.03)_11px)]" />
        <span className="font-mono text-[10px] tracking-[0.2em] text-[#6d675f]">
          {frameLabel}
        </span>
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#3a372f] font-mono text-xs text-[#6d675f]">
          ◌
        </span>
        <span className="text-sm font-semibold text-[#d8d2c6]">{title}</span>
        {tag ? (
          <span className="font-mono text-[10px] tracking-wider text-[#8a8478]">
            {tag} · No link yet
          </span>
        ) : null}
      </div>
    );
  }

  if (playing) {
    if (video.kind === "youtube") {
      return (
        <iframe
          className="h-full w-full border-0"
          src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&playsinline=1`}
          title={title}
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      );
    }
    if (video.kind === "facebook") {
      return (
        <div className="flex h-full w-full flex-col bg-black">
          <iframe
            className="w-full flex-1 border-0"
            src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(video.url)}&show_text=false&autoplay=true`}
            title={title}
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
          <a
            className="block bg-[#101013] px-3 py-2 text-center font-mono text-[11px] tracking-wider text-[#ff8c3a]"
            href={video.url}
            target="_blank"
            rel="noreferrer"
          >
            If the player stays blank — Watch on Facebook ↗
          </a>
        </div>
      );
    }
    return (
      <video
        className="h-full w-full bg-black object-contain"
        src={video.url}
        controls
        autoPlay
        playsInline
      />
    );
  }

  // Facade (before play is pressed)
  return (
    <button
      type="button"
      tabIndex={tabIndex}
      aria-label={`Play video: ${title}`}
      onClick={() => {
        setPlaying(true);
        onPlay?.();
      }}
      className="group relative block h-full w-full cursor-pointer overflow-hidden bg-[#101013] text-left"
    >
      {resolvedThumb ? (
        <img
          src={resolvedThumb}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-85 transition group-hover:opacity-100"
        />
      ) : video.kind === "facebook" ? (
        <span className="absolute inset-0 [background:radial-gradient(120%_110%_at_50%_20%,rgba(24,119,242,0.28)_0%,rgba(255,106,0,0.1)_42%,#0b0c12_85%)]" />
      ) : (
        <span className="absolute inset-0 [background:radial-gradient(120%_120%_at_30%_20%,#1d1a16_0%,#0c0c0e_70%)]" />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />
      <span className="absolute left-3 top-3 font-mono text-[10px] tracking-[0.2em] text-[#ffb27a]">
        {video.kind === "facebook" ? "FACEBOOK VIDEO" : frameLabel}
      </span>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ff6a00] text-xl text-black shadow-[0_0_36px_rgba(255,106,0,0.45)] transition group-hover:scale-110">
          ▶
        </span>
      </span>
      {!hideOverlayMeta ? (
        <span className="absolute inset-x-3 bottom-3">
          <span className="block truncate text-sm font-semibold text-white">
            {title}
          </span>
          {tag ? (
            <span className="block font-mono text-[10px] tracking-wider text-[#c9c2b4]">
              {tag}
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}
