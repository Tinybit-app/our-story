# Notification Preferences Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `/notification-settings` page accessible to all circle members for managing push, mute, and email digest preferences per circle. Remove notification toggles from the owner-only circle-settings page.

**Architecture:** New Nuxt page with per-circle preferences, circle selector for multi-circle users, immediate-save upsert. One migration to update default and add `'monthly'` to the CHECK constraint. Cleanup of 10.1 notification code from circle-settings.

**Tech Stack:** Nuxt (Vue), Supabase client, i18n, Tailwind

**Spec:** `docs/superpowers/specs/2026-04-28-notification-preferences-design.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `app/pages/notification-settings.vue` | Notification preferences page — circle selector + push/mute/digest controls |
| `supabase/migrations/027_digest_monthly_default.sql` | Update email_digest_frequency CHECK constraint and default |

### Modified files
| File | Change |
|------|--------|
| `app/pages/timeline/index.vue` | Add bell icon link to `/notification-settings` in header |
| `app/pages/circle-settings.vue` | Remove notification preferences section (template + script) |
| `locales/en.json` | Add `notificationSettings.*` keys, remove `circleSettings.notifications*` and `circleSettings.muteCircle*` keys |
| `locales/zh-CN.json` | Same i18n changes |
| `locales/fr.json` | Same i18n changes |
| `supabase/tests/rls.test.sql` | No changes needed — RLS policies for NotificationPreference already tested |
| `app/types/database.ts` | Regenerate after migration |
| `docs/build-plan.md` | Update 10.3 status |

---

## Task 1: Database Migration — Monthly Default + CHECK Constraint

**Files:**
- Create: `supabase/migrations/027_digest_monthly_default.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/027_digest_monthly_default.sql`:

```sql
-- Add 'monthly' as a valid email_digest_frequency option and change default from 'weekly' to 'monthly'

-- Drop the existing CHECK constraint and recreate with 'monthly' added
ALTER TABLE NotificationPreference
  DROP CONSTRAINT IF EXISTS notificationpreference_email_digest_frequency_check;

ALTER TABLE NotificationPreference
  ADD CONSTRAINT notificationpreference_email_digest_frequency_check
  CHECK (email_digest_frequency IN ('daily', 'weekly', 'monthly', 'off'));

-- Change the default for new rows
ALTER TABLE NotificationPreference
  ALTER COLUMN email_digest_frequency SET DEFAULT 'monthly';
```

- [ ] **Step 2: Reset database and run tests**

Run: `pnpm db:reset && pnpm db:test`
Expected: All RLS tests pass. No new tests needed — the CHECK constraint change doesn't affect RLS.

- [ ] **Step 3: Regenerate TypeScript types**

Run: `pnpm db:types`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/027_digest_monthly_default.sql app/types/database.ts
git commit -m "feat(notifications): add monthly digest option and change default"
```

---

## Task 2: i18n Keys

**Files:**
- Modify: `locales/en.json`, `locales/zh-CN.json`, `locales/fr.json`

- [ ] **Step 1: Add notificationSettings keys and remove old circleSettings notification keys in en.json**

Read `locales/en.json` first. Then:

Remove these keys from the `"circleSettings"` object:
- `"notifications"`
- `"notificationsDesc"`
- `"pushNotifications"`
- `"pushNotificationsDesc"`
- `"muteCircle"`
- `"muteCircleDesc"`

Add a new top-level `"notificationSettings"` object:

```json
"notificationSettings": {
  "title": "Notification settings",
  "selectCircle": "Select a circle",
  "pushNotifications": "Push notifications",
  "pushNotificationsDesc": "Get notified when members share memories, comment, or react.",
  "muteCircle": "Mute this circle",
  "muteCircleDesc": "Pause all notifications from this circle.",
  "muteActiveNote": "Push notifications and email digests from this circle are paused.",
  "emailDigest": "Email digest",
  "emailDigestDesc": "A summary of new memories and activity.",
  "digestWeekly": "Weekly",
  "digestMonthly": "Monthly",
  "digestOff": "Off"
}
```

- [ ] **Step 2: Same changes in zh-CN.json**

Read `locales/zh-CN.json` first. Remove the same 6 keys from `"circleSettings"`. Add:

```json
"notificationSettings": {
  "title": "通知设置",
  "selectCircle": "选择圈子",
  "pushNotifications": "推送通知",
  "pushNotificationsDesc": "当成员分享回忆、评论或回应时收到通知。",
  "muteCircle": "静音此圈子",
  "muteCircleDesc": "暂停来自此圈子的所有通知。",
  "muteActiveNote": "此圈子的推送通知和邮件摘要已暂停。",
  "emailDigest": "邮件摘要",
  "emailDigestDesc": "新回忆和活动的摘要。",
  "digestWeekly": "每周",
  "digestMonthly": "每月",
  "digestOff": "关闭"
}
```

- [ ] **Step 3: Same changes in fr.json**

Read `locales/fr.json` first. Remove the same 6 keys from `"circleSettings"`. Add:

```json
"notificationSettings": {
  "title": "Paramètres de notification",
  "selectCircle": "Sélectionner un cercle",
  "pushNotifications": "Notifications push",
  "pushNotificationsDesc": "Soyez notifié quand les membres partagent des souvenirs, commentent ou réagissent.",
  "muteCircle": "Couper les notifications",
  "muteCircleDesc": "Mettre en pause toutes les notifications de ce cercle.",
  "muteActiveNote": "Les notifications push et les résumés par email de ce cercle sont en pause.",
  "emailDigest": "Résumé par email",
  "emailDigestDesc": "Un résumé des nouveaux souvenirs et de l'activité.",
  "digestWeekly": "Hebdomadaire",
  "digestMonthly": "Mensuel",
  "digestOff": "Désactivé"
}
```

- [ ] **Step 4: Commit**

```bash
git add locales/en.json locales/zh-CN.json locales/fr.json
git commit -m "feat(notifications): add i18n keys for notification settings page"
```

---

## Task 3: Notification Settings Page

**Files:**
- Create: `app/pages/notification-settings.vue`

- [ ] **Step 1: Create the page**

Create `app/pages/notification-settings.vue`:

```vue
<template>
  <div class="min-h-screen bg-background">

    <!-- Header -->
    <header class="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border">
      <div class="max-w-[1280px] mx-auto px-5 h-14 flex items-center gap-3">
        <button
          class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
          @click="router.back()"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          {{ t('common.back') }}
        </button>

        <p class="flex-1 text-sm font-semibold text-foreground text-center">{{ t('notificationSettings.title') }}</p>

        <!-- spacer to balance the back button -->
        <div class="w-12" />
      </div>
    </header>

    <main class="max-w-[1280px] mx-auto px-5 py-8">
      <div class="max-w-lg space-y-6">

        <!-- Loading -->
        <div v-if="!circles.length" class="flex justify-center py-24">
          <div class="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
        </div>

        <template v-else>

          <!-- Circle selector (only when 2+ circles) -->
          <div v-if="circles.length > 1" class="flex flex-wrap gap-2">
            <button
              v-for="c in circles"
              :key="c.id"
              class="px-4 py-2 rounded-full text-sm font-medium border transition-colors"
              :class="selectedCircleId === c.id
                ? 'border-foreground bg-secondary text-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/30'"
              @click="selectedCircleId = c.id"
            >
              {{ c.name }}
            </button>
          </div>

          <!-- Single circle name (when only 1) -->
          <div v-else>
            <p class="text-sm font-semibold text-foreground">{{ circles[0].name }}</p>
          </div>

          <div class="h-px bg-border" />

          <!-- Push toggle -->
          <label class="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <p class="text-sm font-medium text-foreground">{{ t('notificationSettings.pushNotifications') }}</p>
              <p class="text-xs text-muted-foreground mt-0.5">{{ t('notificationSettings.pushNotificationsDesc') }}</p>
            </div>
            <input
              type="checkbox"
              :checked="pushEnabled"
              class="w-5 h-5 rounded border-border accent-primary cursor-pointer"
              @change="togglePush"
            />
          </label>

          <!-- Mute toggle -->
          <label class="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <p class="text-sm font-medium text-foreground">{{ t('notificationSettings.muteCircle') }}</p>
              <p class="text-xs text-muted-foreground mt-0.5">{{ t('notificationSettings.muteCircleDesc') }}</p>
            </div>
            <input
              type="checkbox"
              :checked="circleMuted"
              class="w-5 h-5 rounded border-border accent-primary cursor-pointer"
              @change="toggleMute"
            />
          </label>

          <!-- Mute active note -->
          <p v-if="circleMuted" class="text-xs text-muted-foreground/70 -mt-2 pl-0.5">
            {{ t('notificationSettings.muteActiveNote') }}
          </p>

          <div class="h-px bg-border" />

          <!-- Email digest frequency -->
          <div>
            <p class="text-sm font-medium text-foreground">{{ t('notificationSettings.emailDigest') }}</p>
            <p class="text-xs text-muted-foreground mt-0.5 mb-3">{{ t('notificationSettings.emailDigestDesc') }}</p>

            <div class="inline-flex rounded-lg border border-border overflow-hidden">
              <button
                v-for="opt in digestOptions"
                :key="opt.value"
                class="px-4 py-2 text-xs font-medium transition-colors"
                :class="digestFrequency === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:text-foreground'"
                @click="setDigest(opt.value)"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

        </template>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const router = useRouter()
const supabase = useSupabaseClient()
const user = useSupabaseUser()

// ── Circle list ───────────────────────────────────────────
const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
const circles = computed(() => circlesData.value?.circles ?? [])

const selectedCircleId = ref('')

// Auto-select first circle
watch(circles, (list) => {
  if (list.length && !selectedCircleId.value) {
    selectedCircleId.value = list[0].id
  }
}, { immediate: true })

// ── Preferences ───────────────────────────────────────────
const pushEnabled = ref(true)
const circleMuted = ref(false)
const digestFrequency = ref<'weekly' | 'monthly' | 'off'>('monthly')

const digestOptions = computed(() => [
  { value: 'weekly' as const, label: t('notificationSettings.digestWeekly') },
  { value: 'monthly' as const, label: t('notificationSettings.digestMonthly') },
  { value: 'off' as const, label: t('notificationSettings.digestOff') },
])

async function loadPrefs() {
  if (!selectedCircleId.value || !user.value) return

  const { data } = await supabase
    .from('notificationpreference')
    .select('push_enabled, circle_muted, email_digest_frequency')
    .eq('user_id', user.value.id)
    .eq('circle_id', selectedCircleId.value)
    .maybeSingle()

  if (data) {
    pushEnabled.value = data.push_enabled
    circleMuted.value = data.circle_muted
    digestFrequency.value = (data.email_digest_frequency as 'weekly' | 'monthly' | 'off') ?? 'monthly'
  } else {
    // No row yet — show defaults
    pushEnabled.value = true
    circleMuted.value = false
    digestFrequency.value = 'monthly'
  }
}

watch(selectedCircleId, () => { loadPrefs() }, { immediate: true })

async function savePref(fields: Record<string, any>) {
  if (!selectedCircleId.value || !user.value) return

  await supabase
    .from('notificationpreference')
    .upsert(
      {
        user_id: user.value.id,
        circle_id: selectedCircleId.value,
        ...fields,
      },
      { onConflict: 'user_id,circle_id' }
    )
}

function togglePush() {
  pushEnabled.value = !pushEnabled.value
  savePref({ push_enabled: pushEnabled.value })
}

function toggleMute() {
  circleMuted.value = !circleMuted.value
  savePref({ circle_muted: circleMuted.value })
}

function setDigest(value: 'weekly' | 'monthly' | 'off') {
  digestFrequency.value = value
  savePref({ email_digest_frequency: value })
}
</script>
```

- [ ] **Step 2: Verify page renders in dev**

Run: `pnpm dev`
Navigate to `/notification-settings`. Verify:
- Header with back button and title renders
- Circle selector shows if user has multiple circles
- Push toggle, mute toggle, email digest segmented control render
- Toggling push/mute updates immediately
- Switching digest options updates immediately
- Check `notificationpreference` table in Supabase to confirm upsert works

- [ ] **Step 3: Commit**

```bash
git add app/pages/notification-settings.vue
git commit -m "feat(notifications): add notification settings page"
```

---

## Task 4: Timeline Header — Bell Icon

**Files:**
- Modify: `app/pages/timeline/index.vue`

- [ ] **Step 1: Add bell icon link to timeline header**

In `app/pages/timeline/index.vue`, find the circle settings gear icon (the `NuxtLink` to `/circle-settings` around line 32-42). Add a bell icon link **after** the gear icon link, visible to **all members** (no `v-if` guard):

```vue
            <!-- Notification settings (all members) -->
            <NuxtLink
              to="/notification-settings"
              class="p-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors rounded flex-shrink-0"
              :title="t('notificationSettings.title')"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </NuxtLink>
```

Place it after the gear icon `NuxtLink` and before the `<template v-if="circle?.memberCount">` block.

- [ ] **Step 2: Verify in dev**

Run: `pnpm dev`
Navigate to `/timeline`. Verify:
- Bell icon appears in the header next to the gear icon (or alone if not owner)
- Clicking it navigates to `/notification-settings`
- Gear icon is still owner-only, bell icon is visible to all members

- [ ] **Step 3: Commit**

```bash
git add app/pages/timeline/index.vue
git commit -m "feat(notifications): add bell icon link in timeline header"
```

---

## Task 5: Remove Notification Section from Circle Settings

**Files:**
- Modify: `app/pages/circle-settings.vue`

- [ ] **Step 1: Remove the notification template section**

In `app/pages/circle-settings.vue`, remove the entire notification preferences block from the template. This is the section from the `<div v-if="isOwner" class="h-px bg-border" />` divider before the notification section through the `<div class="h-px bg-border" />` divider after it (lines 276-318 approximately).

Remove these lines:
```vue
          <div v-if="isOwner" class="h-px bg-border" />

          <!-- Notification preferences — all members -->
          <div>
            <h2 class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">
              {{ t('circleSettings.notifications') }}
            </h2>
            <p class="text-xs text-muted-foreground mb-4">
              {{ t('circleSettings.notificationsDesc') }}
            </p>

            <div v-if="!loadingPrefs" class="space-y-4">
              <!-- Push toggle -->
              <label class="flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <p class="text-sm font-medium text-foreground">{{ t('circleSettings.pushNotifications') }}</p>
                  <p class="text-xs text-muted-foreground mt-0.5">{{ t('circleSettings.pushNotificationsDesc') }}</p>
                </div>
                <input
                  type="checkbox"
                  :checked="pushEnabled"
                  class="w-5 h-5 rounded border-border accent-primary cursor-pointer"
                  @change="pushEnabled = !pushEnabled; saveNotificationPref('push_enabled', pushEnabled)"
                />
              </label>

              <!-- Mute toggle -->
              <label class="flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <p class="text-sm font-medium text-foreground">{{ t('circleSettings.muteCircle') }}</p>
                  <p class="text-xs text-muted-foreground mt-0.5">{{ t('circleSettings.muteCircleDesc') }}</p>
                </div>
                <input
                  type="checkbox"
                  :checked="circleMuted"
                  class="w-5 h-5 rounded border-border accent-primary cursor-pointer"
                  @change="circleMuted = !circleMuted; saveNotificationPref('circle_muted', circleMuted)"
                />
              </label>
            </div>
          </div>

          <div class="h-px bg-border" />
```

- [ ] **Step 2: Remove the notification script code**

Remove these lines from the `<script setup>` section (around lines 679-719):

```ts
// ── Notification preferences ───────────────────────────────
const pushEnabled = ref(true)
const circleMuted = ref(false)
const loadingPrefs = ref(true)

async function loadNotificationPrefs() {
  if (!circle.value) return
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const { data } = await supabase
    .from('notificationpreference')
    .select('push_enabled, circle_muted')
    .eq('user_id', user.value!.id)
    .eq('circle_id', circle.value.id)
    .maybeSingle()

  if (data) {
    pushEnabled.value = data.push_enabled
    circleMuted.value = data.circle_muted
  }
  loadingPrefs.value = false
}

async function saveNotificationPref(field: 'push_enabled' | 'circle_muted', value: boolean) {
  if (!circle.value) return
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  await supabase
    .from('notificationpreference')
    .upsert(
      {
        user_id: user.value!.id,
        circle_id: circle.value.id,
        [field]: value,
      },
      { onConflict: 'user_id,circle_id' }
    )
}

watch(() => circle.value?.id, () => { loadNotificationPrefs() }, { immediate: true })
```

- [ ] **Step 3: Verify circle-settings still works**

Run: `pnpm dev`
Navigate to `/circle-settings`. Verify:
- Page loads without errors
- No notification section visible
- All other sections (circle name, type, children, danger zone) still work

- [ ] **Step 4: Run all tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/pages/circle-settings.vue
git commit -m "refactor(notifications): remove notification toggles from circle settings"
```

---

## Task 6: Update Build Plan + Design Spec

**Files:**
- Modify: `docs/build-plan.md`
- Modify: `docs/design-spec.md`

- [ ] **Step 1: Update build plan**

In `docs/build-plan.md`, update the 10.3 line. Replace:
```
- [ ] 10.3 Full notification preferences UI — quiet hours, email digest frequency, per-circle mute — dedicated settings page accessible to all members (not just owners), wired to existing NotificationPreference table
```

With:
```
- [ ] 10.3 Notification preferences page — dedicated `/notification-settings` page accessible to all members; per-circle push toggle, mute toggle, email digest frequency (weekly/monthly/off, default monthly); circle selector for multi-circle users; bell icon in timeline header; notification toggles removed from circle-settings *(implementation complete — pending end-to-end test)*
  - Migration 027: `email_digest_frequency` CHECK constraint updated to include `'monthly'`; default changed from `'weekly'` to `'monthly'`
  - Quiet hours UI deferred (backend already checks in `sendPushToCircle`); daily digest option dropped
```

- [ ] **Step 2: Update design spec notification preferences section**

In `docs/design-spec.md`, find the "Notification preferences" subsection (around line 1277). Update the email_digest_frequency line to reflect the new options:

Change:
```
  - email_digest_frequency: "daily" | "weekly" | "off"
```

To:
```
  - email_digest_frequency: "weekly" | "monthly" | "off"
```

And update the default state line. Change:
```
**Default state on join:** `push_enabled = true`, `email_digest_frequency = "weekly"`, `circle_muted = false`.
```

To:
```
**Default state on join:** `push_enabled = true`, `email_digest_frequency = "monthly"`, `circle_muted = false`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/build-plan.md docs/design-spec.md
git commit -m "docs: update build plan and design spec for 10.3 notification preferences"
```
