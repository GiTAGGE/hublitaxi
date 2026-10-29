# AGENTS.md

## Project

HubliTaxi — a Next.js 15 (App Router) + TypeScript + Tailwind CSS marketing/SEO
website for a Hubli–Dharwad taxi service. Content is mostly file-based (JSON in
`src/data/`). **Customer reviews** use Netlify Blobs on the current production
host, or Cloudflare KV when the Worker `REVIEWS` binding is present — see README.

## Cursor Cloud specific instructions

- **Commands** (see `README.md` for details): `npm run dev` (dev server on
  http://localhost:3000), `npm run lint`, `npm run build`, `npm run start`.
  The update script already runs `npm install`, so dependencies are ready.
- **Dev server.** `npm run dev` stores reviews in `.data/reviews.json` locally.
  Netlify production uses Netlify Blobs. Cloudflare Workers preview uses KV when
  `REVIEWS` is bound. Turnstile required for production submissions. Admin needs
  `ADMIN_REVIEW_PASSWORD` + `ADMIN_SESSION_SECRET`.
- **Cloudflare preview.** `npm run preview` runs OpenNext + workerd. Do not run
  `npm run deploy` / `npm run upload`, change DNS, or attach `hublitaxi.com`
  unless the user explicitly asks. Keep `netlify.toml` and `@netlify/blobs`.
- **Business config lives in `src/data/site.ts`.** The phone/WhatsApp numbers
  there are placeholders. The booking form, click-to-call buttons and JSON-LD
  all read from this file, so update it (not individual components) when wiring
  real contact details.
- **Booking form has no server side.** `BookingForm` builds a `wa.me` WhatsApp
  deep link and opens it in a new tab — there is no form POST endpoint to mock.
  In a headless/sandboxed browser the new tab opens `web.whatsapp.com`; that is
  expected and confirms the lead capture works.
- **Programmatic pages.** `/routes/[slug]` and `/services/[slug]` are generated
  via `generateStaticParams` from `src/data/routes.json` and
  `src/data/services.json`. Adding an entry there automatically creates a new
  page and sitemap URL — no routing code changes needed.
- **Route pricing** — `fromPrice` in `routes.json` is the **sedan round-trip**
  fare shown on cards and route heroes. The fare table on `/routes/[slug]`
  scales other vehicles from that anchor using fleet `perKm` ratios (see
  `src/lib/pricing.ts`). All displayed route fares are round trip.
- **Next.js 15 params are async.** In dynamic pages, `params` is a `Promise` and
  must be `await`ed (and `generateMetadata` must be `async`), otherwise the build
  fails type-checking.
- **Fleet images** live in `public/images/fleet/`. Set the `image` path in
  `src/data/fleet.json` (e.g. `/images/fleet/sedan.jpg`). See
  `public/images/fleet/README.md` for naming and sizing. A placeholder is shown
  until the file exists.
- **Social share (OG) image** is `public/images/og.jpg` (1200×630), configured via
  `site.ogImage` in `src/data/site.ts`. Wired into layout Open Graph/Twitter
  metadata and JSON-LD. Replace the placeholder file to customise previews.
- **Site icon** — `src/app/icon.png`, `src/app/apple-icon.png`, and
  `public/favicon.ico` (gold “H” mark matching the header). Regenerate or replace
  these files to rebrand the favicon.
- **JSON-LD reviews** — do not add `aggregateRating` or `Review` to
  `LocalBusinessJsonLd`. Google flags self-serving review snippets as invalid on
  your own business site. Ratings are shown in the UI only (Hero, Testimonials).
- **Customer reviews** — `/reviews` form → `POST /api/reviews` → KV (Cloudflare)
  or Netlify Blobs (`pending`). Moderate at `/admin/reviews` with
  `ADMIN_REVIEW_PASSWORD` (no username). Approved reviews appear on home
  Testimonials + `/reviews`. Security: Turnstile CAPTCHA, honeypot, rate limit
  (3/day per hashed IP; `CF-Connecting-IP` then `x-forwarded-for`), sanitization.
- **Deployment** production is Netlify (`netlify.toml`, `@netlify/plugin-nextjs`).
  OpenNext config targets a `hublitaxi-preview` Worker with no custom domain.
  Do not switch the publish dir to a static export — server components/ISR rely
  on the Netlify runtime plugin and, on Cloudflare, the OpenNext Worker.
