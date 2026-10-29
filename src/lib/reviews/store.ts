import "server-only";

import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { PublicReview, Review } from "@/lib/reviews/types";

const BLOB_STORE = "hubli-reviews";
const BLOB_KEY = "all-reviews";
const FILE_PATH = path.join(process.cwd(), ".data", "reviews.json");

type ReviewRecord = Review & { ip_hash?: string | null };
type ReviewData = { reviews: ReviewRecord[] };

type ReviewsKv = {
  get(key: string, type: "json"): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
};

function isBuildPhase() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function isLocalDev() {
  return (
    process.env.NODE_ENV === "development" &&
    !process.env.AWS_LAMBDA_FUNCTION_NAME &&
    process.env.NETLIFY !== "true"
  );
}

/** Use Netlify Blobs on production; local file store in dev. */
function shouldUseBlobs() {
  if (isBuildPhase()) return false;
  if (isLocalDev()) return false;
  return true;
}

function blobCredentials() {
  const siteID =
    process.env.NETLIFY_SITE_ID ??
    process.env.SITE_ID ??
    process.env.NETLIFY_PROJECT_ID;
  const token =
    process.env.NETLIFY_AUTH_TOKEN ??
    process.env.NETLIFY_API_TOKEN ??
    process.env.NETLIFY_PERSONAL_ACCESS_TOKEN;
  return { siteID, token };
}

async function getBlobStore() {
  const { getStore } = await import("@netlify/blobs");

  try {
    return getStore(BLOB_STORE);
  } catch {
    const { siteID, token } = blobCredentials();
    if (siteID && token) {
      return getStore({ name: BLOB_STORE, siteID, token });
    }
    throw new Error(
      "Netlify Blobs is not configured. Add NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN in Netlify environment variables."
    );
  }
}

/**
 * Cloudflare KV takes precedence only when the REVIEWS binding is present.
 * `next dev` and `next build` keep using the file store so Netlify production
 * and local file-based workflows stay unchanged.
 */
async function getReviewsKv(): Promise<ReviewsKv | undefined> {
  if (isBuildPhase() || isLocalDev()) return undefined;

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return env.REVIEWS;
  } catch {
    return undefined;
  }
}

function parseReviewData(data: unknown): ReviewData {
  if (data && typeof data === "object" && "reviews" in data) {
    const reviews = (data as ReviewData).reviews;
    if (Array.isArray(reviews)) return { reviews };
  }
  return { reviews: [] };
}

function toPublicReview(row: ReviewRecord): PublicReview {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    rating: row.rating,
    text: row.text,
    created_at: row.created_at,
  };
}

async function readFileStore(): Promise<ReviewData> {
  try {
    const raw = await readFile(FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as ReviewData;
    return Array.isArray(parsed.reviews) ? parsed : { reviews: [] };
  } catch {
    return { reviews: [] };
  }
}

async function writeFileStore(data: ReviewData): Promise<void> {
  await mkdir(path.dirname(FILE_PATH), { recursive: true });
  await writeFile(FILE_PATH, JSON.stringify(data, null, 2), "utf8");
}

async function readBlobStore(): Promise<ReviewData> {
  const store = await getBlobStore();
  const data = await store.get(BLOB_KEY, { type: "json" });
  return parseReviewData(data);
}

async function writeBlobStore(data: ReviewData): Promise<void> {
  const store = await getBlobStore();
  await store.setJSON(BLOB_KEY, data);
}

async function readKvStore(kv: ReviewsKv): Promise<ReviewData> {
  const data = await kv.get(BLOB_KEY, "json");
  return parseReviewData(data);
}

async function writeKvStore(kv: ReviewsKv, data: ReviewData): Promise<void> {
  await kv.put(BLOB_KEY, JSON.stringify(data));
}

async function readStore(): Promise<ReviewData> {
  const kv = await getReviewsKv();
  if (kv) {
    try {
      return await readKvStore(kv);
    } catch {
      return { reviews: [] };
    }
  }

  if (shouldUseBlobs()) {
    try {
      return await readBlobStore();
    } catch {
      return { reviews: [] };
    }
  }

  return readFileStore();
}

async function writeStore(data: ReviewData): Promise<void> {
  const kv = await getReviewsKv();
  if (kv) {
    await writeKvStore(kv, data);
    return;
  }

  if (shouldUseBlobs()) {
    await writeBlobStore(data);
    return;
  }

  await writeFileStore(data);
}

function getApprovedSorted(reviews: ReviewRecord[]) {
  return reviews
    .filter((r) => r.status === "approved")
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export async function getApprovedReviewRatings(): Promise<number[]> {
  const { reviews } = await readStore();
  return getApprovedSorted(reviews).map((r) => r.rating);
}

export async function getApprovedReviewsPage(
  offset = 0,
  limit = 12
): Promise<{ reviews: PublicReview[]; total: number }> {
  const { reviews } = await readStore();
  const approved = getApprovedSorted(reviews);
  return {
    reviews: approved.slice(offset, offset + limit).map(toPublicReview),
    total: approved.length,
  };
}

export async function getApprovedReviews(limit = 500): Promise<PublicReview[]> {
  const { reviews } = await getApprovedReviewsPage(0, limit);
  return reviews;
}

export async function getPendingReviews(): Promise<Review[]> {
  const { reviews } = await readStore();
  return reviews
    .filter((r) => r.status === "pending")
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    .map(({ ip_hash: _, ...review }) => review);
}

export async function insertReview(input: {
  name: string;
  location: string;
  rating: number;
  text: string;
  ipHash: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const data = await readStore();
    data.reviews.push({
      id: randomUUID(),
      name: input.name,
      location: input.location,
      rating: input.rating,
      text: input.text,
      status: "pending",
      ip_hash: input.ipHash,
      created_at: new Date().toISOString(),
    });
    await writeStore(data);
    return { ok: true };
  } catch (error) {
    console.error("insertReview failed:", error);
    return { ok: false, error: "Could not save review" };
  }
}

export async function updateReviewStatus(
  id: string,
  status: "approved" | "rejected"
): Promise<boolean> {
  try {
    const data = await readStore();
    const review = data.reviews.find((r) => r.id === id && r.status === "pending");
    if (!review) return false;
    review.status = status;
    await writeStore(data);
    return true;
  } catch (error) {
    console.error("updateReviewStatus failed:", error);
    return false;
  }
}

export async function countRecentSubmissionsByIp(
  ipHash: string,
  sinceMs: number
): Promise<number> {
  const { reviews } = await readStore();
  return reviews.filter(
    (r) =>
      r.ip_hash === ipHash &&
      new Date(r.created_at).getTime() > sinceMs
  ).length;
}
