<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <header
      class="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md"
    >
      <div class="mx-auto flex max-w-[1280px] items-center gap-3 px-5 py-3.5">
        <button
          class="-ml-1 flex flex-shrink-0 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          @click="router.back()"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {{ t('common.back') }}
        </button>
      </div>
    </header>

    <main class="mx-auto max-w-[1280px] px-5">
      <!-- Profile hero -->
      <div
        v-if="member"
        class="flex items-end gap-5 border-b border-border pb-8 pt-8"
      >
        <!-- Avatar -->
        <div
          class="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary ring-2 ring-border"
        >
          <img
            v-if="member.avatarUrl"
            :src="member.avatarUrl"
            class="h-full w-full object-cover"
          />
          <span v-else class="text-xl font-bold text-foreground">{{
            initials(member)
          }}</span>
        </div>

        <!-- Name + stats -->
        <div class="min-w-0 flex-1">
          <h1
            class="truncate text-xl font-semibold leading-tight text-foreground"
          >
            {{ displayName(member) }}
          </h1>
          <div class="mt-1.5 flex flex-wrap items-center gap-3">
            <span class="text-[11px] capitalize text-muted-foreground">{{
              member.role
            }}</span>
            <span class="text-xs text-border">·</span>
            <span class="text-[11px] text-muted-foreground">{{
              t('member.joined', { date: joinedLabel })
            }}</span>
            <span v-if="totalMemories > 0" class="text-xs text-border">·</span>
            <span
              v-if="totalMemories > 0"
              class="text-[11px] text-muted-foreground"
            >
              {{ t('member.memories', totalMemories) }}
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
          @reaction-update="onReactionUpdate"
        />
      </div>
    </main>
  </div>

  <MemoryShell
    :memories="memoriesFlat"
    :start-index="selectedIndex"
    :origin-rect="selectedRect"
    :tilt="selectedTilt"
    @close="selectedIndex = null"
    @update="onMemoryUpdate"
  />
</template>

<script setup lang="ts">
import type { Memory } from '~/composables/useTimeline'
const { t, locale } = useI18n()

const selectedIndex = ref<number | null>(null)
const selectedRect = ref<DOMRect | null>(null)
const selectedTilt = ref(0)

function onOpenMemory({
  memory,
  tilt,
  rect,
}: {
  memory: Memory
  tilt: number
  rect: DOMRect
}) {
  selectedIndex.value = memoriesFlat.value.findIndex((m) => m.id === memory.id)
  selectedRect.value = rect
  selectedTilt.value = tilt
}

function onMemoryUpdate(patch: Pick<Memory, 'id'> & Partial<Memory>) {
  const i = memoriesFlat.value.findIndex((m) => m.id === patch.id)
  if (i !== -1)
    memoriesFlat.value[i] = { ...memoriesFlat.value[i], ...patch } as Memory
}

function onReactionUpdate({
  memoryId,
  reactions,
}: {
  memoryId: string
  reactions: any[]
}) {
  const i = memoriesFlat.value.findIndex((m) => m.id === memoryId)
  if (i !== -1)
    memoriesFlat.value[i] = {
      ...memoriesFlat.value[i],
      memoryreaction: reactions,
    } as Memory
}

definePageMeta({})

const router = useRouter()
const route = useRoute()
const userId = route.params.userId as string

// ── Circle + member info ───────────────────────────────────
const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
// Prefer ?circle=<id> so a member's profile page edits/views the right
// circle (callers from members.vue / timeline pass the active circle's id).
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

const { data: membersData } = await useAsyncData(
  `members-${circleId.value}`,
  () => $fetch<{ members: any[] }>(`/api/circles/${circleId.value!}/members`),
  { immediate: !!circleId.value },
)
const member = computed(
  () =>
    membersData.value?.members.find((m: any) => m.userId === userId) ?? null,
)

function displayName(m: any): string {
  const parts = [m.firstName, m.lastName].filter(Boolean)
  return parts.length ? parts.join(' ') : t('common.unknown')
}

function initials(m: any): string {
  const first = m.firstName?.[0] ?? ''
  const last = m.lastName?.[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

const joinedLabel = computed(() => {
  if (!member.value?.joinedAt) return ''
  return new Date(member.value.joinedAt).toLocaleDateString(locale.value, {
    month: 'long',
    year: 'numeric',
  })
})

// ── Timeline ───────────────────────────────────────────────
const memoriesFlat = ref<Memory[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(false)

const { monthGroups } = useTimeline(memoriesFlat)
const totalMemories = computed(() =>
  monthGroups.value.reduce((sum, g) => sum + g.totalCount, 0),
)

async function fetchTimeline(cursor?: string) {
  if (loading.value || !circleId.value) return
  loading.value = true
  try {
    const data = await $fetch<{
      memories: Memory[]
      nextCursor: string | null
    }>('/api/timeline', {
      query: {
        circleId: circleId.value,
        authorId: userId,
        ...(cursor ? { cursor } : {}),
      },
    })
    memoriesFlat.value = cursor
      ? [...memoriesFlat.value, ...data.memories]
      : data.memories
    nextCursor.value = data.nextCursor
  } catch (err) {
    console.error('[member-timeline] fetch error:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => fetchTimeline())
</script>
