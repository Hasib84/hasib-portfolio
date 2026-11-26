import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";
import { Actions } from "./actions";
import { db, DB_PATH } from "./db";
import * as schema from "./schema";
import type { Ctx } from "./space-sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, "../../client/dist");
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

const ctx: Ctx = {
  db: (() => db) as unknown as Ctx["db"],
  invalidateQueries() {
    // Client-side React Query invalidates on mutation completion.
  },
  saveUpload(fileName, bytes) {
    const safeName = path.basename(fileName);
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, safeName), bytes);
    return `/uploads/${safeName}`;
  },
};

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".woff2": "font/woff2",
};

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function injectLiveSeoIntoHtml(html: string): Promise<string> {
  try {
    const site = await Actions.getSite.handler(ctx, {});
    const s = site.settings;
    const title = s["seo_title"]?.trim();
    const desc = s["seo_description"]?.trim();
    const keywords = s["seo_keywords"]?.trim();
    const base = (s["site_url"] ?? "").trim().replace(/\/+$/, "");
    const ogImg =
      s["og_image_url"]?.trim() ||
      site.workItems.find((w) => w.thumbnailUrl?.trim())?.thumbnailUrl?.trim() ||
      site.photos.find((p) => p.imageUrl?.trim())?.imageUrl?.trim() ||
      "";
    const resolvedOgImg = ogImg && ogImg.startsWith("/") && base ? `${base}${ogImg}` : ogImg;

    let out = html;
    if (title) {
      out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlAttr(title)}</title>`);
      out = out.replace(
        /(<meta[^>]+property=["']og:title["'][^>]+content=["'])[^"']*(["'][^>]*>)/i,
        `$1${escapeHtmlAttr(title)}$2`,
      );
      out = out.replace(
        /(<meta[^>]+name=["']twitter:title["'][^>]+content=["'])[^"']*(["'][^>]*>)/i,
        `$1${escapeHtmlAttr(title)}$2`,
      );
    }
    if (desc) {
      out = out.replace(
        /(<meta[^>]+name=["']description["'][^>]+content=["'])[^"']*(["'][^>]*>)/i,
        `$1${escapeHtmlAttr(desc)}$2`,
      );
      out = out.replace(
        /(<meta[^>]+property=["']og:description["'][^>]+content=["'])[^"']*(["'][^>]*>)/i,
        `$1${escapeHtmlAttr(desc)}$2`,
      );
      out = out.replace(
        /(<meta[^>]+name=["']twitter:description["'][^>]+content=["'])[^"']*(["'][^>]*>)/i,
        `$1${escapeHtmlAttr(desc)}$2`,
      );
    }
    if (keywords) {
      out = out.replace(
        /(<meta[^>]+name=["']keywords["'][^>]+content=["'])[^"']*(["'][^>]*>)/i,
        `$1${escapeHtmlAttr(keywords)}$2`,
      );
    }
    const extraHeadTags: string[] = [];
    if (base) {
      extraHeadTags.push(`<link rel="canonical" href="${escapeHtmlAttr(`${base}/`)}" />`);
      extraHeadTags.push(`<meta property="og:url" content="${escapeHtmlAttr(`${base}/`)}" />`);
    }
    if (resolvedOgImg) {
      extraHeadTags.push(`<meta property="og:image" content="${escapeHtmlAttr(resolvedOgImg)}" />`);
      extraHeadTags.push(`<meta name="twitter:image" content="${escapeHtmlAttr(resolvedOgImg)}" />`);
    }
    if (extraHeadTags.length > 0) {
      out = out.replace("</head>", `    ${extraHeadTags.join("\n    ")}\n  </head>`);
    }
    return out;
  } catch {
    return html;
  }
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendText(res: http.ServerResponse, status: number, contentType: string, body: string) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readBody(req: http.IncomingMessage, maxBytes = 15 * 1024 * 1024): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    total += buf.length;
    if (total > maxBytes) {
      throw new Error("File is too large (max 10 MB).");
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function verifyAdminToken(token: string): Promise<boolean> {
  if (!token) return false;
  const rows = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.token, token))
    .limit(1);
  const session = rows[0];
  return Boolean(session && session.expiresAt > Date.now());
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathname = url.pathname;

    if (req.method === "POST" && pathname === "/actions") {
      const raw = await readBody(req, 2 * 1024 * 1024);
      let parsedBody: { action?: unknown; args?: unknown };
      try {
        parsedBody = raw ? (JSON.parse(raw) as { action?: unknown; args?: unknown }) : {};
      } catch {
        return sendJson(res, 400, { error: "Invalid JSON body." });
      }
      const actionName = typeof parsedBody.action === "string" ? parsedBody.action : "";
      const actionDef = (Actions as Record<string, (typeof Actions)[keyof typeof Actions]>)[
        actionName
      ];
      if (!actionDef) {
        return sendJson(res, 404, { error: `Unknown action: ${actionName}` });
      }
      try {
        const validatedArgs = actionDef.request.parse(parsedBody.args ?? {});
        const result = await actionDef.handler(ctx, validatedArgs as never);
        return sendJson(res, 200, result);
      } catch (err) {
        if (err instanceof ZodError) {
          return sendJson(res, 400, {
            error: err.issues.map((i) => i.message).join("; ") || "Invalid input.",
          });
        }
        const msg = err instanceof Error ? err.message : "Action failed.";
        return sendJson(res, 400, { error: msg });
      }
    }

    if (req.method === "POST" && pathname === "/upload") {
      const tokenHeader = req.headers["x-admin-token"];
      const token = typeof tokenHeader === "string" ? tokenHeader : "";
      if (!(await verifyAdminToken(token))) {
        return sendJson(res, 401, { error: "Please log in as admin first." });
      }
      const raw = await readBody(req, 15 * 1024 * 1024);
      let body: { filename?: unknown; dataUrl?: unknown };
      try {
        body = JSON.parse(raw) as { filename?: unknown; dataUrl?: unknown };
      } catch {
        return sendJson(res, 400, { error: "Invalid upload payload." });
      }
      const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
      if (!match?.[1] || !match[2]) {
        return sendJson(res, 400, { error: "Please choose a valid PNG, JPG, WEBP, or GIF image." });
      }
      const ext = IMAGE_EXT_BY_MIME[match[1].toLowerCase()];
      if (!ext) {
        return sendJson(res, 400, { error: "Unsupported image type. Use PNG, JPG, WEBP, or GIF." });
      }
      const baseName =
        typeof body.filename === "string"
          ? body.filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40) || "image"
          : "image";
      const fileName = `${baseName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`;
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      const filePath = path.join(UPLOADS_DIR, fileName);
      fs.writeFileSync(filePath, Buffer.from(match[2], "base64"));
      return sendJson(res, 200, { url: `/uploads/${fileName}` });
    }

    if ((req.method === "GET" || req.method === "HEAD") && pathname.startsWith("/uploads/")) {
      const safeName = path.basename(pathname);
      const filePath = path.join(UPLOADS_DIR, safeName);
      if (!filePath.startsWith(UPLOADS_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        return sendText(res, 404, "text/plain; charset=utf-8", "Not found");
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
      const buf = fs.readFileSync(filePath);
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": buf.length,
        "Cache-Control": "public, max-age=31536000, immutable",
      });
      if (req.method === "HEAD") res.end();
      else res.end(buf);
      return;
    }

    if (req.method === "GET" && (pathname === "/sitemap.xml" || pathname === "/robots.txt" || pathname === "/llms.txt")) {
      const site = await Actions.getSite.handler(ctx, {});
      if (pathname === "/sitemap.xml") {
        return sendText(res, 200, "application/xml; charset=utf-8", site.seoDocs.sitemap);
      }
      if (pathname === "/robots.txt") {
        return sendText(res, 200, "text/plain; charset=utf-8", site.seoDocs.robots);
      }
      return sendText(res, 200, "text/plain; charset=utf-8", site.seoDocs.llms);
    }

    if (req.method === "GET" || req.method === "HEAD") {
      if (!fs.existsSync(CLIENT_DIST)) {
        return sendText(
          res,
          503,
          "text/plain; charset=utf-8",
          "Frontend build not found. Run `npm run build` inside backend/ first.",
        );
      }
      const safePath = path.normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
      let filePath = path.join(CLIENT_DIST, safePath);
      if (!filePath.startsWith(CLIENT_DIST) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(CLIENT_DIST, "index.html");
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
      if (ext === ".html" && !pathname.startsWith("/admin")) {
        const htmlRaw = fs.readFileSync(filePath, "utf8");
        const htmlLive = await injectLiveSeoIntoHtml(htmlRaw);
        const buf = Buffer.from(htmlLive, "utf8");
        res.writeHead(200, {
          "Content-Type": contentType,
          "Content-Length": buf.length,
        });
        if (req.method === "HEAD") res.end();
        else res.end(buf);
        return;
      }
      const buf = fs.readFileSync(filePath);
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": buf.length,
      });
      if (req.method === "HEAD") {
        res.end();
      } else {
        res.end(buf);
      }
      return;
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (err) {
    console.error("Unhandled request error:", err);
    sendJson(res, 500, { error: err instanceof Error ? err.message : "Internal server error." });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Hasib Portfolio server running at http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  console.log(`Admin panel available at http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}/admin`);
  console.log(`SQLite database: ${DB_PATH}`);
});
