// supabase/functions/send-quiet-circle-nudges/quietCircleNudgeEmail.ts
// IMPORTANT: 1:1 mirror of buildQuietCircleNudgeEmail from server/utils/email.ts.
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
