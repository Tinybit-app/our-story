<template>
  <div class="min-h-screen bg-background flex flex-col items-center justify-center px-6">
    <div class="w-full max-w-sm">

      <p class="text-xs font-bold tracking-widest text-foreground uppercase mb-10 text-center">Our Story</p>

      <!-- Progress dots -->
      <div class="flex items-center justify-center gap-2 mb-10">
        <span
          v-for="i in 3"
          :key="i"
          data-testid="value-prop-dot"
          class="block h-1.5 rounded-full transition-all duration-300"
          :class="i === currentScreen ? 'w-6 bg-foreground' : 'w-1.5 bg-border'"
        />
      </div>

      <!-- Screen content -->
      <Transition name="slide" mode="out-in">
        <div :key="currentScreen">

          <!-- Screen 1: The pain -->
          <template v-if="currentScreen === 1">
            <div class="rounded-2xl bg-secondary border border-border p-5 mb-8 text-xs text-muted-foreground font-mono leading-relaxed">
              <p class="mb-1 text-foreground font-semibold text-sm">📱 Family Chat</p>
              <p>Mum: "Did anyone see the photo from today?"</p>
              <p>Dad: "Which one? There are 200 messages…"</p>
              <p class="text-muted-foreground/50">· · ·</p>
            </div>
            <h1 class="text-2xl font-bold text-foreground leading-snug mb-3">
              Photos get buried.<br>
              Group chats are noisy.<br>
              That moment deserved better.
            </h1>
            <p class="text-sm text-muted-foreground leading-relaxed">
              The memories that matter most get lost in the scroll. Our Story keeps them beautifully, forever.
            </p>
          </template>

          <!-- Screen 2: The solution -->
          <template v-else-if="currentScreen === 2">
            <div class="rounded-2xl bg-secondary border border-border p-5 mb-8 flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-sm">📸</div>
                <div>
                  <p class="text-xs font-semibold text-foreground">First steps</p>
                  <p class="text-[11px] text-muted-foreground">June 2024 · ❤️ 3 reactions</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-sm">✦</div>
                <div>
                  <p class="text-xs font-semibold text-foreground">First word: "Dada"</p>
                  <p class="text-[11px] text-muted-foreground">August 2024 · milestone</p>
                </div>
              </div>
            </div>
            <h1 class="text-2xl font-bold text-foreground leading-snug mb-3">
              Your circle's story, beautifully kept.
            </h1>
            <p class="text-sm text-muted-foreground leading-relaxed">
              Notes, milestones, and reactions — not just another folder of files.
            </p>
          </template>

          <!-- Screen 3: The promise -->
          <template v-else>
            <div class="rounded-2xl bg-secondary border border-border p-5 mb-8 flex items-center gap-4">
              <div class="flex-1 text-center">
                <p class="text-2xl mb-1">📱</p>
                <p class="text-[11px] text-muted-foreground">iPhone &<br>Android</p>
              </div>
              <div class="w-px h-10 bg-border" />
              <div class="flex-1 text-center">
                <p class="text-2xl mb-1">💻</p>
                <p class="text-[11px] text-muted-foreground">View by<br>email link</p>
              </div>
            </div>
            <h1 class="text-2xl font-bold text-foreground leading-snug mb-3">
              Works for everyone.
            </h1>
            <p class="text-sm text-muted-foreground leading-relaxed">
              iPhone, Android, or just an email. No one gets left out.
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
          Start your story →
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
  // If already seen, skip straight to circle type picker
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
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.slide-enter-from {
  opacity: 0;
  transform: translateX(16px);
}
.slide-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}
</style>
