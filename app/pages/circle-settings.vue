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
          <span class="text-[12px] font-medium text-foreground">{{ t('nav.circleSettings') }}</span>
        </span>
        <div class="w-12" />
      </div>
    </header>

    <main class="mx-auto max-w-[640px] px-5 py-8">
      <!-- Loading -->
      <div v-if="!circle" class="flex justify-center py-24">
        <div class="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>

      <template v-else>
        <!-- Italic display title -->
        <div class="mb-8 px-[4px]">
          <h1 class="font-serif text-[32px] italic leading-[1.05] text-foreground sm:text-[34px]">
            {{ circle.name }}
          </h1>
          <p class="mt-2 text-[12.5px] leading-[1.5] text-muted-foreground">
            {{ t('circleSettings.displaySubtitle') }}
          </p>
        </div>

        <!-- ── ABOUT ──────────────────────────────────────── -->
        <SettingsSection :label="t('circleSettings.sectionAbout')">
          <!-- Circle name -->
          <SettingsRow>
            {{ t('circleSettings.circleName') }}
            <template #hint>
              <span v-if="circleNameError" class="text-destructive">{{ circleNameError }}</span>
            </template>
            <template #control>
              <input
                v-model="circleNameInput"
                type="text"
                maxlength="100"
                :placeholder="t('circleSettings.circleNamePlaceholder')"
                :disabled="!isOwner"
                class="w-[160px] rounded-lg border border-transparent bg-foreground/[.05] px-3 py-1.5 text-right text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none focus:ring-0 disabled:opacity-40"
                @blur="saveCircleName"
                @keyup.enter="saveCircleName"
              />
            </template>
          </SettingsRow>

          <!-- Circle type — full-width segmented grid -->
          <div class="px-[14px] pb-[13px] pt-[10px]">
            <p class="mb-2 text-[11px] font-medium text-muted-foreground">
              {{ t('circleSettings.circleType') }}
            </p>
            <div class="grid grid-cols-4 gap-0.5 rounded-[10px] bg-foreground/[.06] p-0.5">
              <button
                v-for="ct in circleTypeOptions"
                :key="ct.value"
                type="button"
                :disabled="!isOwner || savingCircleType"
                class="rounded-[8px] px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40"
                :class="
                  selectedCircleType === ct.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="setCircleType(ct.value)"
              >
                {{ ct.label }}
              </button>
            </div>
            <p v-if="circleTypeError" class="mt-1.5 text-[11px] text-destructive">
              {{ circleTypeError }}
            </p>
          </div>

          <!-- Anniversary / Trip date — couple/friends/travel circles only -->
          <SettingsRow
            v-if="['couple', 'friends', 'travel'].includes(circle.circle_type)"
          >
            {{
              circle.circle_type === 'couple'
                ? t('circleSettings.anniversary')
                : t('circleSettings.tripDate')
            }}
            <template #hint>
              {{
                circle.circle_type === 'couple'
                  ? t('circleSettings.anniversaryDesc')
                  : t('circleSettings.tripDateDesc')
              }}
              <span v-if="anniversaryError" class="block text-destructive">{{ anniversaryError }}</span>
            </template>
            <template #control>
              <div class="flex items-center gap-1">
                <input
                  v-model="anniversaryDateInput"
                  type="date"
                  :aria-label="circle.circle_type === 'couple' ? 'Anniversary date' : 'Trip date'"
                  :disabled="!isOwner || savingAnniversary"
                  class="rounded-lg border border-transparent bg-foreground/[.05] px-2 py-1.5 text-[13px] text-foreground focus:border-ring focus:outline-none disabled:opacity-40"
                  :style="{ colorScheme: isDark ? 'dark' : 'light' }"
                  @change="saveAnniversary"
                />
                <button
                  v-if="circle.anniversary_date && isOwner"
                  :disabled="savingAnniversary"
                  class="rounded-md p-1 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
                  :title="t('circleSettings.clearAnniversary')"
                  @click="clearAnniversary"
                >
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </template>
          </SettingsRow>
        </SettingsSection>

        <!-- ── MEMBERS ─────────────────────────────────────── -->
        <SettingsSection :label="t('circleSettings.sectionMembers')">
          <!-- Member count drill → /members -->
          <SettingsRow :to="circleId ? `/members?circle=${circleId}` : '/members'">
            {{ t('circleSettings.sectionMembers') }}
            <template #hint>
              {{
                t('circleSettings.membersCount', {
                  n: membersData?.members?.length ?? 0,
                })
              }}
            </template>
          </SettingsRow>

          <!-- Invite someone -->
          <SettingsRow v-if="isOwner" @click="inviteOpen = true" class="cursor-pointer transition-colors hover:bg-foreground/[.03]">
            {{ t('nav.inviteSomeone') }}
            <template #hint>{{ t('nav.inviteDesc', { circle: circle.name }) }}</template>
            <template #control>
              <!-- chevron-like plus -->
              <svg class="h-3 w-3 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </template>
          </SettingsRow>
        </SettingsSection>

        <!-- ── CHILDREN ────────────────────────────────────── -->
        <SettingsSection
          v-if="isOwner"
          :label="t('circleSettings.sectionChildren')"
        >
          <!-- Existing children -->
          <template v-if="children.length">
            <div
              v-for="child in children"
              :key="child.id"
            >
              <!-- View mode -->
              <div
                v-if="editingChildId !== child.id"
                class="flex items-center gap-[14px] px-[14px] py-[13px]"
              >
                <div class="min-w-0 flex-1">
                  <p class="text-[14px] font-medium leading-tight text-foreground">{{ child.name }}</p>
                  <p class="mt-0.5 text-[11px] leading-[1.35] text-muted-foreground">{{ formatDob(child.date_of_birth) }}</p>
                </div>
                <div class="flex flex-shrink-0 items-center gap-1">
                  <button
                    class="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[.05] hover:text-foreground"
                    @click="startEditChild(child)"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    :disabled="removingChildId === child.id"
                    class="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    @click="removeChild(child.id)"
                  >
                    <svg v-if="removingChildId !== child.id" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                    <div v-else class="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  </button>
                </div>
              </div>

              <!-- Edit mode -->
              <div v-else class="flex flex-col gap-2 px-[14px] py-3">
                <div class="flex gap-2">
                  <input
                    v-model="editChildName"
                    type="text"
                    :placeholder="t('circleSettings.childNamePlaceholder')"
                    maxlength="100"
                    class="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                    @keydown.enter="saveEditChild(child.id)"
                    @keydown.escape="cancelEditChild"
                  />
                  <input
                    v-model="editChildDob"
                    type="date"
                    aria-label="Date of birth"
                    class="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    :style="{ colorScheme: isDark ? 'dark' : 'light' }"
                    @keydown.enter="saveEditChild(child.id)"
                    @keydown.escape="cancelEditChild"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <button
                    :disabled="savingChildId === child.id || !editChildName.trim() || !editChildDob"
                    class="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                    @click="saveEditChild(child.id)"
                  >
                    {{ savingChildId === child.id ? '…' : t('modal.save') }}
                  </button>
                  <button
                    class="rounded-lg px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                    @click="cancelEditChild"
                  >
                    {{ t('modal.cancel') }}
                  </button>
                </div>
              </div>
            </div>
          </template>

          <!-- Add child row -->
          <div v-if="children.length < 10" class="px-[14px] py-3">
            <p class="mb-2 text-[11px] font-medium text-muted-foreground">{{ t('circleSettings.addChild') }}</p>
            <div class="flex gap-2">
              <input
                v-model="newChildName"
                type="text"
                :placeholder="t('circleSettings.childNamePlaceholder')"
                maxlength="100"
                class="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                v-model="newChildDob"
                type="date"
                aria-label="Date of birth"
                class="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                :style="{ colorScheme: isDark ? 'dark' : 'light' }"
              />
              <button
                :disabled="addingChild || !newChildName.trim() || !newChildDob"
                :aria-label="t('circleSettings.addChild')"
                class="flex-shrink-0 rounded-lg bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                @click="addChild"
              >
                {{ addingChild ? '…' : '+' }}
              </button>
            </div>
          </div>
          <div v-else class="px-[14px] py-[13px]">
            <p class="text-[11px] text-muted-foreground">{{ t('circleSettings.childrenMax') }}</p>
          </div>

          <div v-if="childrenError" class="px-[14px] pb-3">
            <p class="text-[11px] text-destructive">{{ childrenError }}</p>
          </div>
        </SettingsSection>

        <!-- ── DANGER ──────────────────────────────────────── -->
        <SettingsSection v-if="isOwner" :label="t('circleSettings.sectionDanger')">
          <SettingsRow :destructive="true" @click="openDeleteDialog" class="cursor-pointer transition-colors hover:bg-foreground/[.03]">
            {{ t('members.deleteCircle') }}
            <template #hint>{{ t('members.deleteCircleDesc') }}</template>
          </SettingsRow>
        </SettingsSection>
      </template>
    </main>

    <!-- ── Invite sheet ─────────────────────────────────────── -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="inviteOpen"
        class="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
      >
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closeInvite" />
        <div class="relative w-full max-w-sm rounded-[20px] border border-border bg-card p-6 shadow-2xl">
          <h2 class="mb-1 font-display text-lg font-bold text-foreground">
            {{ t('nav.inviteSomeone') }}
          </h2>
          <p class="mb-5 text-xs text-muted-foreground">
            {{ t('nav.inviteDesc', { circle: circle?.name ?? '' }) }}
          </p>
          <form @submit.prevent="sendInvite">
            <input
              v-model="inviteEmail"
              type="email"
              placeholder="their@email.com"
              required
              :disabled="inviteSending"
              class="mb-3 w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <p v-if="inviteError" class="mb-3 text-xs text-destructive">{{ inviteError }}</p>
            <p v-if="inviteSentTo" class="mb-3 text-xs text-green-600 dark:text-green-400">
              {{ t('nav.inviteSentTo', { email: inviteSentTo }) }}
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                class="flex-1 rounded-[10px] border border-border py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                @click="closeInvite"
              >
                {{ t('nav.cancel') }}
              </button>
              <button
                type="submit"
                :disabled="inviteSending || !inviteEmail"
                class="flex-1 rounded-[10px] bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {{ inviteSending ? t('nav.sending') : t('nav.sendInvite') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- ── Circle deletion dialog (2-step) ─────────────────── -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="deleteDialogOpen"
        class="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="closeDeleteDialog"
        />
        <div
          class="relative w-full max-w-sm overflow-hidden rounded-[20px] border border-border bg-card shadow-2xl"
        >
          <!-- Step 1: Warning -->
          <template v-if="deleteStep === 1">
            <div class="border-b border-border px-6 pb-4 pt-6">
              <p class="mb-1 text-[10px] font-bold uppercase tracking-widest text-destructive">
                {{ t('members.deleteCircle') }}
              </p>
              <h2 class="text-base font-bold leading-snug text-foreground">
                {{ t('members.deleteCircleWarningTitle') }}
              </h2>
            </div>
            <div class="space-y-3 px-6 py-4">
              <div class="bg-destructive/8 flex items-start gap-2 rounded-xl border border-destructive/20 px-3.5 py-3">
                <svg class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-destructive" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <p class="text-xs leading-relaxed text-destructive">
                  {{
                    t('members.deleteCircleWarning', {
                      memories: membersData?.memoryCount ?? 0,
                      members: membersData?.members?.length ?? 0,
                    })
                  }}
                </p>
              </div>
              <p class="text-xs leading-relaxed text-muted-foreground">
                {{ t('members.deleteCircleRestoreHint') }}
              </p>
            </div>
            <div class="flex gap-2 px-6 pb-6">
              <button
                class="flex-1 rounded-[10px] border border-border py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                @click="closeDeleteDialog"
              >
                {{ t('nav.cancel') }}
              </button>
              <button
                class="flex-1 rounded-[10px] bg-destructive py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                @click="deleteStep = 2"
              >
                {{ t('members.deleteCircleContinue') }}
              </button>
            </div>
          </template>

          <!-- Step 2: Type-to-confirm -->
          <template v-else>
            <div class="border-b border-border px-6 pb-4 pt-6">
              <p class="mb-1 text-[10px] font-bold uppercase tracking-widest text-destructive">
                {{ t('members.deleteCircle') }}
              </p>
              <h2 class="text-base font-bold leading-snug text-foreground">
                {{ t('members.deleteCircleConfirmTitle') }}
              </h2>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ t('members.deleteCircleConfirmDesc', { name: circle?.name ?? '' }) }}
              </p>
            </div>
            <div class="px-6 py-4">
              <input
                v-model="deleteConfirmInput"
                type="text"
                :placeholder="circle?.name ?? ''"
                class="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-destructive/40"
                @keyup.enter="confirmDeleteCircle"
              />
              <p v-if="deleteError" class="mt-2 text-xs text-destructive">{{ deleteError }}</p>
            </div>
            <div class="flex gap-2 px-6 pb-6">
              <button
                class="flex-1 rounded-[10px] border border-border py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                @click="closeDeleteDialog"
              >
                {{ t('nav.cancel') }}
              </button>
              <button
                :disabled="
                  deleteConfirmInput.trim().toLowerCase() !==
                    (circle?.name ?? '').trim().toLowerCase() || isDeleting
                "
                class="flex-1 rounded-[10px] bg-destructive py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                @click="confirmDeleteCircle"
              >
                {{ isDeleting ? '…' : t('members.deleteCircleConfirm') }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
definePageMeta({})
const { t, locale } = useI18n()
const router = useRouter()
const colorMode = useColorMode()
const isDark = computed(() =>
  colorMode.preference === 'system'
    ? colorMode.value === 'dark'
    : colorMode.preference === 'dark',
)

// ── Circle ─────────────────────────────────────────────────
const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
const route = useRoute()
// Prefer ?circle=<id> from the URL so settings always edits the circle the
// user was just viewing on the timeline. Falls back to the first circle if
// the param is missing or doesn't match (e.g. user typed /circle-settings
// directly, or the param is stale).
const circle = computed(() => {
  const all = circlesData.value?.circles ?? []
  const paramId = route.query.circle as string | undefined
  if (paramId) {
    const match = all.find((c: any) => c.id === paramId)
    if (match) return match
  }
  return all[0] ?? null
})
const circleId = computed<string | null>(() => circle.value?.id ?? null)

const isOwner = computed(() => circle.value?.role === 'owner')

const CIRCLE_TYPE_KEYS: Record<string, string> = {
  parents: 'circleType.parents.label',
  couple: 'circleType.couple.label',
  family: 'circleType.family.label',
  friends: 'circleType.friends.label',
  caregiving: 'circleType.caregiving.label',
  travel: 'circleType.travel.label',
  solo: 'circleType.solo.label',
}

const circleTypeOptions = computed(() => [
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
  {
    value: 'custom',
    label: t('circleSettings.customTypeLabel'),
    description: t('circleSettings.customTypeDesc'),
  },
])

// ── Circle name ────────────────────────────────────────────
const circleNameInput = ref(circle.value?.name ?? '')
const savingCircleName = ref(false)
const circleNameError = ref('')

watch(circle, (c) => {
  if (!savingCircleName.value) {
    circleNameInput.value = c?.name ?? ''
  }
})

async function saveCircleName() {
  if (!circleId.value || savingCircleName.value) return
  const trimmed = circleNameInput.value.trim()
  if (!trimmed || trimmed === circle.value?.name) return
  savingCircleName.value = true
  circleNameError.value = ''
  try {
    await $fetch(`/api/circles/${circleId.value}`, {
      method: 'PATCH',
      body: { name: trimmed },
    })
    await refreshNuxtData()
  } catch (err: any) {
    circleNameError.value =
      err?.data?.message ?? t('circleSettings.errorSaveCircleName')
  } finally {
    savingCircleName.value = false
  }
}

// ── Circle type picker ─────────────────────────────────────
const selectedCircleType = ref(circle.value?.circle_type ?? '')
const savingCircleType = ref(false)
const circleTypeError = ref('')

// Keep in sync if circles data reloads
watch(circle, (c) => {
  if (!savingCircleType.value) {
    selectedCircleType.value = c?.circle_type ?? ''
  }
})

async function setCircleType(value: string) {
  if (!isOwner.value || value === selectedCircleType.value) return
  selectedCircleType.value = value
  await saveCircleType()
}

async function saveCircleType() {
  if (!circleId.value || savingCircleType.value) return
  savingCircleType.value = true
  circleTypeError.value = ''
  try {
    await $fetch(`/api/circles/${circleId.value}`, {
      method: 'PATCH',
      body: { circleType: selectedCircleType.value },
    })
    await refreshNuxtData()
  } catch (err: any) {
    circleTypeError.value =
      err?.data?.message ?? t('circleSettings.errorSaveCircleType')
  } finally {
    savingCircleType.value = false
  }
}

// ── Members + memory count (for deletion warning) ──────────
type MembersResponse = {
  members: any[]
  invites: any[]
  myRole: string
  memoryCount: number
}
const { data: membersData } = await useAsyncData<MembersResponse>(
  'circle-settings-members',
  () =>
    circleId.value
      ? $fetch<MembersResponse>(`/api/circles/${circleId.value}/members`)
      : Promise.resolve(null as any),
  { watch: [circleId] },
)

// Redirect non-owners away — this page is owner-only
watchEffect(() => {
  if (circle.value && !isOwner.value) {
    navigateTo('/members')
  }
})

// ── Children ───────────────────────────────────────────────
interface ChildProfile {
  id: string
  name: string
  date_of_birth: string
}

const { data: childrenData, refresh: refreshChildren } = await useAsyncData<{
  children: ChildProfile[]
}>(
  'circle-settings-children',
  () =>
    circleId.value
      ? $fetch<{ children: ChildProfile[] }>(
          `/api/circles/${circleId.value}/children`,
        )
      : Promise.resolve({ children: [] }),
  { watch: [circleId] },
)
const children = computed(() => childrenData.value?.children ?? [])

const newChildName = ref('')
const newChildDob = ref('')
const addingChild = ref(false)
const removingChildId = ref<string | null>(null)
const childrenError = ref('')

const editingChildId = ref<string | null>(null)
const editChildName = ref('')
const editChildDob = ref('')
const savingChildId = ref<string | null>(null)

function startEditChild(child: ChildProfile) {
  editingChildId.value = child.id
  editChildName.value = child.name
  editChildDob.value = child.date_of_birth
}

function cancelEditChild() {
  editingChildId.value = null
  editChildName.value = ''
  editChildDob.value = ''
}

async function saveEditChild(childId: string) {
  if (!circleId.value || !editChildName.value.trim() || !editChildDob.value)
    return
  savingChildId.value = childId
  childrenError.value = ''
  try {
    await $fetch(`/api/circles/${circleId.value}/children/${childId}`, {
      method: 'PATCH',
      body: {
        name: editChildName.value.trim(),
        dateOfBirth: editChildDob.value,
      },
    })
    await refreshChildren()
    cancelEditChild()
  } catch (err: any) {
    childrenError.value =
      err?.data?.message ?? t('circleSettings.errorUpdateChild')
  } finally {
    savingChildId.value = null
  }
}

function formatDob(dob: string) {
  return new Date(dob).toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

async function addChild() {
  if (!circleId.value || !newChildName.value.trim() || !newChildDob.value)
    return
  addingChild.value = true
  childrenError.value = ''
  try {
    await $fetch(`/api/circles/${circleId.value}/children`, {
      method: 'POST',
      body: { name: newChildName.value.trim(), dateOfBirth: newChildDob.value },
    })
    newChildName.value = ''
    newChildDob.value = ''
    await refreshChildren()
  } catch (err: any) {
    childrenError.value =
      err?.data?.message ?? t('circleSettings.errorAddChild')
  } finally {
    addingChild.value = false
  }
}

async function removeChild(childId: string) {
  if (!circleId.value) return
  removingChildId.value = childId
  childrenError.value = ''
  try {
    await $fetch(`/api/circles/${circleId.value}/children/${childId}`, {
      method: 'DELETE',
    })
    await refreshChildren()
  } catch (err: any) {
    childrenError.value =
      err?.data?.message ?? t('circleSettings.errorRemoveChild')
  } finally {
    removingChildId.value = null
  }
}

// ── Anniversary date ───────────────────────────────────────
const anniversaryDateInput = ref(circle.value?.anniversary_date ?? '')
const savingAnniversary = ref(false)
const anniversaryError = ref('')

// Keep input in sync if circles data reloads
watch(circle, (c) => {
  if (!savingAnniversary.value) {
    anniversaryDateInput.value = c?.anniversary_date ?? ''
  }
})

async function saveAnniversary() {
  if (!circleId.value || savingAnniversary.value) return
  savingAnniversary.value = true
  anniversaryError.value = ''
  try {
    await $fetch(`/api/circles/${circleId.value}`, {
      method: 'PATCH',
      body: { anniversaryDate: anniversaryDateInput.value || null },
    })
    await refreshNuxtData()
  } catch (err: any) {
    anniversaryError.value =
      err?.data?.message ?? t('circleSettings.errorSaveAnniversary')
  } finally {
    savingAnniversary.value = false
  }
}

async function clearAnniversary() {
  anniversaryDateInput.value = ''
  await saveAnniversary()
}

// ── Invite sheet ───────────────────────────────────────────
const inviteOpen = ref(false)
const inviteEmail = ref('')
const inviteSending = ref(false)
const inviteError = ref('')
const inviteSentTo = ref('')

function closeInvite() {
  inviteOpen.value = false
  inviteEmail.value = ''
  inviteError.value = ''
  inviteSentTo.value = ''
}

async function sendInvite() {
  if (!circleId.value || !inviteEmail.value) return
  inviteSending.value = true
  inviteError.value = ''
  inviteSentTo.value = ''
  try {
    await $fetch('/api/circles/invite', {
      method: 'POST',
      body: { circleId: circleId.value, email: inviteEmail.value },
    })
    inviteSentTo.value = inviteEmail.value
    inviteEmail.value = ''
    await refreshNuxtData()
  } catch (err: any) {
    const msg = err?.data?.message ?? ''
    if (msg.includes('already been sent'))
      inviteError.value = t('nav.inviteAlreadySent')
    else if (msg.includes('Max 10'))
      inviteError.value = t('nav.inviteMaxPending')
    else inviteError.value = t('nav.inviteFailed')
  } finally {
    inviteSending.value = false
  }
}

// ── Circle deletion ────────────────────────────────────────
const deleteDialogOpen = ref(false)
const deleteStep = ref<1 | 2>(1)
const deleteConfirmInput = ref('')
const deleteError = ref('')
const isDeleting = ref(false)

function openDeleteDialog() {
  deleteDialogOpen.value = true
  deleteStep.value = 1
  deleteConfirmInput.value = ''
  deleteError.value = ''
}

function closeDeleteDialog() {
  deleteDialogOpen.value = false
  deleteStep.value = 1
  deleteConfirmInput.value = ''
  deleteError.value = ''
}

async function confirmDeleteCircle() {
  if (!circleId.value || !circle.value) return
  if (
    deleteConfirmInput.value.trim().toLowerCase() !==
    circle.value.name.trim().toLowerCase()
  ) {
    deleteError.value = t('members.deleteCircleNameMismatch')
    return
  }
  isDeleting.value = true
  deleteError.value = ''
  try {
    await $fetch(`/api/circles/${circleId.value}/delete`, {
      method: 'POST',
      body: { confirmName: deleteConfirmInput.value.trim() },
    })
    // Clear the membership cache so the middleware re-checks membership
    // and redirects to /no-circle if this was the user's only circle.
    const { clear } = useUserState()
    clear()
    await navigateTo('/timeline')
  } catch (err: any) {
    deleteError.value = err?.data?.message ?? t('members.deleteCircleError')
  } finally {
    isDeleting.value = false
  }
}
</script>
