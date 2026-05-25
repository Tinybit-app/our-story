import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildWeeklyDigestEmail,
  buildMonthlyDigestEmail,
  type DigestEmailOpts,
} from './digestEmail.ts'

// Triggered by pg_cron — see migration 028 for schedule definitions.
// curl -X POST '<project-url>/functions/v1/send-digest?frequency=weekly' \
//   -H 'Authorization: Bearer <service-role-key>'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://ourstory.tinybit.app'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  const url = new URL(req.url)
  const frequency = url.searchParams.get('frequency')
  if (frequency !== 'weekly' && frequency !== 'monthly') {
    return Response.json({ error: "frequency must be 'weekly' or 'monthly'" }, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const periodDays = frequency === 'weekly' ? 7 : 30
  const idempotencyDays = frequency === 'weekly' ? 6 : 25
  const idempotencyCutoff = new Date(
    Date.now() - idempotencyDays * 24 * 60 * 60 * 1000,
  ).toISOString()
  const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()
  const tracker =
    frequency === 'weekly' ? 'last_weekly_digest_sent_at' : 'last_monthly_digest_sent_at'

  // Find candidate circles (not soft-deleted)
  const { data: circles, error: circlesErr } = await supabase
    .from('circle')
    .select(`id, name, ${tracker}`)
    .is('deleted_at', null)

  if (circlesErr) {
    console.error('[send-digest] circles query failed:', circlesErr.message)
    return Response.json({ error: 'circles query failed' }, { status: 500 })
  }

  let sent = 0
  let skipped = 0

  for (const c of circles ?? []) {
    try {
      // Idempotency: skip if recently sent
      const lastSent = (c as any)[tracker] as string | null
      if (lastSent && lastSent > idempotencyCutoff) {
        skipped++
        continue
      }

      // Memories in the period, ordered by recency
      const { data: memories } = await supabase
        .from('memory')
        .select('id, note, milestone_label, memorymedia!memory_id(storage_path, media_type)')
        .eq('circle_id', c.id)
        .gte('created_at', periodStart)
        .order('created_at', { ascending: false })
        .limit(6)
      const mems = memories ?? []

      if (mems.length === 0) {
        skipped++
        continue
      }

      // Sign thumbnail URLs (7-day TTL — matches typical email open window)
      const memoryItems = await Promise.all(
        mems.map(async (m: any) => {
          const media = m.memorymedia?.[0] ?? null
          let thumbnailUrl = ''
          if (media?.storage_path) {
            const { data: signed } = await supabase.storage
              .from('memories-private')
              .createSignedUrl(media.storage_path, 7 * 24 * 60 * 60)
            thumbnailUrl = signed?.signedUrl ?? ''
          }
          return {
            id: m.id,
            note: m.note ?? null,
            milestoneLabel: m.milestone_label ?? null,
            thumbnailUrl,
            isVideo: media?.media_type === 'video',
          }
        }),
      )

      // Optional: child name + age for the digest period midpoint
      const { data: children } = await supabase
        .from('childprofile')
        .select('name, date_of_birth')
        .eq('circle_id', c.id)
        .order('created_at', { ascending: true })
        .limit(1)
      const child = children?.[0] ?? null
      const periodMidpoint = new Date(Date.now() - (periodDays / 2) * 24 * 60 * 60 * 1000)
      const childAge = child ? computeAge(child.date_of_birth, periodMidpoint) : null

      // Recipients — joined to NotificationPreference, filtered by frequency match
      const { data: recipients } = await supabase
        .from('circlemember')
        .select(
          `
          user_id,
          user!inner(id, email, first_name, locale, deletion_requested_at),
          notificationpreference(circle_muted, email_digest_frequency)
        `,
        )
        .eq('circle_id', c.id)

      const eligible = (recipients ?? []).filter((row: any) => {
        const u = row.user
        if (!u || u.deletion_requested_at) return false
        if (!u.email) return false
        const np = Array.isArray(row.notificationpreference)
          ? row.notificationpreference[0]
          : row.notificationpreference
        if (np?.circle_muted) return false
        const userFrequency = np?.email_digest_frequency ?? 'monthly'
        return userFrequency === frequency
      })

      if (eligible.length === 0) {
        skipped++
        continue
      }

      // Send to each recipient
      for (const row of eligible) {
        const u = (row as any).user
        const opts: DigestEmailOpts = {
          recipientFirstName: u.first_name ?? '',
          circleName: c.name,
          childName: child?.name ?? null,
          childAge,
          memories: memoryItems,
          totalCount: memoryItems.length,
          appUrl: `${APP_URL}/timeline?circle=${c.id}`,
          unsubscribeUrl: `${APP_URL}/notification-settings`,
          locale: (u.locale as 'en' | 'zh-CN' | 'fr') ?? 'en',
        }
        const { subject, html } =
          frequency === 'weekly' ? buildWeeklyDigestEmail(opts) : buildMonthlyDigestEmail(opts)

        await sendEmail(u.email, subject, html)
      }

      // Idempotency: mark sent
      await supabase
        .from('circle')
        .update({ [tracker]: new Date().toISOString() })
        .eq('id', c.id)
      sent++
    } catch (err) {
      console.error(`[send-digest] failed for circle ${c.id}:`, err)
    }
  }

  return Response.json({ ok: true, frequency, sent, skipped })
})

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.log(`[dev] digest email to ${to}: ${subject}`)
    return
  }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Our Story <hello@ourstory.tinybit.app>',
        to,
        subject,
        html,
      }),
    })
  } catch (err) {
    console.error(`[send-digest] Resend send failed for ${to}:`, err)
  }
}

function computeAge(dob: string, at: Date): string {
  // Mirrors useBabyAge composable's logic (basic version — months/years only)
  const birth = new Date(dob)
  const months = (at.getFullYear() - birth.getFullYear()) * 12 + (at.getMonth() - birth.getMonth())
  if (months < 1) return 'newborn'
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  if (years < 2 && remMonths > 0)
    return `${years} year, ${remMonths} month${remMonths === 1 ? '' : 's'}`
  return `${years} year${years === 1 ? '' : 's'}`
}
