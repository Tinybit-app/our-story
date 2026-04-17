<template>
  <div class="min-h-screen bg-background">

    <!-- Header -->
    <header class="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border">
      <div class="max-w-5xl mx-auto px-5 h-14 flex items-center gap-3">
        <button
          class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
          @click="router.back()"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          Back
        </button>

        <p class="flex-1 text-sm font-semibold text-foreground text-center">Members</p>

        <!-- Invite button (owner/admin only) -->
        <button
          v-if="canManage"
          class="flex items-center gap-1.5 text-sm font-medium text-foreground hover:opacity-70 transition-opacity"
          @click="inviteOpen = true"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
          Invite
        </button>
        <div v-else class="w-12" />
      </div>
    </header>

    <main class="max-w-5xl mx-auto px-5 py-6 space-y-8">

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
            {{ data.members.length }} {{ data.members.length === 1 ? 'Member' : 'Members' }}
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
                    <span v-if="member.userId === authUser?.sub" class="text-muted-foreground font-normal"> (you)</span>
                  </p>
                </div>
                <span :class="roleBadgeClass(member.role)" class="flex-shrink-0 text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full capitalize">
                  {{ member.role }}
                </span>
              </div>

              <!-- Remove button / inline confirm -->
              <template v-if="canManage && member.role !== 'owner' && !(member.userId === authUser?.sub)">
                <div v-if="confirmRemoveId === member.userId" class="flex items-center gap-1.5 flex-shrink-0" @click.stop>
                  <span class="text-xs text-muted-foreground">Remove?</span>
                  <button
                    class="px-2.5 py-1 text-xs font-semibold text-destructive border border-destructive/40 rounded-lg hover:bg-destructive/10 transition-colors"
                    :disabled="removingId === member.userId"
                    @click="removeMember(member)"
                  >
                    <svg v-if="removingId === member.userId" class="w-3 h-3 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    <span v-else>Yes</span>
                  </button>
                  <button
                    class="px-2.5 py-1 text-xs font-medium text-foreground border border-border rounded-lg hover:bg-secondary transition-colors"
                    @click="confirmRemoveId = null"
                  >
                    No
                  </button>
                </div>
                <button
                  v-else
                  class="p-1.5 text-muted-foreground/50 hover:text-destructive transition-colors rounded-lg hover:bg-secondary flex-shrink-0"
                  @click.stop="confirmRemoveId = member.userId"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </template>
            </li>
          </ul>
        </section>

        <!-- Pending invites (owner/admin only) -->
        <section v-if="canManage && data.invites.length > 0">
          <p class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-4">
            Pending invites
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
                  Invited {{ timeAgo(invite.created_at) }} · expires {{ timeAgo(invite.expires_at, true) }}
                </p>
              </div>

              <!-- Resend + cancel -->
              <div class="flex items-center gap-1.5 flex-shrink-0">
                <button
                  class="px-3 py-1.5 text-xs font-semibold text-foreground bg-secondary hover:bg-border rounded-lg transition-colors disabled:opacity-50"
                  :disabled="resendingEmail === invite.email"
                  @click="resendInvite(invite)"
                >
                  {{ resendingEmail === invite.email ? '…' : 'Resend' }}
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
          <h2 class="font-display text-lg font-bold text-foreground mb-1">Invite someone</h2>
          <p class="text-xs text-muted-foreground mb-5">They'll get a link to join {{ circleName }}.</p>

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
            <p v-if="inviteSentTo" class="text-xs text-green-600 dark:text-green-400 mb-3">Invite sent to {{ inviteSentTo }}.</p>

            <div class="flex gap-2">
              <button type="button" class="flex-1 py-3 rounded-[10px] text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors" @click="closeInvite">Cancel</button>
              <button type="submit" :disabled="inviteSending || !inviteEmail" class="flex-1 py-3 rounded-[10px] text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40">
                {{ inviteSending ? 'Sending…' : 'Send invite' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup lang="ts">
definePageMeta({})

const router = useRouter()
const authUser = useSupabaseUser()

// ── Circle ─────────────────────────────────────────────────
const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
const circle = computed(() => circlesData.value?.circles?.[0] ?? null)
const circleId = computed<string | null>(() => circle.value?.id ?? null)
const circleName = computed(() => circle.value?.name ?? 'your circle')

// ── Members data ───────────────────────────────────────────
const { data, pending, refresh } = await useAsyncData(
  'circle-members',
  () => circleId.value
    ? $fetch<{ members: any[]; invites: any[]; myRole: string }>(`/api/circles/${circleId.value}/members`)
    : null,
  { watch: [circleId] }
)

const canManage = computed(() =>
  data.value?.myRole === 'owner' || data.value?.myRole === 'admin'
)

// ── Display helpers ────────────────────────────────────────
function displayName(member: any): string {
  const parts = [member.firstName, member.lastName].filter(Boolean)
  return parts.length ? parts.join(' ') : member.firstName || 'Unknown'
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

function timeAgo(dateStr: string, future = false): string {
  const diff = Math.abs(Date.now() - new Date(dateStr).getTime())
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor(diff / 3_600_000)
  const mins = Math.floor(diff / 60_000)
  if (future) {
    if (days > 0) return `in ${days}d`
    if (hours > 0) return `in ${hours}h`
    return `in ${mins}m`
  }
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  return `${mins}m ago`
}

// ── Remove member ──────────────────────────────────────────
const removingId = ref<string | null>(null)
const confirmRemoveId = ref<string | null>(null)
const removeError = ref('')

async function removeMember(member: any) {
  if (!circleId.value) return
  removingId.value = member.userId
  try {
    await $fetch(`/api/circles/${circleId.value}/members/${member.userId}`, { method: 'DELETE' })
    confirmRemoveId.value = null
    await refresh()
  } catch (err: any) {
    removeError.value = err?.data?.message ?? 'Failed to remove member.'
    confirmRemoveId.value = null
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
    alert(err?.data?.message ?? 'Failed to cancel invite.')
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
    await refresh()
  } catch (err: any) {
    alert(err?.data?.message ?? 'Failed to resend invite.')
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
    inviteSentTo.value = inviteEmail.value
    inviteEmail.value = ''
    await refresh()
  } catch (err: any) {
    const msg = err?.data?.message ?? ''
    if (msg.includes('already been sent')) inviteError.value = 'An invite was already sent to this email.'
    else if (msg.includes('Max 10')) inviteError.value = 'You have 10 pending invites. Wait for some to be accepted first.'
    else inviteError.value = 'Failed to send invite. Please try again.'
  } finally {
    inviteSending.value = false
  }
}
</script>
