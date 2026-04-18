<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <header class="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border">
      <div class="max-w-[1280px] mx-auto px-5 py-3.5 flex items-center gap-3">
        <NuxtLink
          to="/"
          class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {{ t('common.back') }}
        </NuxtLink>
        <span class="text-border">·</span>
        <p class="text-sm font-semibold text-foreground">{{ t('settings.account.title') }}</p>
      </div>
    </header>

    <main class="max-w-[1280px] mx-auto px-5 py-8">
      <div class="max-w-lg space-y-8">

        <!-- ── Pending deletion banner ───────────────────── -->
        <div
          v-if="pendingDeletionDate"
          class="rounded-2xl overflow-hidden border border-destructive/25"
        >
          <!-- Coloured header strip -->
          <div class="bg-destructive/8 px-5 pt-5 pb-4 border-b border-destructive/15">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-full bg-destructive/12 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg class="w-4 h-4 text-destructive" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div>
                <p class="text-sm font-semibold text-destructive leading-snug">{{ t('settings.account.pendingDeletionTitle') }}</p>
                <p class="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {{ t('settings.account.pendingDeletionDesc', { date: pendingDeletionDate }) }}
                </p>
              </div>
            </div>
          </div>
          <div class="px-5 py-4 bg-background">
            <button
              @click="cancelDeletion"
              :disabled="canceling"
              class="w-full py-2.5 rounded-[10px] text-sm font-semibold border border-border text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
            >
              {{ canceling ? t('settings.account.canceling') : t('settings.account.cancelDeletion') }}
            </button>
          </div>
        </div>

        <!-- ── Export data ───────────────────────────────── -->
        <div>
          <h2 class="text-base font-semibold text-foreground mb-1">{{ t('settings.account.exportTitle') }}</h2>
          <p class="text-sm text-muted-foreground mb-4">{{ t('settings.account.exportDesc') }}</p>
          <p v-if="exportMsg" class="text-sm mb-3" :class="exportError ? 'text-destructive' : 'text-green-600 dark:text-green-400'">
            {{ exportMsg }}
          </p>
          <button
            @click="requestExport"
            :disabled="exporting"
            class="px-5 py-2.5 border border-border rounded-[10px] text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
          >
            {{ exporting ? t('settings.account.exporting') : t('settings.account.exportButton') }}
          </button>
        </div>

        <div class="h-px bg-border" />

        <!-- ── Delete account ────────────────────────────── -->
        <div>
          <h3 class="text-base font-semibold text-destructive mb-4">{{ t('settings.account.deleteTitle') }}</h3>

          <!-- Needs manual ownership transfer -->
          <div v-if="circlesNeedingTransfer.length > 0" class="rounded-2xl border border-amber-200 dark:border-amber-800/50 overflow-hidden">
            <div class="bg-amber-50 dark:bg-amber-900/20 px-5 py-4 border-b border-amber-200 dark:border-amber-800/50">
              <div class="flex gap-2.5 items-start">
                <svg class="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p class="text-sm font-medium text-amber-700 dark:text-amber-300">{{ t('settings.account.needsTransferWarning') }}</p>
              </div>
            </div>
            <div class="px-5 py-4 space-y-3">
              <ul class="space-y-1.5">
                <li v-for="name in circlesNeedingTransfer" :key="name" class="flex items-center gap-2 text-sm text-muted-foreground">
                  <span class="w-1 h-1 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                  {{ name }}
                </li>
              </ul>
              <p class="text-xs text-muted-foreground">{{ t('settings.account.needsTransferHint') }}</p>
            </div>
          </div>

          <!-- Deletion flow -->
          <template v-else>
            <!-- Step-by-step consequences -->
            <div class="rounded-2xl border border-border overflow-hidden mb-5">
              <!-- Step 1 -->
              <div class="px-5 py-4 border-b border-border">
                <div class="flex gap-4">
                  <div class="flex flex-col items-center gap-1 flex-shrink-0">
                    <div class="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center">
                      <span class="text-[10px] font-bold text-destructive">1</span>
                    </div>
                    <div class="w-px flex-1 bg-border min-h-[16px]" />
                  </div>
                  <div class="pb-2">
                    <p class="text-sm font-semibold text-foreground leading-snug">{{ t('settings.account.deleteStep1Title') }}</p>
                    <p class="text-xs text-muted-foreground mt-1 leading-relaxed">{{ t('settings.account.deleteStep1Desc') }}</p>
                  </div>
                </div>
              </div>
              <!-- Step 2 -->
              <div class="px-5 py-4">
                <div class="flex gap-4">
                  <div class="flex flex-col items-center flex-shrink-0">
                    <div class="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center">
                      <span class="text-[10px] font-bold text-destructive">2</span>
                    </div>
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-foreground leading-snug">
                      {{ t('settings.account.deleteStep2Title', { date: purgePreviewDate }) }}
                    </p>
                    <p class="text-xs text-muted-foreground mt-1 mb-2.5 leading-relaxed">{{ t('settings.account.deleteStep2Desc') }}</p>
                    <ul class="space-y-1.5">
                      <li class="flex items-center gap-2 text-xs text-muted-foreground">
                        <svg class="w-3 h-3 text-destructive/60 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                        {{ t('settings.account.deleteItem1') }}
                      </li>
                      <li class="flex items-center gap-2 text-xs text-muted-foreground">
                        <svg class="w-3 h-3 text-destructive/60 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                        {{ t('settings.account.deleteItem2') }}
                      </li>
                      <li class="flex items-center gap-2 text-xs text-muted-foreground">
                        <svg class="w-3 h-3 text-destructive/60 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                        {{ t('settings.account.deleteItem3') }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <!-- Circle memories choice -->
            <div class="mb-5">
              <p class="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">{{ t('settings.account.deleteCircleQuestion') }}</p>
              <div class="space-y-2">
                <label
                  class="flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors"
                  :class="keepCircleMemories ? 'border-foreground bg-secondary' : 'border-border hover:border-foreground/30'"
                >
                  <input type="radio" :value="true" v-model="keepCircleMemories" class="mt-0.5 accent-foreground" />
                  <div>
                    <p class="text-sm font-medium text-foreground">{{ t('settings.account.deleteCircleKeepLabel') }}</p>
                    <p class="text-xs text-muted-foreground mt-0.5">{{ t('settings.account.deleteCircleKeepDesc') }}</p>
                  </div>
                </label>
                <label
                  class="flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors"
                  :class="!keepCircleMemories ? 'border-destructive/60 bg-destructive/5' : 'border-border hover:border-foreground/30'"
                >
                  <input type="radio" :value="false" v-model="keepCircleMemories" class="mt-0.5 accent-foreground" />
                  <div>
                    <p class="text-sm font-medium text-foreground">{{ t('settings.account.deleteCircleRemoveLabel') }}</p>
                    <p class="text-xs text-muted-foreground mt-0.5">{{ t('settings.account.deleteCircleRemoveDesc') }}</p>
                  </div>
                </label>
              </div>
            </div>

            <!-- Email note + error + confirm -->
            <p class="text-xs text-muted-foreground mb-4 leading-relaxed">
              {{ t('settings.account.deleteEmailNote') }}
            </p>
            <p v-if="deleteError" class="text-sm text-destructive mb-3">{{ deleteError }}</p>
            <button
              @click="requestDeletion"
              :disabled="deleting"
              class="w-full py-3 rounded-[10px] text-sm font-semibold bg-destructive text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {{ deleting ? t('settings.account.deleting') : t('settings.account.deleteButton') }}
            </button>
          </template>
        </div>

      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const router = useRouter()
const supabase = useSupabaseClient()

const { data: profile } = await useFetch<{ deletedAt: string | null }>('/api/profile')

const pendingDeletionDate = computed(() => {
  if (!profile.value?.deletedAt) return null
  const purgeDate = new Date(profile.value.deletedAt)
  purgeDate.setDate(purgeDate.getDate() + 30)
  return purgeDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
})

// Preview the purge date before initiating (today + 30 days)
const purgePreviewDate = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
})

// ── Export ──────────────────────────────────────────────────
const exporting = ref(false)
const exportMsg = ref('')
const exportError = ref(false)

async function requestExport() {
  exporting.value = true
  exportMsg.value = ''
  exportError.value = false
  try {
    const res = await $fetch<{ message: string }>('/api/account/export', { method: 'POST' })
    exportMsg.value = res.message ?? t('settings.account.exportQueued')
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
const deleting = ref(false)
const deleteError = ref('')
const circlesNeedingTransfer = ref<string[]>([])
const keepCircleMemories = ref(true)

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

// ── Cancel deletion ─────────────────────────────────────────
const canceling = ref(false)

async function cancelDeletion() {
  canceling.value = true
  try {
    await $fetch('/api/account/cancel-deletion', { method: 'POST' })
    await refreshNuxtData()
    router.replace('/settings/account')
  } catch {
    // silently fail — user can try again
  } finally {
    canceling.value = false
  }
}
</script>
