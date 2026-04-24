import { serverSupabaseServiceRole } from "#supabase/server"
import { z } from "zod"

const VALID_EMOJIS = ["❤️", "😂", "😮", "😢", "👏"] as const

const schema = z.object({
  viewerToken: z.string().min(1),
  memoryId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  emoji: z.enum(VALID_EMOJIS),
  guestName: z.string().max(100).optional(),
})

export default defineEventHandler(async (event) => {
  const result = schema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: "Invalid request body." })

  const { viewerToken, memoryId, emoji, guestName } = result.data
  const secret = useRuntimeConfig(event).jwtSecret as string
  if (!secret) throw createError({ statusCode: 500, message: "Server misconfiguration." })

  let circleId: string
  let viewerLinkId: string
  let nonce: string
  try {
    const payload = verifyViewerToken(viewerToken, secret)
    circleId = payload.circle_id
    viewerLinkId = payload.viewer_link_id
    nonce = payload.nonce
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ""
    if (msg.toLowerCase().includes("expired")) {
      throw createError({ statusCode: 401, message: "expired" })
    }
    throw createError({ statusCode: 401, message: "Invalid viewer token." })
  }

  const supabase = serverSupabaseServiceRole(event)

  // Revocation check — same as viewer/timeline.get.ts
  const { data: viewerLink } = await supabase
    .from("viewer_link")
    .select("nonce, expires_at")
    .eq("id", viewerLinkId)
    .maybeSingle()

  if (!viewerLink || viewerLink.nonce !== nonce) {
    throw createError({ statusCode: 401, message: "Invalid viewer token." })
  }
  if (new Date(viewerLink.expires_at).getTime() < Date.now()) {
    throw createError({ statusCode: 401, message: "expired" })
  }

  // Verify the memory belongs to this circle
  const { data: memory } = await supabase
    .from("memory")
    .select("id")
    .eq("id", memoryId)
    .eq("circle_id", circleId)
    .eq("visibility", "circle")
    .maybeSingle()

  if (!memory) throw createError({ statusCode: 404, message: "Memory not found." })

  const { error } = await (supabase.from("memoryreaction") as any)
    .insert({
      memory_id: memoryId,
      user_id: null,
      emoji,
      guest_name: guestName ?? "Viewer",
    })

  if (error) {
    console.error("[reactions/guest] insert failed:", error.message)
    throw createError({ statusCode: 500, message: "Failed to save reaction." })
  }

  return { ok: true }
})
