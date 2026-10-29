import { createHash } from "crypto";
import { countRecentSubmissionsByIp } from "@/lib/reviews/store";

const MAX_SUBMISSIONS_PER_DAY = 3;

export function hashClientIp(ip: string): string | null {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function getClientIp(request: Request): string | undefined {
  const cfConnectingIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfConnectingIp) return cfConnectingIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return request.headers.get("x-real-ip") ?? undefined;
}

export async function isRateLimited(ipHash: string | null): Promise<boolean> {
  if (!ipHash) return false;

  const since = Date.now() - 24 * 60 * 60 * 1000;
  const count = await countRecentSubmissionsByIp(ipHash, since);
  return count >= MAX_SUBMISSIONS_PER_DAY;
}
