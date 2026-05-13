// supabase/functions/send-first-month-recap/firstMonthRecapEmail.ts
// IMPORTANT: 1:1 mirror of buildFirstMonthRecapEmail from server/utils/email.ts.
// Deno can't import from Nitro, so this file duplicates the builder.

function layout(body: string): string {
  return `
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #fffdf8; color: #1a1a1a;">
      <p style="font-size: 11px; font-weight: bold; letter-spacing: 0.12em; text-transform: uppercase; color: #888; margin: 0 0 28px;">Our Story</p>
      ${body}
      <p style="color: #bbb; font-size: 11px; margin-top: 40px; text-align: center;">Private, invite-only · No ads</p>
    </div>
  `
}

function primaryButton(href: string, label: string): string {
  return `<a href="${href}" style="display: block; background: #1a1a1a; color: #fff; text-align: center; padding: 16px 24px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 600;">${label}</a>`
}

export interface FirstMonthRecapEmailOpts {
  recipientFirstName: string
  circleName: string
  firstMemoryUploaderName: string
  firstMemoryNote: string | null
  firstMemoryDate: string
  firstMemoryThumbnailUrl: string | null
  memoryCount: number
  milestoneCount: number
  topReactionMemoryThumbnailUrl: string | null
  topReactionMemoryNote: string | null
  topReactionEmoji: string | null
  topReactionCount: number | null
  appUrl: string
  inviteUrl: string
  unsubscribeUrl: string
  locale: 'en' | 'zh-CN' | 'fr'
}

export function buildFirstMonthRecapEmail(opts: FirstMonthRecapEmailOpts): {
  subject: string
  html: string
} {
  const {
    recipientFirstName,
    circleName,
    firstMemoryUploaderName,
    firstMemoryNote,
    firstMemoryDate,
    firstMemoryThumbnailUrl,
    memoryCount,
    milestoneCount,
    topReactionMemoryThumbnailUrl,
    topReactionEmoji,
    topReactionCount,
    appUrl,
    inviteUrl,
    unsubscribeUrl,
    locale,
  } = opts

  const subject = (() => {
    if (locale === 'zh-CN') return `「${circleName}」的第一个月 💛`
    if (locale === 'fr') return `Votre premier mois avec ${circleName} 💛`
    return `Your first month with ${circleName} 💛`
  })()

  const greeting =
    locale === 'zh-CN'
      ? `你好 ${recipientFirstName}，`
      : locale === 'fr'
        ? `Bonjour ${recipientFirstName},`
        : `Hi ${recipientFirstName ?? 'there'},`

  const intro = (() => {
    if (locale === 'zh-CN')
      return `一个月前，${firstMemoryUploaderName} 在「${circleName}」上传了你们的第一条记忆。`
    if (locale === 'fr')
      return `Il y a un mois, ${firstMemoryUploaderName} a ajouté votre premier souvenir à ${circleName}.`
    return `One month ago, ${firstMemoryUploaderName} added your first memory to ${circleName}.`
  })()

  const dateFormatted = new Date(firstMemoryDate).toLocaleDateString(
    locale === 'zh-CN' ? 'zh-CN' : locale === 'fr' ? 'fr' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' },
  )

  const heroImg = firstMemoryThumbnailUrl
    ? `<img src="${firstMemoryThumbnailUrl}" style="width:100%;border-radius:12px;display:block;margin:0 0 8px;" alt="" />`
    : ''

  const heroNote = firstMemoryNote
    ? `<p style="font-size:14px;color:#444;font-style:italic;margin:0 0 4px;line-height:1.5;">"${firstMemoryNote}"</p>`
    : ''

  const heroDate = `<p style="font-size:11px;color:#888;margin:0 0 24px;">${dateFormatted}</p>`

  const statsLabels = (() => {
    if (locale === 'zh-CN')
      return {
        memories: '条记忆',
        milestones: '个里程碑',
        topReaction: '最受欢迎',
        thisMonth: '这一个月',
      }
    if (locale === 'fr')
      return {
        memories: 'souvenirs',
        milestones: 'jalons',
        topReaction: 'Le plus aimé',
        thisMonth: 'Ce mois-ci',
      }
    return {
      memories: 'memories',
      milestones: 'milestones marked',
      topReaction: 'Most loved',
      thisMonth: 'This month',
    }
  })()

  const statsBlock = `
    <div style="background:#f5f0e8;border-radius:12px;padding:20px;margin:0 0 24px;">
      <p style="font-size:13px;color:#888;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">
        ${statsLabels.thisMonth}
      </p>
      <p style="font-size:16px;color:#1a1a1a;margin:0 0 8px;">📸 ${memoryCount} ${statsLabels.memories}</p>
      ${milestoneCount > 0 ? `<p style="font-size:16px;color:#1a1a1a;margin:0 0 8px;">✨ ${milestoneCount} ${statsLabels.milestones}</p>` : ''}
      ${
        topReactionMemoryThumbnailUrl && topReactionEmoji && topReactionCount
          ? `<p style="font-size:16px;color:#1a1a1a;margin:0;">${topReactionEmoji} ${topReactionCount} ${statsLabels.topReaction}</p>`
          : ''
      }
    </div>
  `

  const ctaPrimary =
    locale === 'zh-CN'
      ? '添加新记忆 →'
      : locale === 'fr'
        ? 'Ajouter un souvenir →'
        : 'Add another memory →'
  const ctaSecondary =
    locale === 'zh-CN'
      ? '邀请还没加入的人 →'
      : locale === 'fr'
        ? "Inviter quelqu'un qui n'a pas encore rejoint →"
        : "Invite someone who hasn't joined yet →"

  const unsubscribeText = (() => {
    if (locale === 'zh-CN')
      return `你收到此邮件是因为你是「${circleName}」的成员。<a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">管理邮件偏好</a>。`
    if (locale === 'fr')
      return `Vous recevez ceci car vous êtes membre de ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Gérer les préférences email</a>.`
    return `You're receiving this because you're a member of ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Manage email preferences</a>.`
  })()

  const recapBody = `
    <p style="font-size:15px;color:#333;margin:0 0 16px;">${greeting}</p>
    <p style="font-size:15px;color:#333;margin:0 0 24px;line-height:1.5;">${intro}</p>
    ${heroImg}
    ${heroNote}
    ${heroDate}
    ${statsBlock}
    <p style="margin:0 0 12px;">${primaryButton(appUrl, ctaPrimary)}</p>
    <p style="margin:0 0 32px;text-align:center;"><a href="${inviteUrl}" style="font-size:14px;color:#555;text-decoration:underline;">${ctaSecondary}</a></p>
    <p style="font-size:11px;color:#888;line-height:1.5;margin:24px 0 0;">${unsubscribeText}</p>
  `

  return { subject, html: layout(recapBody) }
}
