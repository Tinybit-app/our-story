// supabase/functions/send-on-this-day/firstMonthMemoryEmail.ts
// IMPORTANT: 1:1 mirror of buildFirstMonthMemoryEmail from server/utils/email.ts.
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
