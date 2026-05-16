<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/60 backdrop-blur-sm"
        @click="emit('close')"
      />

      <!-- Sheet -->
      <div
        class="relative w-full overflow-hidden rounded-t-[24px] bg-background shadow-2xl sm:max-w-sm sm:rounded-[24px]"
      >
        <!-- Accent stripe -->
        <div
          class="h-[3px] bg-gradient-to-r from-amber-900/80 via-accent to-amber-200/60"
        />

        <div class="px-5 pb-5 pt-4">
          <!-- Header -->
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-foreground">
              {{ t('quickNote.title') }}
            </h2>
            <button
              class="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              :aria-label="t('modal.cancel')"
              @click="emit('close')"
            >
              <svg
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Note textarea -->
          <textarea
            ref="textareaRef"
            v-model="note"
            :placeholder="t('quickNote.notePlaceholder')"
            rows="4"
            maxlength="500"
            class="mb-3 w-full resize-none rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
          />

          <!-- Milestone -->
          <input
            v-model="milestoneLabel"
            type="text"
            :placeholder="t('quickNote.milestonePlaceholder')"
            maxlength="40"
            class="mb-3 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
          />

          <!-- Date -->
          <div class="mb-3">
            <p
              class="mb-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground"
            >
              {{ t('quickNote.whenWas') }}
            </p>
            <DateField v-model="memoryDate" :max="todayStr" />
          </div>

          <!-- People picker -->
          <div v-if="members?.length || children?.length" class="mb-4">
            <p
              class="mb-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground"
            >
              {{ t('quickNote.whoIsIn') }}
            </p>
            <div class="flex flex-wrap gap-1.5">
              <!-- Member chips -->
              <button
                v-for="member in members"
                :key="member.userId"
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[11px] font-medium transition-colors"
                :class="
                  selectedMemberIds.includes(member.userId)
                    ? 'border-accent/40 bg-accent/15 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                "
                @click="toggleMember(member.userId)"
              >
                <span
                  class="flex h-4 w-4 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-border text-[7px] font-bold"
                >
                  <img
                    v-if="member.avatarUrl"
                    :src="member.avatarUrl"
                    class="h-full w-full object-cover"
                  />
                  <span v-else>{{
                    (member.firstName?.[0] ?? '') + (member.lastName?.[0] ?? '')
                  }}</span>
                </span>
                {{ member.firstName ?? member.userId.slice(0, 6) }}
              </button>
              <!-- Child chips -->
              <button
                v-for="child in children"
                :key="child.id"
                type="button"
                class="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
                :class="
                  selectedChildIds.includes(child.id)
                    ? 'border-accent/40 bg-accent/15 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                "
                @click="toggleChild(child.id)"
              >
                {{ child.name }}
              </button>
            </div>
          </div>

          <!-- Error -->
          <p v-if="error" class="mb-3 text-xs text-destructive">{{ error }}</p>

          <!-- Save -->
          <button
            class="flex w-full items-center justify-center gap-2 rounded-[12px] bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            :disabled="saving || !note.trim()"
            @click="save"
          >
            {{ saving ? t('quickNote.saving') : t('quickNote.save') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useAnalytics, classifyMilestone } from '~/composables/useAnalytics'

const { t } = useI18n()
const { track } = useAnalytics()

const props = defineProps<{
  circleId: string
  members?: Array<{
    userId: string
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
  }>
  children?: Array<{ id: string; name: string }>
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

// ── State ──────────────────────────────────────────────────────────────────
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const note = ref('')
const milestoneLabel = ref('')
const memoryDate = ref(todayIso())
const selectedMemberIds = ref<string[]>([])
const selectedChildIds = ref<string[]>([])
const saving = ref(false)
const error = ref('')

const todayStr = todayIso()

function todayIso() {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
}

onMounted(() => nextTick(() => textareaRef.value?.focus()))

function toggleMember(userId: string) {
  const i = selectedMemberIds.value.indexOf(userId)
  if (i === -1) selectedMemberIds.value.push(userId)
  else selectedMemberIds.value.splice(i, 1)
}

function toggleChild(childId: string) {
  const i = selectedChildIds.value.indexOf(childId)
  if (i === -1) selectedChildIds.value.push(childId)
  else selectedChildIds.value.splice(i, 1)
}

async function save() {
  error.value = ''
  if (!note.value.trim()) {
    error.value = t('quickNote.errorEmpty')
    return
  }
  saving.value = true
  try {
    const result = await $fetch<{ memoryId: string }>(
      '/api/memories/quick-note',
      {
        method: 'POST',
        body: {
          circleId: props.circleId,
          note: note.value.trim(),
          memoryDate: memoryDate.value,
          milestoneLabel: milestoneLabel.value.trim() || null,
          childIds: [...selectedChildIds.value],
          memberIds: [...selectedMemberIds.value],
        },
      },
    )
    track('memory_uploaded', {
      circle_id: props.circleId,
      memory_type: 'note',
      visibility: 'circle',
      media_count: 1,
    })
    track('memory_shared_to_circle', {
      circle_id: props.circleId,
      memory_id: result.memoryId,
    })
    if (milestoneLabel.value.trim()) {
      track('milestone_created', {
        circle_id: props.circleId,
        milestone_type: classifyMilestone(milestoneLabel.value),
      })
    }
    emit('saved')
  } catch {
    error.value = t('quickNote.errorFailed')
  } finally {
    saving.value = false
  }
}
</script>
