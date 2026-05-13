<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center bg-background px-6"
  >
    <div class="w-full max-w-sm">
      <p
        class="mb-10 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
      >
        Our Story
      </p>

      <!-- Progress dots -->
      <div class="mb-10 flex items-center justify-center gap-2">
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
          <!-- Screen 1: The pain — Family -->
          <template v-if="currentScreen === 1">
            <div
              class="relative mb-8 space-y-3 overflow-hidden rounded-2xl border border-border bg-card px-5 py-5"
            >
              <div class="mb-4 flex items-center justify-between">
                <p
                  class="text-[11px] font-semibold uppercase tracking-widest text-foreground/60"
                >
                  {{ t('valueProp.screen1.chatLabel') }}
                </p>
                <span
                  class="text-[10px] font-semibold tracking-wide text-accent/70"
                  >{{ t('valueProp.screen1.circleTypeTag') }}</span
                >
              </div>
              <div class="space-y-2.5">
                <div class="flex items-start gap-2.5 opacity-40">
                  <div
                    class="w-[2px] shrink-0 self-stretch rounded-full bg-accent"
                  />
                  <div>
                    <p
                      class="mb-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {{ t('valueProp.screen1.chatName1') }}
                    </p>
                    <p class="text-xs leading-snug text-foreground/70">
                      {{ t('valueProp.screen1.chatMsg1') }}
                    </p>
                  </div>
                </div>
                <div class="flex items-start gap-2.5 opacity-60">
                  <div
                    class="w-[2px] shrink-0 self-stretch rounded-full bg-accent"
                  />
                  <div>
                    <p
                      class="mb-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {{ t('valueProp.screen1.chatName2') }}
                    </p>
                    <p class="text-xs leading-snug text-foreground/70">
                      {{ t('valueProp.screen1.chatMsg2') }}
                    </p>
                  </div>
                </div>
                <div class="flex items-start gap-2.5">
                  <div
                    class="w-[2px] shrink-0 self-stretch rounded-full bg-border"
                  />
                  <div>
                    <p
                      class="mb-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {{ t('valueProp.screen1.chatName3') }}
                    </p>
                    <p
                      class="text-xs italic leading-snug text-muted-foreground"
                    >
                      {{ t('valueProp.screen1.chatMsg3') }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <h1
              class="mb-3 text-[1.6rem] font-bold leading-[1.25] tracking-tight text-foreground"
            >
              {{ t('valueProp.screen1.heading1') }}<br />
              {{ t('valueProp.screen1.heading2') }}<br />
              <span class="text-accent">{{
                t('valueProp.screen1.heading3')
              }}</span>
            </h1>
            <p class="text-sm leading-relaxed text-muted-foreground">
              {{ t('valueProp.screen1.body') }}
            </p>
          </template>

          <!-- Screen 2: The solution — Friends & Travel -->
          <template v-else-if="currentScreen === 2">
            <div
              class="mb-8 rounded-2xl border border-border bg-card px-5 py-5"
            >
              <div class="mb-4 flex items-center justify-between">
                <p
                  class="text-[11px] font-semibold uppercase tracking-widest text-foreground/60"
                >
                  {{ t('valueProp.screen2.milestoneLabel') }}
                </p>
                <span
                  class="text-[10px] font-semibold tracking-wide text-accent/70"
                  >{{ t('valueProp.screen2.circleTypeTag') }}</span
                >
              </div>
              <div class="flex items-stretch gap-4">
                <div class="flex flex-col items-center pb-1 pt-1.5">
                  <div class="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <div
                    class="my-1 w-[1px] flex-1 bg-gradient-to-b from-accent/40 to-border/30"
                  />
                  <div class="h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
                </div>
                <div class="flex-1 space-y-4">
                  <div>
                    <p
                      class="mb-0.5 font-['Caveat'] text-base leading-none text-accent"
                    >
                      {{ t('valueProp.screen2.date1') }}
                    </p>
                    <p class="text-sm font-semibold text-foreground">
                      {{ t('valueProp.screen2.milestone1') }}
                    </p>
                    <p class="mt-0.5 text-[11px] text-muted-foreground">
                      {{ t('valueProp.screen2.reactions1') }}
                    </p>
                  </div>
                  <div class="opacity-55">
                    <p
                      class="mb-0.5 font-['Caveat'] text-base leading-none text-muted-foreground"
                    >
                      {{ t('valueProp.screen2.date2') }}
                    </p>
                    <p class="text-sm font-semibold text-foreground">
                      {{ t('valueProp.screen2.milestone2') }}
                    </p>
                    <p class="mt-0.5 text-[11px] text-muted-foreground">
                      {{ t('valueProp.screen2.milestoneLabel') }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <h1
              class="mb-3 text-[1.6rem] font-bold leading-[1.25] tracking-tight text-foreground"
            >
              {{ t('valueProp.screen2.heading1') }}<br />
              <span class="text-accent">{{
                t('valueProp.screen2.heading2')
              }}</span>
            </h1>
            <p class="text-sm leading-relaxed text-muted-foreground">
              {{ t('valueProp.screen2.body') }}
            </p>
          </template>

          <!-- Screen 3: The promise — Couple -->
          <template v-else>
            <div
              class="mb-8 rounded-2xl border border-border bg-card px-5 py-5"
            >
              <div class="mb-4 flex items-center justify-between">
                <p
                  class="text-[11px] font-semibold uppercase tracking-widest text-foreground/60"
                >
                  {{ t('valueProp.screen2.milestoneLabel') }}
                </p>
                <span
                  class="text-[10px] font-semibold tracking-wide text-accent/70"
                  >{{ t('valueProp.screen3.circleTypeTag') }}</span
                >
              </div>
              <div class="flex items-stretch gap-4">
                <div class="flex flex-col items-center pb-1 pt-1.5">
                  <div class="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <div
                    class="my-1 w-[1px] flex-1 bg-gradient-to-b from-accent/40 to-border/30"
                  />
                  <div class="h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
                </div>
                <div class="flex-1 space-y-4">
                  <div>
                    <p
                      class="mb-0.5 font-['Caveat'] text-base leading-none text-accent"
                    >
                      {{ t('valueProp.screen3.date1') }}
                    </p>
                    <p class="text-sm font-semibold text-foreground">
                      {{ t('valueProp.screen3.entry1') }}
                    </p>
                    <p class="mt-0.5 text-[11px] text-muted-foreground">
                      {{ t('valueProp.screen3.entryTag1') }}
                    </p>
                  </div>
                  <div class="opacity-55">
                    <p
                      class="mb-0.5 font-['Caveat'] text-base leading-none text-muted-foreground"
                    >
                      {{ t('valueProp.screen3.date2') }}
                    </p>
                    <p class="text-sm font-semibold text-foreground">
                      {{ t('valueProp.screen3.entry2') }}
                    </p>
                    <p class="mt-0.5 text-[11px] text-muted-foreground">
                      {{ t('valueProp.screen3.entryTag2') }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <h1
              class="mb-3 text-[1.6rem] font-bold leading-[1.25] tracking-tight text-foreground"
            >
              {{ t('valueProp.screen3.heading1') }}<br />
              <span class="text-accent">{{
                t('valueProp.screen3.heading2')
              }}</span>
            </h1>
            <p class="text-sm leading-relaxed text-muted-foreground">
              {{ t('valueProp.screen3.body') }}
            </p>
          </template>
        </div>
      </Transition>

      <!-- Actions -->
      <div class="mt-10 flex flex-col gap-3">
        <button
          v-if="currentScreen < 3"
          class="w-full rounded-[12px] bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          @click="next"
        >
          {{ t('valueProp.next') }}
        </button>
        <button
          v-else
          class="w-full rounded-[12px] bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          @click="finish"
        >
          {{ t('valueProp.start') }}
        </button>
        <button
          class="w-full py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
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
