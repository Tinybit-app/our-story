import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildFirstMonthRecapEmail } from './firstMonthRecapEmail.ts'

// Triggered daily by pg_cron at 9am UTC.
//
// SELECT cron.schedule(
//   'send-first-month-recap',
//   '0 9 * * *',
//   $$SELECT net.http_post(
//     url := 'https://<project>.supabase.co/functions/v1/send-first-month-recap',
//     headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
//   )$$
// );

const APP_URL = Deno.env.get('APP_URL') ?? 'https://our-story.tinybit.app'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const now = Date.now()
  const lower = new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString()
  const upper = new Date(now - 29 * 24 * 60 * 60 * 1000).toISOString()

  // Find candidate circles
  const { data: circles, error: circlesErr } = await supabase
    .from('circle')
    .select('id, name, first_memory_at')
    .gte('first_memory_at', lower)
    .lte('first_memory_at', upper)
    .eq('first_month_email_sent', false)
    .is('deleted_at', null)

  if (circlesErr) {
    console.error('[send-first-month-recap] circles query failed:', circlesErr.message)
    return Response.json({ error: 'circles query failed' }, { status: 500 })
  }

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const c of circles ?? []) {
    try {
      // 1. Fetch the first memory (oldest by created_at) with media + uploader
      const { data: firstMemoryRows } = await supabase
        .from('memory')
        .select(
          `
          id, note, memory_date, owner_user_id, milestone_label,
          memorymedia!memory_id(storage_path, media_type),
          user!owner_user_id(first_name)
        `,
        )
        .eq('circle_id', c.id)
        .order('created_at', { ascending: true })
        .limit(1)
      const firstMemory = (firstMemoryRows ?? [])[0] as any

      if (!firstMemory) {
        skipped++
        continue
      }

      // Sign thumbnail URL if present
      let firstThumbnailUrl: string | null = null
      const fmm = (firstMemory.memorymedia ?? [])[0]
      if (fmm?.storage_path) {
        const { data: signed } = await supabase.storage
          .from('memories-private')
          .createSignedUrl(fmm.storage_path, 7 * 24 * 60 * 60)
        firstThumbnailUrl = signed?.signedUrl ?? null
      }

      const firstUploaderName = firstMemory.user?.first_name ?? 'someone'

      // 2. Memory count + milestone count
      const { count: memoryCount } = await supabase
        .from('memory')
        .select('id', { count: 'exact', head: true })
        .eq('circle_id', c.id)

      const { count: milestoneCount } = await supabase
        .from('memory')
        .select('id', { count: 'exact', head: true })
        .eq('circle_id', c.id)
        .not('milestone_label', 'is', null)

      // 3. Top-reacted memory in this circle
      const { data: reactionRows } = await supabase
        .from('memoryreaction')
        .select('memory_id, emoji, memory!inner(circle_id)')
        .eq('memory.circle_id', c.id)

      // Tally reactions per memory_id
      const counts = new Map<string, { count: number; emoji: string }>()
      for (const r of (reactionRows ?? []) as any[]) {
        const memId = r.memory_id as string
        const prev = counts.get(memId)
        if (prev) {
          counts.set(memId, { count: prev.count + 1, emoji: prev.emoji })
        } else {
          counts.set(memId, { count: 1, emoji: r.emoji ?? '❤️' })
        }
      }
      let topReactionMemoryId: string | null = null
      let topReactionEmoji: string | null = null
      let topReactionCount: number | null = null
      for (const [memId, { count, emoji }] of counts.entries()) {
        if (topReactionCount === null || count > topReactionCount) {
          topReactionMemoryId = memId
          topReactionCount = count
          topReactionEmoji = emoji
        }
      }

      // Top reaction memory thumbnail (if any reactions)
      let topReactionThumbnailUrl: string | null = null
      let topReactionMemoryNote: string | null = null
      if (topReactionMemoryId) {
        const { data: topMem } = await supabase
          .from('memory')
          .select('note, memorymedia!memory_id(storage_path)')
          .eq('id', topReactionMemoryId)
          .maybeSingle()
        topReactionMemoryNote = topMem?.note ?? null
        const tmm = (topMem as any)?.memorymedia?.[0]
        if (tmm?.storage_path) {
          const { data: signed } = await supabase.storage
            .from('memories-private')
            .createSignedUrl(tmm.storage_path, 7 * 24 * 60 * 60)
          topReactionThumbnailUrl = signed?.signedUrl ?? null
        }
      }

      // 4. Recipients — all circle members, filtered by notification prefs
      const { data: members } = await supabase
        .from('circlemember')
        .select(
          `
          user_id,
          user!inner(id, email, first_name, locale, deletion_requested_at),
          notificationpreference(circle_muted, email_digest_frequency)
        `,
        )
        .eq('circle_id', c.id)

      const recipients = (members ?? []).filter((row: any) => {
        const u = row.user
        if (!u || u.deletion_requested_at) return false
        if (!u.email) return false
        const np = Array.isArray(row.notificationpreference)
          ? row.notificationpreference[0]
          : row.notificationpreference
        if (np?.circle_muted) return false
        if (np?.email_digest_frequency === 'off') return false
        return true
      })

      if (recipients.length === 0) {
        skipped++
        // Still mark the flag — circle is processed, just no recipients
        await supabase.from('circle').update({ first_month_email_sent: true }).eq('id', c.id)
        continue
      }

      // 5. Send to each recipient
      for (const r of recipients as any[]) {
        const opts = {
          recipientFirstName: r.user.first_name ?? '',
          circleName: c.name,
          firstMemoryUploaderName: firstUploaderName,
          firstMemoryNote: firstMemory.note ?? null,
          firstMemoryDate: firstMemory.memory_date,
          firstMemoryThumbnailUrl: firstThumbnailUrl,
          memoryCount: memoryCount ?? 0,
          milestoneCount: milestoneCount ?? 0,
          topReactionMemoryThumbnailUrl: topReactionThumbnailUrl,
          topReactionMemoryNote,
          topReactionEmoji,
          topReactionCount,
          appUrl: `${APP_URL}/timeline?circle=${c.id}`,
          inviteUrl: `${APP_URL}/timeline?circle=${c.id}&invite=1`,
          unsubscribeUrl: `${APP_URL}/notification-settings`,
          locale: (r.user.locale ?? 'en') as 'en' | 'zh-CN' | 'fr',
        }
        const { subject, html } = buildFirstMonthRecapEmail(opts)
        await sendEmail(r.user.email, subject, html)
      }

      // 6. Mark sent
      await supabase.from('circle').update({ first_month_email_sent: true }).eq('id', c.id)
      sent++
    } catch (err) {
      console.error(`[send-first-month-recap] failed for circle ${c.id}:`, err)
      errors++
    }
  }

  return Response.json({ ok: true, sent, skipped, errors })
})

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.log(`[dev] first-month recap to ${to}: ${subject}`)
    return
  }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Our Story <hello@our-story.tinybit.app>',
        to,
        subject,
        html,
      }),
    })
  } catch (err) {
    console.error('[send-first-month-recap] Resend send failed:', err)
  }
}
