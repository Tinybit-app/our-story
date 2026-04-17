<template>
  <div class="min-h-screen bg-background">

    <!-- Header -->
    <header class="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border">
      <div class="max-w-[1280px] mx-auto px-5 py-3.5 flex items-center gap-3">
        <button
          class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1 flex-shrink-0"
          @click="router.back()"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          Back
        </button>
      </div>
    </header>

    <main class="max-w-[1280px] mx-auto px-5">

      <!-- Profile hero -->
      <div v-if="member" class="flex items-end gap-5 pt-8 pb-8 border-b border-border">
        <!-- Avatar -->
        <div class="w-16 h-16 rounded-full overflow-hidden ring-2 ring-border flex-shrink-0 flex items-center justify-center bg-secondary">
          <img v-if="member.avatarUrl" :src="member.avatarUrl" class="w-full h-full object-cover" />
          <span v-else class="text-xl font-bold text-foreground">{{ initials(member) }}</span>
        </div>

        <!-- Name + stats -->
        <div class="min-w-0 flex-1">
          <h1 class="text-xl font-semibold text-foreground leading-tight truncate">{{ displayName(member) }}</h1>
          <div class="flex items-center gap-3 mt-1.5 flex-wrap">
            <span class="text-[11px] text-muted-foreground capitalize">{{ member.role }}</span>
            <span class="text-border text-xs">·</span>
            <span class="text-[11px] text-muted-foreground">Joined {{ joinedLabel }}</span>
            <span v-if="totalMemories > 0" class="text-border text-xs">·</span>
            <span v-if="totalMemories > 0" class="text-[11px] text-muted-foreground">
              {{ totalMemories }} {{ totalMemories === 1 ? 'memory' : 'memories' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <div class="py-6">
        <TimelinePolaroid
          :month-groups="monthGroups"
          :loading="loading"
          :has-next-page="!!nextCursor"
          @load-more="fetchTimeline(nextCursor ?? undefined)"
          @open-memory="onOpenMemory"
        />
      </div>

    </main>

  </div>

  <MemoryModal
    :memories="memoriesFlat"
    :start-index="selectedMemoryIndex"
    :origin-rect="selectedRect"
    :tilt="selectedTilt"
    @close="selectedMemoryIndex = null"
    @update="onMemoryUpdate"
  />
</template>

<script setup lang="ts">
import type { Memory } from '~/composables/useTimeline'

const selectedMemoryIndex = ref<number | null>(null)
const selectedRect = ref<DOMRect | null>(null)
const selectedTilt = ref(0)

function onOpenMemory({ memory, tilt, rect }: { memory: Memory; tilt: number; rect: DOMRect }) {
  selectedMemoryIndex.value = memoriesFlat.value.findIndex((m) => m.id === memory.id)
  selectedRect.value = rect
  selectedTilt.value = tilt
}

function onMemoryUpdate(patch: Pick<Memory, 'id'> & Partial<Memory>) {
  const i = memoriesFlat.value.findIndex((m) => m.id === patch.id)
  if (i !== -1) memoriesFlat.value[i] = { ...memoriesFlat.value[i], ...patch } as Memory
}

definePageMeta({})

const router = useRouter()
const route = useRoute()
const userId = route.params.userId as string

// ── Circle + member info ───────────────────────────────────
const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
const circle = computed(() => circlesData.value?.circles?.[0] ?? null)
const circleId = computed<string | null>(() => circle.value?.id ?? null)

const { data: membersData } = await useAsyncData(
  `members-${circleId.value}`,
  () => $fetch<{ members: any[] }>(`/api/circles/${circleId.value!}/members`),
  { immediate: !!circleId.value },
)
const member = computed(() => membersData.value?.members.find((m: any) => m.userId === userId) ?? null)

function displayName(m: any): string {
  const parts = [m.firstName, m.lastName].filter(Boolean)
  return parts.length ? parts.join(' ') : 'Unknown'
}

function initials(m: any): string {
  const first = m.firstName?.[0] ?? ''
  const last = m.lastName?.[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

const joinedLabel = computed(() => {
  if (!member.value?.joinedAt) return ''
  return new Date(member.value.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

// ── Timeline ───────────────────────────────────────────────
const memoriesFlat = ref<Memory[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(false)

const { monthGroups } = useTimeline(memoriesFlat)
const totalMemories = computed(() => monthGroups.value.reduce((sum, g) => sum + g.totalCount, 0))

async function fetchTimeline(cursor?: string) {
  if (loading.value || !circleId.value) return
  loading.value = true
  try {
    const data = await $fetch<{ memories: Memory[]; nextCursor: string | null }>('/api/timeline', {
      query: { circleId: circleId.value, authorId: userId, ...(cursor ? { cursor } : {}) },
    })
    memoriesFlat.value = cursor ? [...memoriesFlat.value, ...data.memories] : data.memories
    nextCursor.value = data.nextCursor
  } catch (err) {
    console.error('[member-timeline] fetch error:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => fetchTimeline())
</script>
