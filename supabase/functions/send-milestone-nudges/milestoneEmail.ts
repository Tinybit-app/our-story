// IMPORTANT: keep in sync with server/utils/email.ts.
// Deno can't import from Nitro, so this is a 1:1 mirror.

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

export interface ChildMilestoneEmailOpts {
  recipientFirstName: string
  childName: string
  milestoneLabel: string
  phase: "T-3" | "T0" | "T+3"
  daysUntil: number
  circleName: string
  appUrl: string
  unsubscribeUrl: string
  locale: "en" | "zh-CN" | "fr"
}

export function buildChildMilestoneEmail(opts: ChildMilestoneEmailOpts): { subject: string; html: string } {
  const { recipientFirstName, childName, milestoneLabel, phase, circleName, appUrl, unsubscribeUrl, locale } = opts

  const subject = (() => {
    if (locale === "zh-CN") {
      if (phase === "T-3") return `${childName}还有 3 天就 ${milestoneLabel} 了`
      if (phase === "T0") return `${childName}今天 ${milestoneLabel} 啦 🎉`
      return `${childName}的 ${milestoneLabel} 你拍到了吗？`
    }
    if (locale === "fr") {
      if (phase === "T-3") return `${childName} aura ${milestoneLabel} dans 3 jours`
      if (phase === "T0") return `${childName} a ${milestoneLabel} aujourd'hui 🎉`
      return `Avez-vous capturé les ${milestoneLabel} de ${childName} ?`
    }
    if (phase === "T-3") return `${childName} turns ${milestoneLabel} in 3 days`
    if (phase === "T0") return `${childName} is ${milestoneLabel} today 🎉`
    return `Did you capture ${childName}'s ${milestoneLabel}?`
  })()

  const greeting = locale === "zh-CN"
    ? `你好 ${recipientFirstName}，`
    : locale === "fr"
      ? `Bonjour ${recipientFirstName},`
      : `Hi ${recipientFirstName ?? "there"},`

  const intro = (() => {
    if (locale === "zh-CN") {
      if (phase === "T-3") return `${childName} 还有 3 天就 ${milestoneLabel} 了 — 准备好记录这一刻了吗？`
      if (phase === "T0") return `今天是 ${childName} ${milestoneLabel} 的日子！添加一条记忆吧。`
      return `${childName} 的 ${milestoneLabel} 已经过去了 — 在这一刻消逝前添加一条记忆吧。`
    }
    if (locale === "fr") {
      if (phase === "T-3") return `${childName} aura ${milestoneLabel} dans 3 jours — prêt à capturer le moment ?`
      if (phase === "T0") return `Aujourd'hui ${childName} a ${milestoneLabel} ! Ajoutez un souvenir.`
      return `${childName} a eu ${milestoneLabel} il y a quelques jours — ajoutez un souvenir avant que le moment ne s'efface.`
    }
    if (phase === "T-3") return `${childName} turns ${milestoneLabel} in 3 days — ready to capture the moment?`
    if (phase === "T0") return `Today is ${childName}'s ${milestoneLabel} milestone 🎉 Add a memory.`
    return `${childName}'s ${milestoneLabel} just passed — add a memory before the moment fades.`
  })()

  const cta = locale === "zh-CN" ? "添加记忆 →" : locale === "fr" ? "Ajouter un souvenir →" : "Add a memory →"

  const unsubscribe = (() => {
    if (locale === "zh-CN") return `你收到此邮件是因为你是「${circleName}」的成员。<a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">管理邮件偏好</a>。`
    if (locale === "fr") return `Vous recevez ceci car vous êtes membre de ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Gérer les préférences email</a>.`
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
  scopeType: "couple" | "trip"
  phase: "T-3" | "T0" | "T+3"
  circleName: string
  appUrl: string
  unsubscribeUrl: string
  locale: "en" | "zh-CN" | "fr"
}

export function buildAnniversaryEmail(opts: AnniversaryEmailOpts): { subject: string; html: string } {
  const { recipientFirstName, years, scopeType, phase, circleName, appUrl, unsubscribeUrl, locale } = opts
  const isCouple = scopeType === "couple"

  const subject = (() => {
    if (locale === "zh-CN") {
      if (isCouple) {
        if (phase === "T-3") return `你们的纪念日还有 3 天`
        if (phase === "T0") return `${years} 周年快乐 🥂`
        return `你们庆祝纪念日了吗？`
      }
      if (phase === "T-3") return `你们的旅行纪念日还有 3 天`
      if (phase === "T0") return `这次旅行已经 ${years} 年了 🌍`
      return `你们记录了这次旅行的纪念吗？`
    }
    if (locale === "fr") {
      if (isCouple) {
        if (phase === "T-3") return `Votre anniversaire est dans 3 jours`
        if (phase === "T0") return `Joyeux ${years} ans ensemble 🥂`
        return `Avez-vous célébré votre anniversaire ?`
      }
      if (phase === "T-3") return `L'anniversaire de votre voyage est dans 3 jours`
      if (phase === "T0") return `${years} ans depuis votre voyage 🌍`
      return `Avez-vous célébré l'anniversaire du voyage ?`
    }
    if (isCouple) {
      if (phase === "T-3") return `Your anniversary is in 3 days`
      if (phase === "T0") return `Happy ${years} years 🥂`
      return `Did you celebrate? Add a memory →`
    }
    if (phase === "T-3") return `Your trip anniversary is in 3 days`
    if (phase === "T0") return `${years} years since your trip 🌍`
    return `Did you mark the trip anniversary?`
  })()

  const greeting = locale === "zh-CN"
    ? `你好 ${recipientFirstName}，`
    : locale === "fr"
      ? `Bonjour ${recipientFirstName},`
      : `Hi ${recipientFirstName ?? "there"},`

  const intro = (() => {
    if (locale === "zh-CN") {
      if (isCouple) {
        if (phase === "T-3") return `你们的 ${years} 周年还有 3 天 — 准备好捕捉这一刻吗？`
        if (phase === "T0") return `今天是你们 ${years} 周年纪念日 🥂 添加一条记忆吧。`
        return `你们的 ${years} 周年纪念日刚过 — 添加一条记忆吧。`
      }
      if (phase === "T-3") return `这次旅行的 ${years} 周年还有 3 天 — 准备好回顾了吗？`
      if (phase === "T0") return `这次旅行已经 ${years} 年了 — 添加一条回忆吧。`
      return `旅行 ${years} 周年刚过 — 添加一条回忆吧。`
    }
    if (locale === "fr") {
      if (isCouple) {
        if (phase === "T-3") return `Vos ${years} ans approchent dans 3 jours — prêt à capturer le moment ?`
        if (phase === "T0") return `Aujourd'hui c'est vos ${years} ans 🥂 Ajoutez un souvenir.`
        return `Votre anniversaire de ${years} ans vient de passer — ajoutez un souvenir.`
      }
      if (phase === "T-3") return `L'anniversaire de votre voyage de ${years} ans est dans 3 jours.`
      if (phase === "T0") return `${years} ans depuis votre voyage — ajoutez un souvenir.`
      return `L'anniversaire du voyage de ${years} ans vient de passer — ajoutez un souvenir.`
    }
    if (isCouple) {
      if (phase === "T-3") return `Your ${years}-year anniversary is in 3 days — ready to capture the moment?`
      if (phase === "T0") return `Today is your ${years}-year anniversary 🥂 Add a memory.`
      return `Your ${years}-year anniversary just passed — add a memory before the moment fades.`
    }
    if (phase === "T-3") return `Your ${years}-year trip anniversary is in 3 days — ready to look back?`
    if (phase === "T0") return `${years} years since your trip — add a memory.`
    return `${years} years since your trip — add a memory before the moment fades.`
  })()

  const cta = locale === "zh-CN" ? "添加记忆 →" : locale === "fr" ? "Ajouter un souvenir →" : "Add a memory →"

  const unsubscribe = (() => {
    if (locale === "zh-CN") return `你收到此邮件是因为你是「${circleName}」的成员。<a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">管理邮件偏好</a>。`
    if (locale === "fr") return `Vous recevez ceci car vous êtes membre de ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Gérer les préférences email</a>.`
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
