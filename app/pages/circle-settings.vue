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

        <p class="flex-1 text-sm font-semibold text-foreground text-center">{{ t('nav.circleSettings') }}</p>

        <!-- spacer to balance the back button -->
        <div class="w-12" />
      </div>
    </header>

    <main class="max-w-[1280px] mx-auto px-5 py-8">
      <div class="max-w-lg space-y-8">

        <!-- Loading -->
        <div v-if="!circle" class="flex justify-center py-24">
          <div class="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
        </div>

        <template v-else>

          <!-- Circle info -->
          <div>
            <div class="flex items-center gap-4 py-2">
              <div class="w-12 h-12 rounded-2xl bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div class="min-w-0">
                <p class="text-base font-semibold text-foreground leading-tight truncate">{{ circle.name }}</p>
                <p class="text-xs text-muted-foreground mt-0.5">{{ circleTypeLabel }}</p>
              </div>
            </div>
          </div>

          <div class="h-px bg-border" />

          <!-- Circle name — owner only -->
          <div v-if="isOwner">
            <h2 class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">
              {{ t('circleSettings.circleName') }}
            </h2>
            <div class="flex gap-2">
              <input
                v-model="circleNameInput"
                type="text"
                maxlength="100"
                :placeholder="t('circleSettings.circleNamePlaceholder')"
                class="flex-1 min-w-0 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                @keyup.enter="saveCircleName"
              />
              <button
                :disabled="savingCircleName || !circleNameInput.trim() || circleNameInput.trim() === circle.name"
                class="flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
                @click="saveCircleName"
              >
                {{ savingCircleName ? '…' : t('modal.save') }}
              </button>
            </div>
            <p v-if="circleNameError" class="text-xs text-destructive mt-2">{{ circleNameError }}</p>
          </div>

          <div v-if="isOwner" class="h-px bg-border" />

          <!-- Circle type picker — owner only -->
          <div v-if="isOwner">
            <h2 class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">
              {{ t('circleSettings.circleType') }}
            </h2>
            <p class="text-xs text-muted-foreground mb-4">
              {{ t('circleSettings.circleTypeDesc') }}
            </p>

            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="type in circleTypeOptions"
                :key="type.value"
                class="rounded-xl px-4 py-3.5 text-left border transition-colors"
                :class="selectedCircleType === type.value
                  ? 'border-foreground bg-secondary'
                  : 'border-border bg-card hover:border-foreground/30'"
                @click="selectedCircleType = type.value"
              >
                <p class="text-sm font-medium text-foreground leading-snug">{{ type.label }}</p>
                <p class="text-xs text-muted-foreground mt-0.5">{{ type.description }}</p>
              </button>
            </div>

            <div class="flex items-center gap-2 mt-3">
              <button
                :disabled="savingCircleType || selectedCircleType === circle.circle_type"
                class="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
                @click="saveCircleType"
              >
                {{ savingCircleType ? '…' : t('modal.save') }}
              </button>
            </div>
            <p v-if="circleTypeError" class="text-xs text-destructive mt-2">{{ circleTypeError }}</p>
          </div>

          <div v-if="isOwner" class="h-px bg-border" />

          <!-- Children (baby age stamps) — owner only -->
          <div v-if="isOwner">
            <h2 class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">
              {{ t('circleSettings.children') }}
            </h2>
            <p class="text-xs text-muted-foreground mb-4">
              {{ t('circleSettings.childrenDesc') }}
            </p>

            <!-- Existing children list -->
            <div v-if="children.length" class="space-y-2 mb-4">
              <div
                v-for="child in children"
                :key="child.id"
                class="rounded-xl border border-border bg-secondary/40 overflow-hidden"
              >
                <!-- View row -->
                <div v-if="editingChildId !== child.id" class="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-foreground truncate">{{ child.name }}</p>
                    <p class="text-xs text-muted-foreground">{{ formatDob(child.date_of_birth) }}</p>
                  </div>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <!-- Edit -->
                    <button
                      class="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      @click="startEditChild(child)"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <!-- Remove -->
                    <button
                      class="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      :disabled="removingChildId === child.id"
                      @click="removeChild(child.id)"
                    >
                      <svg v-if="removingChildId !== child.id" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                      <div v-else class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    </button>
                  </div>
                </div>

                <!-- Edit row -->
                <div v-else class="px-4 py-3 flex flex-col gap-2">
                  <div class="flex gap-2">
                    <input
                      v-model="editChildName"
                      type="text"
                      :placeholder="t('circleSettings.childNamePlaceholder')"
                      maxlength="100"
                      class="flex-1 min-w-0 bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                      @keydown.enter="saveEditChild(child.id)"
                      @keydown.escape="cancelEditChild"
                    />
                    <input
                      v-model="editChildDob"
                      type="date"
                      aria-label="Date of birth"
                      class="flex-1 min-w-0 bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      :style="{ colorScheme: isDark ? 'dark' : 'light' }"
                      @keydown.enter="saveEditChild(child.id)"
                      @keydown.escape="cancelEditChild"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      :disabled="savingChildId === child.id || !editChildName.trim() || !editChildDob"
                      class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
                      @click="saveEditChild(child.id)"
                    >
                      {{ savingChildId === child.id ? '…' : t('modal.save') }}
                    </button>
                    <button
                      class="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
                      @click="cancelEditChild"
                    >
                      {{ t('modal.cancel') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Add child form -->
            <div v-if="children.length < 10" class="flex flex-col gap-2">
              <div class="flex gap-2">
                <input
                  v-model="newChildName"
                  type="text"
                  :placeholder="t('circleSettings.childNamePlaceholder')"
                  maxlength="100"
                  class="flex-1 min-w-0 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  v-model="newChildDob"
                  type="date"
                  aria-label="Date of birth"
                  class="flex-1 min-w-0 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  :style="{ colorScheme: isDark ? 'dark' : 'light' }"
                />
              </div>
              <button
                :disabled="addingChild || !newChildName.trim() || !newChildDob"
                class="self-start px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
                @click="addChild"
              >
                {{ addingChild ? '…' : t('circleSettings.addChild') }}
              </button>
            </div>
            <p v-else class="text-xs text-muted-foreground">{{ t('circleSettings.childrenMax') }}</p>

            <p v-if="childrenError" class="text-xs text-destructive mt-2">{{ childrenError }}</p>
          </div>

          <div v-if="isOwner && ['couple', 'friends', 'travel'].includes(circle.circle_type)" class="h-px bg-border" />

          <!-- Anniversary / Trip date — couple/friends/travel circles, owner only -->
          <div v-if="isOwner && ['couple', 'friends', 'travel'].includes(circle.circle_type)">
            <h2 class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">
              {{ circle.circle_type === 'couple' ? t('circleSettings.anniversary') : t('circleSettings.tripDate') }}
            </h2>
            <p class="text-xs text-muted-foreground mb-4">
              {{ circle.circle_type === 'couple' ? t('circleSettings.anniversaryDesc') : t('circleSettings.tripDateDesc') }}
            </p>
            <div class="flex gap-2 items-start">
              <input
                v-model="anniversaryDateInput"
                type="date"
                :aria-label="circle.circle_type === 'couple' ? 'Anniversary date' : 'Trip date'"
                class="flex-1 min-w-0 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                :style="{ colorScheme: isDark ? 'dark' : 'light' }"
              />
              <button
                :disabled="savingAnniversary || anniversaryDateInput === (circle.anniversary_date ?? '')"
                class="flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
                @click="saveAnniversary"
              >
                {{ savingAnniversary ? '…' : t('modal.save') }}
              </button>
              <button
                v-if="circle.anniversary_date"
                :disabled="savingAnniversary"
                class="flex-shrink-0 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border transition-colors disabled:opacity-40"
                :title="t('circleSettings.clearAnniversary')"
                @click="clearAnniversary"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <p v-if="anniversaryError" class="text-xs text-destructive mt-2">{{ anniversaryError }}</p>
          </div>

          <!-- Danger zone (owner only) -->
          <div v-if="isOwner">
            <h2 class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-4">
              {{ t('members.dangerZone') }}
            </h2>
            <div class="border border-destructive/20 rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-foreground">{{ t('members.deleteCircleTitle') }}</p>
                <p class="text-xs text-muted-foreground mt-0.5">{{ t('members.deleteCircleDesc') }}</p>
              </div>
              <button
                class="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border border-destructive/40 text-destructive hover:bg-destructive/8 transition-colors"
                @click="openDeleteDialog"
              >
                {{ t('members.deleteCircle') }}
              </button>
            </div>
          </div>

        </template>

      </div>
    </main>

    <!-- Circle deletion dialog (2-step) -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="deleteDialogOpen" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closeDeleteDialog" />
        <div class="relative w-full max-w-sm bg-card border border-border rounded-[20px] shadow-2xl overflow-hidden">

          <!-- Step 1: Warning -->
          <template v-if="deleteStep === 1">
            <div class="px-6 pt-6 pb-4 border-b border-border">
              <p class="text-[10px] font-bold tracking-widest uppercase text-destructive mb-1">{{ t('members.deleteCircle') }}</p>
              <h2 class="text-base font-bold text-foreground leading-snug">{{ t('members.deleteCircleWarningTitle') }}</h2>
            </div>
            <div class="px-6 py-4 space-y-3">
              <div class="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-destructive/8 border border-destructive/20">
                <svg class="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p class="text-xs text-destructive leading-relaxed">
                  {{ t('members.deleteCircleWarning', { memories: membersData?.memoryCount ?? 0, members: membersData?.members?.length ?? 0 }) }}
                </p>
              </div>
              <p class="text-xs text-muted-foreground leading-relaxed">
                {{ t('members.deleteCircleRestoreHint') }}
              </p>
            </div>
            <div class="px-6 pb-6 flex gap-2">
              <button
                class="flex-1 py-3 rounded-[10px] text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
                @click="closeDeleteDialog"
              >
                {{ t('nav.cancel') }}
              </button>
              <button
                class="flex-1 py-3 rounded-[10px] text-sm font-semibold bg-destructive text-white hover:opacity-90 transition-opacity"
                @click="deleteStep = 2"
              >
                {{ t('members.deleteCircleContinue') }}
              </button>
            </div>
          </template>

          <!-- Step 2: Type-to-confirm -->
          <template v-else>
            <div class="px-6 pt-6 pb-4 border-b border-border">
              <p class="text-[10px] font-bold tracking-widest uppercase text-destructive mb-1">{{ t('members.deleteCircle') }}</p>
              <h2 class="text-base font-bold text-foreground leading-snug">{{ t('members.deleteCircleConfirmTitle') }}</h2>
              <p class="text-xs text-muted-foreground mt-1">
                {{ t('members.deleteCircleConfirmDesc', { name: circle?.name ?? '' }) }}
              </p>
            </div>
            <div class="px-6 py-4">
              <input
                v-model="deleteConfirmInput"
                type="text"
                :placeholder="circle?.name ?? ''"
                class="w-full bg-background border border-border rounded-[10px] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-destructive/40"
                @keyup.enter="confirmDeleteCircle"
              />
              <p v-if="deleteError" class="text-xs text-destructive mt-2">{{ deleteError }}</p>
            </div>
            <div class="px-6 pb-6 flex gap-2">
              <button
                class="flex-1 py-3 rounded-[10px] text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
                @click="closeDeleteDialog"
              >
                {{ t('nav.cancel') }}
              </button>
              <button
                :disabled="deleteConfirmInput.trim().toLowerCase() !== (circle?.name ?? '').trim().toLowerCase() || isDeleting"
                class="flex-1 py-3 rounded-[10px] text-sm font-semibold bg-destructive text-white hover:opacity-90 transition-opacity disabled:opacity-40"
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
const { t } = useI18n()
const router = useRouter()
const colorMode = useColorMode()
const isDark = computed(() =>
  colorMode.preference === 'system'
    ? colorMode.value === 'dark'
    : colorMode.preference === 'dark'
)

// ── Circle ─────────────────────────────────────────────────
const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
const circle = computed(() => circlesData.value?.circles?.[0] ?? null)
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

const circleTypeLabel = computed(() => {
  const key = circle.value?.circle_type
  return key && CIRCLE_TYPE_KEYS[key] ? t(CIRCLE_TYPE_KEYS[key]) : ''
})

const circleTypeOptions = computed(() => [
  { value: 'parents',    label: t('circleType.parents.label'),    description: t('circleType.parents.description') },
  { value: 'couple',     label: t('circleType.couple.label'),     description: t('circleType.couple.description') },
  { value: 'family',     label: t('circleType.family.label'),     description: t('circleType.family.description') },
  { value: 'friends',    label: t('circleType.friends.label'),    description: t('circleType.friends.description') },
  { value: 'caregiving', label: t('circleType.caregiving.label'), description: t('circleType.caregiving.description') },
  { value: 'travel',     label: t('circleType.travel.label'),     description: t('circleType.travel.description') },
  { value: 'solo',       label: t('circleType.solo.label'),       description: t('circleType.solo.description') },
  { value: 'custom',     label: t('circleSettings.customTypeLabel'), description: t('circleSettings.customTypeDesc') },
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
    circleNameError.value = err?.data?.message ?? t('circleSettings.errorSaveCircleName')
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
    circleTypeError.value = err?.data?.message ?? t('circleSettings.errorSaveCircleType')
  } finally {
    savingCircleType.value = false
  }
}

// ── Members + memory count (for deletion warning) ──────────
type MembersResponse = { members: any[]; invites: any[]; myRole: string; memoryCount: number }
const { data: membersData } = await useAsyncData<MembersResponse>(
  'circle-settings-members',
  () => circleId.value
    ? $fetch<MembersResponse>(`/api/circles/${circleId.value}/members`)
    : Promise.resolve(null as any),
  { watch: [circleId] }
)

// Redirect non-owners away — this page is owner-only
watchEffect(() => {
  if (circle.value && !isOwner.value) {
    navigateTo('/members')
  }
})

// ── Children ───────────────────────────────────────────────
interface ChildProfile { id: string; name: string; date_of_birth: string }

const { data: childrenData, refresh: refreshChildren } = await useAsyncData<{ children: ChildProfile[] }>(
  'circle-settings-children',
  () => circleId.value
    ? $fetch<{ children: ChildProfile[] }>(`/api/circles/${circleId.value}/children`)
    : Promise.resolve({ children: [] }),
  { watch: [circleId] }
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
  if (!circleId.value || !editChildName.value.trim() || !editChildDob.value) return
  savingChildId.value = childId
  childrenError.value = ''
  try {
    await $fetch(`/api/circles/${circleId.value}/children/${childId}`, {
      method: 'PATCH',
      body: { name: editChildName.value.trim(), dateOfBirth: editChildDob.value },
    })
    await refreshChildren()
    cancelEditChild()
  } catch (err: any) {
    childrenError.value = err?.data?.message ?? t('circleSettings.errorUpdateChild')
  } finally {
    savingChildId.value = null
  }
}

function formatDob(dob: string) {
  return new Date(dob).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

async function addChild() {
  if (!circleId.value || !newChildName.value.trim() || !newChildDob.value) return
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
    childrenError.value = err?.data?.message ?? t('circleSettings.errorAddChild')
  } finally {
    addingChild.value = false
  }
}

async function removeChild(childId: string) {
  if (!circleId.value) return
  removingChildId.value = childId
  childrenError.value = ''
  try {
    await $fetch(`/api/circles/${circleId.value}/children/${childId}`, { method: 'DELETE' })
    await refreshChildren()
  } catch (err: any) {
    childrenError.value = err?.data?.message ?? t('circleSettings.errorRemoveChild')
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
    anniversaryError.value = err?.data?.message ?? t('circleSettings.errorSaveAnniversary')
  } finally {
    savingAnniversary.value = false
  }
}

async function clearAnniversary() {
  anniversaryDateInput.value = ''
  await saveAnniversary()
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
  if (deleteConfirmInput.value.trim().toLowerCase() !== circle.value.name.trim().toLowerCase()) {
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
