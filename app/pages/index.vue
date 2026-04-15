<template>
  <div class="min-h-screen bg-background">

    <!-- Header -->
    <header class="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border">
      <div class="max-w-2xl mx-auto px-5 h-14 flex items-center gap-3">

        <!-- Circle name -->
        <div class="flex-1 min-w-0">
          <p class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase leading-none mb-1">Our Story</p>
          <p class="text-sm font-semibold text-foreground leading-none truncate">{{ family?.name ?? '…' }}</p>
        </div>

        <!-- Add memory -->
        <UploadMemory v-if="familyId" :family-id="familyId" @uploaded="onUploaded" />

        <!-- Avatar + dropdown -->
        <div ref="menuRef" class="relative flex-shrink-0">
          <button
            class="w-8 h-8 rounded-full overflow-hidden ring-2 ring-border hover:ring-ring transition-all flex items-center justify-center bg-secondary"
            @click="menuOpen = !menuOpen"
          >
            <img v-if="userAvatarUrl" :src="userAvatarUrl" class="w-full h-full object-cover" />
            <span v-else class="text-[10px] font-bold text-foreground">{{ userInitials }}</span>
          </button>

          <!-- Dropdown -->
          <Transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="opacity-0 scale-95 -translate-y-1"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="opacity-100 scale-100 translate-y-0"
            leave-to-class="opacity-0 scale-95 -translate-y-1"
          >
            <div
              v-if="menuOpen"
              class="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-[14px] shadow-xl overflow-hidden origin-top-right"
            >
              <!-- User identity -->
              <div class="px-4 py-3 border-b border-border">
                <p class="text-sm font-semibold text-foreground truncate">{{ userDisplayName }}</p>
                <p class="text-xs text-muted-foreground truncate mt-0.5">{{ authUser?.email }}</p>
              </div>

              <!-- Actions -->
              <div class="py-1">
                <button
                  class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors text-left"
                  @click="menuOpen = false"
                >
                  <svg class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                  </svg>
                  Profile settings
                </button>

                <!-- Theme toggle -->
                <button
                  class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors text-left"
                  @click="toggleTheme"
                >
                  <svg v-if="isDark" class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                  </svg>
                  <svg v-else class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                  {{ isDark ? 'Light mode' : 'Dark mode' }}
                </button>

                <div class="h-px bg-border mx-3" />
                <button
                  class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-secondary transition-colors text-left"
                  @click="doLogout"
                >
                  <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Log out
                </button>
              </div>
            </div>
          </Transition>
        </div>

      </div>
    </header>

    <!-- Feed -->
    <main class="max-w-2xl mx-auto px-5 py-6">

      <!-- Loading -->
      <div v-if="loading && memories.length === 0" class="flex justify-center py-24">
        <div class="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>

      <!-- Empty state -->
      <div v-else-if="!loading && memories.length === 0" class="text-center py-24">
        <p class="text-sm font-medium text-foreground mb-1.5">No memories yet</p>
        <p class="text-xs text-muted-foreground leading-relaxed">
          Add your first memory — a photo, video, or just a note.
        </p>
      </div>

      <!-- Grid -->
      <div v-else class="columns-1 sm:columns-2 gap-4 space-y-0">
        <div
          v-for="memory in memories"
          :key="memory.id"
          class="break-inside-avoid mb-4"
        >
          <MemoryCard :memory="memory" />
        </div>
      </div>

      <!-- Infinite scroll sentinel -->
      <div ref="loadMoreEl" class="h-4 mt-2" />

      <!-- Pagination loading -->
      <div v-if="loading && memories.length > 0" class="flex justify-center py-6">
        <div class="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>

    </main>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const authUser = useSupabaseUser()
const router = useRouter()

// ── User identity ──────────────────────────────────────────
const userAvatarUrl = computed(() =>
  authUser.value?.user_metadata?.avatar_url
  ?? authUser.value?.user_metadata?.picture
  ?? null
)

const userDisplayName = computed(() => {
  const meta = authUser.value?.user_metadata
  return meta?.full_name ?? meta?.name ?? authUser.value?.email?.split('@')[0] ?? 'You'
})

const userInitials = computed(() => {
  const name = userDisplayName.value
  const parts = name.trim().split(' ')
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
})

// ── Dropdown ───────────────────────────────────────────────
const menuOpen = ref(false)
const menuRef = ref<HTMLElement>()
onClickOutside(menuRef, () => { menuOpen.value = false })

// ── Theme ──────────────────────────────────────────────────
const colorMode = useColorMode()
const prefersDark = usePreferredDark()
const isDark = computed(() =>
  colorMode.preference === 'system' ? prefersDark.value : colorMode.preference === 'dark'
)
function toggleTheme() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
  menuOpen.value = false
}

// ── Auth ───────────────────────────────────────────────────
async function doLogout() {
  const { clear } = useUserState()
  await supabase.auth.signOut()
  clear()
  router.replace('/login')
}

// ── Guard ──────────────────────────────────────────────────
onMounted(async () => {
  const { ensure } = useUserState()
  const { hasMembership, needsProfile } = await ensure()
  if (needsProfile) { router.replace('/onboarding/profile'); return }
  if (!hasMembership) { router.replace('/onboarding'); return }
})

// ── Data ───────────────────────────────────────────────────
const { data: familiesData } = await useFetch<{ families: any[] }>('/api/families')
const family = computed(() => familiesData.value?.families?.[0] ?? null)
const familyId = computed<string | null>(() => family.value?.id ?? null)

const memories = ref<any[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(false)
const loadMoreEl = ref<HTMLElement>()

async function fetchTimeline(cursor?: string) {
  if (loading.value || !familyId.value) return
  loading.value = true
  try {
    const data = await $fetch<{ memories: any[]; nextCursor: string | null }>('/api/timeline', {
      query: { familyId: familyId.value, ...(cursor ? { cursor } : {}) },
    })
    memories.value = cursor ? [...memories.value, ...data.memories] : data.memories
    nextCursor.value = data.nextCursor
  } catch (err) {
    console.error('[timeline] fetch error:', err)
  } finally {
    loading.value = false
  }
}

function onUploaded() {
  fetchTimeline()
}

const { stop } = useIntersectionObserver(loadMoreEl, ([entry]) => {
  if (entry?.isIntersecting && nextCursor.value && !loading.value) {
    fetchTimeline(nextCursor.value)
  }
})

onMounted(() => fetchTimeline())
onUnmounted(() => stop())
</script>
