import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildQuietCircleNudgeEmail } from './quietCircleNudgeEmail.ts'
import webpush from 'https://esm.sh/web-push@3.6.7'

// Triggered daily by pg_cron at 9am UTC.
//
// SELECT cron.schedule(
//   'send-quiet-circle-nudges',
//   '0 9 * * *',
//   $$SELECT net.http_post(
//     url := 'https://<project>.supabase.co/functions/v1/send-quiet-circle-nudges',
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

  const now = Date.now()
  const quietSince = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()
  const lastSentBefore = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: circles, error: circlesErr } = await supabase
    .from('circle')
    .select('id, name, last_memory_at, quiet_nudge_count')
    .is('deleted_at', null)
    .not('first_memory_at', 'is', null)
    .lt('last_memory_at', quietSince)
    .lt('quiet_nudge_count', 3)
    .or(`quiet_nudge_last_sent_at.is.null,quiet_nudge_last_sent_at.lt.${lastSentBefore}`)

  if (circlesErr) {
    console.error('[send-quiet-circle-nudges] circles query failed:', circlesErr.message)
    return Response.json({ error: 'circles query failed' }, { status: 500 })
  }

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const c of circles ?? []) {
    try {
      const { data: ownerRow } = await supabase
        .from('circlemember')
        .select(`user_id, user!inner(id, email, first_name, locale, deletion_requested_at)`)
        .eq('circle_id', c.id)
        .eq('role', 'owner')
        .maybeSingle()
      const owner = (ownerRow as any)?.user
      if (!owner || owner.deletion_requested_at || !owner.email) {
        skipped++
        continue
      }
      const userId = owner.id

      const { data: prefs } = await supabase
        .from('notificationpreference')
        .select(
          'circle_muted, push_enabled, email_digest_frequency, quiet_hours_start, quiet_hours_end',
        )
        .eq('user_id', userId)
        .eq('circle_id', c.id)
        .maybeSingle()
      if (prefs?.circle_muted) {
        skipped++
        continue
      }

      const nudgeCount = ((c.quiet_nudge_count ?? 0) + 1) as 1 | 2 | 3
      const daysSinceLastMemory = Math.floor(
        (now - new Date(c.last_memory_at).getTime()) / (24 * 60 * 60 * 1000),
      )

      const pushEnabled = prefs?.push_enabled !== false
      const inQuiet = isInQuietHours(prefs?.quiet_hours_start, prefs?.quiet_hours_end)

      let delivered = false

      if (pushEnabled && !inQuiet) {
        const { data: subs } = await supabase
          .from('pushsubscription')
          .select('id, endpoint, p256dh, auth')
          .eq('user_id', userId)
        if ((subs ?? []).length > 0 && VAPID_PUBLIC && VAPID_PRIVATE) {
          const { title, body } = pushTextForCount(nudgeCount, owner.locale ?? 'en')
          const payload = JSON.stringify({
            title,
            body,
            tag: `quiet-nudge-${c.id}-${nudgeCount}`,
            renotify: true,
            data: { url: `${APP_URL}/timeline?circle=${c.id}` },
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
        if (prefs?.email_digest_frequency === 'off') {
          skipped++
          continue
        }
        const { subject, html } = buildQuietCircleNudgeEmail({
          recipientFirstName: owner.first_name ?? '',
          circleName: c.name,
          nudgeCount,
          daysSinceLastMemory,
          appUrl: `${APP_URL}/timeline?circle=${c.id}`,
          unsubscribeUrl: `${APP_URL}/notification-settings`,
          locale: (owner.locale ?? 'en') as 'en' | 'zh-CN' | 'fr',
        })
        await sendEmail(owner.email, subject, html)
        delivered = true
      }

      await supabase
        .from('circle')
        .update({
          quiet_nudge_count: nudgeCount,
          quiet_nudge_last_sent_at: new Date().toISOString(),
        })
        .eq('id', c.id)

      sent++
    } catch (err) {
      console.error(`[send-quiet-circle-nudges] failed for circle ${c.id}:`, err)
      errors++
    }
  }

  return Response.json({ ok: true, sent, skipped, errors })
})

function isInQuietHours(start: string | null | undefined, end: string | null | undefined): boolean {
  if (!start || !end) return false
  const now = new Date()
  const hhmm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
  if (start <= end) return hhmm >= start && hhmm < end
  return hhmm >= start || hhmm < end
}

function pushTextForCount(count: 1 | 2 | 3, locale: string): { title: string; body: string } {
  if (locale === 'zh-CN') {
    if (count === 1) return { title: '你的故事有点安静了 🕰', body: '添加一条记忆让它继续吧 →' }
    if (count === 2) return { title: '圈子在等你', body: '已经有一阵子了 — 这周添加点什么？' }
    return { title: '最后一次提醒', body: '我们不会再打扰你了 — 添加一条记忆？' }
  }
  if (locale === 'fr') {
    if (count === 1)
      return {
        title: 'Votre histoire est silencieuse 🕰',
        body: 'Ajoutez un souvenir pour la garder vivante →',
      }
    if (count === 2)
      return {
        title: 'Votre cercle attend',
        body: 'Cela fait un moment — ajoutez quelque chose cette semaine ?',
      }
    return { title: 'Dernier rappel', body: 'On ne vous embêtera plus — ajoutez un souvenir ?' }
  }
  if (count === 1)
    return { title: 'Your story has been quiet 🕰', body: 'Add a memory to keep it alive →' }
  if (count === 2)
    return { title: 'Your circle is waiting', body: "It's been a while — add something this week?" }
  return { title: 'One last reminder', body: "We won't ask again — add a memory?" }
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.log(`[dev] quiet-nudge to ${to}: ${subject}`)
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
    console.error('[send-quiet-circle-nudges] Resend send failed:', err)
  }
}
