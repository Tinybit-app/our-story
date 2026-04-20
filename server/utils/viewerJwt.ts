/**
 * Stateless viewer JWT utilities (build plan §4.5)
 *
 * Produces and verifies signed JWTs for read-only circle access.
 * No Supabase account is required — the token is the credential.
 *
 * Format: base64url(header).base64url(payload).base64url(HMAC-SHA256 signature)
 *
 * Payload: { circle_id, role: "viewer", exp: unix timestamp }
 */

import { createHmac, timingSafeEqual } from "node:crypto"

export interface ViewerPayload {
  circle_id: string
  role: "viewer"
  exp: number
}

// Default expiry: 30 days (matches design spec)
const DEFAULT_EXPIRY_SECONDS = 30 * 24 * 60 * 60

function b64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

function sign(data: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(data).digest())
}

export function signViewerToken(
  circleId: string,
  secret: string,
  expirySeconds = DEFAULT_EXPIRY_SECONDS
): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const payload = b64url(
    JSON.stringify({
      circle_id: circleId,
      role: "viewer",
      exp: Math.floor(Date.now() / 1000) + expirySeconds,
    } satisfies ViewerPayload)
  )
  const sig = sign(`${header}.${payload}`, secret)
  return `${header}.${payload}.${sig}`
}

export function verifyViewerToken(token: string, secret: string): ViewerPayload {
  const parts = token.split(".")
  if (parts.length !== 3) throw new Error("Invalid token format")

  const [header, payloadB64, sig] = parts

  // Verify signature
  const expectedSig = sign(`${header}.${payloadB64}`, secret)
  const expectedBuf = Buffer.from(expectedSig, "utf8")
  const actualBuf = Buffer.from(sig, "utf8")
  if (
    expectedBuf.length !== actualBuf.length ||
    !timingSafeEqual(expectedBuf, actualBuf)
  ) {
    throw new Error("Invalid token signature")
  }

  // Decode payload
  const payload = JSON.parse(
    Buffer.from(payloadB64, "base64url").toString("utf8")
  ) as ViewerPayload

  // Check expiry
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired")
  }

  return payload
}
