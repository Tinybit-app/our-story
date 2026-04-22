<template>
  <div class="min-h-screen bg-background flex flex-col items-center justify-center px-6">
    <div class="w-full max-w-sm">

      <p class="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground uppercase mb-10 text-center">
        Our Story
      </p>

      <!-- Progress dots -->
      <div class="flex items-center justify-center gap-2 mb-10">
        <span
          v-for="i in 3"
          :key="i"
          data-testid="value-prop-dot"
          class="block h-[3px] rounded-full transition-all duration-500 ease-in-out"
          :class="i === currentScreen ? 'w-7 bg-accent' : 'w-2 bg-border'"
        />
      </div>

      <!-- Screen content -->
      <Transition name="slide" mode="out-in">
        <div :key="currentScreen">

          <!-- Screen 1: The pain -->
          <template v-if="currentScreen === 1">
            <div class="rounded-2xl bg-card border border-border px-5 py-5 mb-8 space-y-3 overflow-hidden relative">
              <p class="text-[11px] font-semibold text-foreground/60 uppercase tracking-widest mb-4">{{ t('valueProp.screen1.chatLabel') }}</p>
              <div class="space-y-2.5">
                <div class="flex gap-2.5 items-start opacity-40">
                  <div class="w-[2px] rounded-full bg-accent self-stretch shrink-0" />
                  <div>
                    <p class="text-[10px] text-muted-foreground font-medium mb-0.5">{{ t('valueProp.screen1.chatName1') }}</p>
                    <p class="text-xs text-foreground/70 leading-snug">{{ t('valueProp.screen1.chatMsg1') }}</p>
                  </div>
                </div>
                <div class="flex gap-2.5 items-start opacity-60">
                  <div class="w-[2px] rounded-full bg-accent self-stretch shrink-0" />
                  <div>
                    <p class="text-[10px] text-muted-foreground font-medium mb-0.5">{{ t('valueProp.screen1.chatName2') }}</p>
                    <p class="text-xs text-foreground/70 leading-snug">{{ t('valueProp.screen1.chatMsg2') }}</p>
                  </div>
                </div>
                <div class="flex gap-2.5 items-start">
                  <div class="w-[2px] rounded-full bg-border self-stretch shrink-0" />
                  <div>
                    <p class="text-[10px] text-muted-foreground font-medium mb-0.5">{{ t('valueProp.screen1.chatName3') }}</p>
                    <p class="text-xs text-muted-foreground leading-snug italic">{{ t('valueProp.screen1.chatMsg3') }}</p>
                  </div>
                </div>
              </div>
            </div>
            <h1 class="text-[1.6rem] font-bold text-foreground leading-[1.25] tracking-tight mb-3">
              {{ t('valueProp.screen1.heading1') }}<br>
              {{ t('valueProp.screen1.heading2') }}<br>
              <span class="text-accent">{{ t('valueProp.screen1.heading3') }}</span>
            </h1>
            <p class="text-sm text-muted-foreground leading-relaxed">
              {{ t('valueProp.screen1.body') }}
            </p>
          </template>

          <!-- Screen 2: The solution -->
          <template v-else-if="currentScreen === 2">
            <div class="rounded-2xl bg-card border border-border px-5 py-5 mb-8">
              <div class="flex items-stretch gap-4">
                <div class="flex flex-col items-center pt-1.5 pb-1">
                  <div class="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  <div class="w-[1px] flex-1 bg-gradient-to-b from-accent/40 to-border/30 my-1" />
                  <div class="w-1.5 h-1.5 rounded-full bg-border shrink-0" />
                </div>
                <div class="flex-1 space-y-4">
                  <div>
                    <p class="font-['Caveat'] text-base text-accent leading-none mb-0.5">{{ t('valueProp.screen2.date1') }}</p>
                    <p class="text-sm font-semibold text-foreground">{{ t('valueProp.screen2.milestone1') }}</p>
                    <p class="text-[11px] text-muted-foreground mt-0.5">{{ t('valueProp.screen2.reactions1') }}</p>
                  </div>
                  <div class="opacity-55">
                    <p class="font-['Caveat'] text-base text-muted-foreground leading-none mb-0.5">{{ t('valueProp.screen2.date2') }}</p>
                    <p class="text-sm font-semibold text-foreground">{{ t('valueProp.screen2.milestone2') }}</p>
                    <p class="text-[11px] text-muted-foreground mt-0.5">{{ t('valueProp.screen2.milestoneLabel') }}</p>
                  </div>
                </div>
              </div>
            </div>
            <h1 class="text-[1.6rem] font-bold text-foreground leading-[1.25] tracking-tight mb-3">
              {{ t('valueProp.screen2.heading1') }}<br>
              <span class="text-accent">{{ t('valueProp.screen2.heading2') }}</span>
            </h1>
            <p class="text-sm text-muted-foreground leading-relaxed">
              {{ t('valueProp.screen2.body') }}
            </p>
          </template>

          <!-- Screen 3: The promise -->
          <template v-else>
            <div class="rounded-2xl bg-card border border-border px-5 py-6 mb-8 flex items-center justify-around gap-2">
              <!-- Phone -->
              <div class="flex flex-col items-center gap-2">
                <svg viewBox="0 0 36 60" class="w-8 h-auto text-foreground/80" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="2" width="32" height="56" rx="5" />
                  <line x1="14" y1="5.5" x2="22" y2="5.5" stroke-width="1.5" />
                  <circle cx="18" cy="53" r="2" />
                </svg>
                <p class="text-[11px] text-muted-foreground text-center leading-tight whitespace-pre-line">{{ t('valueProp.screen3.deviceLabel') }}</p>
              </div>
              <!-- Divider -->
              <div class="h-12 w-px bg-border" />
              <!-- Envelope / email -->
              <div class="flex flex-col items-center gap-2">
                <svg viewBox="0 0 48 36" class="w-10 h-auto text-foreground/80" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="2" width="44" height="32" rx="4" />
                  <polyline points="2,2 24,20 46,2" />
                </svg>
                <p class="text-[11px] text-muted-foreground text-center leading-tight whitespace-pre-line">{{ t('valueProp.screen3.emailLabel') }}</p>
              </div>
            </div>
            <h1 class="text-[1.6rem] font-bold text-foreground leading-[1.25] tracking-tight mb-3">
              {{ t('valueProp.screen3.heading1') }}<br>
              <span class="text-accent">{{ t('valueProp.screen3.heading2') }}</span>
            </h1>
            <p class="text-sm text-muted-foreground leading-relaxed">
              {{ t('valueProp.screen3.body') }}
            </p>
          </template>

        </div>
      </Transition>

      <!-- Actions -->
      <div class="mt-10 flex flex-col gap-3">
        <button
          v-if="currentScreen < 3"
          class="w-full bg-primary text-primary-foreground rounded-[12px] py-3.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          @click="next"
        >
          {{ t('valueProp.next') }}
        </button>
        <button
          v-else
          class="w-full bg-primary text-primary-foreground rounded-[12px] py-3.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          @click="finish"
        >
          {{ t('valueProp.start') }}
        </button>
        <button
          class="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          @click="skip"
        >
          {{ t('valueProp.skip') }}
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'onboarding' })

const { t } = useI18n()
const router = useRouter()
const { hasSeen, markAsSeen } = useValuePropSeen()
const currentScreen = ref(1)

onMounted(() => {
  if (hasSeen()) router.replace('/onboarding')
})

function next() {
  if (currentScreen.value < 3) currentScreen.value++
}

function finish() {
  markAsSeen()
  router.push('/onboarding')
}

function skip() {
  markAsSeen()
  router.push('/onboarding')
}
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.slide-enter-from {
  opacity: 0;
  transform: translateX(14px);
}
.slide-leave-to {
  opacity: 0;
  transform: translateX(-14px);
}
</style>
