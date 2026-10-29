/**
 * App-specific Cloudflare bindings. Run `npm run cf-typegen` after changing
 * wrangler.jsonc if you want Wrangler to regenerate the full Worker env types.
 *
 * REVIEWS is optional so Netlify production (no Worker bindings) still type-checks.
 */
declare global {
  interface CloudflareEnv {
    REVIEWS?: {
      get(key: string, type: "json"): Promise<unknown>;
      put(key: string, value: string): Promise<void>;
    };
  }
}

export {};
