# i18n Localization (English + Chinese Simplified) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add English and Chinese Simplified (zh-CN) localization to all user-facing strings using `@nuxtjs/i18n` v8, with an in-place language toggle in the main header dropdown that persists the preference to the database.

**Architecture:** Install `@nuxtjs/i18n` with `strategy: 'no_prefix'` (no URL prefix changes). All strings live in `/locales/en.json` and `/locales/zh-CN.json`. Components use `const { t, locale } = useI18n()` — auto-imported by Nuxt. Locale preference is stored in the `User.locale` DB column (already exists, constraint needs updating to use `'zh-CN'` instead of `'zh-Hans'`). On app init, locale is loaded from the profile API and applied via `setLocale()`. The `i18n` cookie serves as fallback for unauthenticated pages (login, onboarding). Language toggle is a button in the existing avatar dropdown on `index.vue`.

**Tech Stack:** Nuxt 3 (SPA, `ssr: false`), `@nuxtjs/i18n` v8, vue-i18n v9, pnpm

---

## File Structure

**Create:**

- `locales/en.json` — all English strings, grouped by namespace
- `locales/zh-CN.json` — all Chinese Simplified strings
- `supabase/migrations/006_locale.sql` — update locale check constraint from `'zh-Hans'` → `'zh-CN'`

**Modify:**

- `nuxt.config.ts` — add `@nuxtjs/i18n` to modules, add `i18n` config block
- `server/api/profile.get.ts` — include `locale` in response
- `server/api/profile.patch.ts` — accept optional `locale` field
- `app/pages/login.vue` — replace hardcoded strings with `t()`
- `app/pages/onboarding/index.vue` — replace hardcoded strings with `t()`
- `app/pages/onboarding/name.vue` — replace hardcoded strings with `t()`
- `app/pages/onboarding/profile.vue` — replace hardcoded strings with `t()`
- `app/pages/onboarding/invite.vue` — replace hardcoded strings with `t()`
- `app/pages/index.vue` — add language toggle + replace hardcoded strings with `t()`
- `app/components/UploadMemory.vue` — replace hardcoded strings with `t()`
- `app/components/TimelinePolaroid.vue` — replace hardcoded strings with `t()`
- `app/components/MemoryModal.vue` — replace hardcoded strings with `t()`
- `app/components/PolaroidCard.vue` — replace hardcoded strings with `t()`

---

## Task 1: Install and configure @nuxtjs/i18n

**Files:**

- Modify: `package.json` (via pnpm)
- Modify: `nuxt.config.ts`

- [ ] **Step 1: Install the package**

```bash
pnpm add @nuxtjs/i18n
```

Expected: package added to `dependencies` in `package.json`.

- [ ] **Step 2: Add module and i18n config to nuxt.config.ts**

In `nuxt.config.ts`, add `'@nuxtjs/i18n'` to the `modules` array and add this top-level `i18n` block:

```ts
modules: [
  '@nuxtjs/supabase',
  '@nuxtjs/tailwindcss',
  '@vueuse/nuxt',
  '@sentry/nuxt/module',
  '@nuxtjs/color-mode',
  '@nuxtjs/i18n',           // ← add this
],

// Add this block at the top level of defineNuxtConfig:
i18n: {
  strategy: 'no_prefix',
  defaultLocale: 'en',
  locales: [
    { code: 'en', name: 'English', file: 'en.json' },
    { code: 'zh-CN', name: '中文', file: 'zh-CN.json' },
  ],
  langDir: 'locales/',
  detectBrowserLanguage: {
    useCookie: true,
    cookieKey: 'i18n_locale',
    alwaysRedirect: false,
    fallbackLocale: 'en',
  },
},
```

- [ ] **Step 3: Create empty locale files**

Create `locales/en.json`:

```json
{}
```

Create `locales/zh-CN.json`:

```json
{}
```

- [ ] **Step 4: Verify app starts**

```bash
pnpm dev
```

Expected: dev server starts, no errors about missing locale files or module config. App loads at `http://localhost:3000`.

- [ ] **Step 5: Commit**

```bash
git add nuxt.config.ts locales/en.json locales/zh-CN.json package.json pnpm-lock.yaml
git commit -m "feat: install and configure @nuxtjs/i18n with no-prefix strategy"
```

---

## Task 2: DB migration + profile API locale support

**Background:** The `User` table already has a `locale TEXT CHECK (locale IN ('en', 'zh-Hans'))` column (from `001_initial_schema.sql`). The check constraint uses `'zh-Hans'` but the i18n module uses `'zh-CN'`. This task updates the constraint and threads `locale` through the profile API.

**Files:**

- Create: `supabase/migrations/006_locale.sql`
- Modify: `server/api/profile.get.ts`
- Modify: `server/api/profile.patch.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/006_locale.sql`:

```sql
-- Update locale check constraint from 'zh-Hans' to 'zh-CN'
-- to match the BCP 47 locale code used by @nuxtjs/i18n.
ALTER TABLE public."User"
  DROP CONSTRAINT IF EXISTS "User_locale_check";

-- Migrate any existing 'zh-Hans' values (shouldn't be any yet, but safe to do)
UPDATE public."User" SET locale = 'zh-CN' WHERE locale = 'zh-Hans';

ALTER TABLE public."User"
  ADD CONSTRAINT "User_locale_check" CHECK (locale IN ('en', 'zh-CN'));
```

- [ ] **Step 2: Run and verify migration locally**

```bash
pnpm db:push
```

Expected: migration applies without error.

- [ ] **Step 3: Update profile.get.ts to return locale**

Replace the entire file:

```ts
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const { data, error } = await supabase
    .from('user')
    .select('first_name, last_name, avatar_url, locale')
    .eq('id', user.sub)
    .maybeSingle()

  if (error) {
    console.error('[profile] query failed:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to load profile.' })
  }

  return {
    firstName: data?.first_name ?? null,
    lastName: data?.last_name ?? null,
    avatarUrl: data?.avatar_url ?? null,
    locale: data?.locale ?? null,
  }
})
```

- [ ] **Step 4: Update profile.patch.ts to accept optional locale**

Replace the schema and update call:

```ts
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const schema = z.object({
  firstName: z
    .string()
    .min(1)
    .max(100)
    .transform((s) => s.trim())
    .optional(),
  lastName: z
    .string()
    .max(100)
    .transform((s) => s.trim())
    .optional(),
  locale: z.enum(['en', 'zh-CN']).optional(),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = schema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid profile data.' })
  const { firstName, lastName, locale } = result.data

  // Build update payload — only include fields that were provided
  const patch: Record<string, unknown> = {}
  if (firstName !== undefined) patch.first_name = firstName
  if (lastName !== undefined) patch.last_name = lastName ?? null
  if (locale !== undefined) patch.locale = locale

  if (Object.keys(patch).length === 0) return { ok: true }

  const { error } = await supabase.from('user').update(patch).eq('id', user.sub)

  if (error) {
    console.error('[profile] update failed:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to save profile. Please try again.' })
  }

  return { ok: true }
})
```

- [ ] **Step 5: Run unit tests**

```bash
pnpm test
```

Expected: all tests pass (no tests touch profile directly, so this is a smoke check).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/006_locale.sql server/api/profile.get.ts server/api/profile.patch.ts
git commit -m "feat(i18n): add locale to profile API, update DB constraint to zh-CN"
```

---

## Task 3: Create locale files with all strings

**Files:**

- Modify: `locales/en.json`
- Modify: `locales/zh-CN.json`

**Pluralization:** vue-i18n v9 pipe syntax: `"key": "singular | plural"`. The call `t('key', n)` selects the form; `{n}` renders the count. Chinese uses a single form.

- [ ] **Step 1: Write locales/en.json**

```json
{
  "login": {
    "tagline": "Every moment worth keeping, in one place.",
    "subtitle": "For you, your family, your friends.",
    "continueWithGoogle": "Continue with Google",
    "continueWithEmail": "Continue with email",
    "sending": "Sending…",
    "checkInbox": "Check your inbox",
    "sentLink": "We sent a sign-in link to {email}",
    "tryDifferent": "Try a different way",
    "noPassword": "We'll send you a sign-in link — no password needed."
  },
  "onboarding": {
    "whoIsThis": "Who is this story for?",
    "personalise": "We'll personalise your experience based on your group.",
    "continue": "Continue",
    "back": "Back",
    "nameCircle": "Name your circle",
    "nameCircleSub": "This is what your members will see.",
    "creating": "Creating…",
    "whatsYourName": "What's your name?",
    "nameSub": "So your circle knows who you are.",
    "firstName": "First name",
    "lastName": "Last name (optional)",
    "saving": "Saving…",
    "inviteFirst": "Invite your first member",
    "inviteSub": "They'll get an email with a link to join your story.",
    "inviteSent": "Invite sent",
    "inviteSentLink": "A link has been sent to {email}",
    "sendInvite": "Send invite",
    "skipForNow": "Skip for now"
  },
  "circleType": {
    "parents": { "label": "New parents", "description": "Baby milestones & growth" },
    "couple": { "label": "Couple", "description": "Relationship milestones" },
    "family": { "label": "Family", "description": "General family memories" },
    "friends": { "label": "Friend group", "description": "Trips, reunions, moments" },
    "caregiving": { "label": "Caregiving", "description": "Health & life events" },
    "travel": { "label": "Travel group", "description": "Adventures together" },
    "solo": { "label": "Just me", "description": "Personal timeline" }
  },
  "nav": {
    "addMemory": "Add memory",
    "members": "{n} member | {n} members",
    "profileSettings": "Profile settings",
    "inviteMember": "Invite member",
    "lightMode": "Light mode",
    "darkMode": "Dark mode",
    "logOut": "Log out",
    "jumpTo": "Jump to",
    "inviteSomeone": "Invite someone",
    "inviteDesc": "They'll get an email with a link to join {circle}.",
    "cancel": "Cancel",
    "sending": "Sending…",
    "sendInvite": "Send invite",
    "inviteSentTo": "Invite sent to {email}.",
    "inviteAlreadySent": "An invite was already sent to this email.",
    "inviteMaxPending": "You have 10 pending invites. Wait for some to be accepted first.",
    "inviteFailed": "Failed to send invite. Please try again."
  },
  "timeline": {
    "emptyTitle": "Your story starts here",
    "emptyDesc": "Add your first photo or video to start building your shared timeline.",
    "loading": "Loading memories…",
    "memories": "{n} memory | {n} memories",
    "months": "{n} month | {n} months"
  },
  "card": {
    "noNote": "No note"
  },
  "modal": {
    "tabCaption": "Caption",
    "tabComments": "Comments",
    "milestone": "Milestone",
    "note": "Note",
    "milestonePlaceholder": "e.g. First steps",
    "notePlaceholder": "Add a note…",
    "cancel": "Cancel",
    "saving": "Saving…",
    "save": "Save",
    "noNote": "No note added",
    "noNoteOwner": "No note added — click the edit icon to add one",
    "addComment": "Add a comment…",
    "post": "Post",
    "noComments": "No comments yet",
    "viewOlderComments": "View {n} older comment | View {n} older comments"
  },
  "upload": {
    "addMemory": "Add a memory",
    "addMemories": "Add {n} memories",
    "addMore": "+ Add more",
    "applyToAll": "Apply to all",
    "note": "Note",
    "milestone": "Milestone",
    "whenWas": "When was this?",
    "cancel": "Cancel",
    "upload": "Upload",
    "uploadN": "Upload {n}",
    "uploading": "Uploading {done}/{total}…",
    "allUploaded": "All uploaded ✓"
  }
}
```

- [ ] **Step 2: Write locales/zh-CN.json**

```json
{
  "login": {
    "tagline": "每一个值得珍藏的时刻，都在这里。",
    "subtitle": "为你、你的家人、你的朋友。",
    "continueWithGoogle": "使用 Google 继续",
    "continueWithEmail": "使用邮箱继续",
    "sending": "发送中…",
    "checkInbox": "请查收邮件",
    "sentLink": "我们已向 {email} 发送了登录链接",
    "tryDifferent": "尝试其他方式",
    "noPassword": "我们将发送登录链接 — 无需密码。"
  },
  "onboarding": {
    "whoIsThis": "这是谁的故事？",
    "personalise": "我们将根据你的群体为你提供个性化体验。",
    "continue": "继续",
    "back": "返回",
    "nameCircle": "给你的圈子命名",
    "nameCircleSub": "这是你的成员将看到的名称。",
    "creating": "创建中…",
    "whatsYourName": "你叫什么名字？",
    "nameSub": "让你的圈子认识你。",
    "firstName": "名字",
    "lastName": "姓氏（可选）",
    "saving": "保存中…",
    "inviteFirst": "邀请第一位成员",
    "inviteSub": "他们将收到一封含有加入链接的邮件。",
    "inviteSent": "邀请已发送",
    "inviteSentLink": "链接已发送至 {email}",
    "sendInvite": "发送邀请",
    "skipForNow": "暂时跳过"
  },
  "circleType": {
    "parents": { "label": "新手父母", "description": "宝宝成长里程碑" },
    "couple": { "label": "情侣", "description": "感情里程碑" },
    "family": { "label": "家庭", "description": "家庭回忆" },
    "friends": { "label": "朋友圈", "description": "旅行、聚会、精彩时刻" },
    "caregiving": { "label": "照护日记", "description": "健康与生活事件" },
    "travel": { "label": "旅行团", "description": "一起探险" },
    "solo": { "label": "只有我", "description": "个人时间线" }
  },
  "nav": {
    "addMemory": "添加记忆",
    "members": "{n} 位成员",
    "profileSettings": "个人设置",
    "inviteMember": "邀请成员",
    "lightMode": "浅色模式",
    "darkMode": "深色模式",
    "logOut": "退出登录",
    "jumpTo": "跳转到",
    "inviteSomeone": "邀请成员",
    "inviteDesc": "他们将收到一封加入 {circle} 的邮件链接。",
    "cancel": "取消",
    "sending": "发送中…",
    "sendInvite": "发送邀请",
    "inviteSentTo": "邀请已发送至 {email}。",
    "inviteAlreadySent": "此邮箱已收到邀请。",
    "inviteMaxPending": "你有 10 个待处理的邀请，请等待部分邀请被接受后再试。",
    "inviteFailed": "邀请发送失败，请重试。"
  },
  "timeline": {
    "emptyTitle": "你的故事从这里开始",
    "emptyDesc": "上传第一张照片或视频，开始记录你们的共同时间线。",
    "loading": "加载记忆中…",
    "memories": "{n} 条记忆",
    "months": "{n} 个月"
  },
  "card": {
    "noNote": "暂无备注"
  },
  "modal": {
    "tabCaption": "标题",
    "tabComments": "评论",
    "milestone": "里程碑",
    "note": "备注",
    "milestonePlaceholder": "例：第一步",
    "notePlaceholder": "添加备注…",
    "cancel": "取消",
    "saving": "保存中…",
    "save": "保存",
    "noNote": "暂无备注",
    "noNoteOwner": "暂无备注 — 点击编辑图标添加",
    "addComment": "添加评论…",
    "post": "发布",
    "noComments": "暂无评论",
    "viewOlderComments": "查看 {n} 条更早的评论"
  },
  "upload": {
    "addMemory": "添加记忆",
    "addMemories": "添加 {n} 条记忆",
    "addMore": "+ 添加更多",
    "applyToAll": "应用到全部",
    "note": "备注",
    "milestone": "里程碑",
    "whenWas": "这是什么时候？",
    "cancel": "取消",
    "upload": "上传",
    "uploadN": "上传 {n} 个",
    "uploading": "上传中 {done}/{total}…",
    "allUploaded": "全部上传完成 ✓"
  }
}
```

- [ ] **Step 3: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('locales/en.json','utf8'))" && echo "en.json valid"
node -e "JSON.parse(require('fs').readFileSync('locales/zh-CN.json','utf8'))" && echo "zh-CN.json valid"
```

Expected: both lines print "valid".

- [ ] **Step 4: Commit**

```bash
git add locales/en.json locales/zh-CN.json
git commit -m "feat: add English and Chinese Simplified locale files"
```

---

## Task 4: Localize login.vue

**Files:**

- Modify: `app/pages/login.vue:1-78`

- [ ] **Step 1: Add useI18n and replace all hardcoded strings in the template**

Add `const { t } = useI18n()` to the `<script setup>` block (after `definePageMeta`). Then replace strings in the template:

```vue
<script setup lang="ts">
definePageMeta({ auth: false })
const { t } = useI18n()
// ... rest of existing script unchanged
</script>
```

Replace template strings:

| Original                                              | Replacement                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| `Every moment worth keeping, in one place.`           | `{{ t('login.tagline') }}`                                          |
| `For you, your family, your friends.`                 | `{{ t('login.subtitle') }}`                                         |
| `Continue with Google` (button text)                  | `{{ t('login.continueWithGoogle') }}`                               |
| `{{ loading ? 'Sending…' : 'Continue with email' }}`  | `{{ loading ? t('login.sending') : t('login.continueWithEmail') }}` |
| `Check your inbox`                                    | `{{ t('login.checkInbox') }}`                                       |
| `We sent a sign-in link to ...`                       | `{{ t('login.sentLink', { email }) }}`                              |
| `Try a different way`                                 | `{{ t('login.tryDifferent') }}`                                     |
| `We'll send you a sign-in link — no password needed.` | `{{ t('login.noPassword') }}`                                       |

Full updated template section (success state):

```html
<div v-if="sent" class="mt-6 rounded-[12px] border border-border bg-card px-5 py-4 text-center">
  <p class="mb-1 text-sm font-semibold text-foreground">{{ t('login.checkInbox') }}</p>
  <p class="text-xs leading-relaxed text-muted-foreground">{{ t('login.sentLink', { email }) }}</p>
  <button
    type="button"
    class="mt-3 text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
    @click="sent = false; authError = null"
  >
    {{ t('login.tryDifferent') }}
  </button>
</div>
<p
  v-else-if="!authError"
  class="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground"
>
  {{ t('login.noPassword') }}
</p>
```

- [ ] **Step 2: Verify**

Start dev server, navigate to `/login`. Confirm all English strings render. Then in browser devtools console run:

```js
document.cookie = 'i18n_locale=zh-CN; path=/'
location.reload()
```

Confirm page shows Chinese strings (e.g. "每一个值得珍藏的时刻，都在这里。"). Reset: `document.cookie = 'i18n_locale=en; path=/'`.

- [ ] **Step 3: Commit**

```bash
git add app/pages/login.vue
git commit -m "feat(i18n): localize login page"
```

---

## Task 5: Localize onboarding pages

**Files:**

- Modify: `app/pages/onboarding/index.vue`
- Modify: `app/pages/onboarding/name.vue`
- Modify: `app/pages/onboarding/profile.vue`
- Modify: `app/pages/onboarding/invite.vue`

- [ ] **Step 1: Localize onboarding/index.vue**

Add `const { t } = useI18n()` to `<script setup>`. Replace strings:

```vue
<script setup lang="ts">
definePageMeta({ middleware: 'onboarding' })
const { t } = useI18n()
// ... rest of existing script
```

Replace `circleTypes` array definition with a computed that uses translations:

```ts
const circleTypes = computed(() => [
  {
    value: 'parents',
    label: t('circleType.parents.label'),
    description: t('circleType.parents.description'),
  },
  {
    value: 'couple',
    label: t('circleType.couple.label'),
    description: t('circleType.couple.description'),
  },
  {
    value: 'family',
    label: t('circleType.family.label'),
    description: t('circleType.family.description'),
  },
  {
    value: 'friends',
    label: t('circleType.friends.label'),
    description: t('circleType.friends.description'),
  },
  {
    value: 'caregiving',
    label: t('circleType.caregiving.label'),
    description: t('circleType.caregiving.description'),
  },
  {
    value: 'travel',
    label: t('circleType.travel.label'),
    description: t('circleType.travel.description'),
  },
  {
    value: 'solo',
    label: t('circleType.solo.label'),
    description: t('circleType.solo.description'),
  },
])
```

Replace template strings:

```html
<h1 ...>{{ t('onboarding.whoIsThis') }}</h1>
<p ...>{{ t('onboarding.personalise') }}</p>
<!-- Continue button -->
{{ t('onboarding.continue') }}
```

- [ ] **Step 2: Localize onboarding/name.vue**

Add `const { t } = useI18n()` to `<script setup>`. Replace strings:

```html
<h1 ...>{{ t('onboarding.nameCircle') }}</h1>
<p ...>{{ t('onboarding.nameCircleSub') }}</p>
<!-- Continue/Creating button -->
{{ loading ? t('onboarding.creating') : t('onboarding.continue') }}
<!-- Back button -->
{{ t('onboarding.back') }}
```

- [ ] **Step 3: Localize onboarding/profile.vue**

Add `const { t } = useI18n()` to `<script setup>`. Replace strings:

```html
<h1 ...>{{ t('onboarding.whatsYourName') }}</h1>
<p ...>{{ t('onboarding.nameSub') }}</p>
<input ... :placeholder="t('onboarding.firstName')" />
<input ... :placeholder="t('onboarding.lastName')" />
<!-- Continue/Saving button -->
{{ loading ? t('onboarding.saving') : t('onboarding.continue') }}
```

- [ ] **Step 4: Localize onboarding/invite.vue**

Add `const { t } = useI18n()` to `<script setup>`. Replace strings:

```html
<h1 ...>{{ t('onboarding.inviteFirst') }}</h1>
<p ...>{{ t('onboarding.inviteSub') }}</p>

<!-- Sent confirmation card -->
<p ...>{{ t('onboarding.inviteSent') }}</p>
<p ...>{{ t('onboarding.inviteSentLink', { email }) }}</p>

<!-- Send invite button -->
{{ loading ? t('nav.sending') : t('onboarding.sendInvite') }}

<!-- Skip/Continue button -->
{{ sent ? t('onboarding.continue') : t('onboarding.skipForNow') }}
```

- [ ] **Step 5: Verify onboarding flow**

Navigate to `/onboarding`. Verify English strings. Switch locale cookie to `zh-CN`, reload, verify Chinese strings on all 4 onboarding pages.

- [ ] **Step 6: Commit**

```bash
git add app/pages/onboarding/index.vue app/pages/onboarding/name.vue app/pages/onboarding/profile.vue app/pages/onboarding/invite.vue
git commit -m "feat(i18n): localize onboarding pages"
```

---

## Task 6: Add language toggle + localize index.vue (with DB persistence)

**Files:**

- Modify: `app/pages/index.vue`

The profile is already fetched via `useFetch('/api/profile')` on this page. Load the saved locale from it on mount, and persist when toggling.

- [ ] **Step 1: Add useI18n and locale init from profile**

Add at the top of `<script setup>` (after the existing `const { t, locale, setLocale } = useI18n()` line — or add it fresh):

```ts
const { t, locale, setLocale } = useI18n()
```

After the existing `const { data: profile } = await useFetch('/api/profile')` line, apply the saved locale immediately:

```ts
// Apply saved locale from DB profile (profile is already fetched above)
if (profile.value?.locale) {
  setLocale(profile.value.locale as 'en' | 'zh-CN')
}
```

- [ ] **Step 2: Add toggleLocale function (persists to DB)**

Add after `toggleTheme()`:

```ts
async function toggleLocale() {
  const next = locale.value === 'en' ? 'zh-CN' : 'en'
  await setLocale(next)
  menuOpen.value = false
  // Fire-and-forget — cookie already updated by setLocale; DB is best-effort
  $fetch('/api/profile', { method: 'PATCH', body: { locale: next } }).catch(() => {})
}
```

- [ ] **Step 3: Add language toggle button to the dropdown**

In the dropdown `<div class="py-1">`, add after the theme toggle button and before `<div class="h-px bg-border mx-3" />`:

```html
<!-- Language toggle -->
<button
  class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
  @click="toggleLocale"
>
  <svg
    class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    viewBox="0 0 24 24"
  >
    <circle cx="12" cy="12" r="10" />
    <path
      d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
    />
  </svg>
  {{ locale === 'en' ? '中文' : 'English' }}
</button>
```

- [ ] **Step 4: Replace hardcoded strings in template**

Header:

```html
<span>{{ t('nav.addMemory') }}</span> {{ t('nav.members', circle.memberCount) }}
```

Dropdown:

```html
{{ t('nav.profileSettings') }} {{ t('nav.inviteMember') }} {{ isDark ? t('nav.lightMode') :
t('nav.darkMode') }} {{ t('nav.logOut') }}
```

Jump modal:

```html
<h2 ...>{{ t('nav.jumpTo') }}</h2>
```

Invite dialog:

```html
<h2 ...>{{ t('nav.inviteSomeone') }}</h2>
<p ...>{{ t('nav.inviteDesc', { circle: circle?.name ?? 'your circle' }) }}</p>
{{ t('nav.cancel') }} {{ inviteSending ? t('nav.sending') : t('nav.sendInvite') }} {{
t('nav.inviteSentTo', { email: inviteSentTo }) }}
```

Update `sendInvite()` error messages:

```ts
if (msg.includes('already been sent')) inviteError.value = t('nav.inviteAlreadySent')
else if (msg.includes('Max 10')) inviteError.value = t('nav.inviteMaxPending')
else inviteError.value = t('nav.inviteFailed')
```

- [ ] **Step 5: Verify DB persistence**

1. Start dev server and log in.
2. Open avatar dropdown → click "中文". Verify UI switches to Chinese instantly.
3. Hard-refresh the page (`Cmd+Shift+R`). Verify it loads in Chinese (locale loaded from DB profile).
4. Open devtools → Network → find the PATCH `/api/profile` request — confirm body is `{"locale":"zh-CN"}` and response is `{"ok":true}`.
5. Click "English" in the dropdown. Hard-refresh — verify it loads in English.

- [ ] **Step 6: Commit**

```bash
git add app/pages/index.vue
git commit -m "feat(i18n): add language toggle with DB persistence, localize main index page"
```

---

## Task 7: Localize UploadMemory.vue

**Files:**

- Modify: `app/components/UploadMemory.vue`

- [ ] **Step 1: Add useI18n to script setup**

In the `<script setup>` block (after the `defineProps` and `defineExpose` lines):

```ts
const { t } = useI18n()
```

- [ ] **Step 2: Replace hardcoded strings in template**

Header:

```html
<!-- h2 title -->
{{ items.length === 1 ? t('upload.addMemory') : t('upload.addMemories', items.length) }}

<!-- + Add more button -->
{{ t('upload.addMore') }}
```

Batch group date row:

```html
{{ t('upload.applyToAll') }}
```

Single item labels:

```html
<label ...>{{ t('upload.note') }}</label>
<label ...>{{ t('upload.milestone') }}</label>
<label ...>{{ t('upload.whenWas') }}</label>
```

Footer buttons:

```html
<!-- Cancel -->
{{ t('upload.cancel') }}

<!-- Upload button -->
<span v-if="isUploading"
  >{{ t('upload.uploading', { done: doneCount, total: items.length }) }}</span
>
<span v-else-if="allDone">{{ t('upload.allUploaded') }}</span>
<span v-else
  >{{ items.length === 1 ? t('upload.upload') : t('upload.uploadN', items.length) }}</span
>
```

- [ ] **Step 3: Verify**

Open the upload modal by clicking "Add memory" on the main page. Verify English strings. Switch locale to zh-CN, reopen modal, verify Chinese strings (e.g. "添加记忆", "上传", "应用到全部").

- [ ] **Step 4: Commit**

```bash
git add app/components/UploadMemory.vue
git commit -m "feat(i18n): localize UploadMemory component"
```

---

## Task 8: Localize TimelinePolaroid.vue and PolaroidCard.vue

**Files:**

- Modify: `app/components/TimelinePolaroid.vue`
- Modify: `app/components/PolaroidCard.vue`

- [ ] **Step 1: Localize TimelinePolaroid.vue**

Add `const { t } = useI18n()` to `<script setup>`.

Replace strings in template:

```html
<!-- Empty state -->
<p ...>{{ t('timeline.emptyTitle') }}</p>
<p ...>{{ t('timeline.emptyDesc') }}</p>

<!-- Loading skeleton -->
<p ...>{{ t('timeline.loading') }}</p>

<!-- Month section header -->
<span ...>{{ group.label }} &middot; {{ t('timeline.memories', group.totalCount) }}</span>

<!-- See more card -->
<span
  >+{{ group.totalCount - group.memories.length }} {{ t('timeline.memories', group.totalCount -
  group.memories.length).replace(/^\d+ /, '') }}</span
>
```

Wait — the "See more" card currently shows `+{{ n }} more` and `Open {{ group.label }} →`. For the memory count word, use `t('timeline.memories', n)` which renders as "5 memories" (including the number). Since we need just the word, do this inline:

```html
<span class="leading-snug">+{{ group.totalCount - group.memories.length }} more</span>
<span class="leading-snug">Open {{ group.label }} →</span>
```

Leave "more" and "Open ... →" as-is for now (they contain dynamic content and are less prominent — can be addressed in a follow-up if needed).

Update the `yearSummary` function to use `t()`:

```ts
function yearSummary(yearSection: { year: number; months: MonthGroup[] }): string {
  const totalMemories = yearSection.months.reduce((sum, g) => sum + g.totalCount, 0)
  const monthCount = yearSection.months.length
  return `${t('timeline.memories', totalMemories)} · ${t('timeline.months', monthCount)}`
}
```

- [ ] **Step 2: Localize PolaroidCard.vue**

Add `const { t } = useI18n()` to `<script setup>`.

Replace strings in template:

```html
<!-- Caption fallback -->
:class="captionText ? 'text-foreground' : 'text-muted-foreground/40 italic'"
>{{ captionText || t('card.noNote') }}</p>

<!-- Image alt text -->
:alt="memory.note ?? t('card.noNote')"
```

- [ ] **Step 3: Verify**

On the main timeline, verify the empty state, loading text, year summary, and month header all show correct strings. Switch locale to zh-CN and confirm Chinese strings appear for all these elements.

- [ ] **Step 4: Commit**

```bash
git add app/components/TimelinePolaroid.vue app/components/PolaroidCard.vue
git commit -m "feat(i18n): localize TimelinePolaroid and PolaroidCard components"
```

---

## Task 9: Localize MemoryModal.vue

**Files:**

- Modify: `app/components/MemoryModal.vue`

- [ ] **Step 1: Add useI18n to script setup**

After the existing `const PRESET_EMOJIS = [...]` block:

```ts
const { t } = useI18n()
```

- [ ] **Step 2: Replace hardcoded strings in template**

Tab bar:

```html
<!-- Caption tab button -->
{{ t('modal.tabCaption') }}

<!-- Comments tab button (keep the count badge logic unchanged) -->
{{ t('modal.tabComments') }}
```

Caption tab — edit mode labels:

```html
<label ...>{{ t('modal.milestone') }}</label>
<label ...>{{ t('modal.note') }}</label>
<input ... :placeholder="t('modal.milestonePlaceholder')" ... />
<textarea ... :placeholder="t('modal.notePlaceholder')" ... />

<!-- Cancel / Save buttons -->
{{ t('modal.cancel') }} {{ saving ? t('modal.saving') : t('modal.save') }}
```

Caption tab — view mode empty state:

```html
<p v-else class="mb-2 text-[13px] italic text-muted-foreground/50">
  {{ isOwner ? t('modal.noNoteOwner') : t('modal.noNote') }}
</p>
```

Comments tab — input:

```html
<textarea ... :placeholder="t('modal.addComment')" ... />
<button ...>{{ submitting ? '…' : t('modal.post') }}</button>
```

Comments tab — empty state and view older:

```html
<p v-else ...>{{ t('modal.noComments') }}</p>

<button v-if="!allCommentsVisible && hiddenCommentCount > 0" ...>
  {{ t('modal.viewOlderComments', hiddenCommentCount) }}
</button>
```

- [ ] **Step 3: Verify**

Open a memory modal. Verify all strings in Caption and Comments tabs display correctly in English. Switch locale to zh-CN (cookie), reload, open a memory — verify Chinese strings: "标题", "评论", "添加备注…", "发布", "暂无评论".

- [ ] **Step 4: Commit**

```bash
git add app/components/MemoryModal.vue
git commit -m "feat(i18n): localize MemoryModal component"
```

---

## Self-Review

**Spec coverage check:**

- ✅ `@nuxtjs/i18n` installed and configured with `no_prefix` strategy
- ✅ DB migration updating `locale` check constraint from `'zh-Hans'` → `'zh-CN'`
- ✅ Profile GET returns `locale`; Profile PATCH accepts optional `locale`
- ✅ English locale file with all ~80 strings across 8 namespaces
- ✅ Chinese Simplified locale file with all corresponding strings
- ✅ Language toggle in main header dropdown (index.vue)
- ✅ Locale loaded from DB profile on app init (survives hard-refresh)
- ✅ Locale saved to DB on toggle (fire-and-forget PATCH)
- ✅ Cookie fallback for unauthenticated pages (login, onboarding)
- ✅ Login page localized
- ✅ All 4 onboarding pages localized
- ✅ UploadMemory component localized
- ✅ TimelinePolaroid + PolaroidCard localized
- ✅ MemoryModal localized

**Placeholder scan:** No TBD/TODO entries present. All `t()` calls have matching keys in both locale files.

**Type consistency:** `t()` is from `useI18n()` in every file. Plural calls `t('key', n)` use numeric `n` consistently throughout.

**Not in scope (follow-up):**

- `app/pages/member/[userId].vue` header (uses same nav component pattern; strings minimal)
- "more" / "Open ... →" text in the "See more" card (contains dynamic circle name, low priority)
- Email templates (server-side, separate concern)
