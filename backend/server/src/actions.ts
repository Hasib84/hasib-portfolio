// Actions for the Hasib Mahamud portfolio backend.
//
// Public: `getSite` returns every piece of content the public page renders
// (and seeds the database from the current site's content on first load).
// Admin: a single password (set by the owner on first use, stored only as a
// salted SHA-256 hash) issues a session token; every editing action checks
// that token before writing.

import { defineAction, z, type ActionsModule, type Ctx } from "./space-sdk";
import { asc, eq } from "drizzle-orm";
import * as schema from "./schema";
import {
SEED_FAQS,
SEED_JOURNEY,
SEED_PARTNERS,
SEED_PHOTOS,
SEED_SERVICES,
SEED_SETTINGS,
SEED_WORK,
} from "./seed";

/* ---------------------------------- auth --------------------------------- */

async function hashPassword(salt: string, password: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${password}`),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function newToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
}

type Db = ReturnType<Ctx["db"]>;

async function createSession(db: Db): Promise<string> {
  const token = newToken();
  const now = Date.now();
  await db.insert(schema.sessions).values({
    token,
    createdAt: now,
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
  });
  return token;
}

async function requireAdmin(db: Db, token: string): Promise<void> {
  if (!token) throw new Error("Please log in first.");
  const rows = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.token, token))
    .limit(1);
  const session = rows[0];
  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Your login has expired. Please log in again.");
  }
}

/* ---------------------------------- seed --------------------------------- */

async function seedIfEmpty(db: Db): Promise<boolean> {
  const existing = await db.select().from(schema.settings).limit(1);
  if (existing.length > 0) return false;
  for (const [key, value] of SEED_SETTINGS) {
    await db.insert(schema.settings).values({ key, value });
  }
  for (const [i, j] of SEED_JOURNEY.entries()) {
    await db.insert(schema.journeyChapters).values({ ...j, sortOrder: i });
  }
  for (const [i, p] of SEED_PARTNERS.entries()) {
    await db.insert(schema.partners).values({
      name: p.name,
      status: p.status,
      logoUrl: p.logoUrl ?? "",
      pageUrl: p.pageUrl ?? "",
      sortOrder: i,
    });
  }
  for (const [i, w] of SEED_WORK.entries()) {
    await db.insert(schema.workItems).values({
      track: w.track,
      title: w.title,
      tag: w.tag,
      videoUrl: w.videoUrl,
      thumbnailUrl: w.thumbnailUrl ?? "",
      sortOrder: i,
    });
  }
  for (const [i, p] of SEED_PHOTOS.entries()) {
    await db.insert(schema.photos).values({
      title: p.title,
      category: p.category,
      imageUrl: p.imageUrl ?? "",
      sortOrder: i,
    });
  }
  for (const [i, s] of SEED_SERVICES.entries()) {
    await db.insert(schema.services).values({
      kicker: s.kicker,
      title: s.title,
      description: s.description,
      chips: JSON.stringify(s.chips),
      toolBadges: s.toolBadges,
      isNew: s.isNew,
      sortOrder: i,
    });
  }
  for (const [i, f] of SEED_FAQS.entries()) {
    await db.insert(schema.faqs).values({ ...f, sortOrder: i });
  }
  return true;
}

/* -------------------------------- seo docs ------------------------------- */

function parseJsonArray(value: string | undefined): Array<Record<string, string>> {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as Array<Record<string, string>>) : [];
  } catch {
    return [];
  }
}

function buildSeoDocs(
  s: Record<string, string>,
  serviceTitles: string[],
  partnerNames: string[] = [],
): { sitemap: string; robots: string; llms: string } {
  const base = (s["site_url"] ?? "").replace(/\/+$/, "");
  const sitemap = base
    ? `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${base}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`
    : `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Set your Site URL in Admin → SEO & AI Search first, then this sitemap will list your real address. -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n`;
  const robots = `User-agent: *\nAllow: /\n${base ? `\nSitemap: ${base}/sitemap.xml\n` : ""}`;
  const socials = parseJsonArray(s["socials"])
    .filter((x) => {
      try {
        const u = new URL(x["url"] ?? "");
        return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
      } catch {
        return false;
      }
    })
    .map((x) => `- ${x["label"] ?? ""}: ${x["url"] ?? ""}`)
    .join("\n");
  const rawLoc = (s["hero_location"] ?? "Mirpur, Dhaka").trim();
  const fullLoc = /bangladesh/i.test(rawLoc) ? rawLoc : `${rawLoc}, Bangladesh`;
  const partnerLine =
    partnerNames.length > 0
      ? ` He has also collaborated part-time with brands including ${partnerNames.join(", ")}.`
      : "";
  const llms = `# Hasib Mahamud — Photographer & Video Editor in Dhaka, Bangladesh

> ${s["seo_description"] ?? ""}

## About
Hasib Mahamud is a ${s["hero_role"] ?? "Photographer & Video Editor"} based in ${fullLoc}, with 6+ years of experience. He founded Chitroboron (2018–2023) and creates product photography and social media reels.${partnerLine}

## Services
${serviceTitles.map((t) => `- ${t}`).join("\n")}

## Service area
Mirpur, Dhaka, Bangladesh — available for weddings and brand shoots across Dhaka; travel can be discussed when booking.

## Contact
- WhatsApp / Phone: ${s["phone_display"] ?? ""}
- Email: ${s["email"] ?? ""}
- Location: ${s["location"] ?? ""}

## Links
${socials}
`;
  return { sitemap, robots, llms };
}

/* ------------------------------- site payload ---------------------------- */

const okResponse = z.object({ ok: z.literal(true) });

const siteResponse = z.object({
  settings: z.record(z.string(), z.string()),
  journey: z.array(
    z.object({
      id: z.number(),
      period: z.string(),
      role: z.string(),
      org: z.string(),
      description: z.string(),
      clipLabel: z.string(),
      sortOrder: z.number(),
    }),
  ),
  partners: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      logoUrl: z.string(),
      pageUrl: z.string(),
      status: z.string(),
      sortOrder: z.number(),
    }),
  ),
  workItems: z.array(
    z.object({
      id: z.number(),
      track: z.string(),
      title: z.string(),
      tag: z.string(),
      videoUrl: z.string(),
      thumbnailUrl: z.string(),
      sortOrder: z.number(),
    }),
  ),
  photos: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      category: z.string(),
      imageUrl: z.string(),
      sortOrder: z.number(),
    }),
  ),
  services: z.array(
    z.object({
      id: z.number(),
      kicker: z.string(),
      title: z.string(),
      description: z.string(),
      chips: z.array(z.string()),
      toolBadges: z.string(),
      isNew: z.boolean(),
      sortOrder: z.number(),
    }),
  ),
  faqs: z.array(
    z.object({
      id: z.number(),
      question: z.string(),
      answer: z.string(),
      sortOrder: z.number(),
    }),
  ),
  seoDocs: z.object({
    sitemap: z.string(),
    robots: z.string(),
    llms: z.string(),
  }),
});

type SitePayload = z.infer<typeof siteResponse>;

async function loadSite(db: Db): Promise<SitePayload> {
  await seedIfEmpty(db);
  const settingRows = await db.select().from(schema.settings);
  const settings: Record<string, string> = {};
  for (const row of settingRows) settings[row.key] = row.value;

  const journey = await db
    .select()
    .from(schema.journeyChapters)
    .orderBy(asc(schema.journeyChapters.sortOrder), asc(schema.journeyChapters.id));
  const partners = await db
    .select()
    .from(schema.partners)
    .orderBy(asc(schema.partners.sortOrder), asc(schema.partners.id));
  const workItems = await db
    .select()
    .from(schema.workItems)
    .orderBy(asc(schema.workItems.sortOrder), asc(schema.workItems.id));
  const photos = await db
    .select()
    .from(schema.photos)
    .orderBy(asc(schema.photos.sortOrder), asc(schema.photos.id));
  const serviceRows = await db
    .select()
    .from(schema.services)
    .orderBy(asc(schema.services.sortOrder), asc(schema.services.id));
  const faqs = await db
    .select()
    .from(schema.faqs)
    .orderBy(asc(schema.faqs.sortOrder), asc(schema.faqs.id));

  const services = serviceRows.map((row) => {
    let chips: string[] = [];
    try {
      const parsed: unknown = JSON.parse(row.chips);
      if (Array.isArray(parsed)) chips = parsed.filter((c) => typeof c === "string");
    } catch {
      chips = [];
    }
    return {
      id: row.id,
      kicker: row.kicker,
      title: row.title,
      description: row.description,
      chips,
      toolBadges: row.toolBadges,
      isNew: row.isNew === 1,
      sortOrder: row.sortOrder,
    };
  });

  return {
    settings,
    journey,
    partners,
    workItems,
    photos,
    services,
    faqs,
    seoDocs: buildSeoDocs(
      settings,
      services.map((x) => x.title),
      partners.map((p) => p.name).filter(Boolean),
    ),
  };
}

/* --------------------- approved video placement -------------------------- */

// Owner-approved placement (2026-11-25): the showreel plus the six Reels
// (Make Frame Creation Shorts) and six Wide (Chitroboron wedding films)
// slots. Applied once to the live database by `applyApprovedVideos`; only
// slots whose link is still empty are filled, so later admin edits are
// never overwritten.
const APPROVED_SHOWREEL_URL = "https://www.youtube.com/watch?v=SIkvwdftLPs";

const APPROVED_VIDEOS: Array<{
  track: "reels" | "wide";
  title: string;
  videoUrl: string;
}> = [
  { track: "reels", title: "Before vs After: 11.11 Sale Reel Editing | Clothing Brand Ad", videoUrl: "https://www.youtube.com/watch?v=TFCttanZw5I" },
  { track: "reels", title: "Script to Commercial Reel | How I Turned a Written Script Into a Commercial Reel", videoUrl: "https://www.youtube.com/watch?v=5wPVngr2bkU" },
  { track: "reels", title: "E-Commerce Clothing Ad Editing | Swapon's World Half Shirt", videoUrl: "https://www.youtube.com/watch?v=V3a5p_YSyUI" },
  { track: "reels", title: "Before vs After: Simple Reels Editing That Converts", videoUrl: "https://www.youtube.com/watch?v=yqxa_h8-pDA" },
  { track: "reels", title: "Turning Voice Into Motion | Clothing Brand Offer Video", videoUrl: "https://www.youtube.com/watch?v=Ef5ok-U6lRE" },
  { track: "reels", title: "My First Project for a Clothing Brand (2024)", videoUrl: "https://www.youtube.com/watch?v=IYufFMObYss" },
  { track: "wide", title: "Cinematic Wedding Film | Titon & Trina", videoUrl: "https://www.youtube.com/watch?v=SIkvwdftLPs" },
  { track: "wide", title: "Riya's Gaye Holud Trailer | Cinematic Bengali Wedding", videoUrl: "https://www.youtube.com/watch?v=dA6Ycig2Q7w" },
  { track: "wide", title: "Mithun & Purnima Wedding Ceremony", videoUrl: "https://www.youtube.com/watch?v=iSwaLR51zmk" },
  { track: "wide", title: "Titly Debnath | Ashirbad Ceremony Trailer", videoUrl: "https://www.youtube.com/watch?v=FmvZKwZDSl4" },
  { track: "wide", title: "Arjun & Borsha Wedding Outdoor | Couple Shoot", videoUrl: "https://www.youtube.com/watch?v=RQzLpXMzt-w" },
  { track: "wide", title: "Borsha Holud Outdoor | Traditional Bride Cinematic Look", videoUrl: "https://www.youtube.com/watch?v=KEkCA2GyVbM" },
];

/* --------------------------------- actions ------------------------------- */

const tokenField = z.string().max(200);
const idField = z.number().int().positive().optional();
const sortField = z.number().int().min(0).max(9999).default(0);

/* --------------------------- video link inspect ---------------------------- */

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const cp = Number.parseInt(hex, 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : _;
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const cp = Number.parseInt(dec, 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : _;
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function extractYoutubeId(raw: string): string | null {
  const ytPatterns = [
    /youtube\.com\/watch\?[^#]*v=([\w-]{6,})/,
    /youtu\.be\/([\w-]{6,})/,
    /youtube\.com\/shorts\/([\w-]{6,})/,
    /youtube\.com\/embed\/([\w-]{6,})/,
    /youtube\.com\/live\/([\w-]{6,})/,
    /youtube-nocookie\.com\/embed\/([\w-]{6,})/,
  ];
  for (const p of ytPatterns) {
    const m = raw.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

function inferTagForWork(
  track: "reels" | "wide" | "square",
  title: string,
  kind: "youtube" | "facebook" | "mp4" | "unknown",
): string {
  const lower = title.toLowerCase();
  const topic =
    /wedding|holud|ashirbad|bride|ceremony/.test(lower)
      ? "Wedding"
      : /clothing|shirt|sale|brand|e-commerce|ecommerce|commercial|product|ad\b/.test(lower)
        ? "Brand Ad"
        : kind === "facebook"
          ? "Facebook"
          : kind === "youtube"
            ? "YouTube"
            : kind === "mp4"
              ? "MP4"
              : "";
  if (track === "reels") return topic ? `Vertical · ${topic}` : "Vertical · Reels";
  if (track === "square") return topic ? `Square · ${topic}` : "Square · 1:1";
  return topic ? `1920 × 1080 · ${topic}` : "1920 × 1080 · Film";
}

function isFacebookHost(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    return (
      h === "facebook.com" ||
      h.endsWith(".facebook.com") ||
      h === "fb.watch" ||
      h.endsWith(".fb.watch")
    );
  } catch {
    return false;
  }
}

function isSafeFacebookImageHost(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    return (
      h === "fbcdn.net" ||
      h.endsWith(".fbcdn.net") ||
      h === "facebook.com" ||
      h.endsWith(".facebook.com") ||
      h === "fbsbx.com" ||
      h.endsWith(".fbsbx.com")
    );
  } catch {
    return false;
  }
}

async function cacheFacebookThumbnail(
  ctx: Ctx,
  rawImgUrl: string,
  prefix = "fb-thumb",
): Promise<string> {
  const cleaned = decodeHtmlEntities(rawImgUrl).replace(/\\\//g, "/").trim();
  if (!cleaned || !isSafeFacebookImageHost(cleaned) || !ctx.saveUpload) return "";
  try {
    const res = await fetch(cleaned, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return "";
    const ctype = (res.headers.get("content-type") ?? "").toLowerCase();
    const ext = ctype.includes("png")
      ? ".png"
      : ctype.includes("webp")
        ? ".webp"
        : ctype.includes("jpeg") || ctype.includes("jpg")
          ? ".jpg"
          : "";
    if (!ext) return "";
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 3 * 1024 * 1024) return "";
    const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`;
    return ctx.saveUpload(fileName, bytes);
  } catch {
    return "";
  }
}

function cleanScrapedTitle(raw: string): string {
  return decodeHtmlEntities(raw)
    .replace(/\uFFFD+/g, "")
    .replace(/^\s*\d+(?:\.\d+)?[KkMm]?\s+views\s*·\s*\d+(?:\.\d+)?[KkMm]?\s+reactions\s*\|\s*/i, "")
    .replace(/^\s*\|\s*/, "")
    .replace(/\s*\|\s*Facebook\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFacebookTitleAndThumb(html: string): {
  title: string;
  thumb: string;
  isReel: boolean;
} {
  let title = "";
  let thumb = "";
  let isReel = false;

  const ogUrl =
    html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i)?.[1] ??
    "";
  if (/\/reel\//i.test(ogUrl)) isReel = true;

  const ogTitle =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1] ??
    html.match(/<title>([^<]+)<\/title>/i)?.[1] ??
    "";
  const candidateTitle = ogTitle ? cleanScrapedTitle(ogTitle) : "";
  if (
    candidateTitle &&
    !/^(log in|login|sign up|facebook|watch|video)$/i.test(candidateTitle) &&
    !/log in or sign up/i.test(candidateTitle)
  ) {
    title = candidateTitle.slice(0, 160).trim();
  }

  const ogImg =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ??
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)?.[1] ??
    "";
  if (ogImg && !/rsrc\.php|safe_image/i.test(ogImg)) {
    thumb = ogImg;
  }

  if (!thumb) {
    const jsonThumb =
      html.match(/"preferred_thumbnail":\s*\{"image":\s*\{"uri":"([^"]+)"/)?.[1] ??
      html.match(/"thumbnailImage":\s*\{"uri":"([^"]+)"/)?.[1] ??
      html.match(/<link[^>]+rel=["']preload["'][^>]+href=["'](https:[^"']*t15\.5256-10[^"']+)["']/i)?.[1] ??
      html.match(/https?:\\?\/\\?\/scontent[^"'\s\\]*t15\.5256-10[^"'\s\\]*/)?.[0] ??
      "";
    if (jsonThumb) thumb = jsonThumb;
  }

  return { title, thumb, isReel };
}

async function inspectVideoUrl(ctx: Ctx, rawUrl: string): Promise<{
  ok: boolean;
  kind: "youtube" | "facebook" | "mp4" | "unknown";
  track?: "reels" | "wide" | "square";
  title: string;
  tag: string;
  thumbnailUrl: string;
  author: string;
  note: string;
}> {
  const url = rawUrl.trim();
  if (!url) {
    return {
      ok: false,
      kind: "unknown",
      title: "",
      tag: "",
      thumbnailUrl: "",
      author: "",
      note: "Link paste korun.",
    };
  }

  const ytId = extractYoutubeId(url);
  if (ytId) {
    let title = "";
    let author = "";
    let isShorts = /youtube\.com\/shorts\//i.test(url);

    const [oembedRes, shortsHeadRes] = await Promise.allSettled([
      fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${ytId}`)}&format=json`,
        { signal: AbortSignal.timeout(4500) },
      ),
      isShorts
        ? Promise.resolve(null)
        : fetch(`https://www.youtube.com/shorts/${ytId}`, {
            method: "HEAD",
            redirect: "manual",
            signal: AbortSignal.timeout(3500),
          }),
    ]);

    if (oembedRes.status === "fulfilled" && oembedRes.value.ok) {
      try {
        const data = (await oembedRes.value.json()) as { title?: string; author_name?: string };
        title = (data.title ?? "").trim();
        author = (data.author_name ?? "").trim();
      } catch {
        // ignore JSON parse failure
      }
    }
    if (
      shortsHeadRes.status === "fulfilled" &&
      shortsHeadRes.value &&
      shortsHeadRes.value.status === 200
    ) {
      isShorts = true;
    }
    if (!isShorts && /#shorts\b|\breel\b|\breels\b/i.test(title)) {
      isShorts = true;
    }

    const track: "reels" | "wide" = isShorts ? "reels" : "wide";
    const tag = inferTagForWork(track, title, "youtube");
    const thumbnailUrl = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
    const note = title
      ? `YouTube ${isShorts ? "Reels / Shorts (9:16)" : "Wide (16:9)"} auto-detected — Title, Tag o Thumbnail bose geche!`
      : "YouTube link valid — title auto-fetch kora jayni, nije chhoto title likhte paren.";
    return {
      ok: true,
      kind: "youtube",
      track,
      title,
      tag,
      thumbnailUrl,
      author,
      note,
    };
  }

  if (/facebook\.com|fb\.watch/i.test(url)) {
    let isReel = /\/reel\/|\/share\/r\//i.test(url);
    let title = "";
    let rawThumb = "";

    if (isFacebookHost(url)) {
      const candidates: Array<{ target: string; ua: string }> = [
        {
          target: url,
          ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        },
        {
          target: url,
          ua: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        },
      ];
      for (const c of candidates) {
        if (title && rawThumb) break;
        try {
          const res = await fetch(c.target, {
            headers: {
              "user-agent": c.ua,
              accept: "text/html,application/xhtml+xml",
              "accept-language": "en-US,en;q=0.9",
            },
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) continue;
          const html = await res.text();
          const extracted = extractFacebookTitleAndThumb(html);
          if (extracted.isReel) isReel = true;
          if (!title && extracted.title) title = extracted.title;
          if (!rawThumb && extracted.thumb) rawThumb = extracted.thumb;
        } catch {
          // Facebook may restrict unauthenticated HTML requests; keep going.
        }
      }
    }

    const cachedThumb = rawThumb ? await cacheFacebookThumbnail(ctx, rawThumb) : "";
    const track: "reels" | "wide" = isReel ? "reels" : "wide";
    const tag = inferTagForWork(track, title, "facebook");
    const note =
      title && cachedThumb
        ? `Facebook ${isReel ? "Reel (9:16)" : "Video"} auto-detected — Title o Thumbnail auto set hoyeche!`
        : cachedThumb
          ? `Facebook Thumbnail pawa geche! Sudhu ekta chhoto Title likhe din.`
          : title
            ? `Facebook ${isReel ? "Reel (9:16)" : "Video"} Title pawa geche, kintu thumbnail block kora — niche Upload Thumbnail diye chhobi dite parben.`
            : `Facebook link ta private/restricted — thumbnail o title auto ana jayni; niche Title likhe Upload Thumbnail diye chhobi dite parben.`;
    return {
      ok: true,
      kind: "facebook",
      track,
      title,
      tag,
      thumbnailUrl: cachedThumb,
      author: "",
      note,
    };
  }

  if (/\.mp4($|\?)/i.test(url)) {
    let title = "";
    try {
      const cleanPath = decodeURIComponent(url.split("?")[0] ?? "");
      const file = cleanPath.split("/").pop() ?? "";
      title = file
        .replace(/\.mp4$/i, "")
        .replace(/[_-]+/g, " ")
        .trim();
    } catch {
      title = "";
    }
    const tag = inferTagForWork("wide", title, "mp4");
    return {
      ok: true,
      kind: "mp4",
      track: "wide",
      title,
      tag,
      thumbnailUrl: "",
      author: "",
      note: "Direct MP4 link detected — Track o chaile custom thumbnail upload korte parben.",
    };
  }

  return {
    ok: false,
    kind: "unknown",
    title: "",
    tag: "",
    thumbnailUrl: "",
    author: "",
    note: "YouTube, Facebook, ba .mp4 link check korun.",
  };
}

export const Actions = {
  getSite: defineAction({
    description:
      "Returns all portfolio content (texts, journey, partners, work videos, photos, services, FAQs) plus generated sitemap/robots/llms documents.",
    request: z.object({}),
    response: siteResponse,
    async handler(ctx) {
      return loadSite(ctx.db<typeof schema>());
    },
  }),

  seedSite: defineAction({
    description:
      "Seeds the portfolio database with the current website's content if it is still empty; never overwrites existing edits.",
    request: z.object({}),
    response: z.object({ seeded: z.boolean() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const seeded = await seedIfEmpty(db);
      if (seeded) ctx.invalidateQueries();
      return { seeded };
    },
  }),

  applyApprovedVideos: defineAction({
    description:
      "Fills the still-empty showreel and Reels/Wide work slots with the owner-approved YouTube videos; never overwrites a slot that already has a link.",
    request: z.object({}),
    response: z.object({ updated: z.number(), skipped: z.number() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      await seedIfEmpty(db);
      let updated = 0;
      let skipped = 0;

      const showreelRows = await db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, "showreel_video_url"))
        .limit(1);
      const showreel = showreelRows[0];
      if (!showreel) {
        await db
          .insert(schema.settings)
          .values({ key: "showreel_video_url", value: APPROVED_SHOWREEL_URL });
        updated += 1;
      } else if (showreel.value.trim() === "") {
        await db
          .update(schema.settings)
          .set({ value: APPROVED_SHOWREEL_URL })
          .where(eq(schema.settings.key, "showreel_video_url"));
        updated += 1;
      } else {
        skipped += 1;
      }

      for (const track of ["reels", "wide"] as const) {
        const items = await db
          .select()
          .from(schema.workItems)
          .where(eq(schema.workItems.track, track))
          .orderBy(asc(schema.workItems.sortOrder), asc(schema.workItems.id));
        const approved = APPROVED_VIDEOS.filter((v) => v.track === track);
        for (const [i, item] of items.entries()) {
          const target = approved[i];
          if (!target) break;
          if (item.videoUrl.trim() === "") {
            await db
              .update(schema.workItems)
              .set({ title: target.title, videoUrl: target.videoUrl })
              .where(eq(schema.workItems.id, item.id));
            updated += 1;
          } else {
            skipped += 1;
          }
        }
      }

      if (updated > 0) ctx.invalidateQueries();
      return { updated, skipped };
    },
  }),

  authStatus: defineAction({
    description: "Reports whether an admin password exists and whether the given session token is logged in.",
    request: z.object({ token: z.string().max(200).optional() }),
    response: z.object({ hasPassword: z.boolean(), authed: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const auth = await db.select().from(schema.adminAuth).limit(1);
      let authed = false;
      if (args.token) {
        const rows = await db
          .select()
          .from(schema.sessions)
          .where(eq(schema.sessions.token, args.token))
          .limit(1);
        authed = !!rows[0] && rows[0].expiresAt > Date.now();
      }
      return { hasPassword: auth.length > 0, authed };
    },
  }),

  setupPassword: defineAction({
    description: "Sets the admin password on first use and returns a session token.",
    request: z.object({ password: z.string().min(6).max(200) }),
    response: z.object({ token: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const auth = await db.select().from(schema.adminAuth).limit(1);
      if (auth.length > 0) throw new Error("A password is already set. Please log in.");
      const salt = crypto.randomUUID();
      await db.insert(schema.adminAuth).values({
        id: 1,
        salt,
        passwordHash: await hashPassword(salt, args.password),
      });
      return { token: await createSession(db) };
    },
  }),

  login: defineAction({
    description: "Logs the admin in with the password and returns a session token.",
    request: z.object({ password: z.string().min(1).max(200) }),
    response: z.object({ token: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const auth = await db.select().from(schema.adminAuth).limit(1);
      const row = auth[0];
      if (!row) throw new Error("No password set yet. Set one first.");
      const hash = await hashPassword(row.salt, args.password);
      if (hash !== row.passwordHash) throw new Error("Wrong password. Try again.");
      return { token: await createSession(db) };
    },
  }),

  logout: defineAction({
    description: "Ends the admin session for the given token.",
    request: z.object({ token: tokenField }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.sessions).where(eq(schema.sessions.token, args.token));
      return { ok: true as const };
    },
  }),

  changePassword: defineAction({
    description: "Changes the admin password after checking the current one.",
    request: z.object({
      token: tokenField,
      currentPassword: z.string().min(1).max(200),
      newPassword: z.string().min(6).max(200),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await requireAdmin(db, args.token);
      const auth = await db.select().from(schema.adminAuth).limit(1);
      const row = auth[0];
      if (!row) throw new Error("No password set yet.");
      const current = await hashPassword(row.salt, args.currentPassword);
      if (current !== row.passwordHash) throw new Error("Current password is wrong.");
      const salt = crypto.randomUUID();
      await db
        .update(schema.adminAuth)
        .set({ salt, passwordHash: await hashPassword(salt, args.newPassword) })
        .where(eq(schema.adminAuth.id, 1));
      return { ok: true as const };
    },
  }),

  updateSettings: defineAction({
    description: "Saves one or more site text/settings values (hero, about, contact, socials, SEO) from the admin panel.",
    request: z.object({
      token: tokenField,
      entries: z
        .array(
          z.object({
            key: z.string().min(1).max(64),
            value: z.string().max(20000),
          }),
        )
        .min(1)
        .max(120),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await requireAdmin(db, args.token);
      for (const entry of args.entries) {
        await db
          .insert(schema.settings)
          .values({ key: entry.key, value: entry.value })
          .onConflictDoUpdate({
            target: schema.settings.key,
            set: { value: entry.value },
          });
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  saveJourneyChapter: defineAction({
    description: "Adds or updates one My Journey chapter.",
    request: z.object({
      token: tokenField,
      id: idField,
      period: z.string().max(120),
      role: z.string().max(200),
      org: z.string().max(200),
      description: z.string().max(2000),
      clipLabel: z.string().max(120),
      sortOrder: sortField,
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await requireAdmin(db, args.token);
      const values = {
        period: args.period,
        role: args.role,
        org: args.org,
        description: args.description,
        clipLabel: args.clipLabel,
        sortOrder: args.sortOrder,
      };
      if (args.id) {
        await db
          .update(schema.journeyChapters)
          .set(values)
          .where(eq(schema.journeyChapters.id, args.id));
        ctx.invalidateQueries();
        return { id: args.id };
      }
      const inserted = await db
        .insert(schema.journeyChapters)
        .values(values)
        .returning({ id: schema.journeyChapters.id });
      ctx.invalidateQueries();
      return { id: inserted[0]?.id ?? 0 };
    },
  }),

  deleteJourneyChapter: defineAction({
    description: "Deletes one My Journey chapter.",
    request: z.object({ token: tokenField, id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await requireAdmin(db, args.token);
      await db
        .delete(schema.journeyChapters)
        .where(eq(schema.journeyChapters.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  savePartner: defineAction({
    description: "Adds or updates one part-time/freelance brand page (name, logo image URL, page URL, Running/Past status).",
    request: z.object({
      token: tokenField,
      id: idField,
      name: z.string().max(200),
      logoUrl: z.string().max(2000),
      pageUrl: z.string().max(2000).default(""),
      status: z.enum(["running", "past"]),
      sortOrder: sortField,
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await requireAdmin(db, args.token);
      let logoUrl = args.logoUrl.trim();
      if (isSafeFacebookImageHost(logoUrl)) {
        const cached = await cacheFacebookThumbnail(ctx, logoUrl, "partner-logo");
        if (cached) logoUrl = cached;
      }
      const values = {
        name: args.name,
        logoUrl,
        pageUrl: args.pageUrl,
        status: args.status,
        sortOrder: args.sortOrder,
      };
      if (args.id) {
        await db.update(schema.partners).set(values).where(eq(schema.partners.id, args.id));
        ctx.invalidateQueries();
        return { id: args.id };
      }
      const inserted = await db
        .insert(schema.partners)
        .values(values)
        .returning({ id: schema.partners.id });
      ctx.invalidateQueries();
      return { id: inserted[0]?.id ?? 0 };
    },
  }),

  deletePartner: defineAction({
    description: "Deletes one part-time/freelance brand page entry.",
    request: z.object({ token: tokenField, id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await requireAdmin(db, args.token);
      await db.delete(schema.partners).where(eq(schema.partners.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  saveWorkItem: defineAction({
    description:
      "Adds or updates one Selected Work video slot (track, title, tag, thumbnail, and a YouTube / Facebook / mp4 link that plays on the site).",
    request: z.object({
      token: tokenField,
      id: idField,
      track: z.enum(["reels", "wide", "square"]),
      title: z.string().max(200),
      tag: z.string().max(200),
      videoUrl: z.string().max(2000),
      thumbnailUrl: z.string().max(2000).optional().default(""),
      sortOrder: sortField,
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await requireAdmin(db, args.token);
      const cleanedTag =
        args.tag.trim() || inferTagForWork(args.track, args.title, "unknown");
      const values = {
        track: args.track,
        title: args.title.trim() || "Untitled Video",
        tag: cleanedTag,
        videoUrl: args.videoUrl.trim(),
        thumbnailUrl: args.thumbnailUrl.trim(),
        sortOrder: args.sortOrder,
      };
      if (args.id) {
        await db.update(schema.workItems).set(values).where(eq(schema.workItems.id, args.id));
        ctx.invalidateQueries();
        return { id: args.id };
      }
      const inserted = await db
        .insert(schema.workItems)
        .values(values)
        .returning({ id: schema.workItems.id });
      ctx.invalidateQueries();
      return { id: inserted[0]?.id ?? 0 };
    },
  }),

  deleteWorkItem: defineAction({
    description: "Deletes one Selected Work video slot.",
    request: z.object({ token: tokenField, id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await requireAdmin(db, args.token);
      await db.delete(schema.workItems).where(eq(schema.workItems.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  inspectVideoLink: defineAction({
    description:
      "Auto-detects video platform, orientation track (reels/wide), title, tag, and cached thumbnail from a YouTube, Facebook, or MP4 link.",
    request: z.object({
      token: tokenField,
      url: z.string().max(2000),
    }),
    response: z.object({
      ok: z.boolean(),
      kind: z.enum(["youtube", "facebook", "mp4", "unknown"]),
      track: z.enum(["reels", "wide", "square"]).optional(),
      title: z.string(),
      tag: z.string(),
      thumbnailUrl: z.string(),
      author: z.string(),
      note: z.string(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await requireAdmin(db, args.token);
      return inspectVideoUrl(ctx, args.url);
    },
  }),

  savePhoto: defineAction({
    description: "Adds or updates one Photography film-strip photo (title, category, image URL).",
    request: z.object({
      token: tokenField,
      id: idField,
      title: z.string().max(200),
      category: z.string().max(120),
      imageUrl: z.string().max(2000),
      sortOrder: sortField,
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await requireAdmin(db, args.token);
      const cleanTitle = args.title.trim() || "Studio Frame";
      const cleanCategory = args.category.trim() || "Photography";
      let imageUrl = args.imageUrl.trim();
      if (isSafeFacebookImageHost(imageUrl)) {
        const cached = await cacheFacebookThumbnail(ctx, imageUrl, "photo-still");
        if (cached) imageUrl = cached;
      }
      const values = {
        title: cleanTitle,
        category: cleanCategory,
        imageUrl,
        sortOrder: args.sortOrder,
      };
      if (args.id) {
        await db.update(schema.photos).set(values).where(eq(schema.photos.id, args.id));
        ctx.invalidateQueries();
        return { id: args.id };
      }
      const inserted = await db
        .insert(schema.photos)
        .values(values)
        .returning({ id: schema.photos.id });
      ctx.invalidateQueries();
      return { id: inserted[0]?.id ?? 0 };
    },
  }),

  deletePhoto: defineAction({
    description: "Deletes one Photography photo.",
    request: z.object({ token: tokenField, id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await requireAdmin(db, args.token);
      await db.delete(schema.photos).where(eq(schema.photos.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  saveService: defineAction({
    description: "Adds or updates one Services stacking card (title, description, work chips, tool badges).",
    request: z.object({
      token: tokenField,
      id: idField,
      kicker: z.string().max(120),
      title: z.string().max(200),
      description: z.string().max(2000),
      chips: z.array(z.string().max(200)).max(12),
      toolBadges: z.string().max(300),
      isNew: z.boolean(),
      sortOrder: sortField,
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await requireAdmin(db, args.token);
      const values = {
        kicker: args.kicker,
        title: args.title,
        description: args.description,
        chips: JSON.stringify(args.chips),
        toolBadges: args.toolBadges,
        isNew: args.isNew ? 1 : 0,
        sortOrder: args.sortOrder,
      };
      if (args.id) {
        await db.update(schema.services).set(values).where(eq(schema.services.id, args.id));
        ctx.invalidateQueries();
        return { id: args.id };
      }
      const inserted = await db
        .insert(schema.services)
        .values(values)
        .returning({ id: schema.services.id });
      ctx.invalidateQueries();
      return { id: inserted[0]?.id ?? 0 };
    },
  }),

  deleteService: defineAction({
    description: "Deletes one Services card.",
    request: z.object({ token: tokenField, id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await requireAdmin(db, args.token);
      await db.delete(schema.services).where(eq(schema.services.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  saveFaq: defineAction({
    description: "Adds or updates one FAQ question and answer.",
    request: z.object({
      token: tokenField,
      id: idField,
      question: z.string().max(500),
      answer: z.string().max(3000),
      sortOrder: sortField,
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await requireAdmin(db, args.token);
      const values = {
        question: args.question,
        answer: args.answer,
        sortOrder: args.sortOrder,
      };
      if (args.id) {
        await db.update(schema.faqs).set(values).where(eq(schema.faqs.id, args.id));
        ctx.invalidateQueries();
        return { id: args.id };
      }
      const inserted = await db
        .insert(schema.faqs)
        .values(values)
        .returning({ id: schema.faqs.id });
      ctx.invalidateQueries();
      return { id: inserted[0]?.id ?? 0 };
    },
  }),

  deleteFaq: defineAction({
    description: "Deletes one FAQ entry.",
    request: z.object({ token: tokenField, id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await requireAdmin(db, args.token);
      await db.delete(schema.faqs).where(eq(schema.faqs.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),
} satisfies ActionsModule;
