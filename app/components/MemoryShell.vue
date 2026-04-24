<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <!-- Backdrop -->
      <div
        ref="backdropEl"
        class="absolute inset-0 cursor-pointer"
        style="background: rgba(0,0,0,0); transition: background 300ms ease, backdrop-filter 300ms ease;"
        @click="close"
      />

      <!-- Prev arrow -->
      <button
        v-if="hasPrev"
        class="absolute left-3 sm:left-6 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all backdrop-blur-sm"
        style="top: 50%; transform: translateY(-50%)"
        @click.stop="navigate('prev')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <!-- Next arrow -->
      <button
        v-if="hasNext"
        class="absolute right-3 sm:right-6 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all backdrop-blur-sm"
        style="top: 50%; transform: translateY(-50%)"
        @click.stop="navigate('next')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      <!-- Card — opacity-0 via Tailwind so JS animation owns opacity without reactive conflicts -->
      <div
        ref="cardEl"
        class="relative z-10 bg-card will-change-transform flex flex-col opacity-0"
        :style="cardSizeStyle"
        @click.stop
      >
        <!-- Pin -->
        <div
          class="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#d64040] dark:bg-[#e05454] shadow-[0_2px_8px_rgba(214,64,64,.5)] opacity-90 z-20"
        />

        <!-- Close -->
        <button
          class="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-foreground text-background hover:opacity-80 transition-opacity"
          @click="close"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <!-- Content — :key resets all local state on navigation -->
        <MemoryModal
          v-if="currentMemory && !isQuickNote"
          :key="currentMemory.id"
          :memory="currentMemory"
          :children="children"
          :members="members"
          :current-user-id="currentUserId"
          :self-avatar-url="selfAvatarUrl"
          :self-initials="selfInitials"
          @update="emit('update', $event)"
        />
        <QuickNoteModal
          v-else-if="currentMemory && isQuickNote"
          :key="currentMemory.id"
          :memory="currentMemory"
          :children="children"
          :members="members"
          :current-user-id="currentUserId"
          :self-avatar-url="selfAvatarUrl"
          :self-initials="selfInitials"
          @update="emit('update', $event)"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Memory } from '~/composables/useTimeline'

interface ChildProfile { id: string; name: string; date_of_birth: string }
interface CircleMember { userId: string; firstName: string | null; lastName: string | null; avatarUrl: string | null }

const props = defineProps<{
  memories: Memory[]
  startIndex: number | null
  originRect: DOMRect | null
  tilt: number
  children?: ChildProfile[]
  members?: CircleMember[]
}>()

const emit = defineEmits<{
  close: []
  update: [Pick<Memory, 'id'> & Partial<Memory>]
}>()

// ── Auth + profile (fetched once, passed down to content) ──
const supabaseClient = useSupabaseClient()
const currentUserId = ref<string | null>(useSupabaseUser().value?.id ?? null)
if (!currentUserId.value) {
  supabaseClient.auth.getSession().then(({ data }) => {
    currentUserId.value = data.session?.user?.id ?? null
  })
}

const selfAvatarUrl = ref<string | null>(null)
const selfInitials = ref('?')
supabaseClient.auth.getSession().then(async ({ data }) => {
  if (!data.session?.user?.id) return
  try {
    const profile = await $fetch<{ avatarUrl: string | null; firstName: string | null; lastName: string | null }>('/api/profile')
    selfAvatarUrl.value = profile.avatarUrl
    const parts = [profile.firstName, profile.lastName].filter(Boolean)
    selfInitials.value = parts.map(p => p![0]).join('').toUpperCase() || '?'
  } catch { /* non-critical */ }
})

// ── Core state ─────────────────────────────────────────────
const cardEl = ref<HTMLElement>()
const backdropEl = ref<HTMLElement>()
const visible = ref(false)
const navigating = ref(false)
const currentIndex = ref(0)

// ── Derived ────────────────────────────────────────────────
const currentMemory = computed(() => props.memories[currentIndex.value] ?? null)
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value < props.memories.length - 1)
const isQuickNote = computed(() => {
  const m = currentMemory.value
  return !!m && !m.memorymedia.length && !!m.note
})

// Sizing changes between quick note and photo/video card types.
// The switch happens while opacity is 0 (mid-navigation), so it's invisible.
const cardSizeStyle = computed(() =>
  isQuickNote.value
    ? { width: '100%', maxWidth: '520px', minHeight: '420px', maxHeight: '82vh' }
    : { width: '100%', height: '100%', maxWidth: '750px', maxHeight: '75vh', padding: '12px 12px 0' }
)

// ── Enter animation ────────────────────────────────────────
async function runEnterAnimation() {
  const el = cardEl.value
  const bd = backdropEl.value
  if (!el) return

  const targetRect = el.getBoundingClientRect()

  if (props.originRect) {
    const srcCX = props.originRect.left + props.originRect.width / 2
    const srcCY = props.originRect.top + props.originRect.height / 2
    const tgtCX = targetRect.left + targetRect.width / 2
    const tgtCY = targetRect.top + targetRect.height / 2
    const dx = srcCX - tgtCX
    const dy = srcCY - tgtCY
    const scale = props.originRect.width / targetRect.width
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${props.tilt}deg)`
    el.style.opacity = '0.9'
    el.style.boxShadow = '0 4px 16px rgba(44,36,32,.14)'
    el.getBoundingClientRect()
  } else {
    el.style.transform = 'scale(0.9) rotate(-1deg)'
    el.style.opacity = '0'
    el.getBoundingClientRect()
  }

  el.style.transition = 'transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 280ms ease, box-shadow 420ms ease'
  el.style.transform = 'none'
  el.style.opacity = '1'
  el.style.boxShadow = '0 28px 80px rgba(44,36,32,.38), 0 6px 20px rgba(44,36,32,.18)'

  if (bd) {
    bd.getBoundingClientRect()
    bd.style.transition = 'background 300ms ease, backdrop-filter 300ms ease'
    bd.style.background = 'rgba(0,0,0,0.6)'
    bd.style.backdropFilter = 'blur(6px)'
  }
}

// ── Navigation (unified — works for both photo↔note transitions) ──
async function navigate(dir: 'prev' | 'next') {
  if (navigating.value) return
  const newIdx = dir === 'prev' ? currentIndex.value - 1 : currentIndex.value + 1
  if (newIdx < 0 || newIdx >= props.memories.length) return

  navigating.value = true

  const el = cardEl.value
  if (el) {
    const xOut = dir === 'next' ? -50 : 50
    el.style.transition = 'transform 180ms ease-in, opacity 160ms ease-in'
    el.style.transform = `translateX(${xOut}px)`
    el.style.opacity = '0'
    await new Promise(r => setTimeout(r, 190))
  }

  // Switch index — card size and content component may both change here.
  // Since opacity is 0, the layout shift is invisible.
  currentIndex.value = newIdx
  await nextTick()

  if (el) {
    const xIn = dir === 'next' ? 50 : -50
    el.style.transition = 'none'
    el.style.transform = `translateX(${xIn}px)`
    el.style.opacity = '0'
    el.getBoundingClientRect() // force reflow
    el.style.transition = 'transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 220ms ease'
    el.style.transform = 'none'
    el.style.opacity = '1'
    await new Promise(r => setTimeout(r, 290))
  }

  navigating.value = false
}

// ── Close ──────────────────────────────────────────────────
async function close() {
  const el = cardEl.value
  const bd = backdropEl.value

  if (el) {
    el.style.transition = 'transform 280ms cubic-bezier(0.4, 0, 1, 1), opacity 220ms ease, box-shadow 220ms ease'
    el.style.transform = 'scale(0.88) rotate(-1.5deg)'
    el.style.opacity = '0'
    el.style.boxShadow = '0 4px 8px rgba(44,36,32,.08)'
  }
  if (bd) {
    bd.style.transition = 'background 220ms ease, backdrop-filter 220ms ease'
    bd.style.background = 'rgba(0,0,0,0)'
    bd.style.backdropFilter = 'blur(0px)'
  }

  await new Promise(r => setTimeout(r, 290))
  visible.value = false
  emit('close')
}

// ── Open when startIndex prop arrives ──────────────────────
watch(
  () => props.startIndex,
  async (idx) => {
    if (idx !== null && idx !== undefined) {
      currentIndex.value = idx
      visible.value = true
      await nextTick()
      await runEnterAnimation()
    }
  }
)

// ── Keyboard ───────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (!visible.value) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowLeft') navigate('prev')
  else if (e.key === 'ArrowRight') navigate('next')
}

watch(visible, v => { document.body.style.overflow = v ? 'hidden' : '' })

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>
