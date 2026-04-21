<template>
  <div class="min-h-screen bg-background">

    <!-- Header -->
    <header class="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border">
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

          <!-- Circle info (read-only for now) -->
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

          <!-- Children (baby age stamps) — owner only -->
          <div v-if="isOwner">
            <h2 class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">
              Children
            </h2>
            <p class="text-xs text-muted-foreground mb-4">
              Add each child's name and date of birth. Memory cards will show their age at the time of the photo.
            </p>

            <!-- Existing children list -->
            <div v-if="children.length" class="space-y-2 mb-4">
              <div
                v-for="child in children"
                :key="child.id"
                class="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-border bg-secondary/40"
              >
                <div class="min-w-0">
                  <p class="text-sm font-medium text-foreground truncate">{{ child.name }}</p>
                  <p class="text-xs text-muted-foreground">{{ formatDob(child.date_of_birth) }}</p>
                </div>
                <button
                  class="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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

            <!-- Add child form -->
            <div v-if="children.length < 10" class="flex flex-col gap-2">
              <div class="flex gap-2">
                <input
                  v-model="newChildName"
                  type="text"
                  placeholder="Name"
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
                {{ addingChild ? '…' : '+ Add child' }}
              </button>
            </div>
            <p v-else class="text-xs text-muted-foreground">Maximum of 10 children reached.</p>

            <p v-if="childrenError" class="text-xs text-destructive mt-2">{{ childrenError }}</p>
          </div>

          <div v-if="isOwner" class="h-px bg-border" />

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
    childrenError.value = err?.data?.message ?? 'Failed to add child. Please try again.'
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
    childrenError.value = err?.data?.message ?? 'Failed to remove child. Please try again.'
  } finally {
    removingChildId.value = null
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
