# Data Plan

## Context provenance
- `পুরো ওয়েবসাইটটা আমি ব্যাকএন্ড থেকেই কন্ট্রোল করতে পারবো এমনভাবে ব্যাকএন্ডটা বানাবা` (verbatim user request; the whole site must be editable from an admin backend)
- `আমি ভিডিওগুলো লিঙ্ক এডমিনে দিয়ে দিব ইউটিউবের লিঙ্ক দিলেও সেটা যেন আমার ওয়েবসাইটে প্লে হয় ফেসবুকের লিঙ্ক দিলেও সেটা যেন আমার ওয়েবসাইটে প্লে হয়` (verbatim user request; YouTube/Facebook links pasted in admin must play in place on the public site)
- `Plan thik ache — design shesh hole backend shuru koro` (user accepted the assistant's backend plan: login admin panel, all texts editable, video/photo add via links, full SEO + AI-search optimisation)
- Full brief from parent agent: recreate the CURRENT portfolio-website design/content as the public face driven by DB data, plus /admin, SEO meta + JSON-LD (Person, ProfessionalService, FAQPage, VideoObject), sitemap.xml, robots.txt, llms.txt.
- Seed content extracted verbatim from the live static site build (`~/workspace/ts-spaces/portfolio-website/.space-build/index.html`, text extraction run 2026-11-25): hero texts ('hi, i'm', HASIB/MAHAMUD, 'Photographer & Video Editor — Mirpur, Dhaka', 'Wedding films, product shoots & scroll-stopping reels…'), stats (6+ Years Experience, 2018 Founded Chitroboron, 3+ Studios & Brands, 4 Core Tools Pr·Ae·Ps·Lr), About bio, Showreel 'Watch First. Hire Second.', 3 Journey chapters (Beauty Studio 2016–2017, Chitroboron 2018–2023, Swapon's World & Stone Rose 2024–Present), 7 partner slots (Page Name 01–07, 4 Running / 3 Past — the site's current placeholders, awaiting his real page names), 18 work items (Reels: Product/Clothing/Wedding/Social/Fashion/Food Reel; Wide: Wedding Film, Product Film, Cinematography, Brand Film, Music Video, Documentary; Square: Product Post, Promo Square, Feed Video, Ad Creative, Sale Post, Review Video), 8 photography items (Wedding Day, Product Story, Clothing Line, Studio Portrait, Fashion Editorial, Event Moments, Food & Flavour, Street Dhaka), 6 services (Video Editing, Motion Graphics & VFX, Product Photography, Cinematography, Social Media Reels, Photo Editing & Retouching — with chips and tool badges as on the site), 5 FAQs verbatim, contact (WhatsApp +880 1976616684, hasibmahamud85@email.com, Mirpur, Dhaka) and socials (YouTube @Chitroboron, Vimeo hasibmahamudud, Facebook Chitroboron / Swapon's World / Stone Rose, Blog).
- Portrait: the user's own photo `assets/shanto-portrait.png` from his existing portfolio-website build, copied into this artifact's client assets (his own supplied image, reused as-is).

## Tested sources
### Existing static portfolio build (seed source)
**Used by**: seedSite action (post-submit, idempotent — inserts only when tables are empty)
**Test command**: `python3 text-extraction over ~/workspace/ts-spaces/portfolio-website/.space-build/index.html` (script/style stripped, visible text listed)
**Sample output**: full section-by-section text quoted in Context provenance above
**Processing**: hand-mapped into settings key-values + rows for journey_chapters, partners, work_items, photos, services, faqs

### Video embed endpoints (client-side iframes, no server fetch)
**Used by**: public VideoSlot component
**Test command**: platform-standard embed patterns — YouTube `https://www.youtube-nocookie.com/embed/<id>` with facade thumbnail `https://i.ytimg.com/vi/<id>/hqdefault.jpg`; Facebook `https://www.facebook.com/plugins/video.php?href=<urlencoded>` with a styled 'Watch on Facebook' fallback card when embedding is unavailable; direct .mp4 via native `<video>`
**Processing**: URL parser classifies youtube/facebook/mp4, extracts YouTube IDs from watch/shorts/youtu.be/embed forms

### Owner-approved video placement (2026-11-25)
**Used by**: `applyApprovedVideos` action (post-submit, one-time) + seed defaults
**Source**: user approved the exact placement in chat ("Hya, ei sajano tei bosiye dao") — Showreel + Wide track from his Chitroboron wedding channel, Reels track from Make Frame Creation Shorts; Square slots stay empty.
**Processing**: the action fills only slots whose `video_url` is still empty (showreel setting + first 6 Reels and 6 Wide items by sort order), setting each item's title and YouTube watch URL exactly as approved; it never overwrites a link the owner later adds in admin. Seed updated to the same values so a fresh database matches.

## Long-term data behavior
- **Refresh policy**: none — all content is owner-edited data in the app DB; public page reads live from DB on every load, admin saves take effect immediately with no rebuild.
- **Growth**: owner adds/edits/deletes rows (work items, photos, services, FAQs, partners, journey chapters) from admin; reorder via sort_order.
- **Ordering**: sort_order ascending, then id.
- **Time semantics**: session tokens expire after 7 days; created_at stored as instants, rendered viewer-local.

## Rejected approaches
- **Tried**: editing the existing static portfolio-website artifact in place
  **Why rejected**: brief explicitly requires a separate new fullstack artifact and the static one kept untouched; a static artifact has no DB or actions for an admin backend.
- **Tried**: path-based /admin routing
  **Why rejected**: the artifact is a single-page app inside a sandboxed iframe; hash routing (#/admin) is the reliable in-app route. The admin is reached at #/admin and via an 'Admin' link in the footer.
