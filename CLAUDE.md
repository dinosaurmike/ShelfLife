# ShelfLife: guide for contributors and AI coding assistants

ShelfLife is an installable reading-tracker web app (PWA) by Mike Warren
([dinosaurmike](https://github.com/dinosaurmike)). Readers log books, see them as spines on a
wooden shelf, explore their reading (stats, Reading DNA, Year in Review, The Reading Tree) and
connect with other readers (follows, notes, recommendations, book clubs).

The source is public for viewing; it is **all rights reserved** (see `LICENSE`).

## Ground rules

* **No secrets in the repository.** The Supabase anon key in `src/utils/constants.js`,
  `analytics.html` and `laseroutput.html` is public by design (Row-Level Security protects the
  data). Never add the `service_role` key, Google OAuth secrets or the Gemini key; server-side keys
  live in Netlify environment variables, script keys in shell environment variables.
* **Name:** the product is **ShelfLife** everywhere people can see it. It was briefly called
  "Note to Shelf": internal identifiers from that time stay as they are, because changing them
  would lose people's data or break installed copies:
  * `localStorage` keys `notetoshelf_guest_books`, `notetoshelf_is_guest`,
    `notetoshelf_cozy_mode`, `notetoshelf_cozy_prompted`
  * the `/NoteToShelf/` serving path (`manifest.json` start_url/icons, `sw.js`, `_redirects`,
    `src/core/auth.js`, `src/features/search.js` scanner path), manifest `id` `notetoshelf`, the
    service-worker cache name. Change these together only when the app moves to its new address,
    and add redirects from the old one.
* Every database table relies on Row-Level Security; new tables need policies before use.
* Keep changes small and in the existing style: plain JavaScript modules on `window.App`, no UI
  framework, hand-made SVG/canvas charts.

## Layout

| Path | What it holds |
|---|---|
| `index.html` | The app page: markup and most styles (large, by design). Loads `src/main.js`. |
| `src/main.js` | Entry point: imports every module and wires them onto `App`. |
| `src/core/` | `app.js` (state, rendering, routing, settings), `auth.js` (Google sign-in, guest/demo modes), `db.js` (Supabase client, mapping, sync queue) |
| `src/features/` | `bookshelf`, `search` (lookup, ISBN/cover scanning, metadata), `stats` (charts, Year in Review), `recaps`, `bookmarks`, `aggregate-view` (lifetime), `trophies`, `community*` (feed, notes, discover, clubs, admin), `splash` |
| `src/components/` | Header, Masthead, MonthlyPace, BookShelf |
| `src/utils/`, `src/constants/` | Supabase config and constants, DOM helpers, maths, symbols, relics |
| `src/style.css` | Styles for the modular parts |
| `analytics.html`, `reading_tree.html`, `laseroutput.html` | Admin dashboard, The Reading Tree, Laser Output (Hershey single-stroke fonts via `hershey.js`) |
| `privacy.html` | Privacy policy (also required for Google sign-in verification) |
| `libs/` | QuaggaJS, ZXing, Tesseract.js, lazy-loaded for scanning |
| `migrations/` | SQL migrations (run in order in Supabase) |
| `netlify/functions/refineReview.js` | Gemini-powered review polishing (`GEMINI_API_KEY` from Netlify env) |
| `scripts/` | `copy-static.mjs` (build step) and one-off data scripts |
| `docs/` | `SETUP.md`, images and the header's HTML source |

## Building

* `npm install`, then `npm run dev` (port 8000) or `npm run build` → `dist/` (Vite bundles
  `index.html` + `src/` and the extra pages; `scripts/copy-static.mjs` copies the files loaded by
  path at run time: libs, icons, manifest, service worker, redirects, `hershey.js`, `qrcode.js`,
  privacy and clear-cache pages).
* CSS is minified with esbuild (`cssMinify: 'esbuild'` in `vite.config.mjs`) because the inline
  styles contain a few harmless slips that the stricter default minifier rejects.
* Bump `CACHE_NAME` in `sw.js` with each release.

## Design

* Editorial "Classic" theme: cream `#FAF8F5`, burgundy `#8B2635`, soft gold `#D4AF37`, 8 px rhythm.
  Type: Playfair Display (headings), Outfit / system UI (text), DM Mono (numbers, labels).
* Length is measured in words (the single source of truth); pages convert at 300 words per page.
* Mobile-first, bottom navigation, haptics, five themes, Cozy Mode.
