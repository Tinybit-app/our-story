import { serverSupabaseUser, serverSupabaseClient } from "#supabase/server"
import { z } from "zod"

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const THIRTY_DAYS_S = 30 * 24 * 60 * 60

const bodySchema = z.object({
  mode: z.enum(["full", "date_range", "selection"]),
  label: z.string().max(100).optional(),
  memoryIds: z.array(z.uuid()).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).superRefine((data, ctx) => {
  if (data.mode === "selection" && (!data.memoryIds || data.memoryIds.length === 0)) {
    ctx.addIssue({ code: "custom", message: "memoryIds required for selection mode", path: ["memoryIds"] })
  }
  if (data.mode === "date_range" && (!data.dateFrom || !data.dateTo)) {
    ctx.addIssue({ code: "custom", message: "dateFrom and dateTo required for date_range mode", path: ["dateFrom"] })
  }
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: "Unauthorized." })

  const circleId = getRouterParam(event, "id")!
  const secret = useRuntimeConfig(event).jwtSecret as string
  if (!secret) throw createError({ statusCode: 500, message: "Server misconfiguration." })

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: "Invalid request body." })

  const { mode, label, memoryIds, dateFrom, dateTo } = parsed.data

  const supabase = await serverSupabaseClient(event)

  // Verify requester is owner
  const { data: membership } = await supabase
    .from("circlemember")
    .select("role")
    .eq("circle_id", circleId)
    .eq("user_id", user.sub)
    .maybeSingle()

  if (membership?.role !== "owner") {
    throw createError({ statusCode: 403, message: "Only the circle owner can create viewer links." })
  }

  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString()
  const defaultLabel = buildDefaultLabel(mode, memoryIds, dateFrom, dateTo)

  const { data: link, error } = await supabase
    .from("viewer_link")
    .insert({
      circle_id: circleId,
      mode,
      memory_ids: memoryIds ?? null,
      date_from: dateFrom ?? null,
      date_to: dateTo ?? null,
      label: label ?? defaultLabel,
      expires_at: expiresAt,
    })
    .select("id, nonce, mode, memory_ids, date_from, date_to, label, expires_at, created_at")
    .single()

  if (error || !link) {
    console.error("[viewer-links.post] insert failed:", error?.message)
    throw createError({ statusCode: 500, message: "Failed to create viewer link." })
  }

  const token = signViewerToken(circleId, secret, THIRTY_DAYS_S, link.id, link.nonce)
  const memoryCount = mode === "selection" ? (memoryIds?.length ?? 0) : null
  const dateRange = mode === "date_range" && dateFrom && dateTo
    ? { from: dateFrom, to: dateTo }
    : null

  return {
    id: link.id,
    mode: link.mode as "full" | "date_range" | "selection",
    label: link.label,
    expiresAt: link.expires_at,
    isExpired: false,
    memoryCount,
    dateRange,
    token,
  }
})

function buildDefaultLabel(
  mode: string,
  memoryIds?: string[],
  dateFrom?: string,
  dateTo?: string
): string {
  if (mode === "full") return "Full timeline"
  if (mode === "date_range" && dateFrom && dateTo) {
    const fmt = (d: string) =>
      new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(d))
    return `${fmt(dateFrom)} – ${fmt(dateTo)}`
  }
  if (mode === "selection") return `${memoryIds?.length ?? 0} memories`
  return "Viewer link"
}
