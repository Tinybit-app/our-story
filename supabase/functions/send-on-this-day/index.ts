import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildOnThisDayPushTitle,
  buildOnThisDayPushBody,
  buildFirstMonthMemoryPushTitle,
  buildFirstMonthMemoryPushBody,
} from './onThisDayCopy.ts'
import { buildFirstMonthMemoryEmail } from './firstMonthMemoryEmail.ts'
import webpush from 'https://esm.sh/web-push@3.6.7'

// Triggered daily by pg_cron at 9am UTC.
//
// SELECT cron.schedule(
//   'send-on-this-day',
//   '0 9 * * *',
//   $$SELECT net.http_post(
//     url := 'https://<project>.supabase.co/functions/v1/send-on-this-day',
//     headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
//   )$$
// );

const APP_URL = Deno.env.get('APP_URL') ?? 'https://our-story.tinybit.app'
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hello@our-story.tinybit.app'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

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

  const now = new Date()
  const thisYear = now.getUTCFullYear()
  const todayMonth = now.getUTCMonth() + 1
  const todayDay = now.getUTCDate()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: circles, error: circlesErr } = await supabase
    .from('circle')
    .select('id, name, memory_count, first_memory_at, last_first_month_memory_sent_at')
    .is('deleted_at', null)
    .not('first_memory_at', 'is', null)

  if (circlesErr) {
    console.error('[send-on-this-day] circles query failed:', circlesErr.message)
    return Response.json({ error: 'circles query failed' }, { status: 500 })
  }

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const c of circles ?? []) {
    try {
      const isAboveThreshold =
        (c.memory_count ?? 0) >= 30 &&
        new Date(c.first_memory_at).getTime() <= new Date(ninetyDaysAgo).getTime()

      if (isAboveThreshold) {
        // ── Above threshold: find a matching past-year memory by MM-DD ──
        const { data: rows } = await supabase
          .from('memory')
          .select(
            `
            id, note, memory_date, owner_user_id,
            memorymedia(storage_path),
            user!owner_user_id(first_name)
          `,
          )
          .eq('circle_id', c.id)
          .order('memory_date', { ascending: true })

        const matchingMemories = (rows ?? []).filter((m: any) => {
          const d = new Date(m.memory_date)
          if (Number.isNaN(d.getTime())) return false
          if (d.getUTCFullYear() >= thisYear) return false
          return d.getUTCMonth() + 1 === todayMonth && d.getUTCDate() === todayDay
        })

        if (matchingMemories.length === 0) {
          skipped++
          continue
        }

        const memory = matchingMemories[0] as any
        const yearsAgo = thisYear - new Date(memory.memory_date).getUTCFullYear()
        const uploaderName = memory.user?.first_name ?? 'someone'

        await sendPushToAllMembers(supabase, c.id, {
          buildTitle: (locale) => buildOnThisDayPushTitle(yearsAgo, locale),
          buildBody: (locale) => buildOnThisDayPushBody(uploaderName, memory.note ?? null, locale),
          tag: `onthisday-${c.id}-${memory.id}`,
          memoryId: memory.id,
        })
        sent++
      } else {
        // ── Below threshold: weekly fallback, oldest memory ──
        if (c.last_first_month_memory_sent_at && c.last_first_month_memory_sent_at > sevenDaysAgo) {
          skipped++
          continue
        }

        const { data: oldestRows } = await supabase
          .from('memory')
          .select(
            `
            id, note, memory_date, owner_user_id,
            memorymedia(storage_path),
            user!owner_user_id(first_name)
          `,
          )
          .eq('circle_id', c.id)
          .order('memory_date', { ascending: true })
          .limit(1)

        const memory = (oldestRows ?? [])[0] as any
        if (!memory) {
          skipped++
          continue
        }

        const uploaderName = memory.user?.first_name ?? 'someone'

        let memoryThumbnailUrl: string | null = null
        const fmm = (memory.memorymedia ?? [])[0]
        if (fmm?.storage_path) {
          const { data: signed } = await supabase.storage
            .from('memories-private')
            .createSignedUrl(fmm.storage_path, 7 * 24 * 60 * 60)
          memoryThumbnailUrl = signed?.signedUrl ?? null
        }

        await sendPushOrEmailToAllMembers(supabase, c.id, {
          buildPushTitle: (locale) => buildFirstMonthMemoryPushTitle(locale),
          buildPushBody: (locale) =>
            buildFirstMonthMemoryPushBody(uploaderName, memory.note ?? null, locale),
          tag: `first-month-memory-${c.id}`,
          memoryId: memory.id,
          buildEmail: (recipientFirstName, locale) =>
            buildFirstMonthMemoryEmail({
              recipientFirstName,
              circleName: c.name,
              uploaderName,
              memoryNote: memory.note ?? null,
              memoryDate: memory.memory_date,
              memoryThumbnailUrl,
              appUrl: `${APP_URL}/timeline?circle=${c.id}&memory=${memory.id}`,
              unsubscribeUrl: `${APP_URL}/notification-settings`,
              locale,
            }),
        })

        await supabase
          .from('circle')
          .update({ last_first_month_memory_sent_at: new Date().toISOString() })
          .eq('id', c.id)
        sent++
      }
    } catch (err) {
      console.error(`[send-on-this-day] failed for circle ${c.id}:`, err)
      errors++
    }
  }

  return Response.json({ ok: true, sent, skipped, errors })
})

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

interface PushSpec {
  buildTitle: (locale: 'en' | 'zh-CN' | 'fr') => string
  buildBody: (locale: 'en' | 'zh-CN' | 'fr') => string
  tag: string
  memoryId: string
}

async function sendPushToAllMembers(supabase: any, circleId: string, spec: PushSpec) {
  const { data: members } = await supabase
    .from('circlemember')
    .select(`user_id, user!inner(id, locale, deletion_requested_at)`)
    .eq('circle_id', circleId)

  for (const m of (members ?? []) as any[]) {
    const u = m.user
    if (!u || u.deletion_requested_at) continue

    const { data: prefs } = await supabase
      .from('notificationpreference')
      .select('circle_muted, push_enabled, quiet_hours_start, quiet_hours_end')
      .eq('user_id', u.id)
      .eq('circle_id', circleId)
      .maybeSingle()
    if (prefs?.circle_muted) continue
    if (prefs?.push_enabled === false) continue
    if (isInQuietHours(prefs?.quiet_hours_start, prefs?.quiet_hours_end)) continue

    const { data: subs } = await supabase
      .from('pushsubscription')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', u.id)
    if (!subs || subs.length === 0) continue
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) continue

    const locale = (u.locale ?? 'en') as 'en' | 'zh-CN' | 'fr'
    const payload = JSON.stringify({
      title: spec.buildTitle(locale),
      body: spec.buildBody(locale),
      tag: spec.tag,
      renotify: true,
      data: { url: `${APP_URL}/timeline?circle=${circleId}&memory=${spec.memoryId}` },
    })

    for (const s of subs as any[]) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await supabase.from('pushsubscription').delete().eq('id', s.id)
        }
      }
    }
  }
}

interface PushOrEmailSpec {
  buildPushTitle: (locale: 'en' | 'zh-CN' | 'fr') => string
  buildPushBody: (locale: 'en' | 'zh-CN' | 'fr') => string
  tag: string
  memoryId: string
  buildEmail: (
    recipientFirstName: string,
    locale: 'en' | 'zh-CN' | 'fr',
  ) => { subject: string; html: string }
}

async function sendPushOrEmailToAllMembers(supabase: any, circleId: string, spec: PushOrEmailSpec) {
  const { data: members } = await supabase
    .from('circlemember')
    .select(`user_id, user!inner(id, email, first_name, locale, deletion_requested_at)`)
    .eq('circle_id', circleId)

  for (const m of (members ?? []) as any[]) {
    const u = m.user
    if (!u || u.deletion_requested_at) continue

    const { data: prefs } = await supabase
      .from('notificationpreference')
      .select(
        'circle_muted, push_enabled, email_digest_frequency, quiet_hours_start, quiet_hours_end',
      )
      .eq('user_id', u.id)
      .eq('circle_id', circleId)
      .maybeSingle()
    if (prefs?.circle_muted) continue

    const locale = (u.locale ?? 'en') as 'en' | 'zh-CN' | 'fr'
    let delivered = false

    const pushEnabled = prefs?.push_enabled !== false
    const inQuiet = isInQuietHours(prefs?.quiet_hours_start, prefs?.quiet_hours_end)

    if (pushEnabled && !inQuiet && VAPID_PUBLIC && VAPID_PRIVATE) {
      const { data: subs } = await supabase
        .from('pushsubscription')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', u.id)
      if (subs && subs.length > 0) {
        const payload = JSON.stringify({
          title: spec.buildPushTitle(locale),
          body: spec.buildPushBody(locale),
          tag: spec.tag,
          renotify: true,
          data: { url: `${APP_URL}/timeline?circle=${circleId}&memory=${spec.memoryId}` },
        })
        for (const s of subs as any[]) {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
            )
          } catch (err: any) {
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              await supabase.from('pushsubscription').delete().eq('id', s.id)
            }
          }
        }
        delivered = true
      }
    }

    if (!delivered) {
      if (prefs?.email_digest_frequency === 'off') continue
      if (!u.email) continue
      const { subject, html } = spec.buildEmail(u.first_name ?? '', locale)
      await sendEmail(u.email, subject, html)
    }
  }
}

function isInQuietHours(start: string | null | undefined, end: string | null | undefined): boolean {
  if (!start || !end) return false
  const now = new Date()
  const hhmm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
  if (start <= end) return hhmm >= start && hhmm < end
  return hhmm >= start || hhmm < end
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.log(`[dev] first-month-memory email to ${to}: ${subject}`)
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
    console.error('[send-on-this-day] Resend send failed:', err)
  }
}
