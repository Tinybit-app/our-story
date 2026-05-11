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

        <p class="flex-1 text-sm font-semibold text-foreground text-center">{{ t('members.title') }}</p>

        <!-- Right side: invite + settings (owner/admin only) -->
        <div class="flex items-center gap-2">
          <button
            v-if="canManage"
            class="flex items-center gap-1.5 text-sm font-medium text-foreground hover:opacity-70 transition-opacity"
            @click="inviteOpen = true"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
            {{ t('members.invite') }}
          </button>
          <!-- Circle settings link (owner only) -->
          <NuxtLink
            v-if="data?.myRole === 'owner'"
            to="/circle-settings"
            class="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
            :title="t('nav.circleSettings')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </NuxtLink>
          <div v-if="!canManage" class="w-12" />
        </div>
      </div>
    </header>

    <main class="max-w-[1280px] mx-auto px-5 py-6 space-y-8">

      <!-- Loading -->
      <div v-if="pending" class="flex justify-center py-24">
        <div class="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>

      <template v-else-if="data">

        <!-- Remove error -->
        <p v-if="removeError" class="text-xs text-destructive -mb-4">{{ removeError }}</p>

        <!-- Active members -->
        <section>
          <p class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-4">
            {{ t('members.count', data.members.length) }}
          </p>
          <ul class="space-y-1">
            <li
              v-for="member in data.members"
              :key="member.id"
              class="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-secondary/60 transition-colors -mx-3 cursor-pointer"
              @click="router.push(`/member/${member.userId}`)"
            >
              <!-- Avatar -->
              <div class="w-11 h-11 rounded-full overflow-hidden ring-2 ring-border flex-shrink-0 flex items-center justify-center bg-secondary">
                <img v-if="member.avatarUrl" :src="member.avatarUrl" class="w-full h-full object-cover" />
                <span v-else class="text-xs font-bold text-foreground">{{ initials(member) }}</span>
              </div>

              <!-- Name + role -->
              <div class="flex-1 min-w-0 flex items-center gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-foreground leading-none truncate">
                    {{ displayName(member) }}
                    <span v-if="member.userId === authUser?.sub" class="text-muted-foreground font-normal"> {{ t('members.you') }}</span>
                  </p>
                </div>
                <span :class="roleBadgeClass(member.role)" class="flex-shrink-0 text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full">
                  {{ roleLabel(member.role) }}
                </span>
              </div>

              <!-- Role action button (owner only, non-self, non-owner targets) -->
              <button
                v-if="data?.myRole === 'owner' && member.role !== 'owner' && member.userId !== authUser?.sub"
                class="p-1.5 text-muted-foreground/50 hover:text-foreground transition-colors rounded-lg hover:bg-secondary flex-shrink-0"
                @click.stop="openRoleDialog(member)"
                :title="member.role === 'admin' ? t('members.removeAdmin') : t('members.makeAdmin')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </button>

              <!-- Remove button -->
              <button
                v-if="canManage && member.role !== 'owner' && !(member.userId === authUser?.sub)"
                class="p-1.5 text-muted-foreground/50 hover:text-destructive transition-colors rounded-lg hover:bg-secondary flex-shrink-0"
                @click.stop="openRemoveDialog(member)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </li>
          </ul>
        </section>

        <!-- Pending invites (owner/admin only) -->
        <section v-if="canManage && data.invites.length > 0">
          <p class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-4">
            {{ t('members.pendingInvites') }}
          </p>
          <ul class="space-y-1">
            <li
              v-for="invite in data.invites"
              :key="invite.id"
              class="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-secondary/60 transition-colors -mx-3"
            >
              <!-- Placeholder avatar -->
              <div class="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center bg-secondary border-2 border-dashed border-border">
                <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                </svg>
              </div>

              <!-- Email + expiry -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-foreground leading-none truncate">{{ invite.email }}</p>
                <p class="text-xs text-muted-foreground mt-1">
                  {{ t('members.invited', { time: timeAgo(invite.created_at) }) }} · {{ t('members.expires', { time: timeAgo(invite.expires_at, true) }) }}
                </p>
              </div>

              <!-- Resend + cancel -->
              <div class="flex items-center gap-1.5 flex-shrink-0">
                <button
                  class="px-3 py-1.5 text-xs font-semibold text-foreground bg-secondary hover:bg-border rounded-lg transition-colors disabled:opacity-50"
                  :disabled="resendingEmail === invite.email"
                  @click="resendInvite(invite)"
                >
                  {{ resendingEmail === invite.email ? '…' : t('members.resend') }}
                </button>
                <button
                  class="p-1.5 text-muted-foreground/50 hover:text-destructive transition-colors rounded-lg hover:bg-secondary"
                  :disabled="cancellingId === invite.id"
                  @click="cancelInvite(invite)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </li>
          </ul>
        </section>

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
      <div v-if="roleDialog" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="roleDialog = null" />
        <div class="relative w-full max-w-sm bg-card border border-border rounded-[20px] shadow-2xl overflow-hidden">

          <!-- Header -->
          <div class="px-6 pt-6 pb-4 border-b border-border">
            <p class="text-sm font-semibold text-foreground">{{ displayName(roleDialog) }}</p>
            <p class="text-xs text-muted-foreground mt-0.5">{{ roleLabel(roleDialog.role) }}</p>
          </div>

          <!-- Actions -->
          <div class="px-6 py-4 space-y-2">
            <!-- member → admin -->
            <button
              v-if="roleDialog.role === 'member'"
              class="w-full text-left px-4 py-3 rounded-xl border border-border hover:bg-secondary text-sm font-medium text-foreground transition-colors"
              :disabled="!!roleChangingId"
              @click="changeRole(roleDialog, 'admin')"
            >
              {{ t('members.makeAdmin') }}
            </button>

            <!-- admin → member -->
            <button
              v-if="roleDialog.role === 'admin'"
              class="w-full text-left px-4 py-3 rounded-xl border border-border hover:bg-secondary text-sm font-medium text-foreground transition-colors"
              :disabled="!!roleChangingId"
              @click="changeRole(roleDialog, 'member')"
            >
              {{ t('members.removeAdmin') }}
            </button>

            <!-- admin → owner (transfer) -->
            <template v-if="roleDialog.role === 'admin'">
              <div v-if="!transferConfirming" class="pt-1">
                <button
                  class="w-full text-left px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-sm font-medium text-amber-700 dark:text-amber-300 transition-colors"
                  :disabled="!!roleChangingId"
                  @click="transferConfirming = true"
                >
                  {{ t('members.transferOwnership') }}
                </button>
              </div>
              <div v-else class="pt-1 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-3">
                <p class="text-sm font-semibold text-amber-700 dark:text-amber-300">
                  {{ t('members.transferOwnershipTitle', { name: roleDialog.firstName }) }}
                </p>
                <p class="text-xs text-amber-600 dark:text-amber-400">{{ t('members.transferOwnershipDesc') }}</p>
                <div class="flex gap-2 pt-1">
                  <button
                    class="flex-1 py-2 rounded-lg text-xs font-medium border border-border text-foreground hover:bg-secondary transition-colors"
                    @click="transferConfirming = false"
                  >
                    {{ t('nav.cancel') }}
                  </button>
                  <button
                    class="flex-1 py-2 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:opacity-90 transition-opacity disabled:opacity-40"
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
            <p v-if="roleChangeError" class="text-xs text-destructive mb-3">{{ roleChangeError }}</p>
            <button
              class="w-full py-2.5 rounded-[10px] text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
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
      <div v-if="removeDialog" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="removeDialog = null" />
        <div class="relative w-full max-w-sm bg-card border border-border rounded-[20px] shadow-2xl overflow-hidden">

          <!-- Header -->
          <div class="px-6 pt-6 pb-4 border-b border-border">
            <p class="text-[10px] font-bold tracking-widest uppercase text-destructive mb-1">{{ t('members.removeAction') }}</p>
            <h2 class="text-base font-bold text-foreground leading-snug">
              {{ t('members.removeTitle', { name: removeDialog.firstName }) }}
            </h2>
            <p class="text-xs text-muted-foreground mt-1">{{ t('members.removeContentQuestion') }}</p>
          </div>

          <!-- Choices -->
          <div class="px-6 py-4 space-y-2">
            <label
              class="flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all"
              :class="keepContent ? 'border-foreground bg-secondary' : 'border-border hover:border-foreground/30'"
            >
              <input type="radio" :value="true" v-model="keepContent" class="mt-0.5 accent-foreground" />
              <div>
                <p class="text-sm font-medium text-foreground">{{ t('members.removeKeepLabel') }}</p>
                <p class="text-xs text-muted-foreground mt-0.5 leading-relaxed">{{ t('members.removeKeepDesc') }}</p>
              </div>
            </label>

            <label
              class="flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all"
              :class="!keepContent ? 'border-destructive/50 bg-destructive/5' : 'border-border hover:border-foreground/30'"
            >
              <input type="radio" :value="false" v-model="keepContent" class="mt-0.5 accent-foreground" />
              <div>
                <p class="text-sm font-medium text-foreground">{{ t('members.removeDeleteLabel') }}</p>
                <p class="text-xs text-muted-foreground mt-0.5 leading-relaxed">{{ t('members.removeDeleteDesc') }}</p>
              </div>
            </label>

            <!-- Irreversibility warning shown when "remove" is selected -->
            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
            >
              <div v-if="!keepContent" class="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-destructive/8 border border-destructive/20">
                <svg class="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p class="text-xs text-destructive leading-relaxed">{{ t('members.removeDeleteWarning') }}</p>
              </div>
            </Transition>
          </div>

          <!-- Footer -->
          <div class="px-6 pb-6 space-y-2.5">
            <p class="text-xs text-muted-foreground">{{ t('members.removeNotification') }}</p>
            <p v-if="removeError" class="text-xs text-destructive">{{ removeError }}</p>
            <div class="flex gap-2 pt-1">
              <button
                type="button"
                class="flex-1 py-3 rounded-[10px] text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
                @click="removeDialog = null"
              >
                {{ t('nav.cancel') }}
              </button>
              <button
                :disabled="!!removingId"
                class="flex-1 py-3 rounded-[10px] text-sm font-semibold bg-destructive text-white hover:opacity-90 transition-opacity disabled:opacity-40"
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
      <div v-if="inviteOpen" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closeInvite" />
        <div class="relative w-full max-w-sm bg-card border border-border rounded-[20px] p-6 shadow-2xl">
          <h2 class="font-display text-lg font-bold text-foreground mb-1">{{ t('nav.inviteSomeone') }}</h2>
          <p class="text-xs text-muted-foreground mb-5">{{ t('nav.inviteDesc', { circle: circleName }) }}</p>

          <form @submit.prevent="sendInvite">
            <input
              v-model="inviteEmail"
              type="email"
              placeholder="their@email.com"
              required
              :disabled="inviteSending"
              class="w-full bg-background border border-border rounded-[10px] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-3 disabled:opacity-50"
            />
            <p v-if="inviteError" class="text-xs text-destructive mb-3">{{ inviteError }}</p>
            <p v-if="inviteSentTo" class="text-xs text-green-600 dark:text-green-400 mb-3">{{ t('nav.inviteSentTo', { email: inviteSentTo }) }}</p>

            <div class="flex gap-2">
              <button type="button" class="flex-1 py-3 rounded-[10px] text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors" @click="closeInvite">{{ t('nav.cancel') }}</button>
              <button type="submit" :disabled="inviteSending || !inviteEmail" class="flex-1 py-3 rounded-[10px] text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40">
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
import { useAnalytics } from "~/composables/useAnalytics"
definePageMeta({})
const { t } = useI18n()
const { track } = useAnalytics()

const router = useRouter()
const authUser = useSupabaseUser()

// ── Circle ─────────────────────────────────────────────────
const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
const circle = computed(() => circlesData.value?.circles?.[0] ?? null)
const circleId = computed<string | null>(() => circle.value?.id ?? null)
const circleName = computed(() => circle.value?.name ?? 'your circle')

// ── Members data ───────────────────────────────────────────
type MembersResponse = { members: any[]; invites: any[]; myRole: string; memoryCount: number }
const { data, pending, refresh } = await useAsyncData<MembersResponse>(
  'circle-members',
  () => circleId.value
    ? $fetch<MembersResponse>(`/api/circles/${circleId.value}/members`)
    : Promise.resolve(null as any),
  { watch: [circleId] }
)

const canManage = computed(() =>
  data.value?.myRole === 'owner' || data.value?.myRole === 'admin'
)

// ── Display helpers ────────────────────────────────────────
function displayName(member: any): string {
  const parts = [member.firstName, member.lastName].filter(Boolean)
  return parts.length ? parts.join(' ') : member.firstName || t('common.unknown')
}

function initials(member: any): string {
  const first = member.firstName?.[0] ?? ''
  const last = member.lastName?.[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

function roleBadgeClass(role: string): string {
  switch (role) {
    case 'owner':   return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    case 'admin':   return 'bg-secondary text-foreground'
    case 'caregiver': return 'bg-sky-100/60 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
    default:        return 'bg-border/60 text-muted-foreground'
  }
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
const roleDialog = ref<{ userId: string; firstName: string; lastName?: string | null; role: string } | null>(null)
const roleChangingId = ref<string | null>(null)
const roleChangeError = ref('')
const transferConfirming = ref(false)

function openRoleDialog(member: any) {
  roleDialog.value = { userId: member.userId, firstName: member.firstName, lastName: member.lastName, role: member.role }
  roleChangeError.value = ''
  transferConfirming.value = false
}

async function changeRole(member: { userId: string; role: string } | null, newRole: string) {
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
    await $fetch(`/api/circles/${circleId.value}/invites/${invite.id}`, { method: 'DELETE' })
    await refresh()
  } catch (err: any) {
    alert(err?.data?.message ?? t('members.cancelInviteError'))
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
    track("member_invited", {
      circle_id: circleId.value,
      invite_method: "link",
    })
    await refresh()
  } catch (err: any) {
    alert(err?.data?.message ?? t('members.resendInviteError'))
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
    track("member_invited", {
      circle_id: circleId.value,
      invite_method: "link",
    })
    inviteSentTo.value = inviteEmail.value
    inviteEmail.value = ''
    await refresh()
  } catch (err: any) {
    const msg = err?.data?.message ?? ''
    if (msg.includes('already been sent')) inviteError.value = t('nav.inviteAlreadySent')
    else if (msg.includes('Max 10')) inviteError.value = t('nav.inviteMaxPending')
    else inviteError.value = t('nav.inviteFailed')
  } finally {
    inviteSending.value = false
  }
}
</script>
