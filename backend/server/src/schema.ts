// Drizzle schema for the Hasib Mahamud portfolio backend.
//
// All public-site content lives here so the admin panel can edit everything
// without a rebuild: `settings` holds single text values (and JSON blobs for
// structured lists like stats/socials), the other tables hold repeatable
// content rows. `admin_auth` stores one salted password hash; `sessions`
// holds login tokens issued to the admin UI.

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});

export const adminAuth = sqliteTable("admin_auth", {
  id: integer("id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
});

export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const journeyChapters = sqliteTable("journey_chapters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  period: text("period").notNull().default(""),
  role: text("role").notNull().default(""),
  org: text("org").notNull().default(""),
  description: text("description").notNull().default(""),
  clipLabel: text("clip_label").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const partners = sqliteTable("partners", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().default(""),
  logoUrl: text("logo_url").notNull().default(""),
  pageUrl: text("page_url").notNull().default(""),
  status: text("status", { enum: ["running", "past"] })
    .notNull()
    .default("running"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const workItems = sqliteTable("work_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  track: text("track", { enum: ["reels", "wide", "square"] }).notNull(),
  title: text("title").notNull().default(""),
  tag: text("tag").notNull().default(""),
  videoUrl: text("video_url").notNull().default(""),
  thumbnailUrl: text("thumbnail_url").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const photos = sqliteTable("photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull().default(""),
  category: text("category").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const services = sqliteTable("services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kicker: text("kicker").notNull().default(""),
  title: text("title").notNull().default(""),
  description: text("description").notNull().default(""),
  chips: text("chips").notNull().default("[]"),
  toolBadges: text("tool_badges").notNull().default(""),
  isNew: integer("is_new").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const faqs = sqliteTable("faqs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  question: text("question").notNull().default(""),
  answer: text("answer").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});
