import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import JSZip from 'https://esm.sh/jszip@3'
import { Resend } from 'https://esm.sh/resend@4'

// Triggered by pg_net webhook on ExportJob INSERT, or polled every 5 minutes.
// Picks up the oldest pending ExportJob, builds a zip of memories scoped to
// the requested circle, and emails a 24h signed download link.
//
// Scope rules:
//   - owner / admin → all memories in the circle (every member's uploads)
//   - member / caregiver → only the requesting user's own uploads

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

  // Claim the oldest pending job
  const { data: job, error: claimError } = await supabase
    .from('exportjob')
    .select('id, user_id, circle_id')
    .eq('status', 'pending')
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (claimError) {
    console.error('[process-export] claim failed:', claimError.message)
    return Response.json({ error: 'Failed to claim job' }, { status: 500 })
  }

  if (!job) {
    return Response.json({ ok: true, message: 'No pending jobs' })
  }

  // Mark as processing to prevent double-processing
  await supabase.from('exportjob').update({ status: 'processing' }).eq('id', job.id)

  try {
    // Resolve circle name and user's role in that circle
    const [circleResult, memberResult] = await Promise.all([
      supabase.from('circle').select('name').eq('id', job.circle_id).maybeSingle(),
      supabase
        .from('circlemember')
        .select('role')
        .eq('circle_id', job.circle_id)
        .eq('user_id', job.user_id)
        .maybeSingle(),
    ])

    const circleName: string = circleResult.data?.name ?? 'Your circle'
    const role: string = memberResult.data?.role ?? 'member'
    const isOwnerOrAdmin = role === 'owner' || role === 'admin'

    // Fetch memories — full circle for owners/admins, own uploads only for members
    let memoriesQuery = supabase
      .from('memory')
      .select(
        'id, memory_date, note, milestone_label, visibility, owner_user_id, memorymedia!memory_id(storage_path, media_type)',
      )
      .eq('circle_id', job.circle_id)

    if (!isOwnerOrAdmin) {
      memoriesQuery = memoriesQuery.eq('owner_user_id', job.user_id)
    }

    const { data: memories } = await memoriesQuery

    const zip = new JSZip()

    for (const memory of memories ?? []) {
      const folder = zip.folder(`${(memory.memory_date as string).slice(0, 7)}/${memory.id}`)!

      const meta = {
        date: memory.memory_date,
        note: memory.note,
        milestone_label: memory.milestone_label,
        visibility: memory.visibility,
        circle_name: circleName,
        uploaded_by: isOwnerOrAdmin ? (memory.owner_user_id ?? null) : undefined,
      }
      folder.file('metadata.json', JSON.stringify(meta, null, 2))

      for (const media of (memory.memorymedia as any[]) ?? []) {
        const { data: file } = await supabase.storage
          .from('memories-private')
          .download(media.storage_path)

        if (file) {
          const ext = (media.storage_path as string).split('.').pop()
          folder.file(`media.${ext}`, await file.arrayBuffer())
        }
      }
    }

    // Upload zip to storage
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })
    const exportPath = `exports/${job.user_id}/${job.id}.zip`

    await supabase.storage
      .from('memories-private')
      .upload(exportPath, zipBuffer, { contentType: 'application/zip' })

    // Generate a 24h signed URL (never expose raw storage path)
    const { data: signedUrlData } = await supabase.storage
      .from('memories-private')
      .createSignedUrl(exportPath, 86400)

    const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString()

    await supabase
      .from('exportjob')
      .update({
        status: 'complete',
        download_url: signedUrlData?.signedUrl ?? null,
        expires_at: expiresAt,
      })
      .eq('id', job.id)

    // Email the download link
    const { data: authUser } = await supabase.auth.admin.getUserById(job.user_id)
    const userEmail = authUser?.user?.email

    if (userEmail && signedUrlData?.signedUrl) {
      const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
      await resend.emails.send({
        from: 'Our Story <hello@our-story.tinybit.app>',
        to: userEmail,
        subject: `Your "${circleName}" export is ready`,
        html: `<p>Your export of <strong>${circleName}</strong> is ready. <a href="${signedUrlData.signedUrl}">Download your memories</a> — link expires in 24 hours.</p>`,
      })
    }

    return Response.json({ ok: true, jobId: job.id })
  } catch (err) {
    console.error(`[process-export] job ${job.id} failed:`, err)
    await supabase.from('exportjob').update({ status: 'failed' }).eq('id', job.id)
    return Response.json({ error: 'Export failed' }, { status: 500 })
  }
})
