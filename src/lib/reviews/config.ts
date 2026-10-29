/** Reviews use Cloudflare KV when bound, otherwise Netlify Blobs (no external database). */
export function isReviewsEnabled() {
  return true;
}

export function isTurnstileEnabled() {
  return Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY &&
      process.env.TURNSTILE_SECRET_KEY
  );
}

export function isAdminConfigured() {
  return Boolean(
    process.env.ADMIN_REVIEW_PASSWORD && process.env.ADMIN_SESSION_SECRET
  );
}
