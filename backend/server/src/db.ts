import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(__dirname, "../../app.db");

const sqlite = new DatabaseSync(DB_PATH);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

sqlite.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS admin_auth (
  id INTEGER PRIMARY KEY,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS journey_chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  org TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  clip_label TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  page_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'running',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS work_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kicker TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  chips TEXT NOT NULL DEFAULT '[]',
  tool_badges TEXT NOT NULL DEFAULT '',
  is_new INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL DEFAULT '',
  answer TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
`);

const partnerCols = sqlite.prepare("PRAGMA table_info(partners)").all() as Array<{ name: string }>;
if (!partnerCols.some((c) => c.name === "page_url")) {
  sqlite.exec("ALTER TABLE partners ADD COLUMN page_url TEXT NOT NULL DEFAULT '';");
}
const workCols = sqlite.prepare("PRAGMA table_info(work_items)").all() as Array<{ name: string }>;
if (!workCols.some((c) => c.name === "thumbnail_url")) {
  sqlite.exec("ALTER TABLE work_items ADD COLUMN thumbnail_url TEXT NOT NULL DEFAULT '';");
}

function normalizeParams(params: unknown[]) {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === "boolean") return p ? 1 : 0;
    return p as null | number | bigint | string | Uint8Array;
  });
}

export const db = drizzle(
  async (sql, params, method) => {
    const stmt = sqlite.prepare(sql);
    const clean = normalizeParams(params);
    if (method === "run") {
      stmt.run(...clean);
      return { rows: [] };
    }
    if (method === "get") {
      const row = stmt.get(...clean) as Record<string, unknown> | undefined;
      return { rows: (row ? Object.values(row) : undefined) as unknown as unknown[] };
    }
    const rows = stmt.all(...clean) as Array<Record<string, unknown>>;
    return { rows: rows.map((r) => Object.values(r)) };
  },
  { schema },
);
