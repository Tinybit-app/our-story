<template>
  <div class="min-h-screen bg-background">
    <!-- Page strip header -->
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
          <span class="text-[12px] font-medium text-foreground">{{ t('settings.account.title') }}</span>
        </span>
        <div class="w-12" />
      </div>
    </header>

    <main class="mx-auto max-w-[640px] px-5 py-8">
      <!-- Italic display title -->
      <div class="mb-8 px-[4px]">
        <h1 class="font-serif text-[32px] italic leading-[1.05] text-foreground sm:text-[34px]">
          {{ t('settings.account.displayTitle') }}
        </h1>
        <p class="mt-2 text-[12.5px] leading-[1.5] text-muted-foreground">
          {{ t('settings.account.displaySubtitle') }}
        </p>
      </div>

      <!-- ── Pending deletion banner ───────────────────── -->
      <div
        v-if="pendingDeletionDate"
        class="mb-8 overflow-hidden rounded-2xl border border-destructive/25"
      >
        <!-- Coloured header strip -->
        <div class="bg-destructive/8 border-b border-destructive/15 px-5 pb-4 pt-5">
          <div class="flex items-start gap-3">
            <div class="bg-destructive/12 mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
              <svg
                class="h-4 w-4 text-destructive"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold leading-snug text-destructive">
                {{ t('settings.account.pendingDeletionTitle') }}
              </p>
              <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
                {{
                  t('settings.account.pendingDeletionDesc', {
                    date: pendingDeletionDate,
                  })
                }}
              </p>
            </div>
          </div>
        </div>
        <div class="bg-background px-5 py-4">
          <button
            @click="cancelDeletion"
            :disabled="canceling"
            class="w-full rounded-[10px] border border-border py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-40"
          >
            {{
              canceling
                ? t('settings.account.canceling')
                : t('settings.account.cancelDeletion')
            }}
          </button>
        </div>
      </div>

      <!-- ── PROFILE section ───────────────────────────── -->
      <SettingsSection :label="t('settings.account.sectionProfile')">
        <!-- First name -->
        <SettingsRow>
          {{ t('settings.account.firstNameLabel') }}
          <template #control>
            <input
              v-model="firstName"
              type="text"
              class="w-[160px] rounded-md border border-transparent bg-transparent text-right text-[13px] text-foreground placeholder:text-muted-foreground focus:border-border focus:outline-none focus:ring-0"
              :placeholder="t('settings.account.firstNamePlaceholder')"
              @blur="saveProfile"
            />
          </template>
        </SettingsRow>

        <!-- Last name -->
        <SettingsRow>
          {{ t('settings.account.lastNameLabel') }}
          <template #control>
            <input
              v-model="lastName"
              type="text"
              class="w-[160px] rounded-md border border-transparent bg-transparent text-right text-[13px] text-foreground placeholder:text-muted-foreground focus:border-border focus:outline-none focus:ring-0"
              :placeholder="t('settings.account.lastNamePlaceholder')"
              @blur="saveProfile"
            />
          </template>
        </SettingsRow>
      </SettingsSection>

      <!-- ── LANGUAGE section ──────────────────────────── -->
      <SettingsSection :label="t('settings.account.sectionLanguage')">
        <SettingsRow>
          {{ t('settings.account.languageTitle') }}
          <template #hint>{{ t('settings.account.languageDesc') }}</template>
          <template #control>
            <div class="flex gap-0.5 rounded-[10px] bg-foreground/[.06] p-0.5">
              <button
                v-for="loc in locales"
                :key="loc.code"
                type="button"
                class="rounded-[8px] px-3 py-1 text-[12px] font-medium transition-colors"
                :class="
                  locale === loc.code
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="pickLocale(loc.code)"
              >
                {{ (loc as any).shortLabel ?? loc.name }}
              </button>
            </div>
          </template>
        </SettingsRow>
      </SettingsSection>

      <!-- ── ACCOUNT section ───────────────────────────── -->
      <SettingsSection :label="t('settings.account.sectionAccount')">
        <!-- Email (read-only) -->
        <SettingsRow v-if="authUser?.email">
          {{ t('settings.account.emailLabel') }}
          <template #control>
            <span class="text-[13px] text-muted-foreground">{{ authUser.email }}</span>
          </template>
        </SettingsRow>

        <!-- Export data -->
        <SettingsRow>
          {{ t('settings.account.exportTitle') }}
          <template #hint>{{ t('settings.account.exportDesc') }}</template>
          <template #control>
            <div class="flex flex-col items-end gap-2">
              <!-- Circle selector — only shown when user belongs to more than one circle -->
              <select
                v-if="exportCircles.length > 1"
                v-model="selectedCircleId"
                class="rounded-[8px] border border-border bg-background px-2 py-1 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              >
                <option value="" disabled>
                  {{ t('settings.account.exportSelectCircle') }}
                </option>
                <option v-for="c in exportCircles" :key="c.id" :value="c.id">
                  {{ c.name }}
                </option>
              </select>
              <button
                @click="requestExport"
                :disabled="exporting || !selectedCircleId"
                class="text-[13px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                {{
                  exporting
                    ? t('settings.account.exporting')
                    : t('settings.account.exportButton')
                }}
              </button>
            </div>
          </template>
        </SettingsRow>
        <div v-if="exportMsg" class="px-[14px] pb-3">
          <p
            class="text-[12px]"
            :class="exportError ? 'text-destructive' : 'text-green-600 dark:text-green-400'"
          >
            {{ exportMsg }}
          </p>
        </div>

        <!-- Log out -->
        <SettingsRow>
          {{ t('settings.account.logOutLabel') }}
          <template #control>
            <button
              type="button"
              class="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              @click="doLogout"
            >
              {{ t('settings.account.logOutAction') }}
            </button>
          </template>
        </SettingsRow>

        <!-- Delete account -->
        <SettingsRow destructive>
          {{ t('settings.account.deleteTitle') }}
          <template #hint>{{ t('settings.account.deleteDesc') }}</template>
          <template #control>
            <button
              v-if="!showDeleteFlow"
              type="button"
              class="text-[13px] text-destructive transition-opacity hover:opacity-70"
              @click="showDeleteFlow = true"
            >
              {{ t('settings.account.deleteAction') }}
            </button>
          </template>
        </SettingsRow>
      </SettingsSection>

      <!-- ── Deleted circles (pending restore) ────────── -->
      <SettingsSection
        v-if="deletedCircles.length > 0"
        :label="t('settings.account.deletedCirclesTitle')"
      >
        <div class="px-[14px] py-3">
          <p class="mb-3 text-[12px] text-muted-foreground">
            {{ t('settings.account.deletedCirclesDesc') }}
          </p>
          <p v-if="restoreMsg" class="mb-3 text-[12px] text-green-600 dark:text-green-400">
            {{ restoreMsg }}
          </p>
          <ul class="space-y-3">
            <li
              v-for="c in deletedCircles"
              :key="c.id"
              class="flex items-center justify-between gap-4"
            >
              <div class="min-w-0">
                <p class="truncate text-[13px] font-medium text-foreground">{{ c.name }}</p>
                <p class="mt-0.5 text-[11px] text-muted-foreground">
                  {{ t('settings.account.purgesOn', { date: formatPurgeDate(c.purge_date) }) }}
                </p>
              </div>
              <button
                :disabled="restoringId === c.id"
                class="flex-shrink-0 rounded-xl border border-border px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-40"
                @click="restoreCircle(c)"
              >
                {{
                  restoringId === c.id
                    ? t('settings.account.restoring')
                    : t('settings.account.restoreCircle')
                }}
              </button>
            </li>
          </ul>
          <p v-if="restoreError" class="mt-2 text-[11px] text-destructive">
            {{ restoreError }}
          </p>
        </div>
      </SettingsSection>

      <!-- ── Delete flow (expanded below ACCOUNT section) ─ -->
      <div v-if="showDeleteFlow && !pendingDeletionDate" class="mt-2">
        <!-- Needs manual ownership transfer -->
        <div
          v-if="circlesNeedingTransfer.length > 0"
          class="overflow-hidden rounded-2xl border border-foreground/20"
        >
          <div class="border-b border-foreground/20 bg-secondary px-5 py-4">
            <div class="flex items-start gap-2.5">
              <svg
                class="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p class="text-sm font-medium text-foreground">
                {{ t('settings.account.needsTransferWarning') }}
              </p>
            </div>
          </div>
          <div class="space-y-3 px-5 py-4">
            <ul class="space-y-1.5">
              <li
                v-for="name in circlesNeedingTransfer"
                :key="name"
                class="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span class="h-1 w-1 flex-shrink-0 rounded-full bg-muted-foreground/40" />
                {{ name }}
              </li>
            </ul>
            <p class="text-xs text-muted-foreground">
              {{ t('settings.account.needsTransferHint') }}
            </p>
          </div>
        </div>

        <!-- Deletion flow -->
        <template v-else>
          <!-- Step-by-step consequences -->
          <div class="mb-5 overflow-hidden rounded-2xl border border-border">
            <!-- Step 1 -->
            <div class="border-b border-border px-5 py-4">
              <div class="flex gap-4">
                <div class="flex flex-shrink-0 flex-col items-center gap-1">
                  <div class="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10">
                    <span class="text-[10px] font-bold text-destructive">1</span>
                  </div>
                  <div class="min-h-[16px] w-px flex-1 bg-border" />
                </div>
                <div class="pb-2">
                  <p class="text-sm font-semibold leading-snug text-foreground">
                    {{ t('settings.account.deleteStep1Title') }}
                  </p>
                  <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {{ t('settings.account.deleteStep1Desc') }}
                  </p>
                </div>
              </div>
            </div>
            <!-- Step 2 -->
            <div class="px-5 py-4">
              <div class="flex gap-4">
                <div class="flex flex-shrink-0 flex-col items-center">
                  <div class="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10">
                    <span class="text-[10px] font-bold text-destructive">2</span>
                  </div>
                </div>
                <div>
                  <p class="text-sm font-semibold leading-snug text-foreground">
                    {{
                      t('settings.account.deleteStep2Title', {
                        date: purgePreviewDate,
                      })
                    }}
                  </p>
                  <p class="mb-2.5 mt-1 text-xs leading-relaxed text-muted-foreground">
                    {{ t('settings.account.deleteStep2Desc') }}
                  </p>
                  <ul class="space-y-1.5">
                    <li class="flex items-center gap-2 text-xs text-muted-foreground">
                      <svg class="h-3 w-3 flex-shrink-0 text-destructive/60" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {{ t('settings.account.deleteItem1') }}
                    </li>
                    <li class="flex items-center gap-2 text-xs text-muted-foreground">
                      <svg class="h-3 w-3 flex-shrink-0 text-destructive/60" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {{ t('settings.account.deleteItem2') }}
                    </li>
                    <li class="flex items-center gap-2 text-xs text-muted-foreground">
                      <svg class="h-3 w-3 flex-shrink-0 text-destructive/60" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {{ t('settings.account.deleteItem3') }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- Circle memories choice -->
          <div class="mb-5">
            <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">
              {{ t('settings.account.deleteCircleQuestion') }}
            </p>
            <div class="space-y-2">
              <label
                class="flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors"
                :class="
                  keepCircleMemories
                    ? 'border-foreground bg-secondary'
                    : 'border-border hover:border-foreground/30'
                "
              >
                <input
                  type="radio"
                  :value="true"
                  v-model="keepCircleMemories"
                  class="mt-0.5 accent-foreground"
                />
                <div>
                  <p class="text-sm font-medium text-foreground">
                    {{ t('settings.account.deleteCircleKeepLabel') }}
                  </p>
                  <p class="mt-0.5 text-xs text-muted-foreground">
                    {{ t('settings.account.deleteCircleKeepDesc') }}
                  </p>
                </div>
              </label>
              <label
                class="flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors"
                :class="
                  !keepCircleMemories
                    ? 'border-destructive/60 bg-destructive/5'
                    : 'border-border hover:border-foreground/30'
                "
              >
                <input
                  type="radio"
                  :value="false"
                  v-model="keepCircleMemories"
                  class="mt-0.5 accent-foreground"
                />
                <div>
                  <p class="text-sm font-medium text-foreground">
                    {{ t('settings.account.deleteCircleRemoveLabel') }}
                  </p>
                  <p class="mt-0.5 text-xs text-muted-foreground">
                    {{ t('settings.account.deleteCircleRemoveDesc') }}
                  </p>
                </div>
              </label>
            </div>
          </div>

          <!-- Email note + error + confirm -->
          <p class="mb-4 text-xs leading-relaxed text-muted-foreground">
            {{ t('settings.account.deleteEmailNote') }}
          </p>
          <p v-if="deleteError" class="mb-3 text-sm text-destructive">
            {{ deleteError }}
          </p>
          <div class="flex gap-3">
            <button
              @click="showDeleteFlow = false"
              class="flex-1 rounded-[10px] border border-border py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              @click="confirmingDelete = true"
              :disabled="deleting"
              class="flex-1 rounded-[10px] bg-destructive py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {{ t('settings.account.deleteButton') }}
            </button>
          </div>
        </template>
      </div>

      <!-- ── Delete confirmation modal ────────────────── -->
      <Teleport to="body">
        <div
          v-if="confirmingDelete"
          class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          @click.self="confirmingDelete = false"
        >
          <div class="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
            <div class="px-5 pb-4 pt-5">
              <p class="mb-2 text-base font-semibold text-foreground">
                {{ t('settings.account.deleteConfirmTitle') }}
              </p>
              <p class="text-sm leading-relaxed text-muted-foreground">
                {{ t('settings.account.deleteConfirmDesc') }}
              </p>
            </div>
            <div class="flex gap-2 px-5 pb-5">
              <button
                @click="confirmingDelete = false"
                class="flex-1 rounded-[10px] border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                {{ t('settings.account.deleteConfirmCancel') }}
              </button>
              <button
                @click="((confirmingDelete = false), requestDeletion())"
                :disabled="deleting"
                class="flex-1 rounded-[10px] bg-destructive py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {{
                  deleting
                    ? t('settings.account.deleting')
                    : t('settings.account.deleteConfirmAction')
                }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useAnalytics } from '~/composables/useAnalytics'

const { t, locale, locales, setLocale } = useI18n()
const router = useRouter()
const supabase = useSupabaseClient()
const authUser = useSupabaseUser()
const { track } = useAnalytics()

async function pickLocale(code: string) {
  await setLocale(code as 'en' | 'zh-CN' | 'fr')
  $fetch('/api/profile', { method: 'PATCH', body: { locale: code } }).catch(
    () => {},
  )
}

const { data: profile } = await useFetch<{
  firstName: string | null
  lastName: string | null
  deletedAt: string | null
}>('/api/profile')

// Profile fields
const firstName = ref(profile.value?.firstName ?? '')
const lastName = ref(profile.value?.lastName ?? '')

const pendingDeletionDate = computed(() => {
  if (!profile.value?.deletedAt) return null
  const purgeDate = new Date(profile.value.deletedAt)
  purgeDate.setDate(purgeDate.getDate() + 30)
  return purgeDate.toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

// Preview the purge date before initiating (today + 30 days)
const purgePreviewDate = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

// Save profile on blur
async function saveProfile() {
  await $fetch('/api/profile', {
    method: 'PATCH',
    body: {
      firstName: firstName.value || undefined,
      lastName: lastName.value || undefined,
    },
  }).catch(() => {})
}

// Log out
async function doLogout() {
  const { clear } = useUserState()
  await supabase.auth.signOut()
  clear()
  router.replace('/login')
}

// ── Export ──────────────────────────────────────────────────
const { data: circlesData } = await useFetch<{
  circles: { id: string; name: string }[]
}>('/api/circles')
const exportCircles = computed(() => circlesData.value?.circles ?? [])
const selectedCircleId = ref<string>('')
watch(
  exportCircles,
  (list) => {
    if (!selectedCircleId.value) {
      const first = list[0]
      if (first) selectedCircleId.value = first.id
    }
  },
  { immediate: true },
)

const exporting = ref(false)
const exportMsg = ref('')
const exportError = ref(false)

async function requestExport() {
  if (!selectedCircleId.value) return
  exporting.value = true
  exportMsg.value = ''
  exportError.value = false
  try {
    const res = await $fetch<{ message: string }>('/api/account/export', {
      method: 'POST',
      body: { circleId: selectedCircleId.value },
    })
    exportMsg.value = res.message ?? t('settings.account.exportQueued')
    track('export_requested', {
      circle_id: selectedCircleId.value,
      format: 'zip',
    })
  } catch (err: any) {
    exportError.value = true
    const msg = err?.data?.message ?? ''
    exportMsg.value = msg.includes('already in progress')
      ? t('settings.account.exportInProgress')
      : t('common.errorGeneric')
  } finally {
    exporting.value = false
  }
}

// ── Delete account ──────────────────────────────────────────
const showDeleteFlow = ref(false)
const deleting = ref(false)
const deleteError = ref('')
const keepCircleMemories = ref(true)
const confirmingDelete = ref(false)

// Pre-load ownership check so the warning is visible before the user clicks delete
const { data: preflightData } = await useFetch<{
  circlesNeedingTransfer: string[]
}>('/api/account/deletion-preflight')
const circlesNeedingTransfer = ref<string[]>(
  preflightData.value?.circlesNeedingTransfer ?? [],
)

async function requestDeletion() {
  deleting.value = true
  deleteError.value = ''
  circlesNeedingTransfer.value = []
  try {
    await $fetch('/api/account/delete', {
      method: 'POST',
      body: { keepCircleMemories: keepCircleMemories.value },
    })
    const { clear } = useUserState()
    await supabase.auth.signOut()
    clear()
    router.replace('/login')
  } catch (err: any) {
    const data = err?.data?.data
    if (data?.code === 'needs_transfer' && Array.isArray(data.circles)) {
      circlesNeedingTransfer.value = data.circles
    } else {
      deleteError.value = err?.data?.message ?? t('common.errorGeneric')
    }
  } finally {
    deleting.value = false
  }
}

// ── Deleted circles (restore) ───────────────────────────────
const { data: deletedCirclesData, refresh: refreshDeletedCircles } =
  await useFetch<{
    circles: {
      id: string
      name: string
      circle_type: string
      deleted_at: string
      purge_date: string
    }[]
  }>('/api/circles/deleted')

const deletedCircles = computed(() => deletedCirclesData.value?.circles ?? [])

const restoringId = ref<string | null>(null)
const restoreError = ref('')
const restoreMsg = ref('')

function formatPurgeDate(iso: string): string {
  return new Date(iso).toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

async function restoreCircle(circle: { id: string; name: string }) {
  restoringId.value = circle.id
  restoreError.value = ''
  restoreMsg.value = ''
  try {
    await $fetch(`/api/circles/${circle.id}/restore`, { method: 'POST' })
    restoreMsg.value = t('settings.account.restoreSuccess', {
      name: circle.name,
    })
    useUserState().clear()
    await refreshDeletedCircles()
  } catch (err: any) {
    restoreError.value =
      err?.data?.message ?? t('settings.account.restoreError')
  } finally {
    restoringId.value = null
  }
}

// ── Cancel deletion ─────────────────────────────────────────
const canceling = ref(false)

async function cancelDeletion() {
  canceling.value = true
  try {
    await $fetch('/api/account/cancel-deletion', { method: 'POST' })
    // Clear the cached user state so the middleware re-fetches and lifts the
    // /settings/account gate on the next navigation.
    const { clear } = useUserState()
    clear()
    await refreshNuxtData()
    router.replace('/timeline')
  } catch {
    // silently fail — user can try again
  } finally {
    canceling.value = false
  }
}
</script>
