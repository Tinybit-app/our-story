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
            <!-- Typographic chat illustration — no emoji -->
            <div class="rounded-2xl bg-card border border-border px-5 py-5 mb-8 space-y-3 overflow-hidden relative">
              <p class="text-[11px] font-semibold text-foreground/60 uppercase tracking-widest mb-4">Family Chat</p>
              <div class="space-y-2.5">
                <div class="flex gap-2.5 items-start opacity-40">
                  <div class="w-[2px] rounded-full bg-accent self-stretch shrink-0" />
                  <div>
                    <p class="text-[10px] text-muted-foreground font-medium mb-0.5">Mum</p>
                    <p class="text-xs text-foreground/70 leading-snug">"Did anyone see the photo from today?"</p>
                  </div>
                </div>
                <div class="flex gap-2.5 items-start opacity-60">
                  <div class="w-[2px] rounded-full bg-accent self-stretch shrink-0" />
                  <div>
                    <p class="text-[10px] text-muted-foreground font-medium mb-0.5">Dad</p>
                    <p class="text-xs text-foreground/70 leading-snug">"Which one? There are 200 messages…"</p>
                  </div>
                </div>
                <div class="flex gap-2.5 items-start">
                  <div class="w-[2px] rounded-full bg-border self-stretch shrink-0" />
                  <div>
                    <p class="text-[10px] text-muted-foreground font-medium mb-0.5">You</p>
                    <p class="text-xs text-muted-foreground leading-snug italic">Scrolling… scrolling…</p>
                  </div>
                </div>
              </div>
            </div>
            <h1 class="text-[1.6rem] font-bold text-foreground leading-[1.25] tracking-tight mb-3">
              Photos get buried.<br>
              Moments get lost.<br>
              <span class="text-accent">They deserved better.</span>
            </h1>
            <p class="text-sm text-muted-foreground leading-relaxed">
              Our Story keeps the memories that matter — beautifully, and forever.
            </p>
          </template>

          <!-- Screen 2: The solution -->
          <template v-else-if="currentScreen === 2">
            <!-- Memory timeline illustration -->
            <div class="rounded-2xl bg-card border border-border px-5 py-5 mb-8">
              <div class="flex items-stretch gap-4">
                <!-- Timeline spine -->
                <div class="flex flex-col items-center pt-1.5 pb-1">
                  <div class="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  <div class="w-[1px] flex-1 bg-gradient-to-b from-accent/40 to-border/30 my-1" />
                  <div class="w-1.5 h-1.5 rounded-full bg-border shrink-0" />
                </div>
                <!-- Entries -->
                <div class="flex-1 space-y-4">
                  <div>
                    <p class="font-['Caveat'] text-base text-accent leading-none mb-0.5">June 12, 2024</p>
                    <p class="text-sm font-semibold text-foreground">First steps</p>
                    <p class="text-[11px] text-muted-foreground mt-0.5">3 reactions from the family</p>
                  </div>
                  <div class="opacity-55">
                    <p class="font-['Caveat'] text-base text-muted-foreground leading-none mb-0.5">August 3, 2024</p>
                    <p class="text-sm font-semibold text-foreground">First word: "Dada"</p>
                    <p class="text-[11px] text-muted-foreground mt-0.5">Milestone</p>
                  </div>
                </div>
              </div>
            </div>
            <h1 class="text-[1.6rem] font-bold text-foreground leading-[1.25] tracking-tight mb-3">
              Your circle's story,<br>
              <span class="text-accent">beautifully kept.</span>
            </h1>
            <p class="text-sm text-muted-foreground leading-relaxed">
              Notes, milestones, and reactions — not just another folder of files.
            </p>
          </template>

          <!-- Screen 3: The promise -->
          <template v-else>
            <!-- Device illustration using SVG lines -->
            <div class="rounded-2xl bg-card border border-border px-5 py-6 mb-8 flex items-center justify-around gap-2">
              <!-- Phone -->
              <div class="flex flex-col items-center gap-2">
                <svg viewBox="0 0 36 60" class="w-8 h-auto text-foreground/80" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="2" width="32" height="56" rx="5" />
                  <line x1="14" y1="5.5" x2="22" y2="5.5" stroke-width="1.5" />
                  <circle cx="18" cy="53" r="2" />
                </svg>
                <p class="text-[11px] text-muted-foreground text-center leading-tight">iPhone &<br>Android</p>
              </div>
              <!-- Divider -->
              <div class="h-12 w-px bg-border" />
              <!-- Envelope / email -->
              <div class="flex flex-col items-center gap-2">
                <svg viewBox="0 0 48 36" class="w-10 h-auto text-foreground/80" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="2" width="44" height="32" rx="4" />
                  <polyline points="2,2 24,20 46,2" />
                </svg>
                <p class="text-[11px] text-muted-foreground text-center leading-tight">View by<br>email link</p>
              </div>
            </div>
            <h1 class="text-[1.6rem] font-bold text-foreground leading-[1.25] tracking-tight mb-3">
              Works for<br>
              <span class="text-accent">everyone.</span>
            </h1>
            <p class="text-sm text-muted-foreground leading-relaxed">
              iPhone, Android, or just an email. No one in the family gets left out.
            </p>
          </template>

        </div>
      </Transition>

      <!-- Actions -->
      <div class="mt-10 flex flex-col gap-3">
        <button
          v-if="currentScreen < 3"
          @click="next"
          class="w-full bg-primary text-primary-foreground rounded-[12px] py-3.5 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Next
        </button>
        <button
          v-else
          @click="finish"
          class="w-full bg-primary text-primary-foreground rounded-[12px] py-3.5 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Start your story
        </button>
        <button
          @click="skip"
          class="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Skip
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'onboarding' })

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
