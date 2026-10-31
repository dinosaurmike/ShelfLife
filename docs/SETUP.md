# Setting up ShelfLife

ShelfLife is a static web app (built with Vite) backed by a Supabase project. This guide covers
running it locally, the database, sign-in, building and deploying.

## 1. Run it locally

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:8000>. The app talks to the Supabase project configured in
`src/utils/constants.js` (see below).

## 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the **Project URL** and the **anon public key**, and put them in
   `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `src/utils/constants.js` (also in `analytics.html` and
   `laseroutput.html`, which have their own copies).
   - The anon key is designed to be public: Row-Level Security decides what each signed-in reader can
     see. **Never** put the `service_role` key in the app or in this repository.
3. **Sign-in with Google:** **Authentication → Providers → Google**, enable it and add your Google
   OAuth client ID and secret. In **Authentication → URL Configuration**, add your site's URL (and
   `http://localhost:8000` for testing) as allowed redirect URLs.

### Database migrations

Run the SQL files in `migrations/` in numerical order in Supabase's **SQL Editor**. They are written
to be safe to re-run where possible.

| File | What it does |
|---|---|
| `migration_25_admin_actions.sql` | Admin actions |
| `migration_26_advanced_admin.sql` | Advanced admin tools |
| `migration_27_add_username.sql` | Usernames |
| `migration_27_unlisted_links.sql` | Unlisted share links |
| `migration_28_public_shelves_default.sql` | Public shelves default |

Earlier migrations (the base `books` and `user_profiles` tables, social features, notes and more)
were applied to the original project before this repository was split out.

## 3. Build

```bash
npm run build
```

`dist/` then holds the complete site: the bundled app (`index.html` + `assets/`), the extra pages,
icons, scanner libraries, manifest, service worker and `_redirects`. Upload `dist/` to any static host.

## 4. Deploy on Netlify

- **Build command:** `npm run build` · **Publish directory:** `dist`
- `_redirects` handles the single-page routing and old addresses. The app is currently served from
  the `/NoteToShelf/` path (see `manifest.json`, `sw.js` and `_redirects`); serving it from a
  different path or its own domain means updating those three files and the Supabase redirect URLs.
- **AI review polishing:** the function in `netlify/functions/refineReview.js` reads
  `GEMINI_API_KEY` from **Site settings → Environment variables**. Set it there; never in the code.
- When you release, bump `CACHE_NAME` in `sw.js` so installed copies pick up the new version.

## 5. Scripts

`scripts/seed_public_clubs.js` and `scripts/scrape_oprah.js` are one-off data helpers. They read
`SUPABASE_URL` and `SUPABASE_KEY` from environment variables, so keys never live in the files:

```bash
SUPABASE_URL=https://… SUPABASE_KEY=… node scripts/seed_public_clubs.js
```
