# Hasib Mahamud — Portfolio Website (Full Stack)

Full-stack portfolio website for **Hasib Mahamud** (Photographer & Video Editor, Mirpur, Dhaka) built with React 19, Vite, Tailwind CSS v4, TypeScript, Node.js (`node:sqlite` + Drizzle ORM), and an integrated Dark Studio Admin panel at `/admin`.

## Requirements
- **Node.js `>= 22.14.0`** (uses built-in `node:sqlite`)

## Local Development
```bash
npm run install:backend
npm run build
npm start
```
- Public site: `http://localhost:3000`
- Admin panel: `http://localhost:3000/admin` (sets your admin password on first login)

## Deploying to a Live Server (VPS / Render / Railway / Coolify)
1. **Build command:**
   ```bash
   npm --prefix backend ci && npm --prefix backend run build
   ```
2. **Start command:**
   ```bash
   npm --prefix backend start
   ```
3. **Environment variables (optional):**
   - `PORT` (defaults to `3000`)
   - `HOST` (defaults to `0.0.0.0`)
   - `DB_PATH` (point to a persistent disk path such as `/data/app.db` on cloud platforms so admin edits persist across redeploys)
4. On first boot with an empty database, `seed.ts` automatically populates all portfolio videos, photos, partner brands, services, FAQs, and SEO settings. Visit `/admin` to create your live admin password and set your custom domain under **SEO & AI Search → Site URL** so `/sitemap.xml` and `robots.txt` reflect your live domain.
