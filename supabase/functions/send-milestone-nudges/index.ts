import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getMilestoneKeyForAge, getAnniversaryYear } from './milestoneCron.ts'
import {
  buildChildMilestoneEmail,
  buildAnniversaryEmail,
} from './milestoneEmail.ts'
import webpush from 'https://esm.sh/web-push@3.6.7'

// Triggered daily by pg_cron at 9am UTC.
//
// SELECT cron.schedule(
//   'send-milestone-nudges',
//   '0 9 * * *',
//   $$SELECT net.http_post(
//     url := 'https://<project>.supabase.co/functions/v1/send-milestone-nudges',
//     headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
//   )$$
// );

const APP_URL = Deno.env.get('APP_URL') ?? 'https://our-story.tinybit.app'
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT =
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hello@our-story.tinybit.app'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

interface MilestoneCandidate {
  scope_type: 'child' | 'couple' | 'trip'
  scope_id: string
  circle_id: string
  milestone_key: string
  phase: 'T-3' | 'T0' | 'T+3'
  display_name: string
  years_or_label: string
  milestone_date: string
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

  const today = new Date()
  const todayISO = today.toISOString().slice(0, 10)
  const plus3 = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const minus3 = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const phaseTargets: Array<['T-3' | 'T0' | 'T+3', string]> = [
    ['T-3', plus3],
    ['T0', todayISO],
    ['T+3', minus3],
  ]

  const candidates: MilestoneCandidate[] = []

  // ── Child milestones ───────────────────────────────────────
  const { data: children } = await supabase
    .from('childprofile')
    .select('id, name, date_of_birth, circle_id, circle!inner(id, deleted_at)')
  for (const child of (children ?? []) as any[]) {
    if (child.circle?.deleted_at) continue
    for (const [phase, target] of phaseTargets) {
      const key = getMilestoneKeyForAge(child.date_of_birth, target)
      if (!key) continue
      candidates.push({
        scope_type: 'child',
        scope_id: child.id,
        circle_id: child.circle_id,
        milestone_key: key,
        phase,
        display_name: child.name,
        years_or_label: humanizeMilestoneKey(key),
        milestone_date: target,
      })
    }
  }

  // ── Couple / Trip anniversaries ────────────────────────────
  const { data: circles } = await supabase
    .from('circle')
    .select('id, name, anniversary_date, circle_type, deleted_at')
    .in('circle_type', ['couple', 'friends', 'travel'])
    .not('anniversary_date', 'is', null)
    .is('deleted_at', null)
  for (const c of (circles ?? []) as any[]) {
    for (const [phase, target] of phaseTargets) {
      const year = getAnniversaryYear(c.anniversary_date, target)
      if (!year) continue
      const isCouple = c.circle_type === 'couple'
      candidates.push({
        scope_type: isCouple ? 'couple' : 'trip',
        scope_id: c.id,
        circle_id: c.id,
        milestone_key: isCouple
          ? `anniversary_${year}`
          : `trip_anniversary_${year}`,
        phase,
        display_name: c.name,
        years_or_label: String(year),
        milestone_date: target,
      })
    }
  }

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const cand of candidates) {
    try {
      // T+3 skip rule: skip if any memory in ±3 days has milestone_label set
      if (cand.phase === 'T+3') {
        const lo = addDaysISO(cand.milestone_date, -3)
        const hi = addDaysISO(cand.milestone_date, +3)
        const { count } = await supabase
          .from('memory')
          .select('id', { count: 'exact', head: true })
          .eq('circle_id', cand.circle_id)
          .gte('memory_date', lo)
          .lte('memory_date', hi)
          .not('milestone_label', 'is', null)
        if ((count ?? 0) > 0) {
          skipped++
          continue
        }
      }

      // Recipients: owner + admins of the circle
      const { data: members } = await supabase
        .from('circlemember')
        .select(
          `user_id, role, user!inner(id, email, first_name, locale, deletion_requested_at)`,
        )
        .eq('circle_id', cand.circle_id)
        .in('role', ['owner', 'admin'])
      const recipients = (members ?? []).filter(
        (m: any) => !m.user.deletion_requested_at && m.user.email,
      )

      // Get circle name once
      const { data: circle } = await supabase
        .from('circle')
        .select('name')
        .eq('id', cand.circle_id)
        .single()
      const circleName = circle?.name ?? ''

      for (const r of recipients as any[]) {
        const userId = r.user.id

        // Check NotificationPreference
        const { data: prefs } = await supabase
          .from('notificationpreference')
          .select(
            'circle_muted, milestone_nudges_enabled, push_enabled, email_digest_frequency, quiet_hours_start, quiet_hours_end',
          )
          .eq('user_id', userId)
          .eq('circle_id', cand.circle_id)
          .maybeSingle()
        if (prefs?.circle_muted) {
          skipped++
          continue
        }
        if (prefs && prefs.milestone_nudges_enabled === false) {
          skipped++
          continue
        }

        // Idempotency check
        const { count: existing } = await supabase
          .from('milestonenudge')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('scope_type', cand.scope_type)
          .eq('scope_id', cand.scope_id)
          .eq('milestone_key', cand.milestone_key)
          .eq('nudge_phase', cand.phase)
        if ((existing ?? 0) > 0) {
          skipped++
          continue
        }

        const pushEnabled = prefs?.push_enabled !== false
        const inQuiet = isInQuietHours(
          prefs?.quiet_hours_start,
          prefs?.quiet_hours_end,
        )

        // Try push first
        if (pushEnabled && !inQuiet) {
          const { data: subs } = await supabase
            .from('pushsubscription')
            .select('id, endpoint, p256dh, auth')
            .eq('user_id', userId)
          if ((subs ?? []).length > 0) {
            const payload = JSON.stringify({
              title: pushTitle(cand),
              body: pushBody(cand),
              tag: `milestone-${cand.circle_id}-${cand.scope_id}-${cand.milestone_key}-${cand.phase}`,
              renotify: true,
              data: { url: `${APP_URL}/timeline?circle=${cand.circle_id}` },
            })
            for (const s of subs as any[]) {
              try {
                await webpush.sendNotification(
                  {
                    endpoint: s.endpoint,
                    keys: { p256dh: s.p256dh, auth: s.auth },
                  },
                  payload,
                )
              } catch (err: any) {
                if (err?.statusCode === 410 || err?.statusCode === 404) {
                  await supabase
                    .from('pushsubscription')
                    .delete()
                    .eq('id', s.id)
                }
              }
            }
            await supabase.from('milestonenudge').insert({
              user_id: userId,
              scope_type: cand.scope_type,
              scope_id: cand.scope_id,
              milestone_key: cand.milestone_key,
              nudge_phase: cand.phase,
              channel: 'push',
            })
            sent++
            continue
          }
        }

        // Fallback to email
        if (prefs?.email_digest_frequency === 'off') {
          skipped++
          continue
        }

        const opts = {
          recipientFirstName: r.user.first_name ?? '',
          circleName,
          appUrl: `${APP_URL}/timeline?circle=${cand.circle_id}`,
          unsubscribeUrl: `${APP_URL}/notification-settings`,
          locale: (r.user.locale ?? 'en') as 'en' | 'zh-CN' | 'fr',
        }
        const { subject, html } =
          cand.scope_type === 'child'
            ? buildChildMilestoneEmail({
                ...opts,
                childName: cand.display_name,
                milestoneLabel: cand.years_or_label,
                phase: cand.phase,
                daysUntil: phaseDays(cand.phase),
              })
            : buildAnniversaryEmail({
                ...opts,
                years: Number(cand.years_or_label),
                scopeType: cand.scope_type as 'couple' | 'trip',
                phase: cand.phase,
              })

        await sendEmail(r.user.email, subject, html)
        await supabase.from('milestonenudge').insert({
          user_id: userId,
          scope_type: cand.scope_type,
          scope_id: cand.scope_id,
          milestone_key: cand.milestone_key,
          nudge_phase: cand.phase,
          channel: 'email',
        })
        sent++
      }
    } catch (err) {
      console.error('[send-milestone-nudges] candidate failed:', err)
      errors++
    }
  }

  return Response.json({ ok: true, sent, skipped, errors })
})

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function isInQuietHours(
  start: string | null | undefined,
  end: string | null | undefined,
): boolean {
  if (!start || !end) return false
  const now = new Date()
  const hhmm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
  if (start <= end) return hhmm >= start && hhmm < end
  return hhmm >= start || hhmm < end
}

function phaseDays(phase: 'T-3' | 'T0' | 'T+3'): number {
  return phase === 'T-3' ? 3 : phase === 'T0' ? 0 : -3
}

function humanizeMilestoneKey(key: string): string {
  if (key.endsWith('mo')) {
    const n = parseInt(key, 10)
    return n === 1 ? '1 month' : `${n} months`
  }
  if (key.endsWith('yr')) {
    const n = parseInt(key, 10)
    return n === 1 ? '1 year' : `${n} years`
  }
  return key
}

function pushTitle(c: MilestoneCandidate): string {
  if (c.scope_type === 'child') {
    if (c.phase === 'T-3')
      return `${c.display_name} turns ${c.years_or_label} in 3 days 🎉`
    if (c.phase === 'T0')
      return `${c.display_name} is ${c.years_or_label} today 🎉`
    return `Did you capture ${c.display_name}'s ${c.years_or_label}?`
  }
  if (c.scope_type === 'couple') {
    if (c.phase === 'T-3') return `Your anniversary is in 3 days`
    if (c.phase === 'T0') return `Happy ${c.years_or_label} years 🥂`
    return `Did you celebrate?`
  }
  if (c.phase === 'T-3') return `Your trip anniversary is in 3 days`
  if (c.phase === 'T0') return `${c.years_or_label} years since your trip 🌍`
  return `Did you mark the trip anniversary?`
}

function pushBody(c: MilestoneCandidate): string {
  if (c.phase === 'T-3') return 'Ready to capture the moment?'
  if (c.phase === 'T0') return 'Add a memory →'
  return 'Add it before the moment fades →'
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.log(`[dev] milestone email to ${to}: ${subject}`)
    return
  }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Our Story <hello@our-story.tinybit.app>',
        to,
        subject,
        html,
      }),
    })
  } catch (err) {
    console.error('[send-milestone-nudges] Resend send failed:', err)
  }
}
