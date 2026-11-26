import { Fragment, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "./space-sdk-client";
import { api, type ApiResponse } from "./api";
import { VideoSlot } from "./components/VideoSlot";
import { parseVideo } from "./lib/video";
import portraitBundled from "./assets/portrait.png";
import "./public-site.css";
import "./fullscreen-scale.css";

export type Site = ApiResponse<typeof api, "getSite">;
type WorkItem = Site["workItems"][number];
type Photo = Site["photos"][number];
type Stat = { value: string; suffix: string; label: string; detail?: string };
type Social = { label: string; url: string };

function parseList<T>(value: string | undefined, fallback: T[]): T[] {
  if (!value) return fallback;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function renderAccentHeading(text: string, tailWords: number, useSpan = false) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= tailWords) {
    return useSpan ? <span style={{ color: "var(--orange)" }}>{text}</span> : <em>{text}</em>;
  }
  const head = words.slice(0, words.length - tailWords).join(" ");
  const tail = words.slice(words.length - tailWords).join(" ");
  return (
    <>
      {head}{" "}
      {useSpan ? <span style={{ color: "var(--orange)" }}>{tail}</span> : <em>{tail}</em>}
    </>
  );
}

/* ------------------------------- SEO effect ------------------------------ */

function isValidExternalUrl(raw: string): boolean {
  try {
    const normalized = normalizeUrl(raw);
    if (!normalized) return false;
    const u = new URL(normalized);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

function cleanDisplayTitle(raw: string): string {
  return raw
    .replace(/\uFFFD+/g, "")
    .replace(/^\s*\d+(?:\.\d+)?[KkMm]?\s+views\s*·\s*\d+(?:\.\d+)?[KkMm]?\s+reactions\s*\|\s*/i, "")
    .replace(/^\s*\|\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function useSeo(site: Site) {
  useEffect(() => {
    const s = site.settings;
    if (s["seo_title"]) document.title = s["seo_title"];
    const setMeta = (selector: string, attr: string, value: string) => {
      if (!value) return;
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        const [name, val] = attr.split("=");
        if (name && val) el.setAttribute(name, val);
        document.head.appendChild(el);
      }
      el.setAttribute("content", value);
    };
    setMeta('meta[name="description"]', "name=description", s["seo_description"] ?? "");
    setMeta('meta[name="keywords"]', "name=keywords", s["seo_keywords"] ?? "");
    setMeta('meta[property="og:title"]', "property=og:title", s["seo_title"] ?? "");
    setMeta(
      'meta[property="og:description"]',
      "property=og:description",
      s["seo_description"] ?? "",
    );
    setMeta('meta[name="twitter:title"]', "name=twitter:title", s["seo_title"] ?? "");
    setMeta(
      'meta[name="twitter:description"]',
      "name=twitter:description",
      s["seo_description"] ?? "",
    );
    const firstThumb =
      site.workItems.find((w) => w.thumbnailUrl?.trim())?.thumbnailUrl?.trim() ||
      site.photos.find((p) => p.imageUrl?.trim())?.imageUrl?.trim() ||
      "";
    const ogImg = s["og_image_url"]?.trim() || firstThumb;
    if (ogImg) {
      setMeta('meta[property="og:image"]', "property=og:image", ogImg);
      setMeta('meta[name="twitter:image"]', "name=twitter:image", ogImg);
    }
    const base = (s["site_url"] ?? "").replace(/\/+$/, "") || window.location.origin;
    if (base) {
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", `${base}/`);
      setMeta('meta[property="og:url"]', "property=og:url", `${base}/`);
    }

    const socials = parseList<Social>(s["socials"], []);
    const sameAs = [...new Set(socials.map((x) => normalizeUrl(x.url)).filter(isValidExternalUrl))];
    const videos: Array<Record<string, unknown>> = [];
    const addVideo = (title: string, url: string, tag: string, customThumb?: string) => {
      const v = parseVideo(url);
      if (!v) return;
      const entry: Record<string, unknown> = {
        "@type": "VideoObject",
        name: title,
        description: tag || title,
        uploadDate: "2026-01-01",
      };
      if (v.kind === "youtube") {
        entry["embedUrl"] = `https://www.youtube-nocookie.com/embed/${v.id}`;
        entry["thumbnailUrl"] = customThumb?.trim() || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
        entry["contentUrl"] = `https://www.youtube.com/watch?v=${v.id}`;
      } else {
        entry["contentUrl"] = v.url;
        if (customThumb?.trim()) entry["thumbnailUrl"] = customThumb.trim();
      }
      videos.push(entry);
    };
    addVideo("Hasib Mahamud — Showreel", s["showreel_video_url"] ?? "", "Showreel");
    for (const item of site.workItems) addVideo(item.title, item.videoUrl, item.tag, item.thumbnailUrl);

    const graph: Array<Record<string, unknown>> = [
      {
        "@type": "Person",
        name: "Hasib Mahamud",
        jobTitle: s["hero_role"] ?? "Photographer & Video Editor",
        email: s["email"],
        telephone: s["phone_display"],
        address: {
          "@type": "PostalAddress",
          addressLocality: "Mirpur, Dhaka",
          addressCountry: "BD",
        },
        sameAs,
      },
      {
        "@type": "ProfessionalService",
        name: "Hasib Mahamud — Photographer & Video Editor",
        description: s["seo_description"],
        areaServed: "Dhaka, Bangladesh",
        telephone: s["phone_display"],
        email: s["email"],
      },
      ...videos,
    ];
    if (site.faqs.length > 0) {
      graph.push({
        "@type": "FAQPage",
        mainEntity: site.faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      });
    }

    let ld = document.head.querySelector<HTMLScriptElement>('script[data-dynamic-ld="true"]');
    if (!ld) {
      ld = document.createElement("script");
      ld.type = "application/ld+json";
      ld.dataset.dynamicLd = "true";
      document.head.appendChild(ld);
    }
    ld.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
  }, [site]);
}

/* ------------------------------- constants ------------------------------- */

const FILM_FRAMES = [
  { label: "WEDDING_01", hot: false },
  { label: "PRODUCT_02", hot: true },
  { label: "REELS_03", hot: false },
  { label: "PORTRAIT_04", hot: false },
  { label: "FASHION_05", hot: true },
  { label: "EVENT_06", hot: false },
  { label: "CLOTHING_07", hot: false },
  { label: "CINEMA_08", hot: true },
];

const MARQUEE_WORDS = [
  "Product Photography",
  "Wedding Film",
  "Social Media Reels",
  "Cinematography",
  "Color Grading",
  "Photo Editing",
];

const WAVE_HEIGHTS = Array.from({ length: 64 }, (_, i) =>
  18 + Math.round(76 * Math.abs(Math.sin(i * 1.9) * 0.6 + Math.sin(i * 0.47) * 0.4)),
);

const SERVICE_ACCENTS = [
  "acc-orange",
  "acc-violet",
  "acc-teal",
  "acc-amber",
  "acc-blue",
  "acc-rose",
];
const SERVICE_ICONS = ["🎬", "✦", "📷", "🎥", "📱", "🎨"];

const PHOTO_RATIOS = ["pf-45", "pf-11", "pf-32", "pf-45", "pf-32", "pf-11", "pf-32", "pf-45"];
const PHOTO_GRADS = [
  "linear-gradient(150deg,#3a2a00,#8a5a00 135%)",
  "linear-gradient(150deg,#3a1502,#b34a00 135%)",
  "linear-gradient(150deg,#14213d,#3b5bdb 135%)",
  "linear-gradient(150deg,#2b1030,#7d6fd0 135%)",
  "linear-gradient(150deg,#40102a,#c2255c 135%)",
  "linear-gradient(150deg,#06231d,#177a6b 135%)",
  "linear-gradient(150deg,#0f2b1d,#2f9e44 135%)",
  "linear-gradient(150deg,#1f1a14,#7a6248 135%)",
];

const TRACK_INFO = {
  reels: {
    id: "work-reels",
    cls: "t-reels",
    icon: "▮",
    code: "R1",
    name: "Reels",
    ratio: "9:16",
    subLines: ["1080 × 1920", "FB · IG · Shorts"],
    prefix: "reel",
    stageCls: "r916",
    tagBadge: "Reels",
    prevLabel: "Reels: previous videos",
    nextLabel: "Reels: next videos",
    ariaLabel: "Reels track, vertical 9 by 16",
  },
  wide: {
    id: "work-wide",
    cls: "t-wide",
    icon: "▬",
    code: "V1",
    name: "Wide",
    ratio: "16:9",
    subLines: ["1920 × 1080", "YouTube · Facebook"],
    prefix: "wide",
    stageCls: "r169",
    tagBadge: "Wide",
    prevLabel: "Wide: previous videos",
    nextLabel: "Wide: next videos",
    ariaLabel: "Wide track, widescreen 16 by 9",
  },
  square: {
    id: "work-square",
    cls: "t-square",
    icon: "■",
    code: "S1",
    name: "Square",
    ratio: "1:1",
    subLines: ["1080 × 1080", "Feed posts · Ads"],
    prefix: "square",
    stageCls: "r11",
    tagBadge: "Square",
    prevLabel: "Square: previous videos",
    nextLabel: "Square: next videos",
    ariaLabel: "Square track, 1 by 1",
  },
} as const;

function WaveDivider() {
  return (
    <div className="wave-div" aria-hidden="true">
      {WAVE_HEIGHTS.map((h, i) => (
        <i key={i} style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

function ToolBadgeChips({ toolBadges }: { toolBadges: string }) {
  const parts = toolBadges.split("—").map((p) => p.trim());
  const left = parts[0] ?? "";
  const right = parts[1] ?? "";
  const codes = left.split("·").map((c) => c.trim()).filter(Boolean);
  const badgeClass = (code: string) => {
    const low = code.toLowerCase();
    if (low === "pr") return "tbadge tb-pr";
    if (low === "ae") return "tbadge tb-ae";
    if (low === "ps") return "tbadge tb-ps";
    if (low === "lr") return "tbadge tb-lr";
    return "";
  };
  const isOnSet = codes.length === 1 && !badgeClass(codes[0] ?? "");
  return (
    <div className="stack-tools">
      <span className="st-label">{isOnSet ? left : "Tools"}</span>
      {!isOnSet
        ? codes.map((code) => {
            const cls = badgeClass(code);
            return cls ? (
              <span key={code} className={cls}>
                {code}
              </span>
            ) : null;
          })
        : null}
      {right ? (
        <span style={{ fontSize: 13, fontWeight: 700, color: "#d6d3d1" }}>{right}</span>
      ) : !isOnSet && !codes.some((c) => badgeClass(c)) ? (
        <span style={{ fontSize: 13, fontWeight: 700, color: "#d6d3d1" }}>{toolBadges}</span>
      ) : null}
    </div>
  );
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function SocialBrandIcon({ url, label }: { url: string; label: string }) {
  const hint = `${url} ${label}`.toLowerCase();
  if (hint.includes("youtube") || hint.includes("youtu.be")) {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="#ff3b30" aria-hidden="true">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
      </svg>
    );
  }
  if (hint.includes("facebook") || hint.includes("fb.com") || hint.includes("fb.watch")) {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="#1877f2" aria-hidden="true">
        <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.08 24 18.09 24 12.07Z" />
      </svg>
    );
  }
  if (hint.includes("vimeo")) {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="#1ab7ea" aria-hidden="true">
        <path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197a315.065 315.065 0 0 0 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.01Z" />
      </svg>
    );
  }
  if (hint.includes("instagram") || hint.includes("instagr.am")) {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#e4405f" strokeWidth="2" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="#e4405f" stroke="none" />
      </svg>
    );
  }
  if (hint.includes("tiktok")) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#2dd4bf" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.85a8.28 8.28 0 0 0 4.76 1.5V6.9a4.85 4.85 0 0 1-1-.21Z" />
      </svg>
    );
  }
  if (hint.includes("linkedin")) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#0a66c2" aria-hidden="true">
        <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff8c3a" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
    </svg>
  );
}

function ToolChipBadge({ name }: { name: string }) {
  const n = name.toLowerCase();
  if (n.includes("premiere")) return <span className="about-tbadge tb-pr">Pr</span>;
  if (n.includes("after")) return <span className="about-tbadge tb-ae">Ae</span>;
  if (n.includes("lightroom")) return <span className="about-tbadge tb-lr">Lr</span>;
  if (n.includes("photoshop")) return <span className="about-tbadge tb-ps">Ps</span>;
  if (n.includes("davinci") || n.includes("resolve")) return <span className="about-tbadge tb-dv">Dv</span>;
  if (n.includes("edius")) return <span className="about-tbadge tb-ed">Ed</span>;
  if (n.includes("capcut")) return <span className="about-tbadge tb-cc">Cc</span>;
  if (n.includes("office")) return <span className="about-tbadge tb-gen">Of</span>;
  return <span className="about-tbadge tb-gen">✦</span>;
}

/* ------------------------------- Lightbox -------------------------------- */

function PhotoLightbox({
  photos,
  index,
  onClose,
  onNav,
}: {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onNav: (idx: number) => void;
}) {
  const photo = photos[index];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNav((index + 1) % photos.length);
      if (e.key === "ArrowLeft") onNav((index - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onClose, onNav]);

  if (!photo) return null;
  const grad = PHOTO_GRADS[index % PHOTO_GRADS.length] ?? PHOTO_GRADS[0];

  return (
    <div
      className="lightbox"
      id="photoLightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Photography viewer"
    >
      <div className="lb-backdrop" onClick={onClose} />
      <figure className="lb-box">
        <div className="lb-media">
          {photo.imageUrl ? (
            <img
              className="lb-img"
              src={photo.imageUrl}
              alt={`${photo.title} — ${photo.category} photography by Hasib Mahamud`}
            />
          ) : (
            <div className="lb-ph" style={{ background: grad }}>
              <svg
                width="52"
                height="52"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <rect x="3" y="7" width="18" height="13" rx="2" />
                <circle cx="12" cy="13" r="3.5" />
                <path d="M8 7l1.5-2.5h5L16 7" />
              </svg>
              <span className="lb-ph-title">{photo.title}</span>
              <span className="lb-ph-note">Photo slot — upload image from Admin Panel</span>
            </div>
          )}
        </div>
        <figcaption className="lb-cap">
          <span className="lb-cap-main">
            <strong>{photo.title}</strong>
            <span className="lb-cat">{photo.category}</span>
          </span>
          <span className="lb-count">
            {index + 1} / {photos.length}
          </span>
        </figcaption>
        <button
          className="lb-btn lb-close"
          type="button"
          aria-label="Close photo viewer"
          onClick={onClose}
        >
          ✕
        </button>
        <button
          className="lb-btn lb-prev"
          type="button"
          aria-label="Previous photo"
          onClick={() => onNav((index - 1 + photos.length) % photos.length)}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          className="lb-btn lb-next"
          type="button"
          aria-label="Next photo"
          onClick={() => onNav((index + 1) % photos.length)}
        >
          <span aria-hidden="true">›</span>
        </button>
      </figure>
    </div>
  );
}

/* ----------------------------- Work Track Row ---------------------------- */

function WorkLoopTrack({
  trackKey,
  items,
}: {
  trackKey: keyof typeof TRACK_INFO;
  items: WorkItem[];
}) {
  const info = TRACK_INFO[trackKey];
  const [hasPlaying, setHasPlaying] = useState(false);

  if (items.length === 0) return null;

  const renderCard = (item: WorkItem, idx: number, isDup: boolean) => {
    const displayTitle = cleanDisplayTitle(item.title) || item.title;
    return (
    <article
      key={`${item.id}-${isDup ? "dup" : "orig"}-${idx}`}
      className="wclip"
      aria-hidden={isDup || undefined}
      data-loop-dup={isDup ? "true" : undefined}
    >
      <div className="clipmeta">
        <span>
          <span className="cdot" />
          {info.prefix}_{String(idx + 1).padStart(2, "0")}.mp4
        </span>
        <span className="dur">
          {info.ratio === "16:9" ? "16:9 · 1920×1080" : info.ratio}
        </span>
      </div>
      <div className={`vstage ${info.stageCls}`}>
        <VideoSlot
          url={item.videoUrl}
          title={displayTitle}
          tag={item.tag}
          thumbnailUrl={item.thumbnailUrl}
          frameLabel={`${info.code} · ${info.ratio}`}
          onPlay={() => setHasPlaying(true)}
          tabIndex={isDup ? -1 : undefined}
          hideOverlayMeta
        />
      </div>
      <div className="vinfo">
        <h3>{displayTitle}</h3>
        <span className="vtag">{info.tagBadge}</span>
      </div>
    </article>
  );
  };

  return (
    <div className={`wtrack ${info.cls}${hasPlaying ? " has-playing" : ""}`} id={info.id}>
      <div className="wrail" aria-label={info.ariaLabel}>
        <span className="wicon" aria-hidden="true">
          {info.icon}
        </span>
        <span className="wcode">{info.code}</span>
        <span className="wname">{info.name}</span>
        <span className="wratio">{info.ratio}</span>
        <span className="wsub">
          <span>{info.subLines[0]}</span>
          <span className="wdot" aria-hidden="true"> · </span>
          <span>{info.subLines[1]}</span>
          <span className="wdot" aria-hidden="true"> · </span>
          <span>{items.length} clips · loop</span>
        </span>
      </div>
      <div className="wloop-wrap">
        <div className="wclips wloop-viewport">
          <div className="wloop-track">
            {items.map((item, idx) => renderCard(item, idx, false))}
            {items.map((item, idx) => renderCard(item, idx, true))}
          </div>
        </div>
        <button className="wnav wnav-prev" type="button" aria-label={info.prevLabel}>
          <span aria-hidden="true">‹</span>
        </button>
        <button className="wnav wnav-next" type="button" aria-label={info.nextLabel}>
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- Public Site ----------------------------- */

export function PublicSite() {
  const site = useQuery({ queryKey: ["site"], queryFn: () => api.getSite({}) });
  const data = site.data;
  useSeo(data ?? (EMPTY_SITE as Site));

  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const nameWrapRef = useRef<HTMLDivElement>(null);
  const portraitWrapRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);
  const aboutPhRef = useRef<HTMLDivElement>(null);
  const aboutImgRef = useRef<HTMLImageElement>(null);
  const aboutTextRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);

  const [lightbox, setLightbox] = useState<number | null>(null);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);
  const [activeJump, setActiveJump] = useState<string>("work-reels");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [inqService, setInqService] = useState("Social Media Reels");
  const [inqName, setInqName] = useState("");
  const [inqDetails, setInqDetails] = useState("");

  // Exact --vh viewport height tracker
  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    };
    setVh();
    window.addEventListener("resize", setVh);
    window.addEventListener("orientationchange", setVh);
    return () => {
      window.removeEventListener("resize", setVh);
      window.removeEventListener("orientationchange", setVh);
    };
  }, []);

  // Hero timeline scrubber + cursor parallax + portrait scroll-travel FLIP + Services stacking + Work loop drag/step
  useEffect(() => {
    if (!data) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const cleanups: Array<() => void> = [];

    /* 1. Timeline playhead sweep + drag scrub */
    const dhTimeline = timelineRef.current;
    const dhPlayhead = playheadRef.current;
    const dhTc = tcRef.current;
    if (dhTimeline && dhPlayhead && dhTc) {
      const DH_DUR = 7000;
      const DH_TOTAL = 45;
      let dhP = reduced ? 0.55 : 0;
      let dhScrubbing = false;
      let dhResumeAt = 0;
      let dhLast = performance.now();
      let tlRaf = 0;

      const dhPad = (n: number) => (n < 10 ? "0" : "") + n;
      const dhRender = () => {
        dhPlayhead.style.left = `${dhP * 100}%`;
        const t = dhP * DH_TOTAL;
        const s = Math.floor(t);
        const f = Math.floor((t - s) * 24);
        dhTc.textContent = `00:00:${dhPad(s)}:${dhPad(f)}`;
        dhTimeline.setAttribute("aria-valuenow", String(Math.round(dhP * 100)));
      };
      const dhLoop = (now: number) => {
        const dt = now - dhLast;
        dhLast = now;
        if (!dhScrubbing && now >= dhResumeAt) {
          dhP += dt / DH_DUR;
          if (dhP > 1) dhP = 0;
        }
        dhRender();
        tlRaf = requestAnimationFrame(dhLoop);
      };
      dhRender();
      if (!reduced) tlRaf = requestAnimationFrame(dhLoop);

      const dhSetFromEvent = (e: PointerEvent) => {
        const r = dhTimeline.getBoundingClientRect();
        const x = e.clientX - r.left;
        dhP = Math.min(1, Math.max(0, x / r.width));
        dhRender();
      };
      const onDown = (e: PointerEvent) => {
        dhScrubbing = true;
        try {
          dhTimeline.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        dhSetFromEvent(e);
      };
      const onMove = (e: PointerEvent) => {
        if (dhScrubbing) dhSetFromEvent(e);
      };
      const onEnd = () => {
        if (dhScrubbing) {
          dhScrubbing = false;
          dhResumeAt = performance.now() + 2200;
        }
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "ArrowRight") {
          dhP = Math.min(1, dhP + 0.04);
          dhResumeAt = performance.now() + 2200;
          dhRender();
        }
        if (e.key === "ArrowLeft") {
          dhP = Math.max(0, dhP - 0.04);
          dhResumeAt = performance.now() + 2200;
          dhRender();
        }
      };
      dhTimeline.addEventListener("pointerdown", onDown);
      dhTimeline.addEventListener("pointermove", onMove);
      dhTimeline.addEventListener("pointerup", onEnd);
      dhTimeline.addEventListener("pointercancel", onEnd);
      dhTimeline.addEventListener("keydown", onKey);
      cleanups.push(() => {
        cancelAnimationFrame(tlRaf);
        dhTimeline.removeEventListener("pointerdown", onDown);
        dhTimeline.removeEventListener("pointermove", onMove);
        dhTimeline.removeEventListener("pointerup", onEnd);
        dhTimeline.removeEventListener("pointercancel", onEnd);
        dhTimeline.removeEventListener("keydown", onKey);
      });
    }

    /* 2. Hero cursor parallax */
    const heroEl = heroRef.current;
    if (!reduced && finePointer && heroEl) {
      const onMouseMove = (e: MouseEvent) => {
        const nx = (e.clientX / window.innerWidth - 0.5) * 2;
        const ny = (e.clientY / window.innerHeight - 0.5) * 2;
        heroEl.style.setProperty("--mx", nx.toFixed(3));
        heroEl.style.setProperty("--my", ny.toFixed(3));
      };
      heroEl.addEventListener("mousemove", onMouseMove);
      cleanups.push(() => heroEl.removeEventListener("mousemove", onMouseMove));
    }

    /* 3. Scroll photo travel (single portrait glides from Hero to About Me) */
    const rootEl = rootRef.current;
    const heroImg = heroImgRef.current;
    const aboutImg = aboutImgRef.current;
    const heroWrap = portraitWrapRef.current;
    const aboutPh = aboutPhRef.current;
    const aboutText = aboutTextRef.current;
    const giant = nameWrapRef.current;

    if (rootEl && heroImg && aboutImg && heroWrap) {
      type TravelState = {
        hx: number;
        hy: number;
        hw: number;
        hh: number;
        ax: number;
        ay: number;
        aw: number;
        ah: number;
        end: number;
      };
      let TS: TravelState | null = null;
      let wasLanded = false;
      let dp = 0;
      let blurCur = 0;
      let lastDp = 0;
      let loopOn = false;
      let lastFrameTs = 0;
      let travelRaf = 0;

      const painted = (img: HTMLImageElement) => {
        const r = img.getBoundingClientRect();
        const b = {
          x: r.left + (window.scrollX || window.pageXOffset || 0),
          y: r.top + (window.scrollY || window.pageYOffset || 0),
          w: r.width,
          h: r.height,
        };
        const nw = img.naturalWidth || 1227;
        const nh = img.naturalHeight || 1281;
        const f = Math.min(b.w / nw, b.h / nh);
        const w = nw * f;
        const h = nh * f;
        const pos = (window.getComputedStyle(img).objectPosition || "50% 50%").split(/\s+/);
        let px = parseFloat(pos[0] ?? "50") / 100;
        let py = parseFloat(pos[1] ?? "50") / 100;
        if (Number.isNaN(px)) px = 0.5;
        if (Number.isNaN(py)) py = 0.5;
        return { x: b.x + (b.w - w) * px, y: b.y + (b.h - h) * py, w, h };
      };

      const resetWrap = () => {
        heroWrap.classList.remove("is-travelling");
        heroWrap.style.left = "";
        heroWrap.style.top = "";
        heroWrap.style.width = "";
        heroWrap.style.height = "";
        heroWrap.style.transform = "";
        heroWrap.style.visibility = "";
        heroImg.style.filter = "";
        heroWrap.style.removeProperty("--shadowO");
      };

      const disableTravel = () => {
        TS = null;
        wasLanded = false;
        dp = 0;
        blurCur = 0;
        loopOn = false;
        resetWrap();
        rootEl.classList.remove("travel-on", "landed");
        if (giant) {
          giant.style.opacity = "";
          giant.style.transform = "";
          giant.style.letterSpacing = "";
        }
        if (aboutText) {
          aboutText.style.opacity = "";
          aboutText.style.transform = "";
        }
      };

      const targetP = () => {
        if (!TS) return 0;
        const sy = window.scrollY || window.pageYOffset || 0;
        return Math.min(1, Math.max(0, sy / TS.end));
      };

      const renderTravel = () => {
        if (!TS) return;
        const target = targetP();
        if (target >= 1 && dp >= 0.999) {
          if (!wasLanded) {
            wasLanded = true;
            rootEl.classList.add("landed");
            if (aboutPh) {
              aboutPh.classList.remove("land-pulse");
              void aboutPh.offsetWidth;
              aboutPh.classList.add("land-pulse");
            }
          }
          blurCur = 0;
          if (giant) {
            giant.style.opacity = "0.1";
            giant.style.transform = "translateY(-54px)";
            giant.style.letterSpacing = "0.105em";
          }
          if (aboutText) {
            aboutText.style.opacity = "1";
            aboutText.style.transform = "translateY(0px)";
          }
          heroWrap.style.visibility = "hidden";
          heroImg.style.filter = "";
          heroWrap.style.setProperty("--shadowO", "0");
          return;
        }
        if (wasLanded) {
          wasLanded = false;
          rootEl.classList.remove("landed");
          if (aboutPh) aboutPh.classList.remove("land-pulse");
        }
        const sy = window.scrollY || window.pageYOffset || 0;
        const t = dp * dp * (3 - 2 * dp);
        const x = TS.hx + (TS.ax - TS.hx) * t;
        const y = TS.hy + (TS.ay - TS.hy) * t;
        const w = TS.hw + (TS.aw - TS.hw) * t;
        const h = TS.hh + (TS.ah - TS.hh) * t;
        const vel = Math.abs(dp - lastDp);
        lastDp = dp;
        const mid = Math.sin(Math.PI * t);
        let blurT = vel * 300 + (vel > 0.00035 ? mid * 1.3 : 0);
        if (blurT > 5.5) blurT = 5.5;
        if (dp === 0 || dp === 1) blurT = 0;
        blurCur += (blurT - blurCur) * 0.28;
        if (blurCur < 0.05 && blurT === 0) blurCur = 0;

        if (dp <= 0) {
          resetWrap();
        } else {
          heroWrap.classList.add("is-travelling");
          heroWrap.style.left = `${x.toFixed(1)}px`;
          heroWrap.style.top = `${(y - sy).toFixed(1)}px`;
          heroWrap.style.width = `${w.toFixed(1)}px`;
          heroWrap.style.height = `${h.toFixed(1)}px`;
          heroWrap.style.transform = "none";
          heroWrap.style.visibility = "";
          heroImg.style.filter = `blur(${blurCur.toFixed(2)}px) drop-shadow(0 18px 26px rgba(0,0,0,.55))`;
          heroWrap.style.setProperty("--shadowO", (1 - t).toFixed(3));
        }

        if (giant) {
          giant.style.opacity = (1 - 0.9 * t).toFixed(3);
          giant.style.transform = `translateY(${(-54 * t).toFixed(1)}px)`;
          giant.style.letterSpacing = `${(0.02 + 0.085 * t).toFixed(3)}em`;
        }
        if (aboutText) {
          const q = Math.min(1, Math.max(0, (dp - 0.5) / 0.5));
          aboutText.style.opacity = (0.3 + 0.7 * q).toFixed(3);
          aboutText.style.transform = `translateY(${(18 * (1 - q)).toFixed(1)}px)`;
        }
      };

      const measureTravel = () => {
        if (reduced || window.innerWidth < 761) {
          disableTravel();
          return;
        }
        if (
          !heroImg.complete ||
          !aboutImg.complete ||
          !heroImg.naturalWidth ||
          !aboutImg.naturalWidth
        ) {
          return;
        }
        resetWrap();
        rootEl.classList.remove("landed");
        wasLanded = false;
        void heroWrap.offsetWidth;
        const H = painted(heroImg);
        const A = painted(aboutImg);
        if (!H.w || !A.w) {
          disableTravel();
          return;
        }
        const vh = window.innerHeight;
        const targetTop = Math.min(Math.max((vh - A.h) * 0.5, 70), 240);
        const end = A.y - targetTop;
        if (end < 140) {
          disableTravel();
          return;
        }
        TS = { hx: H.x, hy: H.y, hw: H.w, hh: H.h, ax: A.x, ay: A.y, aw: A.w, ah: A.h, end };
        rootEl.classList.add("travel-on");
        dp = targetP();
        lastDp = dp;
        blurCur = 0;
        renderTravel();
      };

      const travelLoop = (ts: number) => {
        if (!TS) {
          loopOn = false;
          return;
        }
        const dt = lastFrameTs ? Math.min(64, ts - lastFrameTs) : 16.7;
        lastFrameTs = ts;
        const target = targetP();
        const k = 1 - Math.exp(-dt / 95);
        dp += (target - dp) * k;
        if (Math.abs(target - dp) < 0.0007) dp = target;
        renderTravel();
        if (dp !== target || blurCur > 0.05) {
          travelRaf = requestAnimationFrame(travelLoop);
        } else {
          loopOn = false;
          lastFrameTs = 0;
          renderTravel();
        }
      };

      const kickTravel = () => {
        if (!loopOn && TS) {
          loopOn = true;
          lastFrameTs = 0;
          travelRaf = requestAnimationFrame(travelLoop);
        }
      };

      let rzT: ReturnType<typeof setTimeout> | null = null;
      const onResize = () => {
        if (rzT) clearTimeout(rzT);
        rzT = setTimeout(measureTravel, 120);
      };
      window.addEventListener("scroll", kickTravel, { passive: true });
      window.addEventListener("resize", onResize);
      heroImg.addEventListener("load", measureTravel);
      aboutImg.addEventListener("load", measureTravel);
      if (document.fonts && document.fonts.ready) {
        void document.fonts.ready.then(measureTravel);
      }
      let bro: ResizeObserver | null = null;
      if ("ResizeObserver" in window) {
        let roT: ReturnType<typeof setTimeout> | null = null;
        bro = new ResizeObserver(() => {
          if (roT) clearTimeout(roT);
          roT = setTimeout(measureTravel, 150);
        });
        bro.observe(document.body);
      }
      measureTravel();
      const t1 = setTimeout(measureTravel, 1500);
      cleanups.push(() => {
        cancelAnimationFrame(travelRaf);
        if (rzT) clearTimeout(rzT);
        clearTimeout(t1);
        window.removeEventListener("scroll", kickTravel);
        window.removeEventListener("resize", onResize);
        heroImg.removeEventListener("load", measureTravel);
        aboutImg.removeEventListener("load", measureTravel);
        bro?.disconnect();
      });
    }

    /* 4. Services stacking cards scroll scale/brightness */
    const stackCards = Array.from(document.querySelectorAll<HTMLElement>("#services .stack-card"));
    if (stackCards.length && !reduced) {
      let ticking = false;
      let stackRaf = 0;
      const updateStack = () => {
        ticking = false;
        if (window.innerWidth <= 760) {
          for (const c of stackCards) {
            c.style.setProperty("--ss", "1");
            c.style.setProperty("--sb", "1");
          }
          return;
        }
        for (let i = 0; i < stackCards.length - 1; i++) {
          const card = stackCards[i];
          const next = stackCards[i + 1];
          if (!card || !next) continue;
          const nr = next.getBoundingClientRect();
          const cardH = card.offsetHeight || 360;
          const stickyTop = 78 + i * 11;
          const dist = nr.top - stickyTop;
          const p = 1 - Math.min(Math.max(dist / cardH, 0), 1);
          card.style.setProperty("--ss", (1 - p * 0.06).toFixed(4));
          card.style.setProperty("--sb", (1 - p * 0.22).toFixed(4));
        }
        const last = stackCards[stackCards.length - 1];
        if (last) {
          last.style.setProperty("--ss", "1");
          last.style.setProperty("--sb", "1");
        }
      };
      const onStackScroll = () => {
        if (!ticking) {
          ticking = true;
          stackRaf = requestAnimationFrame(updateStack);
        }
      };
      window.addEventListener("scroll", onStackScroll, { passive: true });
      window.addEventListener("resize", onStackScroll);
      updateStack();
      cleanups.push(() => {
        cancelAnimationFrame(stackRaf);
        window.removeEventListener("scroll", onStackScroll);
        window.removeEventListener("resize", onStackScroll);
      });
    }

    /* 5. Work & Logo Marquee offscreen pause + Work drag & prev/next buttons */
    const wtracks = Array.from(document.querySelectorAll<HTMLElement>("#work .wtrack"));
    if (wtracks.length && !reduced && "IntersectionObserver" in window) {
      const wio = new IntersectionObserver(
        (es) => {
          es.forEach((e) => e.target.classList.toggle("offscreen", !e.isIntersecting));
        },
        { threshold: 0.02 },
      );
      wtracks.forEach((t) => wio.observe(t));
      cleanups.push(() => wio.disconnect());
    }

    const mq = document.querySelector<HTMLElement>("#story .logo-marquee");
    if (mq && !reduced && "IntersectionObserver" in window) {
      const mio = new IntersectionObserver(
        (es) => {
          es.forEach((e) => mq.classList.toggle("offscreen", !e.isIntersecting));
        },
        { threshold: 0.02 },
      );
      mio.observe(mq);
      cleanups.push(() => mio.disconnect());
    }

    wtracks.forEach((track) => {
      const vp = track.querySelector<HTMLElement>(".wloop-viewport");
      const tr = track.querySelector<HTMLElement>(".wloop-track");
      const prev = track.querySelector<HTMLButtonElement>(".wnav-prev");
      const next = track.querySelector<HTMLButtonElement>(".wnav-next");
      if (!vp || !tr || !prev || !next) return;

      const wide = track.classList.contains("t-wide");
      let pointerDown = false;
      let dragging = false;
      let startX = 0;
      let baseX = 0;
      let moved = 0;
      let suppress = false;
      let stepping = false;
      let stepTimer: ReturnType<typeof setTimeout> | null = null;
      let resumeTimer: ReturnType<typeof setTimeout> | null = null;
      let animDur = 55;

      const curX = () => {
        const m = window.getComputedStyle(tr).transform;
        if (!m || m === "none") return 0;
        const p = m.match(/matrix\(([^)]+)\)/);
        return p?.[1] ? parseFloat(p[1].split(",")[4] ?? "0") || 0 : 0;
      };
      const halfW = () => tr.scrollWidth / 2;
      const wrapX = (x: number) => {
        const w = halfW();
        if (!w) return x;
        let v = x;
        while (v > 0) v -= w;
        while (v <= -w) v += w;
        return v;
      };
      const cancelStep = () => {
        if (stepTimer) {
          clearTimeout(stepTimer);
          stepTimer = null;
        }
        if (stepping) {
          stepping = false;
          track.classList.remove("is-stepping");
          tr.style.transition = "";
        }
      };

      const onPtrDown = (e: PointerEvent) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        if ((e.target as HTMLElement | null)?.closest?.("video, iframe")) return;
        pointerDown = true;
        dragging = false;
        moved = 0;
        startX = e.clientX;
      };
      const onPtrMove = (e: PointerEvent) => {
        if (!pointerDown) return;
        const dx = e.clientX - startX;
        moved = Math.max(moved, Math.abs(dx));
        if (!dragging) {
          if (moved <= 8) return;
          dragging = true;
          cancelStep();
          baseX = curX();
          track.classList.add("is-held");
          tr.style.transform = `translateX(${baseX}px)`;
          track.classList.add("is-dragging");
          try {
            vp.setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
        }
        tr.style.transform = `translateX(${wrapX(baseX + dx)}px)`;
      };
      const endDrag = (e: PointerEvent) => {
        if (!pointerDown) return;
        pointerDown = false;
        if (!dragging) return;
        dragging = false;
        try {
          if (vp.hasPointerCapture(e.pointerId)) vp.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        track.classList.remove("is-held");
        const x = curX();
        const w = halfW();
        const dur = parseFloat(window.getComputedStyle(tr).animationDuration) || 55;
        if (w) {
          let f = wide ? (x + w) / w : -x / w;
          f = Math.min(Math.max(f, 0), 0.999);
          tr.style.animationDelay = `${(-(f * dur)).toFixed(2)}s`;
        }
        suppress = moved > 8;
        tr.style.transform = "";
        void tr.offsetWidth;
        track.classList.remove("is-dragging");
        if (suppress) setTimeout(() => (suppress = false), 80);
      };
      const onClickCapture = (e: MouseEvent) => {
        if (suppress) {
          e.stopPropagation();
          e.preventDefault();
        }
      };

      const handBack = (x: number) => {
        const w = halfW();
        if (w) {
          let f = wide ? (x + w) / w : -x / w;
          f = Math.min(Math.max(f, 0), 0.999);
          tr.style.animationDelay = `${(-(f * animDur)).toFixed(2)}s`;
        }
        tr.style.transition = "";
        tr.style.transform = "";
        void tr.offsetWidth;
        track.classList.remove("is-stepping");
        stepping = false;
      };
      const animateTo = (fromX: number, toX: number, dur: number, done: () => void) => {
        tr.style.transition = "none";
        tr.style.transform = `translateX(${fromX}px)`;
        void tr.offsetWidth;
        tr.style.transition = `transform ${dur}ms cubic-bezier(.3,.7,.3,1)`;
        tr.style.transform = `translateX(${toX}px)`;
        stepTimer = setTimeout(() => {
          stepTimer = null;
          done();
        }, dur + 50);
      };
      const runStep = (fromX: number, delta: number, stepPx: number) => {
        const w = halfW();
        if (!w) {
          handBack(fromX + delta);
          return;
        }
        const target = fromX + delta;
        if (target >= -w && target <= 0) {
          animateTo(
            fromX,
            target,
            Math.max(60, Math.round((450 * Math.abs(delta)) / stepPx)),
            () => handBack(wrapX(target)),
          );
        } else if (target > 0) {
          animateTo(
            fromX,
            0,
            Math.max(60, Math.round((450 * Math.abs(fromX)) / stepPx)),
            () => runStep(-w, delta + fromX, stepPx),
          );
        } else {
          animateTo(
            fromX,
            -w,
            Math.max(60, Math.round((450 * Math.abs(-w - fromX)) / stepPx)),
            () => runStep(0, delta - (-w - fromX), stepPx),
          );
        }
      };
      const step = (dir: -1 | 1) => {
        const card = tr.querySelector<HTMLElement>(".wclip");
        if (!card) return;
        const stepPx =
          card.offsetWidth + (parseFloat(window.getComputedStyle(card).marginRight) || 0);
        if (!stepPx) return;
        if (reduced) {
          vp.scrollBy({ left: dir * stepPx, top: 0, behavior: "auto" });
          return;
        }
        if (track.classList.contains("is-dragging")) return;
        track.classList.add("is-held");
        if (resumeTimer) clearTimeout(resumeTimer);
        resumeTimer = setTimeout(() => track.classList.remove("is-held"), 4000);
        const fromX = curX();
        if (stepping) {
          if (stepTimer) {
            clearTimeout(stepTimer);
            stepTimer = null;
          }
          tr.style.transition = "none";
          tr.style.transform = `translateX(${fromX}px)`;
        } else {
          animDur = parseFloat(window.getComputedStyle(tr).animationDuration) || 55;
          track.classList.add("is-stepping");
          stepping = true;
        }
        runStep(fromX, dir * (wide ? stepPx : -stepPx), stepPx);
      };

      const onPrev = () => step(-1);
      const onNext = () => step(1);

      if (!reduced) {
        vp.addEventListener("pointerdown", onPtrDown);
        vp.addEventListener("pointermove", onPtrMove);
        vp.addEventListener("pointerup", endDrag);
        vp.addEventListener("pointercancel", endDrag);
        vp.addEventListener("click", onClickCapture, true);
      }
      prev.addEventListener("click", onPrev);
      next.addEventListener("click", onNext);

      cleanups.push(() => {
        if (stepTimer) clearTimeout(stepTimer);
        if (resumeTimer) clearTimeout(resumeTimer);
        vp.removeEventListener("pointerdown", onPtrDown);
        vp.removeEventListener("pointermove", onPtrMove);
        vp.removeEventListener("pointerup", endDrag);
        vp.removeEventListener("pointercancel", endDrag);
        vp.removeEventListener("click", onClickCapture, true);
        prev.removeEventListener("click", onPrev);
        next.removeEventListener("click", onNext);
      });
    });

    /* 6. Scroll reveal (.reveal -> .in) */
    const revealEls = Array.from(document.querySelectorAll<HTMLElement>(".public-site .reveal"));
    if (reduced || !("IntersectionObserver" in window)) {
      revealEls.forEach((el) => el.classList.add("in"));
    } else {
      const rio = new IntersectionObserver(
        (es) => {
          es.forEach((e) => {
            if (e.isIntersecting) {
              const target = e.target as HTMLElement;
              const sibs = target.parentElement ? Array.from(target.parentElement.children) : [];
              target.style.transitionDelay = `${Math.min(Math.max(sibs.indexOf(target), 0), 4) * 70}ms`;
              target.classList.add("in");
              rio.unobserve(target);
            }
          });
        },
        { threshold: 0.01, rootMargin: "0px 0px 120px 0px" },
      );
      revealEls.forEach((el) => rio.observe(el));
      const revealVisible = () => {
        revealEls.forEach((el) => {
          if (el.classList.contains("in")) return;
          const r = el.getBoundingClientRect();
          if (r.top < window.innerHeight * 1.15 && r.bottom > -120) {
            el.classList.add("in");
          }
        });
      };
      const revealFallback = setTimeout(revealVisible, 350);
      window.addEventListener("scroll", revealVisible, { passive: true });
      cleanups.push(() => {
        clearTimeout(revealFallback);
        window.removeEventListener("scroll", revealVisible);
        rio.disconnect();
      });
    }

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [data]);

  if (site.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060606]">
        <p className="font-mono text-xs tracking-[0.3em] text-[#a8a29e]">LOADING TIMELINE…</p>
      </div>
    );
  }
  if (site.error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#060606] px-6 text-center text-[#f5f2ee]">
        <p>The portfolio could not load right now.</p>
        <button
          type="button"
          onClick={() => site.refetch()}
          className="rounded-lg bg-[#ff6a00] px-5 py-2.5 font-mono text-xs font-semibold tracking-widest text-black"
        >
          TRY AGAIN
        </button>
      </div>
    );
  }

  const s = data.settings;
  const heroStats = parseList<Stat>(s["hero_stats"], []);
  const socials = parseList<Social>(s["socials"], []);
  const tools = parseList<string>(s["about_tools"], []);
  const whatsapp = `https://wa.me/${(s["whatsapp_number"] ?? "").replace(/\D/g, "")}`;
  const portraitSrc = s["portrait_url"]?.trim() ? s["portrait_url"] : portraitBundled;

  const reels = data.workItems.filter((i) => i.track === "reels");
  const wide = data.workItems.filter((i) => i.track === "wide");
  const square = data.workItems.filter((i) => i.track === "square");
  const totalVideos = reels.length + wide.length + square.length;

  const youtubeSocial = socials.find((x) => x.label.toLowerCase().includes("youtube"));
  const vimeoSocial = socials.find((x) => x.label.toLowerCase().includes("vimeo"));
  const facebookSocial =
    socials.find((x) => x.url.toLowerCase().includes("hasibmahamud")) ??
    socials.find(
      (x) =>
        x.url.toLowerCase().includes("facebook.com") ||
        x.label.toLowerCase().includes("facebook"),
    );
  const aboutFacebookUrl = s["about_facebook_url"]?.trim()
    ? normalizeUrl(s["about_facebook_url"])
    : facebookSocial
      ? normalizeUrl(facebookSocial.url)
      : "";

  const heroGreeting = s["hero_greeting"] || "hi, i'm";
  const heroRole = s["hero_role"] || "Photographer & Video Editor";
  const heroLocation = s["hero_location"] || "Mirpur, Dhaka";
  const heroTagline = s["hero_tagline"] || "";
  const heroEst = s["hero_est"] || "EST. 2018 — CHITROBORON — DHAKA, BD";

  return (
    <div ref={rootRef} className={`public-site${lightbox !== null ? " lb-open" : ""}`}>
      <SafeAreaTopScrim backgroundColor="#0a0908" />

      {/* ================= HERO: Name Split Stage + Premiere Timeline Dock ================= */}
      <div ref={heroRef} className="first-screen dh-hero" id="top">
        <div className="dh-topbar">
          <a className="dh-logo" href="#top">
            <span className="dh-dot" />
            HASIB <b>MAHAMUD</b>
          </a>
          <nav className="dh-nav" aria-label="Main navigation">
            <a href="#about">About</a>
            <a href="#work">Work</a>
            <a href="#services">Services</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="dh-topbar-actions">
            <a className="dh-btn dh-btn-orange" href={whatsapp} target="_blank" rel="noopener noreferrer">
              Hire Me
            </a>
            <button
              type="button"
              className="dh-menu-btn"
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileNavOpen((v) => !v)}
            >
              {mobileNavOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
        {mobileNavOpen ? (
          <nav className="dh-mobile-nav" aria-label="Mobile navigation">
            <a href="#about" onClick={() => setMobileNavOpen(false)}>About</a>
            <a href="#showreel" onClick={() => setMobileNavOpen(false)}>Showreel</a>
            <a href="#work" onClick={() => setMobileNavOpen(false)}>Work</a>
            <a href="#services" onClick={() => setMobileNavOpen(false)}>Services</a>
            <a href="#faq" onClick={() => setMobileNavOpen(false)}>FAQ</a>
            <a href="#contact" onClick={() => setMobileNavOpen(false)}>Contact</a>
          </nav>
        ) : null}

        <div className="dh-stage" id="dhStage">
          {/* diagonal film strip */}
          <div className="dh-filmstrip" aria-hidden="true">
            <div className="dh-film-track">
              {[...FILM_FRAMES, ...FILM_FRAMES].map((frame, i) => (
                <div key={i} className={`dh-frame${frame.hot ? " dh-hot" : ""}`}>
                  {frame.label}
                </div>
              ))}
            </div>
          </div>

          {/* BACK name + sheen layer */}
          <div ref={nameWrapRef} className="dh-name-wrap" id="dhName">
            <div className="dh-name-back">
              <div className="dh-name-stack">
                <span className="dh-hi">{heroGreeting}</span>
                <h1 style={{ margin: 0, font: "inherit" }} aria-label="Hasib Mahamud — Portfolio">
                  <span className="dh-word dh-w-hasib">
                    {"HASIB".split("").map((ch, i) => (
                      <span
                        key={i}
                        className="dh-ch"
                        style={{
                          ["--d" as string]: `${(0.12 + i * 0.08).toFixed(2)}s`,
                          ["--wd" as string]: `${(i * 0.18).toFixed(2)}s`,
                        }}
                      >
                        {ch}
                      </span>
                    ))}
                  </span>
                  <span className="dh-word dh-w-mahamud">
                    {"MAHAMUD".split("").map((ch, i) => (
                      <span
                        key={i}
                        className="dh-ch"
                        style={{
                          ["--d" as string]: `${(0.56 + i * 0.075).toFixed(2)}s`,
                          ["--wd" as string]: `${(0.35 + i * 0.16).toFixed(2)}s`,
                        }}
                      >
                        {ch}
                      </span>
                    ))}
                  </span>
                </h1>
              </div>
            </div>
            <div className="dh-name-sheen" aria-hidden="true">
              <div className="dh-name-stack">
                <span className="dh-word dh-w-hasib">
                  {"HASIB".split("").map((ch, i) => (
                    <span
                      key={i}
                      className="dh-ch"
                      style={{
                        ["--d" as string]: `${(0.12 + i * 0.08).toFixed(2)}s`,
                        ["--wd" as string]: `${(i * 0.18).toFixed(2)}s`,
                        ["--sd" as string]: `${(i * 0.09).toFixed(2)}s`,
                      }}
                    >
                      {ch}
                    </span>
                  ))}
                </span>
                <span className="dh-word dh-w-mahamud">
                  {"MAHAMUD".split("").map((ch, i) => (
                    <span
                      key={i}
                      className="dh-ch"
                      style={{
                        ["--d" as string]: `${(0.56 + i * 0.075).toFixed(2)}s`,
                        ["--wd" as string]: `${(0.35 + i * 0.16).toFixed(2)}s`,
                        ["--sd" as string]: `${(0.45 + i * 0.09).toFixed(2)}s`,
                      }}
                    >
                      {ch}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          </div>

          {/* portrait */}
          <div ref={portraitWrapRef} className="dh-portrait-wrap">
            <img
              ref={heroImgRef}
              id="portrait"
              src={portraitSrc}
              alt="Hasib Mahamud — photographer and video editor in Mirpur, Dhaka"
              width={1227}
              height={1281}
            />
          </div>

          {/* floating Adobe badges */}
          <div className="dh-badges" aria-hidden="true">
            <div className="dh-badge dh-b-pr">
              Pr<small>Premiere Pro</small>
            </div>
            <div className="dh-badge dh-b-ae">
              Ae<small>After Effects</small>
            </div>
            <div className="dh-badge dh-b-ps">
              Ps<small>Photoshop</small>
            </div>
            <div className="dh-badge dh-b-lr">
              Lr<small>Lightroom</small>
            </div>
          </div>

          <div className="dh-vmark" aria-hidden="true">
            {heroEst.includes("CHITROBORON") ? (
              <>
                {heroEst.split("CHITROBORON")[0]}
                <b>CHITROBORON</b>
                {heroEst.split("CHITROBORON")[1]}
              </>
            ) : (
              heroEst
            )}
          </div>
        </div>

        {/* left info panel */}
        <div className="dh-side" id="dhSide">
          <h2 className="dh-role">
            {heroRole.includes("&") ? (
              <>
                {heroRole.split("&")[0]}&amp;
                <br />
                <em>{heroRole.split("&").slice(1).join("&").trim()}</em> —
                <br />
                {heroLocation}
              </>
            ) : (
              <>
                {heroRole} —<br />
                <em>{heroLocation}</em>
              </>
            )}
          </h2>
          <p>{heroTagline}</p>
          <div className="dh-cta">
            <a className="dh-btn dh-btn-orange" href={whatsapp} target="_blank" rel="noopener noreferrer">
              Hire Me
            </a>
            <a className="dh-btn dh-btn-ghost" href="#showreel">
              <span className="dh-tri">▶</span> Watch Showreel
            </a>
          </div>
        </div>

        {/* bottom dock: stats + interactive scrubbable timeline */}
        <div className="dh-dock">
          <div className="dh-stats">
            {heroStats.map((st) => {
              const parts = st.label.split(" ");
              const first = parts[0] ?? "";
              const rest = parts.slice(1).join(" ");
              return (
                <div key={st.label} className="dh-stat">
                  <span className="dh-num">
                    {st.value}
                    {st.suffix ? <i>{st.suffix}</i> : null}
                  </span>
                  <span className="dh-lbl">
                    <b>{first}</b>
                    {rest ? (
                      <>
                        <br />
                        {rest}
                      </>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            ref={timelineRef}
            className="dh-timeline"
            id="dhTimeline"
            role="slider"
            aria-label="Playhead scrubber — drag to scrub"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={0}
            tabIndex={0}
          >
            <div className="dh-ruler" aria-hidden="true">
              <span style={{ left: "0%" }}>00:00</span>
              <span style={{ left: "25%" }}>00:11</span>
              <span style={{ left: "50%" }}>00:22</span>
              <span style={{ left: "73%" }}>00:33</span>
              <span ref={tcRef} className="dh-tc" id="dhTc">
                00:00:00:00
              </span>
            </div>
            <div className="dh-track">
              <span className="dh-tlabel">V1</span>
              <div className="dh-clips">
                <div className="dh-clip dh-c1">Intro_01.mp4</div>
                <div className="dh-clip dh-c2">Wedding_Film.mp4</div>
                <div className="dh-clip dh-c3">Product_Reel.mp4</div>
                <div className="dh-clip dh-c4">Brand_Film.mp4</div>
                <div className="dh-clip dh-c5">Showreel_Out.mp4</div>
              </div>
            </div>
            <div className="dh-track dh-audio">
              <span className="dh-tlabel">A1</span>
              <div className="dh-clips">
                <div className="dh-wave dh-w1" />
                <div className="dh-wave dh-w2" />
                <div className="dh-wave dh-w3" />
              </div>
            </div>
            <div ref={playheadRef} className="dh-playhead" id="dhPlayhead" />
            <span className="dh-scrub-hint">Drag to scrub</span>
          </div>
        </div>
      </div>

      {/* ================= 00:01 ABOUT ================= */}
      <WaveDivider />
      <section className="blk alt" id="about">
        <div className="wrap">
          <div className="about">
            <div ref={aboutPhRef} className="ph" id="aboutPh">
              <img
                ref={aboutImgRef}
                id="aboutPortrait"
                src={portraitSrc}
                alt="Portrait of Hasib Mahamud in a navy suit"
                width={1227}
                height={1281}
              />
              <div className="cap">
                <strong>Hasib Mahamud</strong>
                <span>
                  {heroLocation} • {heroRole} • 6+ Years
                </span>
              </div>
            </div>
            <div ref={aboutTextRef} id="aboutText">
              <div className="marker">
                <span className="tc">00:01</span>
                <span className="mdot" />
                <span className="mline" />
                <p className="kick">About Me</p>
              </div>
              <h2 className="sec display">
                {renderAccentHeading(s["about_heading"] ?? "A Strong Eye For Detail & Story", 3)}
              </h2>
              {(s["about_bio"] ?? "").split(/\n\s*\n/).map((para, i) => (
                <p key={i} className="body">
                  {para}
                </p>
              ))}
              <h3 style={{ margin: "20px 0 4px", fontSize: 16 }}>Tools I Work In</h3>
              <div className="tools">
                {tools.map((tool) => (
                  <div key={tool} className="tool-pill">
                    <ToolChipBadge name={tool} />
                    {tool}
                  </div>
                ))}
              </div>
              <div className="about-ctas" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a className="btn btn-o" href="#contact">
                  Work With Me
                </a>
                {aboutFacebookUrl ? (
                  <a
                    className="btn btn-g"
                    href={aboutFacebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <SocialBrandIcon url={aboutFacebookUrl} label="Facebook" />
                    Facebook ↗
                  </a>
                ) : null}
                {youtubeSocial ? (
                  <a
                    className="btn btn-g"
                    href={normalizeUrl(youtubeSocial.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <SocialBrandIcon url={youtubeSocial.url} label={youtubeSocial.label} />
                    YouTube ↗
                  </a>
                ) : null}
                {vimeoSocial ? (
                  <a
                    className="btn btn-g"
                    href={normalizeUrl(vimeoSocial.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <SocialBrandIcon url={vimeoSocial.url} label={vimeoSocial.label} />
                    Vimeo Portfolio ↗
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= MARQUEE ================= */}
      <div className="marquee" aria-hidden="true">
        <div className="mtrack">
          {[...MARQUEE_WORDS, ...MARQUEE_WORDS].map((w, i) => (
            <span key={i}>
              {w} <b>✦</b>
            </span>
          ))}
        </div>
      </div>

      {/* ================= 00:02 SHOWREEL + STATS ================= */}
      <WaveDivider />
      <section className="blk" id="showreel">
        <div className="wrap" style={{ textAlign: "center" }}>
          <div className="marker" style={{ justifyContent: "center" }}>
            <span className="tc">00:02</span>
            <span className="mdot" />
            <span className="mline" />
            <p className="kick">Showreel</p>
          </div>
          <h2 className="display showreel-title">
            {renderAccentHeading(s["showreel_heading"] ?? "Watch First. Hire Second.", 2, true)}
          </h2>
          <p className="secsub" style={{ margin: "0 auto" }}>
            {s["showreel_text"]}
          </p>

          <div className="monitor">
            <div className="monitorbar">
              <span>
                <span className="rec">●</span> PROGRAM MONITOR — Premiere Pro
              </span>
              <span>1920 × 1080 · 16:9</span>
              <span className="mtc">TC 00:00:00:00</span>
            </div>
            <div className="reel-stage" id="reelStage">
              <VideoSlot
                url={s["showreel_video_url"] ?? ""}
                title="Hasib Mahamud — Showreel"
                tag="Product · Wedding · Reels — Premiere Pro"
                frameLabel="SHOWREEL — 1920 × 1080"
              />
            </div>
            <div className="reel-meta">
              <span>
                <strong>Hasib Mahamud — Showreel</strong>{" "}
                <span className="rmeta-note">· plays here in 16:9</span>
              </span>
              <span className="reel-links">
                {youtubeSocial ? (
                  <a href={youtubeSocial.url} target="_blank" rel="noopener noreferrer">
                    {youtubeSocial.label} ↗
                  </a>
                ) : null}
                {vimeoSocial ? (
                  <a href={vimeoSocial.url} target="_blank" rel="noopener noreferrer">
                    Vimeo ↗
                  </a>
                ) : null}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 00:03 JOURNEY ================= */}
      <WaveDivider />
      <section className="blk alt" id="story">
        <div className="wrap">
          <div className="marker">
            <span className="tc">00:03</span>
            <span className="mdot" />
            <span className="mline" />
            <p className="kick">My Journey</p>
          </div>
          <h2 className="sec display journey-title">
            {renderAccentHeading(s["journey_heading"] ?? "The Story Behind My Journey", 1)}
          </h2>
          <p className="secsub">{s["journey_intro"]}</p>

          <div className="jtrack reveal">
            <div className="jruler" aria-hidden="true">
              <span>2016</span>
              <span>2018</span>
              <span>2020</span>
              <span>2022</span>
              <span>2024</span>
              <span>NOW</span>
            </div>
            <div className="tl">
              {data.journey.map((j) => (
                <div key={j.id} className="tlrow reveal">
                  <div className="yr">
                    {j.period}
                    <small>{j.clipLabel}</small>
                  </div>
                  <div>
                    <h3>
                      {j.role} — {j.org}
                    </h3>
                    <p>{j.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-feature reveal">
            <p className="pt-feature-kick">Freelance Work</p>
            <h3 className="pt-feature-title display">
              {renderAccentHeading(s["freelance_heading"] ?? "Part-Time & Freelance", 1)}
            </h3>
            <p className="pt-feature-sub">Alongside my main role at Swapon's World &amp; Stone Rose</p>
            <p className="pt-feature-copy">{s["freelance_text"]}</p>
            <div className="pt-chips">
              <span className="pt-chip">
                <strong>{data.partners.length}</strong> Brand Pages
              </span>
              <span className="pt-chip">Photo · Reels · Editing</span>
              <span className="pt-chip">
                <span className="pt-dot pt-dot-run" aria-hidden="true" />
                Running + <span className="pt-dot pt-dot-past" aria-hidden="true" />
                Past Clients
              </span>
            </div>
          </div>

          {data.partners.length > 0 ? (
            <div className="also reveal">
              <p className="also-head">Also Worked With</p>
              <div className="logo-marquee" aria-label="Pages worked with part-time — logo wall">
                <div className="logo-marquee-track">
                  {[false, true].map((isDup, copyIdx) => (
                    <Fragment key={copyIdx}>
                      {data.partners.map((p) => {
                        const href = p.pageUrl?.trim() && isValidExternalUrl(p.pageUrl) ? normalizeUrl(p.pageUrl) : "";
                        const cls = `logo-tile ${p.status === "running" ? "is-running" : "is-past"}${href ? " is-linked" : ""}`;
                        const inner = (
                          <>
                            <span className="sdot" aria-hidden="true" />
                            <span className="logo-card-body">
                              {p.logoUrl ? (
                                <img
                                  className="logo-img"
                                  src={p.logoUrl}
                                  alt={isDup ? "" : `${p.name} logo`}
                                />
                              ) : (
                                <span className="logo-fallback-ic" aria-hidden="true">
                                  <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                  >
                                    <rect x="3" y="7" width="18" height="13" rx="2" />
                                    <circle cx="12" cy="13" r="3.5" />
                                    <path d="M8 7l1.5-2.5h5L16 7" />
                                  </svg>
                                </span>
                              )}
                              <span className="logo-meta">
                                <span className="logo-name">{p.name}</span>
                                <span className="tile-status">
                                  {p.status === "running" ? "Running" : "Past"}
                                  {href ? " · Visit ↗" : ""}
                                </span>
                              </span>
                            </span>
                          </>
                        );
                        return href ? (
                          <a
                            key={`${p.id}-${copyIdx}`}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cls}
                            tabIndex={isDup ? -1 : undefined}
                            aria-hidden={isDup || undefined}
                            aria-label={isDup ? undefined : `${p.name} — open page`}
                          >
                            {inner}
                          </a>
                        ) : (
                          <div
                            key={`${p.id}-${copyIdx}`}
                            className={cls}
                            aria-hidden={isDup || undefined}
                          >
                            {inner}
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ================= 00:04 SELECTED WORK ================= */}
      <div className="ruler-div" aria-hidden="true" />
      <section className="blk" id="work">
        <div className="wrap">
          <div className="whead">
            <div className="whead-l">
              <div className="marker">
                <span className="tc">00:04</span>
                <span className="mdot" />
                <span className="mline" />
                <p className="kick">Selected Work</p>
              </div>
              <h2 className="sec display">
                {renderAccentHeading(s["work_heading"] ?? "Work That Speaks", 1)}
              </h2>
            </div>
            <div className="whead-r">
              <p className="wnote">
                <strong>
                  {totalVideos} videos + {data.photos.length} photos
                </strong>{" "}
                · 4 groups · every piece opens right here
              </p>
              <nav className="jumpbar" aria-label="Jump to a work group">
                <a
                  className={`jbtn${activeJump === "work-reels" ? " on" : ""}`}
                  href="#work-reels"
                  onClick={() => setActiveJump("work-reels")}
                >
                  ▮ Reels · 9:16
                </a>
                <a
                  className={`jbtn${activeJump === "work-wide" ? " on" : ""}`}
                  href="#work-wide"
                  onClick={() => setActiveJump("work-wide")}
                >
                  ▬ Wide · 16:9
                </a>
                <a
                  className={`jbtn${activeJump === "work-square" ? " on" : ""}`}
                  href="#work-square"
                  onClick={() => setActiveJump("work-square")}
                >
                  ■ Square · 1:1
                </a>
                <a
                  className={`jbtn${activeJump === "work-photos" ? " on" : ""}`}
                  href="#work-photos"
                  onClick={() => setActiveJump("work-photos")}
                >
                  ▣ Photos · Stills
                </a>
              </nav>
            </div>
          </div>

          <div className="wtracks">
            <WorkLoopTrack trackKey="reels" items={reels} />
            <WorkLoopTrack trackKey="wide" items={wide} />
            <WorkLoopTrack trackKey="square" items={square} />

            {/* Photography Film Strip */}
            {data.photos.length > 0 ? (
              <div className="wtrack t-photo" id="work-photos">
                <div className="wrail" aria-label="Photography track, still photos">
                  <span className="wicon" aria-hidden="true">
                    ▣
                  </span>
                  <span className="wcode">P1</span>
                  <span className="wname">Photography</span>
                  <span className="wratio">Stills</span>
                  <span className="wsub">
                    Weddings · Products
                    <br />
                    Portraits · Events
                    <br />
                    {data.photos.length} photos · loop
                  </span>
                </div>
                <div className="filmstrip">
                  <div className="sprockets" aria-hidden="true" />
                  <div className="wloop-wrap">
                    <div className="wclips wloop-viewport">
                      <div className="wloop-track">
                        {[false, true].map((isDup, copyIdx) => (
                          <Fragment key={copyIdx}>
                            {data.photos.map((photo, idx) => {
                              const pf = PHOTO_RATIOS[idx % PHOTO_RATIOS.length] ?? "pf-32";
                              const grad = PHOTO_GRADS[idx % PHOTO_GRADS.length] ?? PHOTO_GRADS[0];
                              return (
                                <figure
                                  key={`${photo.id}-${copyIdx}`}
                                  className={`wclip pframe ${pf}`}
                                  data-idx={idx}
                                  role={isDup ? undefined : "button"}
                                  tabIndex={isDup ? undefined : 0}
                                  aria-hidden={isDup || undefined}
                                  data-loop-dup={isDup ? "true" : undefined}
                                  aria-label={
                                    isDup
                                      ? undefined
                                      : `${photo.title} — ${photo.category} photography, open in viewer`
                                  }
                                  onClick={() => setLightbox(idx)}
                                  onKeyDown={(e) => {
                                    if (!isDup && (e.key === "Enter" || e.key === " ")) {
                                      e.preventDefault();
                                      setLightbox(idx);
                                    }
                                  }}
                                >
                                  <div className="pimg">
                                    {photo.imageUrl ? (
                                      <img
                                        className="pslot"
                                        src={photo.imageUrl}
                                        referrerPolicy="no-referrer"
                                        alt={
                                          isDup
                                            ? ""
                                            : `${photo.title} — ${photo.category} photography by Hasib Mahamud`
                                        }
                                        onLoad={(e) => {
                                          const img = e.currentTarget;
                                          if (
                                            img.naturalWidth &&
                                            img.naturalHeight &&
                                            img.parentElement
                                          ) {
                                            const ratio = Math.min(
                                              1.65,
                                              Math.max(0.68, img.naturalWidth / img.naturalHeight),
                                            );
                                            img.parentElement.style.aspectRatio = ratio.toFixed(3);
                                          }
                                        }}
                                        tabIndex={isDup ? -1 : undefined}
                                      />
                                    ) : (
                                      <div className="pph" style={{ background: grad }}>
                                        <svg
                                          width="34"
                                          height="34"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.6"
                                          aria-hidden="true"
                                        >
                                          <rect x="3" y="7" width="18" height="13" rx="2" />
                                          <circle cx="12" cy="13" r="3.5" />
                                          <path d="M8 7l1.5-2.5h5L16 7" />
                                        </svg>
                                        <span className="pcat">{photo.category}</span>
                                        <span className="pslot-note">Photo slot</span>
                                      </div>
                                    )}
                                    <span className="pnum">
                                      IMG_{String(idx + 1).padStart(2, "0")}
                                    </span>
                                  </div>
                                  <figcaption className="pinfo">
                                    <h3>{photo.title}</h3>
                                    <span className="ptag">{photo.category}</span>
                                  </figcaption>
                                </figure>
                              );
                            })}
                          </Fragment>
                        ))}
                      </div>
                    </div>
                    <button
                      className="wnav wnav-prev"
                      type="button"
                      aria-label="Photography: previous photos"
                    >
                      <span aria-hidden="true">‹</span>
                    </button>
                    <button
                      className="wnav wnav-next"
                      type="button"
                      aria-label="Photography: next photos"
                    >
                      <span aria-hidden="true">›</span>
                    </button>
                  </div>
                  <div className="sprockets" aria-hidden="true" />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ================= 00:05 SERVICES ================= */}
      <div className="ruler-div" aria-hidden="true" />
      <section className="blk" id="services">
        <div className="wrap">
          <div className="marker">
            <span className="tc">00:05</span>
            <span className="mdot" />
            <span className="mline" />
            <p className="kick">Services</p>
          </div>
          <h2 className="sec display">
            {renderAccentHeading(s["services_heading"] ?? "What I Do Best", 1)}
          </h2>
          <p className="secsub" style={{ marginTop: 4 }}>
            {s["services_intro"]}
          </p>

          <div className="stack-list" id="stackList">
            {data.services.map((srv, i) => {
              const acc = SERVICE_ACCENTS[i % SERVICE_ACCENTS.length] ?? "acc-orange";
              const icon = SERVICE_ICONS[i % SERVICE_ICONS.length] ?? "🎬";
              const pct = ((i + 1) / Math.max(1, data.services.length)) * 100;
              return (
                <article key={srv.id} className={`stack-card ${acc}`}>
                  <span className="stack-num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="stack-in">
                    <div className="stack-icon" aria-hidden="true">
                      {icon}
                    </div>
                    <div className="stack-main">
                      <p className="stack-kicker">
                        Service {String(i + 1).padStart(2, "0")} /{" "}
                        {String(data.services.length).padStart(2, "0")} — {srv.kicker}
                      </p>
                      <h3>
                        {srv.title}{" "}
                        {srv.isNew ? <span className="stack-new">New</span> : null}
                      </h3>
                      <p className="stack-desc">{srv.description}</p>
                      <div className="stack-chips">
                        {srv.chips.map((chip) => (
                          <span key={chip}>{chip}</span>
                        ))}
                      </div>
                      <ToolBadgeChips toolBadges={srv.toolBadges} />
                    </div>
                  </div>
                  <div className="stack-progress" aria-hidden="true">
                    <i style={{ width: `${pct.toFixed(1)}%` }} />
                  </div>
                </article>
              );
            })}
          </div>

          <div className="stools-strip reveal">
            <span className="ts-label">Tools</span>
            <span className="ts-item">
              <span className="tbadge tb-pr">Pr</span>Premiere Pro
            </span>
            <span className="ts-item">
              <span className="tbadge tb-ae">Ae</span>After Effects
            </span>
            <span className="ts-item">
              <span className="tbadge tb-ps">Ps</span>Photoshop
            </span>
            <span className="ts-item">
              <span className="tbadge tb-lr">Lr</span>Lightroom Classic
            </span>
          </div>
        </div>
      </section>

      {/* ================= 00:06 FAQ ================= */}
      <WaveDivider />
      <section className="blk alt" id="faq">
        <div className="wrap" style={{ textAlign: "center" }}>
          <div className="marker" style={{ justifyContent: "center" }}>
            <span className="tc">00:06</span>
            <span className="mdot" />
            <span className="mline" />
            <p className="kick">FAQ</p>
          </div>
          <h2 className="sec display">
            {renderAccentHeading(s["faq_heading"] ?? "Questions? Answered.", 1)}
          </h2>
          <div className="faq" id="faqList">
            {data.faqs.map((f, i) => {
              const isOpen = openFaqIdx === i;
              return (
                <div key={f.id} className="reveal">
                  <div className={`fitem${isOpen ? " open" : ""}`}>
                    <button
                      type="button"
                      onClick={() => setOpenFaqIdx(isOpen ? null : i)}
                    >
                      <span className="ftc">00:06:{String(i + 1).padStart(2, "0")}</span>
                      <span className="q">{f.question}</span>
                      <span className="pl">{isOpen ? "−" : "+"}</span>
                    </button>
                    <div className="ans">{f.answer}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= 00:07 LET'S TALK ================= */}
      <div className="ruler-div" aria-hidden="true" />
      <section className="blk" id="contact">
        <div className="wrap">
          <div className="talkbox">
            <div className="truler" aria-hidden="true" />
            <div className="marker" style={{ justifyContent: "center" }}>
              <span className="tc">00:07</span>
              <span className="mdot" />
              <span className="mline" />
              <p className="kick">Let's Talk — Export &amp; Deliver</p>
            </div>
            <h2 className="display">
              {renderAccentHeading(
                s["contact_heading"] ?? "Let's Create Something People Remember",
                2,
              )}
            </h2>
            <p>{s["contact_text"]}</p>
            <div className="ctas" style={{ margin: "26px 0 4px" }}>
              <a
                className="btn btn-o"
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                💬 WhatsApp — Book a Call
              </a>
              <a className="btn btn-g" href={`mailto:${s["email"] ?? ""}`}>
                ✉ Email Me
              </a>
            </div>
            <div className="cgrid">
              <div className="ccard reveal">
                <span>WhatsApp / Phone</span>
                <strong>{s["phone_display"]}</strong>
              </div>
              <div className="ccard reveal">
                <span>Email</span>
                <strong>{s["email"]}</strong>
              </div>
              <div className="ccard reveal">
                <span>Studio / Location</span>
                <strong>{s["location"]}</strong>
              </div>
            </div>
            <div className="quick-inq">
              <div className="quick-inq-head">
                <span>Quick Project Inquiry</span>
                <small>Select service &amp; send straight to WhatsApp</small>
              </div>
              <div className="quick-inq-pills" role="group" aria-label="Project type">
                {[
                  "Social Media Reels",
                  "Wedding Film",
                  "Product Photography",
                  "Brand Content (Monthly)",
                ].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`qpill${inqService === opt ? " on" : ""}`}
                    onClick={() => setInqService(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <div className="quick-inq-fields">
                <input
                  type="text"
                  placeholder="Your Name / Brand Page"
                  aria-label="Your Name or Brand Page"
                  value={inqName}
                  onChange={(e) => setInqName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Shoot date & quick note…"
                  aria-label="Project details"
                  value={inqDetails}
                  onChange={(e) => setInqDetails(e.target.value)}
                />
                <a
                  className="btn btn-o"
                  href={`${whatsapp}?text=${encodeURIComponent(
                    `Hi Hasib! I'm interested in *${inqService}*${inqName.trim() ? ` (${inqName.trim()})` : ""}.${inqDetails.trim() ? ` Details: ${inqDetails.trim()}` : ""}`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Send Inquiry on WhatsApp ↗
                </a>
              </div>
            </div>
            <div className="linkrow">
              {socials
                .filter((x) => isValidExternalUrl(x.url))
                .map((x) => (
                  <a
                    key={`${x.label}-${x.url}`}
                    href={normalizeUrl(x.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <SocialBrandIcon url={x.url} label={x.label} />
                    <span>{x.label}</span>
                    <span aria-hidden="true" style={{ opacity: 0.65 }}>
                      ↗
                    </span>
                  </a>
                ))}
            </div>
            <div
              className="foot-timeline"
              role="img"
              aria-label="Decorative editing timeline strip with video and audio tracks and a playhead"
            >
              <div className="frow">
                <span className="flab v">V2</span>
                <div className="ftrk">
                  <span
                    className="fclip"
                    style={{ left: "3%", width: "34%", background: "#a493e6", color: "#16122b" }}
                  >
                    portfolio_final.mp4
                  </span>
                  <span
                    className="fclip"
                    style={{ left: "64%", width: "30%", background: "#ff6a00", color: "#fff" }}
                  >
                    grade_v2.mov
                  </span>
                </div>
              </div>
              <div className="frow">
                <span className="flab v">V1</span>
                <div className="ftrk">
                  <span
                    className="fclip"
                    style={{ left: "1%", width: "44%", background: "#7d6fd0", color: "#fff" }}
                  >
                    hasib_showreel.mp4
                  </span>
                  <span
                    className="fclip"
                    style={{ left: "48%", width: "46%", background: "#ff6a00", color: "#fff" }}
                  >
                    your_project_next.mp4
                  </span>
                </div>
              </div>
              <div className="frow">
                <span className="flab a">A1</span>
                <div className="ftrk">
                  <span
                    className="fclip"
                    style={{ left: "0%", width: "58%", background: "#177a6b", color: "#eafffa" }}
                  >
                    music_track.wav
                  </span>
                  <span
                    className="fclip"
                    style={{ left: "61%", width: "34%", background: "#177a6b", color: "#eafffa" }}
                  >
                    voiceover.wav
                  </span>
                </div>
              </div>
              <div className="fph" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap footin">
          <span>
            © {new Date().getFullYear()} <strong>HASIB MAHAMUD</strong> — Photographer &amp; Video
            Editor, Dhaka
          </span>
          <span>Chitroboron • Swapon's World • Stone Rose</span>
        </div>
      </footer>

      {lightbox !== null ? (
        <PhotoLightbox
          photos={data.photos}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNav={setLightbox}
        />
      ) : null}
    </div>
  );
}

const EMPTY_SITE = {
  settings: {},
  journey: [],
  partners: [],
  workItems: [],
  photos: [],
  services: [],
  faqs: [],
  seoDocs: { sitemap: "", robots: "", llms: "" },
};
