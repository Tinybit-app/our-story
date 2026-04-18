import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const MAX_PHOTO_BYTES = 50 * 1024 * 1024   // 50 MB
const MAX_VIDEO_BYTES = 500 * 1024 * 1024  // 500 MB

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  const authHeader = req.headers.get("Authorization")
  const token = authHeader?.replace("Bearer ", "")
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return new Response("Unauthorized", { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File
  const circleId = formData.get("circleId") as string
  const note = formData.get("note") as string | null
  const milestoneLabel = formData.get("milestoneLabel") as string | null
  const memoryDate = formData.get("memoryDate") as string | null

  if (!file || !circleId) {
    return Response.json({ error: "file and circleId are required" }, { status: 400 })
  }

  // File size check
  const isVideo = file.type.startsWith("video/")
  const maxSize = isVideo ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES
  if (file.size > maxSize) {
    return Response.json({ error: "file_too_large" }, { status: 413 })
  }

  // Verify user is a member of this circle
  const { data: membership } = await supabase
    .from("circlemember")
    .select("id")
    .eq("user_id", user.id)
    .eq("circle_id", circleId)
    .maybeSingle()

  if (!membership) return new Response("Forbidden", { status: 403 })

  // Storage quota check (platform_admins are exempt)
  const [{ data: storage }, { data: userRecord }] = await Promise.all([
    supabase
      .from("accountstorage")
      .select("total_used_bytes, total_quota_bytes, bonus_bytes")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("user")
      .select("platform_role")
      .eq("id", user.id)
      .single(),
  ])

  if (userRecord?.platform_role !== "platform_admin") {
    const quota = (storage?.total_quota_bytes ?? 0) + (storage?.bonus_bytes ?? 0)
    const used = storage?.total_used_bytes ?? 0
    if (used + file.size > quota) {
      return Response.json({ error: "storage_full" }, { status: 413 })
    }
  }

  // Upload to private storage bucket
  const ext = file.name.split(".").pop()
  const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`
  const fileBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from("memories-private")
    .upload(storagePath, fileBuffer, { contentType: file.type })

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 })
  }

  // Insert Memory row
  const { data: memory, error: memoryError } = await supabase
    .from("memory")
    .insert({
      owner_user_id: user.id,
      circle_id: circleId,
      visibility: "circle",
      note: note || null,
      milestone_label: milestoneLabel || null,
      memory_date: memoryDate || new Date().toISOString(),
    })
    .select()
    .single()

  if (memoryError || !memory) {
    // Clean up uploaded file on failure
    await supabase.storage.from("memories-private").remove([storagePath])
    return Response.json({ error: memoryError?.message ?? "Failed to save memory" }, { status: 500 })
  }

  // Insert MemoryMedia row (storage_path never leaves the server)
  await supabase.from("memorymedia").insert({
    memory_id: memory.id,
    storage_path: storagePath,
    file_size: file.size,
    media_type: isVideo ? "video" : "photo",
  })

  // Increment storage usage
  await supabase
    .from("accountstorage")
    .update({ total_used_bytes: (storage?.total_used_bytes ?? 0) + file.size })
    .eq("user_id", user.id)

  return Response.json({ ok: true, memoryId: memory.id })
})
