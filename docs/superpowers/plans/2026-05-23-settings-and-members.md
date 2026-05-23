# Settings + Members Redesign (Sub-Plan #6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the three settings pages (`/notification-settings`, `/settings/account`, `/circle-settings`) using spec §5.2's Apple Rows pattern, and the members page (`/members`) using §5.3's Roster pattern. Build a small set of shared row primitives that the three settings pages compose. No behavior change — same data, same API calls, same auto-save logic — only visual restyling.

**Architecture:** Three new primitive components (`SettingsRow`, `SettingsSection`, `SettingsToggle`) form the vocabulary. Each settings page rewrites its template to use the primitives; script logic stays largely untouched. The members page reuses the same row vocabulary inline (it has different content shape — avatars, role chips — and doesn't need a separate primitive). All four pages move to italic Instrument Serif display titles + mono section labels + monochrome design system.

**Source spec:** [docs/superpowers/specs/2026-05-16-timeline-mosaic-cards-design.md](../specs/2026-05-16-timeline-mosaic-cards-design.md) §5.2 (settings) + §5.3 (members).

**Tech Stack:** Nuxt 3 + Vue 3 (`<script setup>`) + Tailwind v3. No new dependencies, no DB changes, no API changes.

**Sub-plan position:** Last of the timeline-redesign series. Independent of #3 (modal) and #7 (viewer link) — touches different surfaces, no merge conflicts expected with what's already shipped on `dev`.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `app/components/SettingsSection.vue` | Create | Section card primitive: optional mono uppercase label above + rounded card with `--card` background and hairlines between row slots. Default slot for rows. |
| `app/components/SettingsRow.vue` | Create | Row primitive per spec §5.2 anatomy. Slots: `icon` (optional 28×28 icon container), `default` (label + hint stack), `control` (right-aligned control). Optional `to` prop for drill-rows (renders as NuxtLink with chevron). |
| `app/components/SettingsToggle.vue` | Create | 40×22 pill toggle per spec. `v-model` binding. 200ms transition. |
| `app/pages/notification-settings.vue` | Modify | Template rewrite using primitives. Same script + API logic. |
| `app/pages/settings/account.vue` | Modify | Template rewrite. |
| `app/pages/circle-settings.vue` | Modify | Template rewrite (owner-only restrictions preserved). |
| `app/pages/members.vue` | Modify | Template rewrite using primitives inline + hero card. Role chips inline. |
| `unit/settings-toggle.test.ts` | Create | Smoke test for SettingsToggle's v-model + visual state. |

Files intentionally unchanged: existing API endpoints (notification preferences, profile, circle settings, member operations), all composables, all server logic.

---

## Visual reference — Apple Rows pattern

```
┌─ Back ─ Our Story · Notifications ────────────────────┐    <- page strip
│                                                        │
│   How we find you                                      │    <- Instrument Serif italic, 30-34px
│   When to ping, when to leave you alone.              │    <- subtitle, 12.5px muted
│                                                        │
├─ PUSH ─────────────────────────────────────────────────┤    <- mono section label
│  ┌────────────────────────────────────────────────┐   │
│  │ [🔔] Push notifications              [ON]      │   │    <- row
│  │      New memories, comments, reactions          │   │
│  ├────────────────────────────────────────────────┤   │
│  │ [⏰] Quiet hours              10 – 7  ▸         │   │
│  └────────────────────────────────────────────────┘   │
├─ EMAIL ────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────┐   │
│  │ [✉] Weekly digest                      [ON]    │   │
```

---

## Task 1: Build the row primitives

**Files:**
- Create: `app/components/SettingsSection.vue`
- Create: `app/components/SettingsRow.vue`
- Create: `app/components/SettingsToggle.vue`
- Create: `unit/settings-toggle.test.ts`

### Step 1: SettingsToggle

The 40×22 pill toggle. v-model binding. CSS-only animation.

```vue
<!-- app/components/SettingsToggle.vue -->
<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    class="relative inline-flex h-[22px] w-10 flex-shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50"
    :class="modelValue ? 'bg-foreground' : 'bg-foreground/10'"
    @click="onClick"
  >
    <span
      class="inline-block h-[18px] w-[18px] transform rounded-full transition-transform duration-200"
      :class="[
        modelValue
          ? 'translate-x-[20px] bg-background'
          : 'translate-x-[2px] bg-white',
      ]"
    />
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()

function onClick() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>
```

Note: `bg-foreground` and `bg-background` are inverted in the on-state so the knob shows against the foreground track. In dark mode (Obsidian), foreground = near-white, so on = near-white track + near-black knob. In light mode (Porcelain), foreground = near-black, so on = near-black track + near-white knob. Spec §5.2 says "On = `var(--foreground)` track + inverted-foreground knob" — matches.

### Step 2: SettingsRow

```vue
<!-- app/components/SettingsRow.vue -->
<template>
  <component
    :is="to ? NuxtLink : 'div'"
    :to="to"
    class="flex w-full items-center gap-[14px] px-[14px] py-[13px] text-left"
    :class="to ? 'cursor-pointer transition-colors hover:bg-foreground/[.03]' : ''"
  >
    <!-- Icon slot -->
    <div
      v-if="$slots.icon"
      class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-foreground/[.06] text-foreground/80"
    >
      <slot name="icon" />
    </div>

    <!-- Label stack -->
    <div class="min-w-0 flex-1">
      <p
        class="text-[14px] font-medium leading-tight text-foreground"
        :class="destructive && 'text-destructive'"
      >
        <slot />
      </p>
      <p
        v-if="$slots.hint"
        class="mt-0.5 text-[11px] leading-[1.35] text-muted-foreground"
      >
        <slot name="hint" />
      </p>
    </div>

    <!-- Control slot (right-aligned) -->
    <div v-if="$slots.control" class="flex-shrink-0">
      <slot name="control" />
    </div>

    <!-- Chevron for drill-rows -->
    <svg
      v-if="to"
      class="h-3 w-3 flex-shrink-0 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      viewBox="0 0 24 24"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  </component>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components'

defineProps<{
  /** When set, the row renders as a NuxtLink and shows a chevron. */
  to?: string
  /** Render label in destructive color (e.g. "Delete account"). */
  destructive?: boolean
}>()
</script>
```

### Step 3: SettingsSection

```vue
<!-- app/components/SettingsSection.vue -->
<template>
  <section class="mb-8">
    <h2
      v-if="label"
      class="mb-2 ml-[14px] font-mono text-[9px] font-bold uppercase leading-none tracking-[.22em] text-muted-foreground"
    >
      {{ label }}
    </h2>
    <div
      class="overflow-hidden rounded-[14px] border border-border bg-card divide-y divide-foreground/[.05]"
    >
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  label?: string
}>()
</script>
```

Note: `divide-y divide-foreground/[.05]` adds the 1px hairline between rows automatically. Each row inside the section is a child of this divider container.

### Step 4: Unit test for SettingsToggle

Create `unit/settings-toggle.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import SettingsToggle from '~/components/SettingsToggle.vue'

vi.stubGlobal('useI18n', () => ({ t: (k: string) => k }))

describe('SettingsToggle', () => {
  it('renders with the given modelValue', () => {
    const wrapper = mount(SettingsToggle, {
      props: { modelValue: false },
    })
    expect(wrapper.attributes('aria-checked')).toBe('false')
  })

  it('emits update:modelValue with the inverted boolean on click', async () => {
    const wrapper = mount(SettingsToggle, {
      props: { modelValue: false },
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
  })

  it('does not emit when disabled', async () => {
    const wrapper = mount(SettingsToggle, {
      props: { modelValue: false, disabled: true },
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
```

### Step 5: Run the test

```bash
pnpm test unit/settings-toggle.test.ts
```

Expected: 3 tests pass.

### Step 6: Run full suite

```bash
pnpm test
npx vue-tsc --noEmit
```

Expected: 598 + 3 = **601** tests pass. Zero TS errors.

### Step 7: Commit

```bash
git add app/components/SettingsSection.vue app/components/SettingsRow.vue app/components/SettingsToggle.vue unit/settings-toggle.test.ts
git commit -m "feat(settings): row primitives (SettingsSection / SettingsRow / SettingsToggle)"
```

---

## Task 2: Rewrite `/notification-settings`

Per spec §5.2 + §5.3: italic display title "How we find you", subtitle "When to ping, when to leave you alone." (the existing copy may differ — use the existing i18n keys; we're not changing content). Sections: PUSH, EMAIL, PER-CIRCLE.

**Files:**
- Modify: `app/pages/notification-settings.vue`

### Step 1: Read the current page

```bash
wc -l app/pages/notification-settings.vue
grep -nE "<template>|<header|<h1|<h2|<form|togglePush|toggleDigest|prefsLoaded" app/pages/notification-settings.vue | head -20
```

Understand the current structure (sections, save logic, i18n keys).

### Step 2: Rewrite the template

Preserve `<script setup>` entirely. Rewrite only the `<template>` block. Structure:

```vue
<template>
  <div class="min-h-screen bg-background">
    <!-- Page strip: back button + brand kicker · Notifications -->
    <header class="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
      <div class="mx-auto flex h-14 max-w-[640px] items-center gap-3 px-5">
        <button
          class="-ml-1 flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          @click="router.back()"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {{ t('common.back') }}
        </button>
        <span class="flex-1 text-center">
          <span class="text-[9px] font-bold uppercase tracking-[.18em] text-accent">Our Story</span>
          <span class="mx-1 text-muted-foreground">·</span>
          <span class="text-[12px] font-medium text-foreground">{{ t('notificationSettings.title') }}</span>
        </span>
        <div class="w-12" />
      </div>
    </header>

    <main class="mx-auto max-w-[640px] px-5 py-8">
      <!-- Italic display title block -->
      <div class="mb-8 px-[4px]">
        <h1 class="font-serif text-[32px] italic leading-[1.05] text-foreground sm:text-[34px]">
          {{ t('notificationSettings.displayTitle') }}
        </h1>
        <p class="mt-2 text-[12.5px] leading-[1.5] text-muted-foreground">
          {{ t('notificationSettings.displaySubtitle') }}
        </p>
      </div>

      <!-- PUSH section -->
      <SettingsSection :label="t('notificationSettings.sectionPush')">
        <SettingsRow>
          <template #icon>
            <!-- bell icon SVG -->
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </template>
          {{ t('notificationSettings.pushLabel') }}
          <template #hint>{{ t('notificationSettings.pushHint') }}</template>
          <template #control>
            <SettingsToggle v-model="pushEnabled" @update:model-value="onPushChange" />
          </template>
        </SettingsRow>

        <!-- Other rows: quiet hours drill, etc. — wrap each in <SettingsRow> -->
      </SettingsSection>

      <!-- EMAIL section -->
      <SettingsSection :label="t('notificationSettings.sectionEmail')">
        ...
      </SettingsSection>

      <!-- PER-CIRCLE section (if user has multiple circles) -->
      <SettingsSection v-if="circles.length > 1" :label="t('notificationSettings.sectionPerCircle')">
        <SettingsRow
          v-for="c in circles"
          :key="c.id"
          :to="`/notification-settings?circle=${c.id}`"
        >
          {{ c.name }}
          <template #hint>{{ getCircleSummary(c) }}</template>
        </SettingsRow>
      </SettingsSection>

      <!-- Saved toast / pill — preserve existing implementation -->
    </main>
  </div>
</template>
```

This is a SKETCH. The implementer must:
1. Identify all existing sections / rows / fields in the current page
2. Map each to a `<SettingsRow>` inside a `<SettingsSection>`
3. Preserve all i18n keys (or add new ones for `displayTitle` / `displaySubtitle` / `section*` if missing — see Step 3)
4. Preserve all v-model bindings and event handlers
5. Preserve the "Saved" toast or auto-save indicator

### Step 3: i18n keys

The new template needs:
- `notificationSettings.displayTitle` — e.g. "How we find you"
- `notificationSettings.displaySubtitle` — e.g. "When to ping, when to leave you alone."
- `notificationSettings.sectionPush` — "Push"
- `notificationSettings.sectionEmail` — "Email"
- `notificationSettings.sectionPerCircle` — "Per circle"

Add these to en/zh-CN/fr if missing. Use existing keys for everything else (row labels, hints, etc.).

### Step 4: Typecheck + tests + manual sweep

```bash
npx vue-tsc --noEmit
pnpm test
```

If you can run `pnpm dev`:
- Visit `/notification-settings` — verify display title, sections, toggle behavior, save indicator.
- Toggle a switch — verify the API call fires and the saved pill shows.
- Click a drill-row (quiet hours, per-circle) — verify it navigates correctly.

### Step 5: Commit

```bash
git add app/pages/notification-settings.vue locales/en.json locales/zh-CN.json locales/fr.json
git commit -m "feat(notification-settings): Apple Rows pattern rewrite"
```

---

## Task 3: Rewrite `/settings/account`

Same pattern as Task 2. Per spec sections: PROFILE, LANGUAGE, ACCOUNT.

**Files:**
- Modify: `app/pages/settings/account.vue`

### Step 1: Read the current page

```bash
wc -l app/pages/settings/account.vue
grep -nE "<template>|<form|firstName|lastName|avatarUrl|saveProfile|deleteAccount" app/pages/settings/account.vue | head -20
```

### Step 2: Rewrite the template

Use the same scaffold from Task 2. Sections per spec §5.2:

- **PROFILE:** first name (text input), last name (text input), avatar (drill-row to avatar uploader).
- **LANGUAGE:** three radio rows (English / 中文 / Français).
- **ACCOUNT:** email (read-only row), password change (drill-row), log out (action row), delete account (destructive row).

Notes:
- Text inputs inside `<SettingsRow>`'s control slot: use a thin input style that matches the row aesthetic. e.g.:
  ```vue
  <input
    v-model="firstName"
    type="text"
    class="w-[180px] rounded-md border border-transparent bg-transparent text-right text-[13px] text-foreground placeholder:text-muted-foreground focus:border-border focus:outline-none focus:ring-0"
    @blur="saveProfile"
  />
  ```
- Language radio: use a segmented control style:
  ```vue
  <div class="flex gap-0.5 rounded-[10px] bg-foreground/[.06] p-0.5">
    <button
      v-for="loc in locales"
      :key="loc.code"
      class="rounded-[8px] px-3 py-1 text-[12px] font-medium transition-colors"
      :class="locale === loc.code ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
      @click="setLocale(loc.code)"
    >
      {{ loc.shortLabel ?? loc.code.toUpperCase() }}
    </button>
  </div>
  ```
- Delete account row: pass `destructive` prop on `<SettingsRow>` so the label renders in `text-destructive`.

### Step 3: i18n keys

Add `settingsAccount.displayTitle` / `displaySubtitle` / `sectionProfile` / `sectionLanguage` / `sectionAccount`.

### Step 4: Typecheck + tests + manual

```bash
npx vue-tsc --noEmit
pnpm test
```

Manual:
- Visit `/settings/account` — verify display title + all sections render.
- Edit first name → blur → verify auto-save fires.
- Change language → verify it persists.
- Click password change drill-row → verify it opens the modal/page.
- Hover delete row → confirm destructive styling.

### Step 5: Commit

```bash
git add app/pages/settings/account.vue locales/en.json locales/zh-CN.json locales/fr.json
git commit -m "feat(settings-account): Apple Rows pattern rewrite"
```

---

## Task 4: Rewrite `/circle-settings`

Same pattern. Per spec sections: ABOUT, MEMBERS, CHILDREN, DANGER. Owner-only restrictions preserved.

**Files:**
- Modify: `app/pages/circle-settings.vue`

### Step 1: Read the current page

```bash
wc -l app/pages/circle-settings.vue
grep -nE "<template>|<form|circleName|circleType|anniversaryDate|isOwner|deleteCircle" app/pages/circle-settings.vue | head -25
```

### Step 2: Rewrite the template

- **ABOUT:** circle name (text input), circle type (segmented control with the 8 allowed values per CLAUDE.md: parents / couple / family / friends / caregiving / travel / solo / custom), anniversary date (drill-row that opens date picker if relevant).
- **MEMBERS:** count summary row showing "N members" with a drill-row to `/members`. Also drill-row to invite sheet.
- **CHILDREN:** one drill-row per child profile (or some inline edit), plus an "add child" drill-row.
- **DANGER:** delete circle destructive row.

### Step 3: i18n keys

Add `circleSettings.displayTitle` / `displaySubtitle` / `sectionAbout` / `sectionMembers` / `sectionChildren` / `sectionDanger`.

### Step 4: Typecheck + tests + manual

### Step 5: Commit

```bash
git add app/pages/circle-settings.vue locales/en.json locales/zh-CN.json locales/fr.json
git commit -m "feat(circle-settings): Apple Rows pattern rewrite"
```

---

## Task 5: Rewrite `/members`

Per spec §5.3. Hero card + ACTIVE + PENDING sections.

**Files:**
- Modify: `app/pages/members.vue`

### Step 1: Read the current page

```bash
wc -l app/pages/members.vue
grep -nE "<template>|members\.|pendingInvites|role|kick|resend" app/pages/members.vue | head -20
```

### Step 2: Rewrite the template

```vue
<template>
  <div class="min-h-screen bg-background">
    <!-- Page strip -->
    <header class="...">
      ...
    </header>

    <main class="mx-auto max-w-[640px] px-5 py-8">
      <!-- Hero card -->
      <div class="mb-8 overflow-hidden rounded-[18px] border border-border bg-card p-[16px_18px]">
        <p class="text-[9px] font-bold uppercase tracking-[.2em] text-muted-foreground">
          {{ circle.name }}
        </p>
        <h1 class="mt-2 font-serif text-[30px] italic leading-[1.1] text-foreground">
          {{ t('members.displayTitle', { count: members.length }) }}
        </h1>
        <p class="mt-2 font-mono text-[11px] tabular-nums text-muted-foreground">
          {{ t('members.meta', { active: activeCount, pending: pendingCount, since: sinceLabel }) }}
        </p>
        <button
          class="mt-4 w-full rounded-full bg-foreground py-3 text-[13px] font-semibold text-background transition-opacity hover:opacity-90"
          @click="openInvite"
        >
          {{ t('members.inviteCta') }}
        </button>
      </div>

      <!-- ACTIVE -->
      <SettingsSection :label="t('members.sectionActive')">
        <component
          :is="canDrill ? NuxtLink : 'div'"
          v-for="m in activeMembers"
          :key="m.userId"
          :to="canDrill ? `/member/${m.userId}` : undefined"
          class="flex items-center gap-3 px-[14px] py-[12px]"
          :class="canDrill ? 'cursor-pointer hover:bg-foreground/[.03]' : ''"
        >
          <!-- Avatar -->
          <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-[11px] font-bold text-foreground">
            <img v-if="m.avatarUrl" :src="m.avatarUrl" class="h-full w-full object-cover" />
            <span v-else>{{ initials(m) }}</span>
          </div>
          <!-- Name stack -->
          <div class="min-w-0 flex-1">
            <p class="text-[14px] font-semibold text-foreground">
              {{ displayName(m) }}
              <span v-if="m.userId === currentUserId" class="ml-1 font-mono text-[10px] tracking-[.16em] text-muted-foreground">YOU</span>
            </p>
            <p class="mt-0.5 text-[11px] text-muted-foreground">
              {{ t('members.joinedMeta', { date: joinedLabel(m.joinedAt), n: m.memoryCount }) }}
            </p>
          </div>
          <!-- Role chip -->
          <span
            v-if="m.role === 'owner'"
            class="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.14em] text-background"
          >{{ t('members.roleOwner') }}</span>
          <span
            v-else-if="m.role === 'admin'"
            class="rounded-full border border-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.14em] text-foreground"
          >{{ t('members.roleAdmin') }}</span>
          <span
            v-else
            class="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground"
          >{{ t('members.roleMember') }}</span>
          <svg v-if="canDrill" class="h-3 w-3 flex-shrink-0 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </component>
      </SettingsSection>

      <!-- PENDING -->
      <SettingsSection v-if="pendingInvites.length" :label="t('members.sectionPending')">
        <div v-for="inv in pendingInvites" :key="inv.id" class="flex items-center gap-3 px-[14px] py-[12px] opacity-70">
          <!-- Dashed-circle + placeholder avatar -->
          <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-dashed border-foreground/30 text-[14px] text-muted-foreground">
            +
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[14px] text-foreground">{{ inv.email }}</p>
            <p class="mt-0.5 text-[11px] text-muted-foreground">
              {{ t('members.invitedMeta', { ago: timeAgo(inv.createdAt) }) }}
            </p>
          </div>
          <button
            v-if="canDrill"
            class="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            @click.stop="resendInvite(inv.id)"
          >
            {{ t('members.resend') }}
          </button>
        </div>
      </SettingsSection>
    </main>
  </div>
</template>
```

The current members.vue likely has a fancier UI for the role + actions. Preserve all the data fetching, invite/resend/kick handlers — only rewrite the template.

### Step 3: i18n keys

Add `members.displayTitle` (with `{count}` interpolation — e.g. "Four of us." should be a contextual phrase; consider just "{n} of us." or simpler "Our circle"), `members.meta`, `members.sectionActive`, `members.sectionPending`, `members.inviteCta`, `members.joinedMeta`, `members.invitedMeta`, `members.resend`.

Many of these may already exist with different keys. Reuse existing keys where possible.

### Step 4: Typecheck + tests + manual

Manual:
- Visit `/members` — hero card with circle name kicker + italic title + meta + invite CTA.
- Active section: rows with avatars, role chips, drill chevron for owners/admins.
- Pending section (if pending invites exist): muted rows with dashed-circle + Resend link.
- Tap a member row → drills into `/member/[userId]`.
- Tap invite CTA → opens the existing invite sheet.

### Step 5: Commit

```bash
git add app/pages/members.vue locales/en.json locales/zh-CN.json locales/fr.json
git commit -m "feat(members): Roster pattern rewrite"
```

---

## Task 6: Sweep + push

### Step 1: Orphan check

```bash
grep -rnE "checkbox|<input type=\"checkbox\"" app/pages/notification-settings.vue app/pages/settings/account.vue app/pages/circle-settings.vue 2>&1 | head -10
```

Expected: minimal hits. The new SettingsToggle replaces all the raw checkboxes used in the old pages. If any remain, they're either inside non-Apple-Rows-applicable surfaces (rare) or missed during rewrites.

### Step 2: Typecheck + tests

```bash
npx vue-tsc --noEmit
pnpm test
```

Expected: 601 tests pass (598 + 3 new from settings-toggle).

### Step 3: Manual sweep — all four pages on both desktop and mobile

- `/notification-settings`: display title + sections + toggles + save indicator.
- `/settings/account`: profile (name inputs + avatar drill), language segmented, account (email + password drill + log out + destructive delete).
- `/circle-settings`: about (name + type + anniversary), members count drill, children drill, danger delete.
- `/members`: hero card + active + pending + drill navigation.

### Step 4: Push

```bash
git push -u origin HEAD
```

### Step 5: Open PR

Compare URL: `https://github.com/Tinybit-app/our-story/compare/dev...settings-and-members`

Suggested title: `Settings + Members redesign — Apple Rows + Roster pattern (sub-plan #6)`

Suggested body:

```markdown
## Summary

Last of the timeline-redesign series. Rebuilds the three settings pages and the members page per spec §5.2 (Apple Rows) and §5.3 (Roster). No behavior change — same data, same API calls, same auto-save logic — visual restyle only.

- **New row primitives:** `SettingsSection`, `SettingsRow`, `SettingsToggle`. Toggle has a smoke test (3 cases).
- **`/notification-settings`**: italic display title + PUSH / EMAIL / PER-CIRCLE sections.
- **`/settings/account`**: PROFILE / LANGUAGE / ACCOUNT sections. Destructive delete row.
- **`/circle-settings`** (owner only): ABOUT / MEMBERS / CHILDREN / DANGER sections. Restrictions preserved.
- **`/members`**: hero card with circle name kicker + italic display title + meta + invite CTA. ACTIVE + PENDING member sections with role chips (filled owner / outlined admin / muted member).
- **i18n:** new display title + section label keys in en/zh-CN/fr.

## What changed

- **New:** `SettingsSection.vue`, `SettingsRow.vue`, `SettingsToggle.vue`, `unit/settings-toggle.test.ts`.
- **Modified:** four pages — notification-settings, settings/account, circle-settings, members. Templates rewritten; script logic preserved.
- **i18n:** display titles + section labels.

## Test plan

- [x] `pnpm test` (601).
- [x] `npx vue-tsc --noEmit` clean.
- [ ] Manual sweep all four pages on desktop + mobile. Toggle a notification preference and verify save. Edit first name and verify blur-save. Change language. Open circle settings as owner. Visit /members and confirm role chips render.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Definition of done

- [ ] Three row primitives exist + 3 toggle tests pass.
- [ ] All four pages restyled, no behavior regressions.
- [ ] `pnpm test` passes (601).
- [ ] `npx vue-tsc --noEmit` clean.
- [ ] Manual sweep clean across all four pages, both viewports.
- [ ] PR open and CI green.

---

## Risks

- **Existing inputs/forms have their own validation patterns.** The text inputs in `/settings/account` (first/last name) and `/circle-settings` (circle name, anniversary date) have existing onBlur save logic. Preserve those event handlers — only change the input's classes and where it sits in the row.
- **Segmented control accessibility.** The proposed language segmented control is a row of `<button>` elements — that's not a proper radio group from an a11y perspective. For this pass, accept the button row; if a11y review flags it later, swap to `<input type="radio">` styled to look the same.
- **Mono font availability.** The spec calls for JetBrains Mono in the section labels. Tailwind's `font-mono` should resolve to a mono font that's loaded by the project — verify by reading `tailwind.config.ts`. If JetBrains Mono isn't loaded, accept the generic mono fallback for this pass; loading a custom mono font is out of scope.
- **`/circle-settings` is owner-only.** The route guard / data fetch should already handle this. The rewrite preserves the existing redirect-if-not-owner behavior (script untouched).
- **Children section nuance.** The current `/circle-settings` may not have a children section at all (depends on the circle_type). Spec mentions it. Check the existing page — if children aren't surfaced today, defer the children section (out of scope for THIS PR; it's a content addition, not a restyle).
- **i18n key migration risk.** Existing pages use established i18n keys. The plan ADDS new keys (display titles, section labels) but doesn't rename existing ones. If a page's old key set was tied to the old layout (e.g. a "Notification settings" header copy that doesn't fit the new italic title), reuse it anyway — copy changes are out of scope for the restyle.
- **Hero card title interpolation ("Four of us.").** This requires localization that's tricky for plural — Chinese/French have different grammar. Use a simpler key like `members.displayTitle` that's static ("Our circle" or similar) rather than count-interpolated for v1; localize later if desired.
- **Color-mode parity.** All new primitives use `--foreground` / `--background` / `--card` / `--muted-foreground` tokens — they'll automatically switch between Obsidian and Porcelain via the existing color-mode setup. No theme-specific hacks should be needed.
