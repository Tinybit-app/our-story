<template>
  <div>
    <!-- Trigger: button-styled, mirrors the rest of the form's input look -->
    <button
      type="button"
      class="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors hover:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring"
      :class="modelValue ? 'text-foreground' : 'text-muted-foreground/60'"
      :aria-label="ariaLabel ?? t('dateField.ariaLabel')"
      @click="open = true"
    >
      <span class="truncate">{{ displayValue || t('dateField.choose') }}</span>
      <svg
        class="h-4 w-4 flex-shrink-0 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="18" rx="2.5" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    </button>

    <!-- Sheet -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="open"
          class="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
          @click.self="cancel"
        >
          <div
            class="absolute inset-0 bg-black/55 backdrop-blur-sm"
            @click="cancel"
          />

          <Transition
            enter-active-class="transition duration-250 ease-[cubic-bezier(.34,1.45,.45,1)]"
            enter-from-class="translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0"
            enter-to-class="translate-y-0 sm:scale-100 sm:opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="translate-y-0 sm:scale-100 sm:opacity-100"
            leave-to-class="translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0"
            appear
          >
            <div
              v-if="open"
              class="relative w-full max-w-[380px] overflow-hidden rounded-t-[24px] bg-background shadow-2xl sm:rounded-[24px]"
            >
              <!-- Accent stripe -->
              <div
                class="h-[3px] bg-gradient-to-r from-amber-900/80 via-accent to-amber-200/60"
              />

              <!-- Month nav -->
              <div class="flex items-center justify-between px-5 pb-3 pt-4">
                <button
                  type="button"
                  class="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  :aria-label="t('dateField.prevMonth')"
                  @click="shiftMonth(-1)"
                >
                  <svg
                    class="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>

                <div class="text-center leading-tight">
                  <p
                    class="text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground"
                  >
                    {{ yearLabel }}
                  </p>
                  <p
                    class="font-display text-lg font-semibold text-foreground"
                    style="font-family: Georgia, 'Times New Roman', serif"
                  >
                    {{ monthLabel }}
                  </p>
                </div>

                <button
                  type="button"
                  class="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                  :aria-label="t('dateField.nextMonth')"
                  :disabled="!canGoNext"
                  @click="shiftMonth(1)"
                >
                  <svg
                    class="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>

              <!-- Day-of-week headers -->
              <div
                class="grid grid-cols-7 gap-1 border-b border-border/60 px-4 pb-2"
              >
                <div
                  v-for="d in weekdayLabels"
                  :key="d"
                  class="text-center text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground/70"
                >
                  {{ d }}
                </div>
              </div>

              <!-- Date grid -->
              <div class="grid grid-cols-7 gap-1 px-4 py-3">
                <button
                  v-for="(cell, idx) in cells"
                  :key="idx"
                  type="button"
                  :disabled="cell.disabled || !cell.inMonth"
                  class="relative flex h-10 items-center justify-center rounded-full text-sm transition-colors disabled:cursor-default"
                  :class="cellClass(cell)"
                  @click="cell.inMonth && !cell.disabled && pickDay(cell.day)"
                >
                  <span>{{ cell.inMonth ? cell.day : '' }}</span>
                </button>
              </div>

              <!-- Actions -->
              <div class="flex gap-2 border-t border-border/60 px-5 py-4">
                <button
                  type="button"
                  class="flex-1 rounded-[12px] border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                  @click="cancel"
                >
                  {{ t('common.cancel') }}
                </button>
                <button
                  type="button"
                  class="flex-1 rounded-[12px] bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                  :disabled="!draftValue"
                  @click="confirm"
                >
                  {{ t('common.done') }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string | null | undefined // ISO YYYY-MM-DD
  max?: string // ISO YYYY-MM-DD — disable dates after this
  min?: string
  ariaLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [string]
}>()

const { t, locale } = useI18n()

const open = ref(false)
const draftValue = ref<string>(props.modelValue ?? '')
const viewDate = ref<Date>(parseIsoOrToday(props.modelValue))

watch(open, (isOpen) => {
  if (isOpen) {
    draftValue.value = props.modelValue ?? ''
    viewDate.value = parseIsoOrToday(props.modelValue)
  }
})

function parseIsoOrToday(iso?: string | null): Date {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y!, m! - 1, d!)
  }
  return new Date()
}

function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Display: long-form locale-aware, e.g. "Thursday, May 14"
const displayValue = computed(() => {
  if (!props.modelValue) return ''
  const d = parseIsoOrToday(props.modelValue)
  return new Intl.DateTimeFormat(locale.value, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(d)
})

const monthLabel = computed(() =>
  new Intl.DateTimeFormat(locale.value, { month: 'long' }).format(viewDate.value),
)
const yearLabel = computed(() =>
  new Intl.DateTimeFormat(locale.value, { year: 'numeric' }).format(viewDate.value),
)

// Day-of-week headers respect the locale's first day (Sunday default for en/zh/fr is OK).
// We render Sun→Sat for simplicity; future enhancement: detect locale's firstDay via Intl.Locale.
const weekdayLabels = computed(() => {
  const sample = new Date(2024, 5, 2) // June 2 2024 is a Sunday
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(sample)
    d.setDate(sample.getDate() + i)
    return new Intl.DateTimeFormat(locale.value, { weekday: 'narrow' }).format(d)
  })
})

type Cell = { day: number; inMonth: boolean; disabled: boolean; isToday: boolean; isSelected: boolean }

const cells = computed<Cell[]>(() => {
  const year = viewDate.value.getFullYear()
  const month = viewDate.value.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay() // 0 (Sun) – 6 (Sat)
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const todayIso = toIso(new Date())
  const minDate = props.min ? parseIsoOrToday(props.min) : null
  const maxDate = props.max ? parseIsoOrToday(props.max) : null

  const arr: Cell[] = []
  // Leading blanks
  for (let i = 0; i < startWeekday; i++) {
    arr.push({ day: 0, inMonth: false, disabled: true, isToday: false, isSelected: false })
  }
  // Days
  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(year, month, d)
    const cellIso = toIso(cellDate)
    const disabled =
      (!!maxDate && cellDate > maxDate) ||
      (!!minDate && cellDate < minDate)
    arr.push({
      day: d,
      inMonth: true,
      disabled,
      isToday: cellIso === todayIso,
      isSelected: cellIso === draftValue.value,
    })
  }
  // Trailing blanks to fill out the last row (multiple of 7)
  while (arr.length % 7 !== 0) {
    arr.push({ day: 0, inMonth: false, disabled: true, isToday: false, isSelected: false })
  }
  return arr
})

function cellClass(cell: Cell) {
  if (!cell.inMonth) return 'text-transparent'
  if (cell.disabled) return 'text-muted-foreground/30'
  if (cell.isSelected)
    return 'bg-foreground text-background font-semibold shadow-sm'
  if (cell.isToday)
    return 'text-foreground ring-1 ring-inset ring-accent/70 hover:bg-secondary'
  return 'text-foreground hover:bg-secondary'
}

const canGoNext = computed(() => {
  if (!props.max) return true
  const max = parseIsoOrToday(props.max)
  const nextMonthStart = new Date(
    viewDate.value.getFullYear(),
    viewDate.value.getMonth() + 1,
    1,
  )
  return nextMonthStart <= max
})

function shiftMonth(delta: number) {
  const next = new Date(viewDate.value)
  next.setDate(1)
  next.setMonth(next.getMonth() + delta)
  viewDate.value = next
}

function pickDay(day: number) {
  const picked = new Date(
    viewDate.value.getFullYear(),
    viewDate.value.getMonth(),
    day,
  )
  draftValue.value = toIso(picked)
}

function confirm() {
  if (!draftValue.value) return
  emit('update:modelValue', draftValue.value)
  open.value = false
}

function cancel() {
  open.value = false
}
</script>
