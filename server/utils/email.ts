import { Resend } from "resend"

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
    console.log(`[dev] email to ${opts.to}: ${opts.subject}`)
    return
  }
  const resend = new Resend(config.resendApiKey as string)
  await resend.emails.send({
    from: "Our Story <hello@our-story.tinybit.app>",
    ...opts,
  })
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

  if (locale === "zh-CN") {
    const outcome = keepContent
      ? `你的照片和记忆仍保留在 <strong>${circleName}</strong> 的时间线上。`
      : `你的照片和记忆已从 <strong>${circleName}</strong> 中永久删除。`
    return {
      subject: `你已被移出「${circleName}」`,
      html: layout(`
        <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">${removerName} 已将你移出 ${circleName}</h2>
        <p style="color: #555; margin: 0 0 24px; line-height: 1.6; font-size: 15px;">${outcome}</p>
        <p style="color: #555; margin: 0 0 32px; line-height: 1.6; font-size: 14px;">如果你认为这是一个错误，请联系圈子管理员。</p>
        ${primaryButton(appUrl, "打开 Our Story →")}
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
      ${primaryButton(appUrl, "Open Our Story →")}
    `),
  }
}

// ─────────────────────────────────────────────────────────────
// Account deletion confirmation (immediate)
// ─────────────────────────────────────────────────────────────

export function buildAccountDeletionEmail(opts: {
  firstName: string
  purgeDate: string   // e.g. "May 18, 2026"
  cancelUrl: string
  locale: string
}): { subject: string; html: string } {
  const { firstName, purgeDate, cancelUrl, locale } = opts

  if (locale === "zh-CN") {
    return {
      subject: "你的账户已安排删除",
      html: layout(`
        <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">你好，${firstName}</h2>
        <p style="color: #555; margin: 0 0 16px; line-height: 1.6; font-size: 15px;">
          你的 Our Story 账户将于 <strong>${purgeDate}</strong> 永久删除。届时，你在所有圈子中上传的所有照片、视频和记忆都将被永久删除，无法恢复。
        </p>
        <p style="color: #555; margin: 0 0 32px; line-height: 1.6; font-size: 14px;">如果你改变了主意，可以在删除前随时取消。</p>
        ${primaryButton(cancelUrl, "取消删除 →")}
      `),
    }
  }

  return {
    subject: "Your account is scheduled for deletion",
    html: layout(`
      <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">Hi ${firstName},</h2>
      <p style="color: #555; margin: 0 0 16px; line-height: 1.6; font-size: 15px;">
        Your Our Story account is scheduled for permanent deletion on <strong>${purgeDate}</strong>. All your photos, videos, and memories across every circle will be permanently removed and cannot be recovered.
      </p>
      <p style="color: #555; margin: 0 0 32px; line-height: 1.6; font-size: 14px;">Changed your mind? You can cancel any time before then.</p>
      ${primaryButton(cancelUrl, "Cancel deletion →")}
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

  if (locale === "zh-CN") {
    return {
      subject: "你的账户将在 3 天后永久删除",
      html: layout(`
        <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">你好，${firstName}</h2>
        <p style="color: #555; margin: 0 0 16px; line-height: 1.6; font-size: 15px;">
          这是你最后取消删除的机会。你的账户将于 <strong>${purgeDate}</strong> 永久删除，届时所有数据将无法恢复。
        </p>
        ${primaryButton(cancelUrl, "取消删除 →")}
      `),
    }
  }

  return {
    subject: "Your account will be permanently deleted in 3 days",
    html: layout(`
      <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">Hi ${firstName},</h2>
      <p style="color: #555; margin: 0 0 16px; line-height: 1.6; font-size: 15px;">
        This is your last chance to cancel. Your account will be permanently deleted on <strong>${purgeDate}</strong> and all your data will be gone forever.
      </p>
      ${primaryButton(cancelUrl, "Cancel deletion →")}
    `),
  }
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
  const { newOwnerFirstName, previousOwnerName, circleName, appUrl, locale } = opts

  if (locale === "zh-CN") {
    return {
      subject: `你现在是「${circleName}」的创建者`,
      html: layout(`
        <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px;">你好，${newOwnerFirstName}</h2>
        <p style="color: #555; margin: 0 0 24px; line-height: 1.6; font-size: 15px;">
          ${previousOwnerName} 已删除他们的账户，你作为最资深的管理员，现在已成为 <strong>${circleName}</strong> 的新创建者。你现在拥有完全所有权，包括管理成员和删除圈子的权限。
        </p>
        ${primaryButton(appUrl, "打开 Our Story →")}
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
      ${primaryButton(appUrl, "Open Our Story →")}
    `),
  }
}
