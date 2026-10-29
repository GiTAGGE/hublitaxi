# HubliTaxi

Marketing & lead-generation website for **Hubli Taxi** — a local, airport, railway and outstation cab service for Hubli–Dharwad. Built for speed, SEO and high conversion.

Live domain: [hublitaxi.com](https://hublitaxi.com) (Cloudflare Workers via OpenNext).

## Tech stack

- **Next.js 15** (App Router, Server Components, static generation)
- **TypeScript**
- **Tailwind CSS 3**
- JSON content layer + moderated customer reviews (Netlify Blobs in production today; Cloudflare KV when the `REVIEWS` binding is present)
- SEO: dynamic `sitemap.xml`, `robots.txt`, Open Graph + JSON-LD (`TaxiService`, `FAQPage`, `Service`)
- Production is **Cloudflare Workers** via OpenNext (`hublitaxi-preview`). **Netlify** remains configured as a rollback (`netlify.toml`, `@netlify/blobs`) until it is explicitly removed.

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start Next.js dev server at http://localhost:3000
npm run lint     # run ESLint
npm run build    # production Next.js build (prerenders all pages)
npm run start    # serve the Next.js production build
npm run preview  # OpenNext build + local Workers runtime (workerd)
```

Requires Node.js 20+ (see `.nvmrc`).

## Project structure

```
src/
├── app/                 # App Router pages
│   ├── page.tsx         # home page (assembles all sections)
│   ├── routes/[slug]/   # programmatic per-route landing pages (SEO)
│   ├── services/[slug]/ # per-service landing pages
│   ├── routes/, about/, contact/, privacy/, terms/
│   ├── sitemap.ts       # dynamic sitemap
│   └── robots.ts        # robots.txt
├── components/          # Header, Footer, Hero, BookingForm, sections, Icons
├── data/                # content layer
│   ├── site.ts          # business config (phone, WhatsApp, address) — EDIT THIS
│   ├── routes.json      # outstation routes (drives route pages + sitemap)
│   ├── services.json    # services
│   ├── fleet.json       # cars
│   ├── testimonials.json
│   └── faq.json
└── lib/format.ts
```

## Configuration

Update real business details in **`src/data/site.ts`** — especially `phone`, `phoneHref`
(the `tel:` link) and `whatsapp` (E.164, no `+` or spaces). These power the
click-to-call buttons, the WhatsApp booking deep links and the structured data.

Add or edit outstation routes in `src/data/routes.json`; each entry automatically
generates an SEO-optimized landing page at `/routes/<slug>` and is added to the sitemap.
Set **`fromPrice`** per route in `routes.json` (sedan round-trip). Other
vehicle fares on route pages scale from that using `perKm` in `fleet.json`
(`src/lib/pricing.ts`).

Travel guides (must-visit places, hidden gems, road tips) live in
`src/data/route-guides.json` — one entry per route `slug`. The route page
renders this via `RouteTravelGuide`.

## Images

Fleet photos go in **`public/images/fleet/`**. Name files after the vehicle
`slug` in `src/data/fleet.json` (e.g. `sedan.jpg`) and set the matching
`image` path in that JSON file. See `public/images/fleet/README.md`.

Social share preview: replace **`public/images/og.jpg`** (1200×630) or update
`ogImage` in `src/data/site.ts`. See `public/images/og-README.md`.

## Customer reviews (no database)

**No Supabase or external database.** Review JSON is stored in **Netlify Blobs**
on the current production site. On Cloudflare Workers, the same document is stored
in **Workers KV** when the `REVIEWS` binding exists. `npm run dev` still uses
`.data/reviews.json`.

| Layer | What it does |
| ----- | ------------ |
| **Storage** | Cloudflare KV (Worker, when bound) → Netlify Blobs (production) → `.data/reviews.json` (`next dev`) |
| **Moderation** | Submissions stay `pending` until you approve at `/admin/reviews` |
| **Turnstile** | Cloudflare CAPTCHA blocks bots (required in production) |
| **Honeypot** | Hidden field catches automated spam |
| **Rate limit** | Max 3 submissions per hashed IP per 24 hours |
| **Sanitization** | Plain text only — HTML/links stripped |

### Setup (Netlify env vars)

In **Netlify → Site settings → Environment variables**, add:

| Variable | Purpose |
| -------- | ------- |
| `ADMIN_REVIEW_PASSWORD` | Password you choose for the moderation panel |
| `ADMIN_SESSION_SECRET` | Random string (`openssl rand -hex 32`) |
| `IP_HASH_SALT` | Random string for rate-limiting |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | From [Cloudflare Turnstile](https://dash.cloudflare.com/turnstile) |
| `TURNSTILE_SECRET_KEY` | Turnstile secret key |
| `NETLIFY_SITE_ID` | **If reviews fail to save:** Project ID from Netlify → Project configuration → General |
| `NETLIFY_AUTH_TOKEN` | **If reviews fail to save:** [Personal access token](https://app.netlify.com/user/applications) with Blobs access |

### Admin login

1. Go to **`https://hublitaxi.com/admin/reviews`**
2. Enter the password you set as `ADMIN_REVIEW_PASSWORD`
3. Approve or reject pending reviews — approved ones appear on the home page

There is no separate username; only the password you set in Netlify. The session
lasts 8 hours (secure httpOnly cookie).

Seeded reviews in `testimonials.json` always show on the home page. Approved
customer reviews are added on top and included in the rating count.

## Google Analytics 4

Uses the official Next.js [`@next/third-parties`](https://nextjs.org/docs/app/building-your-application/optimizing/third-party-libraries#google-analytics) integration (Google tag / gtag.js). Analytics is **off** until you set the env var.

### Setup

1. Create a [GA4 property](https://analytics.google.com/) for `hublitaxi.com`.
2. **Admin → Data streams → Web** → copy the **Measurement ID** (`G-XXXXXXXXXX`).
3. In **Netlify → Environment variables**, add:
   - `NEXT_PUBLIC_GA_MEASUREMENT_ID` = `G-XXXXXXXXXX`
4. Redeploy the site.

### Tracked events

| User action | GA4 event | Parameters |
| ----------- | --------- | ---------- |
| Call button click | `contact` | `method: Phone`, `link_location` (e.g. `header`, `sticky_mobile`) |
| WhatsApp click | `contact` | `method: WhatsApp`, `link_location` |
| Booking form submit | `generate_lead` | `lead_source: booking_form_whatsapp`, trip/service/vehicle |
| Review form submit | `submit_review` | `form_name`, `rating` |
| Page views | automatic + client navigations | `page_path` |

View reports in GA4 → **Reports → Engagement → Events**. Mark `generate_lead` as a
conversion in **Admin → Events → Mark as conversion** to track booking leads.

### GTM vs gtag

This site uses **gtag directly** (simpler, fewer moving parts). Use [Google Tag Manager](https://tagmanager.google.com/) only if you need multiple marketing pixels (Meta, Ads, etc.) without code changes.

## Deployment (Netlify)

The repo includes `netlify.toml`. On Netlify, connect this GitHub repository and deploy —
the build command is `next build` and the Next.js runtime plugin handles the rest.
Add review env vars in the Netlify dashboard before enabling the review form in production.

Production DNS for `hublitaxi.com` is on Cloudflare (`arushi` / `gerald` NS).
The Worker Custom Domains are `hublitaxi.com` and `www.hublitaxi.com`. Keep the
Netlify site until rollback is no longer needed.

## Cloudflare Workers (OpenNext)

This app stays on **Next.js 15** (not 16, not vinext). `@opennextjs/cloudflare@1.20.14`
declares a peer of `next@>=15.5.28 <16`, so the previously locked 15.5.19 patch
was bumped to **15.5.28** to satisfy the adapter. Worker name is `hublitaxi-preview`.
Custom Domains: `hublitaxi.com` and `www.hublitaxi.com`. `workers_dev` stays on
as a rollback URL.

### Local OpenNext commands

```bash
cp .dev.vars.example .dev.vars    # NEXTJS_ENV=development only; never commit secrets
npm run build                     # same Next.js build Netlify uses
npm run preview                   # opennextjs-cloudflare build && preview (workerd)
npm run cf-typegen                # optional: regenerate cloudflare-env.d.ts
```

`npm run upload` / `npm run deploy` talk to Cloudflare. Do not run them until a
preview deployment is approved. If you do deploy later, use `--keep-vars` (already
in those scripts) so dashboard secrets are not wiped.

### Create Cloudflare resources (once, in your account)

Resource **IDs** cannot be committed until Wrangler prints them. Binding **names**
in `wrangler.jsonc` are already set to the official OpenNext names.

```bash
npx wrangler login

# R2 — incremental cache for ISR (`revalidate = 60` on / and /reviews)
npx wrangler r2 bucket create hublitaxi-next-cache

# D1 — tag cache for revalidatePath after review approval
npx wrangler d1 create hublitaxi-next-tag-cache
# Paste database_id into wrangler.jsonc → d1_databases[0].database_id
# (omitted in-repo because IDs are account-specific)

# KV — customer reviews document (key: all-reviews)
npx wrangler kv namespace create REVIEWS
# Paste id into wrangler.jsonc → kv_namespaces[0].id
```

Durable Object class `DOQueueHandler` is provided by the OpenNext Worker build;
the `v1` migration in `wrangler.jsonc` registers it. No extra create command.

`npm run preview` / `upload` / `deploy` run OpenNext `populateCache`, which
creates the D1 `revalidations` table. The statement the adapter `@opennextjs/cloudflare@1.20.14`
uses (if you need to run it by hand):

```bash
npx wrangler d1 execute NEXT_TAG_CACHE_D1 --command "CREATE TABLE IF NOT EXISTS revalidations (tag TEXT NOT NULL, revalidatedAt INTEGER NOT NULL, stale INTEGER, expire INTEGER default NULL, UNIQUE(tag) ON CONFLICT REPLACE);"
```

### Cloudflare environment variables

Set these in the Worker **Settings → Variables and Secrets** (and in **Build
variables** too if you later use Workers Builds). Do not put values in git.

| Variable | Runtime | Build | Secret |
| -------- | ------- | ----- | ------ |
| `ADMIN_REVIEW_PASSWORD` | yes | no | yes |
| `ADMIN_SESSION_SECRET` | yes | no | yes |
| `IP_HASH_SALT` | yes | no | yes |
| `TURNSTILE_SECRET_KEY` | yes | no | yes |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | yes | yes | no |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | yes | yes | no |
| `NETLIFY_SITE_ID` / `NETLIFY_AUTH_TOKEN` | only if you still need Blobs from a Worker | no | yes |

Reviews on the preview Worker should use KV, so Netlify Blobs tokens are **not**
required there. Do not point preview at production Blobs unless you intend to
share that data.

Turnstile: allow `hublitaxi.com`, `www.hublitaxi.com`, and
`hublitaxi-preview.hublitaxi.workers.dev` on the widget.

### Bindings already named in `wrangler.jsonc`

| Binding | Resource | Purpose |
| ------- | -------- | ------- |
| `ASSETS` | OpenNext static assets | Required |
| `WORKER_SELF_REFERENCE` | this Worker (`hublitaxi-preview`) | ISR / revalidation |
| `NEXT_INC_CACHE_R2_BUCKET` | R2 `hublitaxi-next-cache` | ISR incremental cache |
| `NEXT_CACHE_DO_QUEUE` | Durable Object `DOQueueHandler` | Time-based revalidate queue |
| `NEXT_TAG_CACHE_D1` | D1 `hublitaxi-next-tag-cache` | `revalidatePath` |
| `REVIEWS` | KV namespace | Review JSON |
| `IMAGES` | Cloudflare Images | `next/image` |

**Optional after cutover:** OpenNext cache purge (`CACHE_PURGE_API_TOKEN`,
`CACHE_PURGE_ZONE_ID` for zone `hublitaxi.com`). ISR still refreshes on the 60s
window without it; on-demand `revalidatePath` uses D1.

**Images:** the `IMAGES` binding is the official OpenNext hook. It can incur
[Cloudflare Images](https://developers.cloudflare.com/images/pricing/) charges.
If the account does not have Images, remove the `images` block from
`wrangler.jsonc` and set `images.unoptimized: true` in `next.config.mjs` for
preview only.

### Rollback URL

`https://hublitaxi-preview.hublitaxi.workers.dev` stays available. Canonical
tags and `sitemap.xml` use `https://hublitaxi.com`.
