import { Resend } from 'resend'

// ─────────────────────────────────────────────────────────────
// Core sender
// ─────────────────────────────────────────────────────────────

export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
}) {
  const config = useRuntimeConfig()
  if (!config.resendApiKey) {
    console.log(`[email] RESEND_API_KEY missing; skipping send to ${opts.to}: ${opts.subject}`)
    return
  }
  const resend = new Resend(config.resendApiKey as string)
  try {
    const { data, error } = await resend.emails.send({
      from: 'Our Story <hello@our-story.tinybit.app>',
      ...opts,
    })
    if (error) {
      console.error(
        `[email] Resend rejected send to ${opts.to} (subject: "${opts.subject}"):`,
        error,
      )
      return
    }
    console.log(`[email] sent to ${opts.to} (id: ${data?.id}): ${opts.subject}`)
  } catch (err) {
    console.error(
      `[email] threw while sending to ${opts.to} (subject: "${opts.subject}"):`,
      err,
    )
  }
}

// ─────────────────────────────────────────────────────────────
// Shared layout
// ─────────────────────────────────────────────────────────────

function layout(body: string) {
  return `
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #fffdf8; color: #1a1a1a;">
      <p style="font-size: 11px; font-weight: bold; letter-spacing: 0.12em; text-transform: uppercase; color: #888; margin: 0 0 28px;">Our Story</p>
      ${body}
      <p style="color: #bbb; font-size: 11px; margin-top: 40px; text-align: center;">Private, invite-only · No ads</p>
    </div>
  `
}

function primaryButton(href: string, label: string) {
  return `<a href="${href}" style="display: block; background: #1a1a1a; color: #fff; text-align: center; padding: 16px 24px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 600;">${label}</a>`
}

// ─────────────────────────────────────────────────────────────
// Member removed from circle
// ─────────────────────────────────────────────────────────────

export function buildMemberRemovedEmail(opts: {
  circleName: string
  removerName: string
  keepContent: boolean
  appUrl: string
  locale: string
}): { subject: string; html: string } {
  const { circleName, removerName, keepContent, appUrl, locale } = opts

  if (locale === 'zh-CN') {
    const outcome = keepContent
      ? `你的照片和记忆仍保留在 <strong>${circleName}</strong> 的时间线上。`
      : `你的照片和记忆已从 <strong>${circleName}</strong> 中永久删除。`
    return {
      subject: `你已被移出「${circleName}」`,
      html: layout(`
        <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">${removerName} 已将你移出 ${circleName}</h2>
        <p style="color: #555; margin: 0 0 24px; line-height: 1.6; font-size: 15px;">${outcome}</p>
        <p style="color: #555; margin: 0 0 32px; line-height: 1.6; font-size: 14px;">如果你认为这是一个错误，请联系圈子管理员。</p>
        ${primaryButton(appUrl, '打开 Our Story →')}
      `),
    }
  }

  const outcome = keepContent
    ? `Your photos and memories are still part of <strong>${circleName}</strong>'s story.`
    : `Your photos and memories have been permanently deleted from <strong>${circleName}</strong>.`

  return {
    subject: `You've been removed from ${circleName}`,
    html: layout(`
      <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">${removerName} has removed you from ${circleName}</h2>
      <p style="color: #555; margin: 0 0 24px; line-height: 1.6; font-size: 15px;">${outcome}</p>
      <p style="color: #555; margin: 0 0 32px; line-height: 1.6; font-size: 14px;">If you think this was a mistake, reach out to the circle owner.</p>
      ${primaryButton(appUrl, 'Open Our Story →')}
    `),
  }
}

// ─────────────────────────────────────────────────────────────
// Account deletion confirmation (immediate)
// ─────────────────────────────────────────────────────────────

export function buildAccountDeletionEmail(opts: {
  firstName: string
  purgeDate: string // e.g. "May 18, 2026"
  cancelUrl: string
  locale: string
}): { subject: string; html: string } {
  const { firstName, purgeDate, cancelUrl, locale } = opts

  if (locale === 'zh-CN') {
    return {
      subject: '你的账户已安排删除',
      html: layout(`
        <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">你好，${firstName}</h2>
        <p style="color: #555; margin: 0 0 16px; line-height: 1.6; font-size: 15px;">
          你的 Our Story 账户将于 <strong>${purgeDate}</strong> 永久删除。届时，你在所有圈子中上传的所有照片、视频和记忆都将被永久删除，无法恢复。
        </p>
        <p style="color: #555; margin: 0 0 32px; line-height: 1.6; font-size: 14px;">如果你改变了主意，可以在删除前随时取消。</p>
        ${primaryButton(cancelUrl, '取消删除 →')}
      `),
    }
  }

  return {
    subject: 'Your account is scheduled for deletion',
    html: layout(`
      <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">Hi ${firstName},</h2>
      <p style="color: #555; margin: 0 0 16px; line-height: 1.6; font-size: 15px;">
        Your Our Story account is scheduled for permanent deletion on <strong>${purgeDate}</strong>. All your photos, videos, and memories across every circle will be permanently removed and cannot be recovered.
      </p>
      <p style="color: #555; margin: 0 0 32px; line-height: 1.6; font-size: 14px;">Changed your mind? You can cancel any time before then.</p>
      ${primaryButton(cancelUrl, 'Cancel deletion →')}
    `),
  }
}

// ─────────────────────────────────────────────────────────────
// Account purge warning (day 27 — 3 days before hard delete)
// ─────────────────────────────────────────────────────────────

export function buildPurgeWarningEmail(opts: {
  firstName: string
  purgeDate: string
  cancelUrl: string
  locale: string
}): { subject: string; html: string } {
  const { firstName, purgeDate, cancelUrl, locale } = opts

  if (locale === 'zh-CN') {
    return {
      subject: '你的账户将在 3 天后永久删除',
      html: layout(`
        <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">你好，${firstName}</h2>
        <p style="color: #555; margin: 0 0 16px; line-height: 1.6; font-size: 15px;">
          这是你最后取消删除的机会。你的账户将于 <strong>${purgeDate}</strong> 永久删除，届时所有数据将无法恢复。
        </p>
        ${primaryButton(cancelUrl, '取消删除 →')}
      `),
    }
  }

  return {
    subject: 'Your account will be permanently deleted in 3 days',
    html: layout(`
      <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">Hi ${firstName},</h2>
      <p style="color: #555; margin: 0 0 16px; line-height: 1.6; font-size: 15px;">
        This is your last chance to cancel. Your account will be permanently deleted on <strong>${purgeDate}</strong> and all your data will be gone forever.
      </p>
      ${primaryButton(cancelUrl, 'Cancel deletion →')}
    `),
  }
}

// ─────────────────────────────────────────────────────────────
// Circle deleted — notify all non-owner members
// ─────────────────────────────────────────────────────────────

export function buildCircleDeletedEmail(opts: {
  circleName: string
  ownerName: string
  purgeDate: string // e.g. "May 18, 2026"
  appUrl: string
  locale: string
}): { subject: string; html: string } {
  const { circleName, ownerName, purgeDate, appUrl, locale } = opts
  const exportUrl = `${appUrl}/settings/account`

  if (locale === 'zh-CN') {
    return {
      subject: `${ownerName} 已删除「${circleName}」`,
      html: layout(`
        <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">${ownerName} 已删除「${circleName}」</h2>
        <p style="color: #555; margin: 0 0 16px; line-height: 1.6; font-size: 15px;">
          你有 30 天时间导出自己的照片，之后将永久删除。<strong>${purgeDate}</strong> 后，所有记忆将无法恢复。
        </p>
        <p style="margin: 0 0 24px;">
          ${primaryButton(exportUrl, '导出我的照片 →')}
        </p>
      `),
    }
  }

  if (locale === 'fr') {
    return {
      subject: `${ownerName} a supprimé « ${circleName} »`,
      html: layout(`
        <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">${ownerName} a supprimé « ${circleName} »</h2>
        <p style="color: #555; margin: 0 0 16px; line-height: 1.6; font-size: 15px;">
          Vous avez 30 jours pour exporter vos photos avant qu'elles soient définitivement supprimées. Après le <strong>${purgeDate}</strong>, tous les souvenirs seront irrécupérables.
        </p>
        <p style="margin: 0 0 24px;">
          ${primaryButton(exportUrl, 'Exporter mes photos →')}
        </p>
      `),
    }
  }

  return {
    subject: `${ownerName} has deleted ${circleName}`,
    html: layout(`
      <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">${ownerName} has deleted ${circleName}</h2>
      <p style="color: #555; margin: 0 0 16px; line-height: 1.6; font-size: 15px;">
        You have 30 days to export your photos before they're gone forever. After <strong>${purgeDate}</strong>, all memories will be permanently deleted.
      </p>
      <p style="margin: 0 0 24px;">
        ${primaryButton(exportUrl, 'Export my photos →')}
      </p>
    `),
  }
}

// ─────────────────────────────────────────────────────────────
// Circle deleted — confirmation to the owner (with restore link)
// ─────────────────────────────────────────────────────────────

export function buildCircleDeletedOwnerEmail(opts: {
  circleName: string
  purgeDate: string
  restoreUrl: string
  locale: string
}): { subject: string; html: string } {
  const { circleName, purgeDate, restoreUrl, locale } = opts

  if (locale === 'zh-CN') {
    return {
      subject: `「${circleName}」已安排删除`,
      html: layout(`
        <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">「${circleName}」将被永久删除</h2>
        <p style="color: #555; margin: 0 0 16px; line-height: 1.6; font-size: 15px;">
          删除流程已启动。「<strong>${circleName}</strong>」及其所有内容将于 <strong>${purgeDate}</strong> 永久删除。
        </p>
        <p style="color: #555; margin: 0 0 32px; line-height: 1.6; font-size: 14px;">
          如果你改变了主意，可以在此日期前前往设置页面恢复该圈子。
        </p>
        ${primaryButton(restoreUrl, '前往设置 →')}
      `),
    }
  }

  if (locale === 'fr') {
    return {
      subject: `« ${circleName} » est programmé pour suppression`,
      html: layout(`
        <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">« ${circleName} » sera définitivement supprimé</h2>
        <p style="color: #555; margin: 0 0 16px; line-height: 1.6; font-size: 15px;">
          La suppression a été lancée. « <strong>${circleName}</strong> » et tout son contenu seront définitivement supprimés le <strong>${purgeDate}</strong>.
        </p>
        <p style="color: #555; margin: 0 0 32px; line-height: 1.6; font-size: 14px;">
          Vous avez changé d'avis ? Vous pouvez restaurer ce cercle depuis vos paramètres avant cette date.
        </p>
        ${primaryButton(restoreUrl, 'Aller aux paramètres →')}
      `),
    }
  }

  return {
    subject: `${circleName} is scheduled for deletion`,
    html: layout(`
      <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">${circleName} will be permanently deleted</h2>
      <p style="color: #555; margin: 0 0 16px; line-height: 1.6; font-size: 15px;">
        Deletion has been initiated. <strong>${circleName}</strong> and all its content will be permanently removed on <strong>${purgeDate}</strong>.
      </p>
      <p style="color: #555; margin: 0 0 32px; line-height: 1.6; font-size: 14px;">
        Changed your mind? You can restore this circle from your settings before that date.
      </p>
      ${primaryButton(restoreUrl, 'Go to Settings →')}
    `),
  }
}

// ─────────────────────────────────────────────────────────────
// Tagged in a memory
// ─────────────────────────────────────────────────────────────

export function buildTaggedInMemoryEmail(opts: {
  taggedByName: string
  circleName: string
  appUrl: string
  locale: string
}): { subject: string; html: string } {
  const { taggedByName, circleName, appUrl, locale } = opts

  if (locale === 'zh-CN') {
    return {
      subject: `${taggedByName} 在「${circleName}」的一条记忆中标记了你`,
      html: layout(`
        <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">${taggedByName} 在记忆中标记了你</h2>
        <p style="color: #555; margin: 0 0 24px; line-height: 1.6; font-size: 15px;">
          你被标记在了「<strong>${circleName}</strong>」中的一条记忆里。打开 Our Story 查看它。
        </p>
        ${primaryButton(appUrl, '查看记忆 →')}
      `),
    }
  }

  return {
    subject: `${taggedByName} tagged you in a memory`,
    html: layout(`
      <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">${taggedByName} tagged you in a memory</h2>
      <p style="color: #555; margin: 0 0 24px; line-height: 1.6; font-size: 15px;">
        You've been tagged in a memory in <strong>${circleName}</strong>. Open Our Story to see it.
      </p>
      ${primaryButton(appUrl, 'View memory →')}
    `),
  }
}

// ─────────────────────────────────────────────────────────────
// Weekly / Monthly digest emails (12.1)
// ─────────────────────────────────────────────────────────────

interface DigestMemoryItem {
  id: string
  note: string | null
  milestoneLabel: string | null
  thumbnailUrl: string
  isVideo: boolean
}

export interface DigestEmailOpts {
  recipientFirstName: string
  circleName: string
  childName: string | null
  childAge: string | null
  memories: DigestMemoryItem[]
  totalCount: number
  appUrl: string // /timeline?circle=<id>
  unsubscribeUrl: string // /notification-settings
  locale: 'en' | 'zh-CN' | 'fr'
}

function digestBody(
  opts: DigestEmailOpts,
  periodLabel: { en: string; zh: string; fr: string },
): string {
  const {
    recipientFirstName,
    circleName,
    childName,
    childAge,
    memories,
    totalCount,
    appUrl,
    unsubscribeUrl,
    locale,
  } = opts

  const greetings = {
    en: `Hi ${recipientFirstName ?? 'there'},`,
    'zh-CN': `你好 ${recipientFirstName ?? ''}，`,
    fr: `Bonjour ${recipientFirstName ?? ''},`,
  }
  const intro = {
    en: `${circleName} shared ${totalCount} new memor${totalCount === 1 ? 'y' : 'ies'} ${periodLabel.en}.`,
    'zh-CN': `${circleName}${periodLabel.zh}分享了 ${totalCount} 条新回忆。`,
    fr: `${circleName} a partagé ${totalCount} nouveau${totalCount === 1 ? '' : 'x'} souvenir${totalCount === 1 ? '' : 's'} ${periodLabel.fr}.`,
  }
  const cta = {
    en: 'Open Our Story to react ❤️',
    'zh-CN': '打开 Our Story 表达喜欢 ❤️',
    fr: 'Ouvrir Our Story pour réagir ❤️',
  }
  const unsubscribe = {
    en: `You're receiving this because you're a member of ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Manage email preferences</a>.`,
    'zh-CN': `你收到此邮件是因为你是「${circleName}」的成员。<a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">管理邮件偏好</a>。`,
    fr: `Vous recevez ceci car vous êtes membre de ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Gérer les préférences email</a>.`,
  }

  const heroMemory = memories[0]
  const restMemories = memories.slice(1, 6)

  const childLine =
    childName && childAge
      ? `<p style="font-size:13px;color:#888;margin:0 0 16px;text-align:center;">${childName} · ${childAge}</p>`
      : ''

  const heroImg = heroMemory
    ? `<a href="${appUrl}&memory=${heroMemory.id}" style="display:block;margin:0 0 24px;"><img src="${heroMemory.thumbnailUrl}" style="width:100%;border-radius:12px;display:block;" alt="" /></a>`
    : ''

  const grid = restMemories.length
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 24px;"><tr>${restMemories
        .map(
          (m) =>
            `<td style="padding:2px;width:33.33%;"><a href="${appUrl}&memory=${m.id}"><img src="${m.thumbnailUrl}" style="width:100%;border-radius:6px;display:block;" alt="" /></a></td>`,
        )
        .join('')}</tr></table>`
    : ''

  return `
    <p style="font-size:15px;color:#333;margin:0 0 16px;">${greetings[locale]}</p>
    <p style="font-size:15px;color:#333;margin:0 0 24px;line-height:1.5;">${intro[locale]}</p>
    ${heroImg}
    ${childLine}
    ${grid}
    <p style="margin:0 0 32px;">${primaryButton(appUrl, cta[locale])}</p>
    <p style="font-size:11px;color:#888;line-height:1.5;margin:24px 0 0;">${unsubscribe[locale]}</p>
  `
}

export function buildWeeklyDigestEmail(opts: DigestEmailOpts): {
  subject: string
  html: string
} {
  const { circleName, childName, totalCount, locale } = opts

  const subject = (() => {
    if (locale === 'zh-CN') {
      return childName
        ? `${childName}本周 — ${totalCount} 条新回忆`
        : `${circleName}本周新增 ${totalCount} 条回忆`
    }
    if (locale === 'fr') {
      return childName
        ? `${childName} cette semaine — ${totalCount} nouveau${totalCount === 1 ? '' : 'x'} souvenir${totalCount === 1 ? '' : 's'}`
        : `${circleName} a ajouté ${totalCount} souvenir${totalCount === 1 ? '' : 's'} cette semaine`
    }
    return childName
      ? `${childName} this week — ${totalCount} new memor${totalCount === 1 ? 'y' : 'ies'}`
      : `${circleName} added ${totalCount} memor${totalCount === 1 ? 'y' : 'ies'} this week`
  })()

  const periodLabel = { en: 'this week', zh: '本周', fr: 'cette semaine' }
  return { subject, html: layout(digestBody(opts, periodLabel)) }
}

export function buildMonthlyDigestEmail(opts: DigestEmailOpts): {
  subject: string
  html: string
} {
  const { circleName, childName, totalCount, locale } = opts

  // Use the previous month name (the digest covers the trailing 30 days but is sent on the 1st)
  const lastMonth = new Date()
  lastMonth.setDate(0) // sets to last day of previous month
  const monthName = lastMonth.toLocaleString(
    locale === 'zh-CN' ? 'zh-CN' : locale === 'fr' ? 'fr' : 'en',
    { month: 'long' },
  )

  const subject = (() => {
    if (locale === 'zh-CN') {
      return childName
        ? `${childName}的${monthName} — ${totalCount} 条回忆`
        : `${circleName}的${monthName}回忆`
    }
    if (locale === 'fr') {
      return childName
        ? `${monthName} de ${childName} — ${totalCount} souvenir${totalCount === 1 ? '' : 's'}`
        : `Les souvenirs de ${monthName} — ${circleName}`
    }
    return childName
      ? `${childName}'s ${monthName} — ${totalCount} memor${totalCount === 1 ? 'y' : 'ies'}`
      : `${circleName}'s memories from ${monthName}`
  })()

  const periodLabel = { en: 'this month', zh: '本月', fr: 'ce mois-ci' }
  return { subject, html: layout(digestBody(opts, periodLabel)) }
}

// ─────────────────────────────────────────────────────────────
// Owner auto-promoted to new circle owner
// ─────────────────────────────────────────────────────────────

export function buildOwnerPromotedEmail(opts: {
  newOwnerFirstName: string
  previousOwnerName: string
  circleName: string
  appUrl: string
  locale: string
}): { subject: string; html: string } {
  const { newOwnerFirstName, previousOwnerName, circleName, appUrl, locale } =
    opts

  if (locale === 'zh-CN') {
    return {
      subject: `你现在是「${circleName}」的创建者`,
      html: layout(`
        <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">你好，${newOwnerFirstName}</h2>
        <p style="color: #555; margin: 0 0 24px; line-height: 1.6; font-size: 15px;">
          ${previousOwnerName} 已删除他们的账户，你作为最资深的管理员，现在已成为 <strong>${circleName}</strong> 的新创建者。你现在拥有完全所有权，包括管理成员和删除圈子的权限。
        </p>
        ${primaryButton(appUrl, '打开 Our Story →')}
      `),
    }
  }

  return {
    subject: `You're now the owner of ${circleName}`,
    html: layout(`
      <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">Hi ${newOwnerFirstName},</h2>
      <p style="color: #555; margin: 0 0 24px; line-height: 1.6; font-size: 15px;">
        ${previousOwnerName} has deleted their account. As the most senior admin, you've been made the new owner of <strong>${circleName}</strong>. You now have full ownership including the ability to manage members and delete the circle.
      </p>
      ${primaryButton(appUrl, 'Open Our Story →')}
    `),
  }
}

// ─────────────────────────────────────────────────────────────
// Milestone nudge emails (12.2)
// ─────────────────────────────────────────────────────────────

export interface ChildMilestoneEmailOpts {
  recipientFirstName: string
  childName: string
  milestoneLabel: string
  phase: 'T-3' | 'T0' | 'T+3'
  daysUntil: number
  circleName: string
  appUrl: string
  unsubscribeUrl: string
  locale: 'en' | 'zh-CN' | 'fr'
}

export function buildChildMilestoneEmail(opts: ChildMilestoneEmailOpts): {
  subject: string
  html: string
} {
  const {
    recipientFirstName,
    childName,
    milestoneLabel,
    phase,
    circleName,
    appUrl,
    unsubscribeUrl,
    locale,
  } = opts

  const subject = (() => {
    if (locale === 'zh-CN') {
      if (phase === 'T-3') return `${childName}还有 3 天就 ${milestoneLabel} 了`
      if (phase === 'T0') return `${childName}今天 ${milestoneLabel} 啦 🎉`
      return `${childName}的 ${milestoneLabel} 你拍到了吗？`
    }
    if (locale === 'fr') {
      if (phase === 'T-3')
        return `${childName} aura ${milestoneLabel} dans 3 jours`
      if (phase === 'T0')
        return `${childName} a ${milestoneLabel} aujourd'hui 🎉`
      return `Avez-vous capturé les ${milestoneLabel} de ${childName} ?`
    }
    if (phase === 'T-3') return `${childName} turns ${milestoneLabel} in 3 days`
    if (phase === 'T0') return `${childName} is ${milestoneLabel} today 🎉`
    return `Did you capture ${childName}'s ${milestoneLabel}?`
  })()

  const greeting =
    locale === 'zh-CN'
      ? `你好 ${recipientFirstName}，`
      : locale === 'fr'
        ? `Bonjour ${recipientFirstName},`
        : `Hi ${recipientFirstName ?? 'there'},`

  const intro = (() => {
    if (locale === 'zh-CN') {
      if (phase === 'T-3')
        return `${childName} 还有 3 天就 ${milestoneLabel} 了 — 准备好记录这一刻了吗？`
      if (phase === 'T0')
        return `今天是 ${childName} ${milestoneLabel} 的日子！添加一条记忆吧。`
      return `${childName} 的 ${milestoneLabel} 已经过去了 — 在这一刻消逝前添加一条记忆吧。`
    }
    if (locale === 'fr') {
      if (phase === 'T-3')
        return `${childName} aura ${milestoneLabel} dans 3 jours — prêt à capturer le moment ?`
      if (phase === 'T0')
        return `Aujourd'hui ${childName} a ${milestoneLabel} ! Ajoutez un souvenir.`
      return `${childName} a eu ${milestoneLabel} il y a quelques jours — ajoutez un souvenir avant que le moment ne s'efface.`
    }
    if (phase === 'T-3')
      return `${childName} turns ${milestoneLabel} in 3 days — ready to capture the moment?`
    if (phase === 'T0')
      return `Today is ${childName}'s ${milestoneLabel} milestone 🎉 Add a memory.`
    return `${childName}'s ${milestoneLabel} just passed — add a memory before the moment fades.`
  })()

  const cta =
    locale === 'zh-CN'
      ? '添加记忆 →'
      : locale === 'fr'
        ? 'Ajouter un souvenir →'
        : 'Add a memory →'

  const unsubscribe = (() => {
    if (locale === 'zh-CN')
      return `你收到此邮件是因为你是「${circleName}」的成员。<a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">管理邮件偏好</a>。`
    if (locale === 'fr')
      return `Vous recevez ceci car vous êtes membre de ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Gérer les préférences email</a>.`
    return `You're receiving this because you're a member of ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Manage email preferences</a>.`
  })()

  const body = `
    <p style="font-size:15px;color:#333;margin:0 0 16px;">${greeting}</p>
    <p style="font-size:15px;color:#333;margin:0 0 24px;line-height:1.5;">${intro}</p>
    <p style="margin:0 0 32px;">${primaryButton(appUrl, cta)}</p>
    <p style="font-size:11px;color:#888;line-height:1.5;margin:24px 0 0;">${unsubscribe}</p>
  `
  return { subject, html: layout(body) }
}

export interface AnniversaryEmailOpts {
  recipientFirstName: string
  years: number
  scopeType: 'couple' | 'trip'
  phase: 'T-3' | 'T0' | 'T+3'
  circleName: string
  appUrl: string
  unsubscribeUrl: string
  locale: 'en' | 'zh-CN' | 'fr'
}

export function buildAnniversaryEmail(opts: AnniversaryEmailOpts): {
  subject: string
  html: string
} {
  const {
    recipientFirstName,
    years,
    scopeType,
    phase,
    circleName,
    appUrl,
    unsubscribeUrl,
    locale,
  } = opts
  const isCouple = scopeType === 'couple'

  const subject = (() => {
    if (locale === 'zh-CN') {
      if (isCouple) {
        if (phase === 'T-3') return `你们的纪念日还有 3 天`
        if (phase === 'T0') return `${years} 周年快乐 🥂`
        return `你们庆祝纪念日了吗？`
      }
      if (phase === 'T-3') return `你们的旅行纪念日还有 3 天`
      if (phase === 'T0') return `这次旅行已经 ${years} 年了 🌍`
      return `你们记录了这次旅行的纪念吗？`
    }
    if (locale === 'fr') {
      if (isCouple) {
        if (phase === 'T-3') return `Votre anniversaire est dans 3 jours`
        if (phase === 'T0') return `Joyeux ${years} ans ensemble 🥂`
        return `Avez-vous célébré votre anniversaire ?`
      }
      if (phase === 'T-3')
        return `L'anniversaire de votre voyage est dans 3 jours`
      if (phase === 'T0') return `${years} ans depuis votre voyage 🌍`
      return `Avez-vous célébré l'anniversaire du voyage ?`
    }
    if (isCouple) {
      if (phase === 'T-3') return `Your anniversary is in 3 days`
      if (phase === 'T0') return `Happy ${years} years 🥂`
      return `Did you celebrate? Add a memory →`
    }
    if (phase === 'T-3') return `Your trip anniversary is in 3 days`
    if (phase === 'T0') return `${years} years since your trip 🌍`
    return `Did you mark the trip anniversary?`
  })()

  const greeting =
    locale === 'zh-CN'
      ? `你好 ${recipientFirstName}，`
      : locale === 'fr'
        ? `Bonjour ${recipientFirstName},`
        : `Hi ${recipientFirstName ?? 'there'},`

  const intro = (() => {
    if (locale === 'zh-CN') {
      if (isCouple) {
        if (phase === 'T-3')
          return `你们的 ${years} 周年还有 3 天 — 准备好捕捉这一刻吗？`
        if (phase === 'T0')
          return `今天是你们 ${years} 周年纪念日 🥂 添加一条记忆吧。`
        return `你们的 ${years} 周年纪念日刚过 — 添加一条记忆吧。`
      }
      if (phase === 'T-3')
        return `这次旅行的 ${years} 周年还有 3 天 — 准备好回顾了吗？`
      if (phase === 'T0') return `这次旅行已经 ${years} 年了 — 添加一条回忆吧。`
      return `旅行 ${years} 周年刚过 — 添加一条回忆吧。`
    }
    if (locale === 'fr') {
      if (isCouple) {
        if (phase === 'T-3')
          return `Vos ${years} ans approchent dans 3 jours — prêt à capturer le moment ?`
        if (phase === 'T0')
          return `Aujourd'hui c'est vos ${years} ans 🥂 Ajoutez un souvenir.`
        return `Votre anniversaire de ${years} ans vient de passer — ajoutez un souvenir.`
      }
      if (phase === 'T-3')
        return `L'anniversaire de votre voyage de ${years} ans est dans 3 jours.`
      if (phase === 'T0')
        return `${years} ans depuis votre voyage — ajoutez un souvenir.`
      return `L'anniversaire du voyage de ${years} ans vient de passer — ajoutez un souvenir.`
    }
    if (isCouple) {
      if (phase === 'T-3')
        return `Your ${years}-year anniversary is in 3 days — ready to capture the moment?`
      if (phase === 'T0')
        return `Today is your ${years}-year anniversary 🥂 Add a memory.`
      return `Your ${years}-year anniversary just passed — add a memory before the moment fades.`
    }
    if (phase === 'T-3')
      return `Your ${years}-year trip anniversary is in 3 days — ready to look back?`
    if (phase === 'T0') return `${years} years since your trip — add a memory.`
    return `${years} years since your trip — add a memory before the moment fades.`
  })()

  const cta =
    locale === 'zh-CN'
      ? '添加记忆 →'
      : locale === 'fr'
        ? 'Ajouter un souvenir →'
        : 'Add a memory →'

  const unsubscribe = (() => {
    if (locale === 'zh-CN')
      return `你收到此邮件是因为你是「${circleName}」的成员。<a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">管理邮件偏好</a>。`
    if (locale === 'fr')
      return `Vous recevez ceci car vous êtes membre de ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Gérer les préférences email</a>.`
    return `You're receiving this because you're a member of ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Manage email preferences</a>.`
  })()

  const body = `
    <p style="font-size:15px;color:#333;margin:0 0 16px;">${greeting}</p>
    <p style="font-size:15px;color:#333;margin:0 0 24px;line-height:1.5;">${intro}</p>
    <p style="margin:0 0 32px;">${primaryButton(appUrl, cta)}</p>
    <p style="font-size:11px;color:#888;line-height:1.5;margin:24px 0 0;">${unsubscribe}</p>
  `
  return { subject, html: layout(body) }
}

// ─────────────────────────────────────────────────────────────
// "Your First Month" recap email (12.3)
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// "A memory from your first month" email (10.2 below-threshold fallback)
// ─────────────────────────────────────────────────────────────

export interface FirstMonthMemoryEmailOpts {
  recipientFirstName: string
  circleName: string
  uploaderName: string
  memoryNote: string | null
  memoryDate: string
  memoryThumbnailUrl: string | null
  appUrl: string
  unsubscribeUrl: string
  locale: 'en' | 'zh-CN' | 'fr'
}

export function buildFirstMonthMemoryEmail(opts: FirstMonthMemoryEmailOpts): {
  subject: string
  html: string
} {
  const {
    recipientFirstName,
    circleName,
    uploaderName,
    memoryNote,
    memoryDate,
    memoryThumbnailUrl,
    appUrl,
    unsubscribeUrl,
    locale,
  } = opts

  const subject = (() => {
    if (locale === 'zh-CN') return `「${circleName}」最初的一段回忆`
    if (locale === 'fr')
      return `Un souvenir de vos premiers jours avec ${circleName}`
    return `A memory from your first month with ${circleName}`
  })()

  const greeting =
    locale === 'zh-CN'
      ? `你好 ${recipientFirstName}，`
      : locale === 'fr'
        ? `Bonjour ${recipientFirstName},`
        : `Hi ${recipientFirstName ?? 'there'},`

  const intro = (() => {
    if (locale === 'zh-CN') return `这是你们圈子最早期的一段回忆。`
    if (locale === 'fr')
      return `Voici un souvenir des tout débuts de votre cercle.`
    return `Here's a memory from your circle's earliest days.`
  })()

  const dateFormatted = new Date(memoryDate).toLocaleDateString(
    locale === 'zh-CN' ? 'zh-CN' : locale === 'fr' ? 'fr' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' },
  )

  const heroImg = memoryThumbnailUrl
    ? `<img src="${memoryThumbnailUrl}" style="width:100%;border-radius:12px;display:block;margin:0 0 8px;" alt="" />`
    : ''

  const heroNote = memoryNote
    ? `<p style="font-size:14px;color:#444;font-style:italic;margin:0 0 4px;line-height:1.5;">"${memoryNote}"</p>`
    : ''

  const heroByline = `<p style="font-size:12px;color:#888;margin:0 0 24px;">${uploaderName} · ${dateFormatted}</p>`

  const cta =
    locale === 'zh-CN'
      ? '在 Our Story 中打开 →'
      : locale === 'fr'
        ? 'Ouvrir dans Our Story →'
        : 'Open in Our Story →'

  const unsubscribe = (() => {
    if (locale === 'zh-CN')
      return `你收到此邮件是因为你是「${circleName}」的成员。<a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">管理邮件偏好</a>。`
    if (locale === 'fr')
      return `Vous recevez ceci car vous êtes membre de ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Gérer les préférences email</a>.`
    return `You're receiving this because you're a member of ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Manage email preferences</a>.`
  })()

  const body = `
    <p style="font-size:15px;color:#333;margin:0 0 16px;">${greeting}</p>
    <p style="font-size:15px;color:#333;margin:0 0 24px;line-height:1.5;">${intro}</p>
    ${heroImg}
    ${heroNote}
    ${heroByline}
    <p style="margin:0 0 32px;">${primaryButton(appUrl, cta)}</p>
    <p style="font-size:11px;color:#888;line-height:1.5;margin:24px 0 0;">${unsubscribe}</p>
  `

  return { subject, html: layout(body) }
}

// ─────────────────────────────────────────────────────────────
// Quiet Circle nudge email (12.4)
// ─────────────────────────────────────────────────────────────

export interface QuietCircleNudgeEmailOpts {
  recipientFirstName: string
  circleName: string
  nudgeCount: 1 | 2 | 3
  daysSinceLastMemory: number
  appUrl: string
  unsubscribeUrl: string
  locale: 'en' | 'zh-CN' | 'fr'
}

export function buildQuietCircleNudgeEmail(opts: QuietCircleNudgeEmailOpts): {
  subject: string
  html: string
} {
  const {
    recipientFirstName,
    circleName,
    nudgeCount,
    daysSinceLastMemory,
    appUrl,
    unsubscribeUrl,
    locale,
  } = opts

  const subject = (() => {
    if (locale === 'zh-CN') {
      if (nudgeCount === 1)
        return `「${circleName}」已经 ${daysSinceLastMemory} 天没有新动态了`
      if (nudgeCount === 2) return `「${circleName}」已经有一段时间没人上传了`
      return `最后一次提醒 — 「${circleName}」`
    }
    if (locale === 'fr') {
      if (nudgeCount === 1)
        return `${circleName} est silencieux depuis ${daysSinceLastMemory} jours`
      if (nudgeCount === 2)
        return `Cela fait un moment que personne n'a ajouté à ${circleName}`
      return `Dernier rappel — ${circleName}`
    }
    if (nudgeCount === 1)
      return `${circleName} has been quiet for ${daysSinceLastMemory} days`
    if (nudgeCount === 2)
      return `It's been a while since anyone added to ${circleName}`
    return `One last reminder — ${circleName}`
  })()

  const greeting =
    locale === 'zh-CN'
      ? `你好 ${recipientFirstName}，`
      : locale === 'fr'
        ? `Bonjour ${recipientFirstName},`
        : `Hi ${recipientFirstName ?? 'there'},`

  const intro = (() => {
    if (locale === 'zh-CN')
      return `已经 ${daysSinceLastMemory} 天没有人在「${circleName}」添加新记忆了。`
    if (locale === 'fr')
      return `Cela fait ${daysSinceLastMemory} jours que personne n'a ajouté de souvenir à ${circleName}.`
    return `It's been ${daysSinceLastMemory} days since anyone added a memory to ${circleName}.`
  })()

  const tone = (() => {
    if (locale === 'zh-CN') {
      if (nudgeCount === 1)
        return `哪怕只是一条短短的文字记录，也能让故事活下去。`
      if (nudgeCount === 2)
        return `照片堆积在手机里。当你把它们放到这里，故事才真正存在。`
      return `这是最后一次提醒 — 我们不想打扰你。无论你是继续记录还是暂停一下，这个圈子随时为你保留着。`
    }
    if (locale === 'fr') {
      if (nudgeCount === 1)
        return `Même une petite note garde l'histoire vivante.`
      if (nudgeCount === 2)
        return `Les photos s'accumulent sur les téléphones. L'histoire vit ici quand vous les ajoutez.`
      return `C'est le dernier rappel — nous ne voulons pas vous embêter. Que vous continuiez à construire ou que vous fassiez une pause, ce cercle vous attendra.`
    }
    if (nudgeCount === 1) return `Even a quick note keeps the story alive.`
    if (nudgeCount === 2)
      return `Photos pile up on phones. The story lives here when you put them in.`
    return `This is the last nudge — we won't badger you. Whether you keep building or pause, this circle is here when you're ready.`
  })()

  const cta =
    locale === 'zh-CN'
      ? '添加记忆 →'
      : locale === 'fr'
        ? 'Ajouter un souvenir →'
        : 'Add a memory →'

  const unsubscribe = (() => {
    if (locale === 'zh-CN')
      return `你收到此邮件是因为你是「${circleName}」的创建者。<a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">管理邮件偏好</a>。`
    if (locale === 'fr')
      return `Vous recevez ceci car vous êtes le propriétaire de ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Gérer les préférences email</a>.`
    return `You're receiving this because you're the owner of ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Manage email preferences</a>.`
  })()

  const body = `
    <p style="font-size:15px;color:#333;margin:0 0 16px;">${greeting}</p>
    <p style="font-size:15px;color:#333;margin:0 0 16px;line-height:1.5;">${intro}</p>
    <p style="font-size:15px;color:#333;margin:0 0 24px;line-height:1.5;font-style:italic;">${tone}</p>
    <p style="margin:0 0 32px;">${primaryButton(appUrl, cta)}</p>
    <p style="font-size:11px;color:#888;line-height:1.5;margin:24px 0 0;">${unsubscribe}</p>
  `

  return { subject, html: layout(body) }
}
