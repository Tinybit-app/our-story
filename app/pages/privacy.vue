<template>
  <div class="min-h-screen bg-background">
    <!-- Nav -->
    <header class="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
      <div class="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 py-3.5">
        <NuxtLink
          to="/"
          class="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <p class="select-none text-[9px] font-bold uppercase tracking-[0.18em] text-accent">
            Our Story
          </p>
        </NuxtLink>
      </div>
    </header>

    <main class="mx-auto max-w-[1280px] px-5 py-16">
      <div class="max-w-[680px]">
        <p class="mb-4 text-[9px] font-bold uppercase tracking-[0.18em] text-accent">Legal</p>
        <h1 class="mb-3 font-display text-4xl font-bold text-foreground">Privacy Policy</h1>
        <p class="mb-12 text-sm text-muted-foreground">
          Effective date: <span class="text-foreground">[DATE]</span>
        </p>

        <div class="flex flex-col gap-10 text-sm leading-relaxed">
          <section>
            <h2 class="mb-3 text-base font-semibold text-foreground">Who we are</h2>
            <p class="text-muted-foreground">
              Our Story is a private photo-sharing and memory app operated by
              <span class="font-medium text-foreground">[LEGAL ENTITY NAME]</span> ("<span
                class="font-medium text-foreground"
                >we</span
              >", "<span class="font-medium text-foreground">us</span>", or "<span
                class="font-medium text-foreground"
                >our</span
              >"), incorporated in <span class="font-medium text-foreground">[JURISDICTION]</span>.
              You can reach us at
              <span class="font-medium text-foreground">[PRIVACY EMAIL]</span> for any
              privacy-related questions.
            </p>
          </section>

          <section>
            <h2 class="mb-3 text-base font-semibold text-foreground">What we collect</h2>
            <div class="flex flex-col gap-4 text-muted-foreground">
              <div>
                <p class="mb-1 font-medium text-foreground">Account information</p>
                <p>
                  Your email address, and optionally your first and last name, when you create an
                  account or accept an invite.
                </p>
              </div>
              <div>
                <p class="mb-1 font-medium text-foreground">Photos and videos</p>
                <p>
                  Media files you upload to your circle. These are stored privately and are only
                  accessible to members of the circle you share them with.
                </p>
              </div>
              <div>
                <p class="mb-1 font-medium text-foreground">Notes and captions</p>
                <p>Text you add to memories, milestones, and comments.</p>
              </div>
              <div>
                <p class="mb-1 font-medium text-foreground">Usage data</p>
                <p>
                  Anonymous product analytics (page views, feature usage) via PostHog to help us
                  understand how the app is used and improve it. This data is not linked to your
                  identity and is never sold.
                </p>
              </div>
              <div>
                <p class="mb-1 font-medium text-foreground">Error logs</p>
                <p>
                  Crash reports and error traces via Sentry to help us diagnose bugs. These may
                  include your user ID and the page you were on, but never the content of your
                  memories.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 class="mb-3 text-base font-semibold text-foreground">What we do not do</h2>
            <ul class="flex flex-col gap-2 text-muted-foreground">
              <li class="flex items-start gap-2">
                <svg
                  class="mt-0.5 h-4 w-4 flex-shrink-0 text-accent"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                We do not sell your data to any third party.
              </li>
              <li class="flex items-start gap-2">
                <svg
                  class="mt-0.5 h-4 w-4 flex-shrink-0 text-accent"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                We do not use your photos or memories to train any AI or machine learning model.
              </li>
              <li class="flex items-start gap-2">
                <svg
                  class="mt-0.5 h-4 w-4 flex-shrink-0 text-accent"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                We do not show you ads of any kind.
              </li>
              <li class="flex items-start gap-2">
                <svg
                  class="mt-0.5 h-4 w-4 flex-shrink-0 text-accent"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                We do not make your photos or circles publicly discoverable. Every circle is
                invite-only.
              </li>
              <li class="flex items-start gap-2">
                <svg
                  class="mt-0.5 h-4 w-4 flex-shrink-0 text-accent"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                We do not access or view your photos except to store and deliver them to you and
                your circle members.
              </li>
            </ul>
          </section>

          <section>
            <h2 class="mb-3 text-base font-semibold text-foreground">How we store your data</h2>
            <p class="mb-3 text-muted-foreground">
              Your data is stored on
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noopener"
                class="text-foreground underline underline-offset-2 transition-colors hover:text-accent"
                >Supabase</a
              >, which stores data on AWS infrastructure. Photos and videos are stored in private
              storage buckets — files are never publicly accessible by URL. All access to media is
              via short-lived signed URLs generated on-demand for authenticated circle members only.
            </p>
            <p class="text-muted-foreground">
              Data is stored in the
              <span class="font-medium text-foreground">[SUPABASE REGION]</span> region.
            </p>
          </section>

          <section>
            <h2 class="mb-3 text-base font-semibold text-foreground">
              Data retention and deletion
            </h2>
            <div class="flex flex-col gap-3 text-muted-foreground">
              <p>
                When you delete your account, it is immediately deactivated. After a 30-day grace
                period, all your data is permanently and irreversibly deleted — including photos,
                videos, notes, and your profile. You can cancel deletion any time within those 30
                days by signing back in.
              </p>
              <p>
                When a circle owner deletes a circle, all memories and member data in that circle
                are permanently deleted after 30 days. All members are notified by email.
              </p>
              <p>
                If you are removed from a circle, your reactions are removed immediately. Your
                uploaded photos may remain in the circle if the circle owner chooses to keep them,
                or may be deleted — you will be informed of this choice at the time of removal.
              </p>
            </div>
          </section>

          <section>
            <h2 class="mb-3 text-base font-semibold text-foreground">Your rights</h2>
            <div class="flex flex-col gap-3 text-muted-foreground">
              <p>
                Depending on where you live, you may have the right to access, correct, export, or
                delete the personal data we hold about you.
              </p>
              <p>
                <span class="font-medium text-foreground">Access and export:</span> You can request
                a full export of your data (photos, videos, notes) at any time from Account Settings
                → Export your data.
              </p>
              <p>
                <span class="font-medium text-foreground">Correction:</span> You can update your
                name and email from Account Settings at any time.
              </p>
              <p>
                <span class="font-medium text-foreground">Deletion:</span> You can delete your
                account from Account Settings. All data is permanently removed after the 30-day
                grace period.
              </p>
              <p>
                To exercise any other rights or make a privacy request, email us at
                <span class="font-medium text-foreground">[PRIVACY EMAIL]</span>. We will respond
                within 30 days.
              </p>
            </div>
          </section>

          <section>
            <h2 class="mb-3 text-base font-semibold text-foreground">Cookies</h2>
            <p class="text-muted-foreground">
              We use a small number of essential cookies: one to keep you signed in (managed by
              Supabase Auth), one to remember your language preference, and one to remember your
              light/dark mode preference. We do not use advertising or tracking cookies.
            </p>
          </section>

          <section>
            <h2 class="mb-3 text-base font-semibold text-foreground">Children's privacy</h2>
            <p class="text-muted-foreground">
              Our Story is not directed at children under 13. We do not knowingly collect personal
              information from children under 13. If you believe a child under 13 has provided us
              with personal data, please contact us at
              <span class="font-medium text-foreground">[PRIVACY EMAIL]</span> and we will delete
              it.
            </p>
          </section>

          <section>
            <h2 class="mb-3 text-base font-semibold text-foreground">Changes to this policy</h2>
            <p class="text-muted-foreground">
              If we make material changes to this policy, we will notify you by email at least 14
              days before the changes take effect. The current version is always available at this
              URL.
            </p>
          </section>

          <section>
            <h2 class="mb-3 text-base font-semibold text-foreground">Contact</h2>
            <p class="text-muted-foreground">
              For privacy questions or requests:
              <span class="font-medium text-foreground">[PRIVACY EMAIL]</span><br />
              <span class="font-medium text-foreground">[LEGAL ENTITY NAME]</span><br />
              <span class="font-medium text-foreground">[ADDRESS]</span>
            </p>
          </section>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="mt-16 border-t border-border">
      <div
        class="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-5 py-6"
      >
        <p class="select-none text-[9px] font-bold uppercase tracking-[0.18em] text-accent">
          Our Story
        </p>
        <div class="flex items-center gap-5">
          <NuxtLink to="/privacy" class="text-xs font-medium text-foreground">Privacy</NuxtLink>
          <NuxtLink
            to="/terms"
            class="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >Terms</NuxtLink
          >
          <NuxtLink
            to="/pricing"
            class="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >Pricing</NuxtLink
          >
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ auth: false })

useSeoMeta({
  title: 'Privacy Policy — Our Story',
  description: 'How Our Story collects, uses, and protects your data.',
})
</script>
