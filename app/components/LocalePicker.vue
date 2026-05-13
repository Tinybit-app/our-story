<template>
  <div class="relative" ref="root">
    <!-- Trigger -->
    <button
      data-testid="locale-picker"
      @click="open = !open"
      class="flex h-7 items-center gap-1 rounded-full border border-border bg-card px-2.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-secondary"
      :class="{ 'bg-secondary': open }"
    >
      <span>{{ currentShortLabel }}</span>
      <svg
        class="h-2.5 w-2.5 text-muted-foreground transition-transform duration-150"
        :class="open ? 'rotate-180' : ''"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        viewBox="0 0 24 24"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <!-- Floating list -->
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 -translate-y-1"
    >
      <div
        v-if="open"
        class="absolute right-0 top-full z-50 mt-1.5 min-w-[130px] origin-top-right overflow-hidden rounded-[12px] border border-border bg-card shadow-xl"
      >
        <button
          v-for="loc in locales"
          :key="loc.code"
          @click="pick(loc.code)"
          class="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-secondary"
          :class="
            locale === loc.code
              ? 'font-medium text-foreground'
              : 'text-muted-foreground'
          "
        >
          <span>{{ loc.name }}</span>
          <!-- Checkmark for active locale -->
          <svg
            v-if="locale === loc.code"
            class="h-3.5 w-3.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ guest?: boolean }>()
const { locale, locales, setLocale } = useI18n()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

// Short label from nuxt.config shortLabel field, fallback to uppercased language tag
const currentShortLabel = computed(() => {
  const loc = locales.value.find((l) => l.code === locale.value)
  return (loc as any)?.shortLabel ?? locale.value.split('-')[0]!.toUpperCase()
})

// Close on outside click
function onOutsideClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('click', onOutsideClick, true))
onUnmounted(() => document.removeEventListener('click', onOutsideClick, true))

async function pick(code: string) {
  open.value = false
  await setLocale(code as any)
  if (props.guest) {
    // Guest viewers: persist explicit choice in a separate cookie.
    // Can't use i18n_locale because @nuxtjs/i18n auto-sets it on every page load,
    // making it impossible to distinguish "guest chose English" from "browser default".
    const cookie = useCookie('viewer_locale', { maxAge: 365 * 24 * 60 * 60 })
    cookie.value = code
  } else {
    $fetch('/api/profile', { method: 'PATCH', body: { locale: code } }).catch(
      () => {},
    )
  }
}
</script>
