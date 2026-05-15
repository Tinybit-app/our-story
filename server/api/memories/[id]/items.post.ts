import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const bodySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('media'),
    storagePath: z.string().min(1),
    fileSize: z.number().int().positive(),
    mediaType: z.enum(['photo', 'video', 'live_photo']),
  }),
  z.object({
    type: z.literal('text'),
    textContent: z.string().min(1).max(2000),
  }),
  // Attaches a draft memory's media row to this memory and deletes the draft.
  // Mirrors how upload-batch composes multi-item memories from defer-uploaded
  // drafts, but for adding to an existing canonical memory.
  z.object({
    type: z.literal('draft'),
    draftMemoryId: z.uuid(),
  }),
])

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const memoryId = getRouterParam(event, 'id')
  if (!memoryId)
    throw createError({ statusCode: 400, message: 'Missing memory id' })

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success)
    throw createError({ statusCode: 400, message: 'Invalid request body.' })
  const bodyData = result.data

  const { data: memory } = await supabase
    .from('memory')
    .select('id, owner_user_id, circle_id')
    .eq('id', memoryId)
    .maybeSingle()

  if (!memory) throw createError({ statusCode: 404 })
  if (memory.owner_user_id !== user.sub) throw createError({ statusCode: 403 })

  // Compute next display_order
  const { data: maxRow } = await supabase
    .from('memorymedia')
    .select('display_order')
    .eq('memory_id', memoryId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxRow?.display_order ?? -1) + 1

  // ── Draft: reattach an existing draft's media row to this memory ────────
  if (bodyData.type === 'draft') {
    const { data: draft } = await supabase
      .from('memory')
      .select('id')
      .eq('id', bodyData.draftMemoryId)
      .eq('owner_user_id', user.sub)
      .eq('circle_id', memory.circle_id)
      .eq('visibility', 'draft')
      .maybeSingle()
    if (!draft)
      throw createError({ statusCode: 403, message: 'Invalid draft.' })

    const { data: moved, error: moveErr } = await supabase
      .from('memorymedia')
      .update({ memory_id: memoryId, display_order: nextOrder })
      .eq('memory_id', bodyData.draftMemoryId)
      .select('id')
    if (moveErr || !moved || moved.length === 0) {
      console.error('[items.post] draft reattach failed:', moveErr?.message)
      throw createError({ statusCode: 500, message: 'Failed to attach media.' })
    }

    // Drop the now-empty draft memory; its memorymedia row was already moved.
    await supabase.from('memory').delete().eq('id', bodyData.draftMemoryId)

    return { itemId: moved[0]!.id }
  }

  // ── Media or text: insert a fresh memorymedia row ───────────────────────
  // Each branch returns explicitly so TS narrows the discriminated union
  // cleanly (mixing the ternary with the earlier draft-return guard tripped
  // control-flow analysis and left `bodyData` as `text | draft` here).
  if (bodyData.type === 'media') {
    const { data: row, error } = await supabase
      .from('memorymedia')
      .insert({
        memory_id: memoryId,
        storage_path: bodyData.storagePath,
        file_size: bodyData.fileSize,
        media_type: bodyData.mediaType,
        display_order: nextOrder,
      })
      .select('id')
      .single()
    if (error || !row) {
      console.error('[items.post] media insert error:', error?.message)
      throw createError({ statusCode: 500, message: 'Failed to add item.' })
    }
    return { itemId: row.id }
  }

  const { data: row, error } = await supabase
    .from('memorymedia')
    .insert({
      memory_id: memoryId,
      media_type: 'text',
      text_content: bodyData.textContent,
      display_order: nextOrder,
    })
    .select('id')
    .single()
  if (error || !row) {
    console.error('[items.post] text insert error:', error?.message)
    throw createError({ statusCode: 500, message: 'Failed to add item.' })
  }
  return { itemId: row.id }
})
