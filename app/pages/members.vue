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
          <span class="text-[9px] font-bold uppercase tracking-[.18em] text-accent">{{ circleName }}</span>
          <span class="mx-1 text-muted-foreground">·</span>
          <span class="text-[12px] font-medium text-foreground">{{ t('members.title') }}</span>
        </span>
        <!-- Right side: settings icon (owner only) -->
        <div class="flex w-12 items-center justify-end">
          <NuxtLink
            v-if="data?.myRole === 'owner'"
            :to="circleId ? `/circle-settings?circle=${circleId}` : '/circle-settings'"
            class="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            :title="t('nav.circleSettings')"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-[640px] px-5 py-8">
      <!-- Loading -->
      <div v-if="pending" class="flex justify-center py-24">
        <div class="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>

      <template v-else-if="data">
        <!-- Remove error -->
        <p v-if="removeError && !removeDialog" class="-mt-4 mb-4 text-xs text-destructive">
          {{ removeError }}
        </p>

        <!-- Hero card -->
        <div class="mb-8 overflow-hidden rounded-[18px] border border-border bg-card p-[16px_18px]">
          <!-- Kicker -->
          <p class="font-mono text-[9px] font-bold uppercase tracking-[.2em] text-muted-foreground">
            {{ circleName }}
          </p>
          <!-- Display title -->
          <h1 class="mt-1 font-serif text-[30px] italic leading-[1.1] text-foreground">
            {{ t('members.displayTitle') }}
          </h1>
          <!-- Meta line -->
          <p class="mt-2 font-mono text-[11px] text-muted-foreground">
            {{ metaText }}
          </p>
          <!-- Invite CTA -->
          <button
            v-if="canManage"
            class="mt-4 w-full rounded-full bg-foreground py-2.5 text-[13px] font-semibold text-background transition-opacity hover:opacity-80"
            @click="inviteOpen = true"
          >
            + {{ t('members.inviteCta') }}
          </button>
        </div>

        <!-- ACTIVE section -->
        <SettingsSection :label="t('members.sectionActive')">
          <component
            :is="canManage ? 'NuxtLink' : 'div'"
            v-for="m in data.members"
            :key="m.userId"
            :to="canManage ? (circleId ? `/member/${m.userId}?circle=${circleId}` : `/member/${m.userId}`) : undefined"
            class="flex items-center gap-3 px-[14px] py-[12px]"
            :class="canManage ? 'cursor-pointer transition-colors hover:bg-foreground/[.03]' : ''"
          >
            <!-- Avatar -->
            <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-[11px] font-bold text-foreground">
              <img v-if="m.avatarUrl" :src="m.avatarUrl" class="h-full w-full object-cover" />
              <span v-else>{{ initials(m) }}</span>
            </div>
            <!-- Name + hint -->
            <div class="min-w-0 flex-1">
              <p class="text-[14px] font-semibold text-foreground">
                <span class="truncate">{{ displayName(m) }}</span>
                <span v-if="m.userId === authUser?.sub" class="ml-1 font-mono text-[10px] tracking-[.16em] text-muted-foreground">YOU</span>
              </p>
              <p class="mt-0.5 text-[11px] text-muted-foreground">
                {{ t('members.joinedMeta', { date: joinedLabel(m.joinedAt) }) }}
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
            <!-- Chevron for owner-viewer rows or action buttons -->
            <div v-if="canManage" class="flex flex-shrink-0 items-center gap-1">
              <!-- Role action (owner only, non-self, non-owner target) -->
              <button
                v-if="data?.myRole === 'owner' && m.role !== 'owner' && m.userId !== authUser?.sub"
                class="rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-secondary hover:text-foreground"
                :title="m.role === 'admin' ? t('members.removeAdmin') : t('members.makeAdmin')"
                @click.prevent.stop="openRoleDialog(m)"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
              <!-- Remove button (admin/owner, non-self, non-owner target) -->
              <button
                v-if="m.role !== 'owner' && m.userId !== authUser?.sub"
                class="rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-secondary hover:text-destructive"
                @click.prevent.stop="openRemoveDialog(m)"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
              <svg class="h-3 w-3 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </component>
        </SettingsSection>

        <!-- PENDING section (owner/admin only, only if there are pending invites) -->
        <SettingsSection v-if="canManage && data.invites.length > 0" :label="t('members.sectionPending')">
          <div
            v-for="inv in data.invites"
            :key="inv.id"
            class="flex items-center gap-3 px-[14px] py-[12px] opacity-70"
          >
            <!-- Dashed placeholder avatar -->
            <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-dashed border-foreground/30 text-[14px] text-muted-foreground">
              +
            </div>
            <!-- Email + hint -->
            <div class="min-w-0 flex-1">
              <p class="truncate text-[14px] text-foreground">{{ inv.email }}</p>
              <p class="mt-0.5 text-[11px] text-muted-foreground">
                {{ t('members.invitedMeta', { ago: timeAgo(inv.created_at) }) }}
              </p>
            </div>
            <!-- Resend + cancel -->
            <div class="flex flex-shrink-0 items-center gap-1.5">
              <button
                class="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                :disabled="resendingEmail === inv.email"
                @click.stop="resendInvite(inv)"
              >
                {{ resendingEmail === inv.email ? '…' : t('members.resend') }}
              </button>
              <button
                class="rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-secondary hover:text-destructive disabled:opacity-40"
                :disabled="cancellingId === inv.id"
                @click="cancelInvite(inv)"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </SettingsSection>
      </template>
    </main>

    <!-- Role management dialog -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="roleDialog"
        class="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
      >
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="roleDialog = null" />
        <div class="relative w-full max-w-sm overflow-hidden rounded-[20px] border border-border bg-card shadow-2xl">
          <!-- Header -->
          <div class="border-b border-border px-6 pb-4 pt-6">
            <p class="text-sm font-semibold text-foreground">{{ displayName(roleDialog) }}</p>
            <p class="mt-0.5 text-xs text-muted-foreground">{{ roleLabel(roleDialog.role) }}</p>
          </div>

          <!-- Actions -->
          <div class="space-y-2 px-6 py-4">
            <!-- member → admin -->
            <button
              v-if="roleDialog.role === 'member'"
              class="w-full rounded-xl border border-border px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              :disabled="!!roleChangingId"
              @click="changeRole(roleDialog, 'admin')"
            >
              {{ t('members.makeAdmin') }}
            </button>

            <!-- admin → member -->
            <button
              v-if="roleDialog.role === 'admin'"
              class="w-full rounded-xl border border-border px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              :disabled="!!roleChangingId"
              @click="changeRole(roleDialog, 'member')"
            >
              {{ t('members.removeAdmin') }}
            </button>

            <!-- admin → owner (transfer) -->
            <template v-if="roleDialog.role === 'admin'">
              <div v-if="!transferConfirming" class="pt-1">
                <button
                  class="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  :disabled="!!roleChangingId"
                  @click="transferConfirming = true"
                >
                  {{ t('members.transferOwnership') }}
                </button>
              </div>
              <div v-else class="space-y-3 rounded-xl border border-border bg-secondary p-4 pt-1">
                <p class="text-sm font-semibold text-foreground">
                  {{ t('members.transferOwnershipTitle', { name: roleDialog.firstName }) }}
                </p>
                <p class="text-xs text-muted-foreground">{{ t('members.transferOwnershipDesc') }}</p>
                <div class="flex gap-2 pt-1">
                  <button
                    class="flex-1 rounded-lg border border-border py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                    @click="transferConfirming = false"
                  >
                    {{ t('nav.cancel') }}
                  </button>
                  <button
                    class="flex-1 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                    :disabled="!!roleChangingId"
                    @click="changeRole(roleDialog, 'owner')"
                  >
                    {{ roleChangingId ? '…' : t('members.confirm') }}
                  </button>
                </div>
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div class="px-6 pb-5">
            <p v-if="roleChangeError" class="mb-3 text-xs text-destructive">{{ roleChangeError }}</p>
            <button
              class="w-full rounded-[10px] border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              @click="roleDialog = null"
            >
              {{ t('nav.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Remove member content-choice dialog -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="removeDialog"
        class="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
      >
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="removeDialog = null" />
        <div class="relative w-full max-w-sm overflow-hidden rounded-[20px] border border-border bg-card shadow-2xl">
          <!-- Header -->
          <div class="border-b border-border px-6 pb-4 pt-6">
            <p class="mb-1 text-[10px] font-bold uppercase tracking-widest text-destructive">
              {{ t('members.removeAction') }}
            </p>
            <h2 class="text-base font-bold leading-snug text-foreground">
              {{ t('members.removeTitle', { name: removeDialog.firstName }) }}
            </h2>
            <p class="mt-1 text-xs text-muted-foreground">{{ t('members.removeContentQuestion') }}</p>
          </div>

          <!-- Choices -->
          <div class="space-y-2 px-6 py-4">
            <label
              class="flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all"
              :class="keepContent ? 'border-foreground bg-secondary' : 'border-border hover:border-foreground/30'"
            >
              <input type="radio" :value="true" v-model="keepContent" class="mt-0.5 accent-foreground" />
              <div>
                <p class="text-sm font-medium text-foreground">{{ t('members.removeKeepLabel') }}</p>
                <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">{{ t('members.removeKeepDesc') }}</p>
              </div>
            </label>

            <label
              class="flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all"
              :class="!keepContent ? 'border-destructive/50 bg-destructive/5' : 'border-border hover:border-foreground/30'"
            >
              <input type="radio" :value="false" v-model="keepContent" class="mt-0.5 accent-foreground" />
              <div>
                <p class="text-sm font-medium text-foreground">{{ t('members.removeDeleteLabel') }}</p>
                <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">{{ t('members.removeDeleteDesc') }}</p>
              </div>
            </label>

            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
            >
              <div
                v-if="!keepContent"
                class="bg-destructive/8 flex items-start gap-2 rounded-xl border border-destructive/20 px-3.5 py-3"
              >
                <svg class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-destructive" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <p class="text-xs leading-relaxed text-destructive">{{ t('members.removeDeleteWarning') }}</p>
              </div>
            </Transition>
          </div>

          <!-- Footer -->
          <div class="space-y-2.5 px-6 pb-6">
            <p class="text-xs text-muted-foreground">{{ t('members.removeNotification') }}</p>
            <p v-if="removeError" class="text-xs text-destructive">{{ removeError }}</p>
            <div class="flex gap-2 pt-1">
              <button
                type="button"
                class="flex-1 rounded-[10px] border border-border py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                @click="removeDialog = null"
              >
                {{ t('nav.cancel') }}
              </button>
              <button
                :disabled="!!removingId"
                class="flex-1 rounded-[10px] bg-destructive py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                @click="removeMember(removeDialog)"
              >
                {{ removingId ? t('members.removing') : t('members.removeConfirm') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Invite dialog -->
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
            {{ t('nav.inviteDesc', { circle: circleName }) }}
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
  </div>
</template>

<script setup lang="ts">
import { useAnalytics } from '~/composables/useAnalytics'
import { useToast } from '~/components/ui/toast'
definePageMeta({})
const { t, locale } = useI18n()
const { track } = useAnalytics()
const { toast } = useToast()

const router = useRouter()
const authUser = useSupabaseUser()

// ── Circle ─────────────────────────────────────────────────
const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
// Prefer ?circle=<id> from the URL so this page always reflects the circle
// the user was viewing on the timeline. Falls back to circles[0] when the
// param is missing or stale.
const route = useRoute()
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
const circleName = computed(() => circle.value?.name ?? 'your circle')

// ── Members data ───────────────────────────────────────────
type MembersResponse = {
  members: any[]
  invites: any[]
  myRole: string
  memoryCount: number
}
const { data, pending, refresh } = await useAsyncData<MembersResponse>(
  'circle-members',
  () =>
    circleId.value
      ? $fetch<MembersResponse>(`/api/circles/${circleId.value}/members`)
      : Promise.resolve(null as any),
  { watch: [circleId] },
)

const canManage = computed(
  () => data.value?.myRole === 'owner' || data.value?.myRole === 'admin',
)

// ── Meta line helpers ──────────────────────────────────────
function sinceLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(locale.value, { month: 'short', year: 'numeric' })
}

/** Earliest joinedAt across all members = circle creation date */
const sinceText = computed(() => {
  const members = data.value?.members ?? []
  if (!members.length) return ''
  const earliest = members.reduce((min: string, m: any) =>
    m.joinedAt < min ? m.joinedAt : min, members[0].joinedAt)
  return sinceLabel(earliest)
})

const metaText = computed(() => {
  return t('members.meta', {
    active: data.value?.members.length ?? 0,
    pending: data.value?.invites.length ?? 0,
    since: sinceText.value,
  })
})

// ── Display helpers ────────────────────────────────────────
function displayName(member: any): string {
  const parts = [member.firstName, member.lastName].filter(Boolean)
  return parts.length
    ? parts.join(' ')
    : member.firstName || t('common.unknown')
}

function initials(member: any): string {
  const first = member.firstName?.[0] ?? ''
  const last = member.lastName?.[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

function joinedLabel(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString(locale.value, {
    month: 'short',
    year: '2-digit',
  })
}

function roleLabel(role: string): string {
  if (role === 'owner') return t('members.roleOwner')
  if (role === 'admin') return t('members.roleAdmin')
  return t('members.roleMember')
}

function timeAgo(dateStr: string, future = false): string {
  const diff = Math.abs(Date.now() - new Date(dateStr).getTime())
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor(diff / 3_600_000)
  const mins = Math.floor(diff / 60_000)
  if (future) {
    if (days > 0) return t('common.inDays', { n: days })
    if (hours > 0) return t('common.inHours', { n: hours })
    return t('common.inMins', { n: mins })
  }
  if (days > 0) return t('common.daysAgo', { n: days })
  if (hours > 0) return t('common.hoursAgo', { n: hours })
  return t('common.minsAgo', { n: mins })
}

// ── Role management ───────────────────────────────────────
const roleDialog = ref<{
  userId: string
  firstName: string
  lastName?: string | null
  role: string
} | null>(null)
const roleChangingId = ref<string | null>(null)
const roleChangeError = ref('')
const transferConfirming = ref(false)

function openRoleDialog(member: any) {
  roleDialog.value = {
    userId: member.userId,
    firstName: member.firstName,
    lastName: member.lastName,
    role: member.role,
  }
  roleChangeError.value = ''
  transferConfirming.value = false
}

async function changeRole(
  member: { userId: string; role: string } | null,
  newRole: string,
) {
  if (!circleId.value || !member) return
  roleChangingId.value = member.userId
  roleChangeError.value = ''
  try {
    await $fetch(`/api/circles/${circleId.value}/members/${member.userId}`, {
      method: 'PATCH',
      body: { role: newRole },
    })
    roleDialog.value = null
    await refresh()
  } catch (err: any) {
    roleChangeError.value = err?.data?.message ?? t('members.roleChangeError')
  } finally {
    roleChangingId.value = null
    transferConfirming.value = false
  }
}

// ── Remove member ──────────────────────────────────────────
const removingId = ref<string | null>(null)
const removeError = ref('')
const removeDialog = ref<{ userId: string; firstName: string } | null>(null)
const keepContent = ref(true)

function openRemoveDialog(member: any) {
  removeDialog.value = { userId: member.userId, firstName: member.firstName }
  keepContent.value = true
  removeError.value = ''
}

async function removeMember(member: { userId: string } | null) {
  if (!circleId.value || !member) return
  removingId.value = member.userId
  removeError.value = ''
  try {
    await $fetch(`/api/circles/${circleId.value}/members/${member.userId}`, {
      method: 'DELETE',
      body: { keepContent: keepContent.value },
    })
    removeDialog.value = null
    await refresh()
  } catch (err: any) {
    removeError.value = err?.data?.message ?? t('members.removeError')
  } finally {
    removingId.value = null
  }
}

// ── Cancel invite ──────────────────────────────────────────
const cancellingId = ref<string | null>(null)

async function cancelInvite(invite: any) {
  if (!circleId.value) return
  cancellingId.value = invite.id
  try {
    await $fetch(`/api/circles/${circleId.value}/invites/${invite.id}`, {
      method: 'DELETE',
    })
    await refresh()
  } catch (err: any) {
    toast({
      description: err?.data?.message ?? t('members.cancelInviteError'),
      variant: 'destructive',
    })
  } finally {
    cancellingId.value = null
  }
}

// ── Resend invite ──────────────────────────────────────────
const resendingEmail = ref<string | null>(null)

async function resendInvite(invite: any) {
  if (!circleId.value) return
  resendingEmail.value = invite.email
  try {
    await $fetch('/api/circles/invite', {
      method: 'POST',
      body: { circleId: circleId.value, email: invite.email },
    })
    track('member_invited', {
      circle_id: circleId.value,
      invite_method: 'link',
    })
    await refresh()
  } catch (err: any) {
    toast({
      description: err?.data?.message ?? t('members.resendInviteError'),
      variant: 'destructive',
    })
  } finally {
    resendingEmail.value = null
  }
}

// ── Invite dialog ──────────────────────────────────────────
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
    track('member_invited', {
      circle_id: circleId.value,
      invite_method: 'link',
    })
    inviteSentTo.value = inviteEmail.value
    inviteEmail.value = ''
    await refresh()
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
</script>
