import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAX_PHOTO_BYTES = 50 * 1024 * 1024 // 50 MB
const MAX_VIDEO_BYTES = 500 * 1024 * 1024 // 500 MB

const APP_URL = Deno.env.get('APP_URL') ?? '*'

const corsHeaders = {
  'Access-Control-Allow-Origin': APP_URL,
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

const text = (body: string, init: ResponseInit = {}) =>
  new Response(body, {
    ...init,
    headers: { ...corsHeaders, ...(init.headers ?? {}) },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  const {
    data: { user },
  } = await supabase.auth.getUser(token)
  if (!user) return text('Unauthorized', { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const circleId = formData.get('circleId') as string
  const note = formData.get('note') as string | null
  const milestoneLabel = formData.get('milestoneLabel') as string | null
  const memoryDate = formData.get('memoryDate') as string | null

  if (!file || !circleId) {
    return json({ error: 'file and circleId are required' }, { status: 400 })
  }

  // File size check
  const isVideo = file.type.startsWith('video/')
  const maxSize = isVideo ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES
  if (file.size > maxSize) {
    return json({ error: 'file_too_large' }, { status: 413 })
  }

  // Verify user is a member of this circle
  const { data: membership } = await supabase
    .from('circlemember')
    .select('id')
    .eq('user_id', user.id)
    .eq('circle_id', circleId)
    .maybeSingle()

  if (!membership) return text('Forbidden', { status: 403 })

  // Storage quota check (platform_admins are exempt)
  const [{ data: storage }, { data: userRecord }] = await Promise.all([
    supabase
      .from('accountstorage')
      .select('total_used_bytes, total_quota_bytes, bonus_bytes')
      .eq('user_id', user.id)
      .single(),
    supabase.from('user').select('platform_role').eq('id', user.id).single(),
  ])

  if (userRecord?.platform_role !== 'platform_admin') {
    const quota =
      (storage?.total_quota_bytes ?? 0) + (storage?.bonus_bytes ?? 0)
    const used = storage?.total_used_bytes ?? 0
    if (used + file.size > quota) {
      return json({ error: 'storage_full' }, { status: 413 })
    }
  }

  const url = new URL(req.url)
  const isDeferred = url.searchParams.get('defer') === 'true'

  // Upload to private storage bucket
  const ext = file.name.split('.').pop()
  const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`
  const fileBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('memories-private')
    .upload(storagePath, fileBuffer, { contentType: file.type })

  if (uploadError) {
    return json({ error: uploadError.message }, { status: 500 })
  }

  // Optional client-generated thumbnail. Failure here is non-fatal — the
  // original is already saved and the read path will fall back to signing
  // the original. Same bucket as the original; path = original sans ext +
  // ".thumb.webp". Thumbnail bytes do NOT count against storage quota
  // (they're a derived cache, not user data).
  const thumbnail = formData.get('thumbnail')
  let thumbnailPath: string | null = null
  if (thumbnail instanceof File || thumbnail instanceof Blob) {
    const dot = storagePath.lastIndexOf('.')
    const base = dot > 0 ? storagePath.slice(0, dot) : storagePath
    const thumbPath = `${base}.thumb.webp`
    const thumbBuffer = await thumbnail.arrayBuffer()
    const { error: thumbErr } = await supabase.storage
      .from('memories-private')
      .upload(thumbPath, thumbBuffer, { contentType: 'image/webp' })
    if (thumbErr) {
      console.error(
        `[upload-media] thumb upload failed (${thumbPath}):`,
        thumbErr.message,
      )
    } else {
      thumbnailPath = thumbPath
    }
  }

  // Helper: remove the original AND (if uploaded) the thumbnail in one call.
  const cleanupStorage = async () => {
    const paths = thumbnailPath ? [storagePath, thumbnailPath] : [storagePath]
    await supabase.storage.from('memories-private').remove(paths)
  }

  // Insert Memory row
  const { data: memory, error: memoryError } = await supabase
    .from('memory')
    .insert({
      owner_user_id: user.id,
      circle_id: circleId,
      visibility: isDeferred ? 'draft' : 'circle',
      note: isDeferred ? null : note || null,
      milestone_label: isDeferred ? null : milestoneLabel || null,
      memory_date: memoryDate || new Date().toISOString(),
    })
    .select()
    .single()

  if (memoryError || !memory) {
    await cleanupStorage()
    return json(
      { error: memoryError?.message ?? 'Failed to save memory' },
      { status: 500 },
    )
  }

  // Insert MemoryMedia row (storage_path + thumbnail_path never leave the server)
  const { data: media, error: mediaError } = await supabase
    .from('memorymedia')
    .insert({
      memory_id: memory.id,
      storage_path: storagePath,
      thumbnail_path: thumbnailPath,
      file_size: file.size,
      media_type: isVideo ? 'video' : 'photo',
      display_order: 0,
    })
    .select('id')
    .single()

  if (mediaError || !media) {
    await cleanupStorage()
    await supabase.from('memory').delete().eq('id', memory.id)
    return json(
      { error: mediaError?.message ?? 'Failed to save media' },
      { status: 500 },
    )
  }

  // Increment storage usage
  await supabase
    .from('accountstorage')
    .update({ total_used_bytes: (storage?.total_used_bytes ?? 0) + file.size })
    .eq('user_id', user.id)

  return json({ ok: true, memoryId: memory.id, mediaId: media.id })
})
