// IMPORTANT: keep in sync with server/utils/email.ts builders.
// Deno Edge Functions can't import from Nitro, so this is a 1:1 mirror.

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
