<template>
  <div class="min-h-screen bg-background">

    <!-- Nav -->
    <header class="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border">
      <div class="max-w-[1280px] mx-auto px-5 py-3.5 flex items-center justify-between gap-4">
        <NuxtLink
          to="/"
          class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <p class="text-[9px] font-bold tracking-[0.18em] text-accent uppercase select-none">Our Story</p>
        </NuxtLink>
      </div>
    </header>

    <main class="max-w-[1280px] mx-auto px-5 py-16">
      <div class="max-w-[680px]">

        <p class="text-[9px] font-bold tracking-[0.18em] text-accent uppercase mb-4">Legal</p>
        <h1 class="font-display text-4xl font-bold text-foreground mb-3">Terms of Service</h1>
        <p class="text-sm text-muted-foreground mb-12">
          Effective date: <span class="text-foreground">[DATE]</span>
        </p>

        <div class="flex flex-col gap-10 text-sm leading-relaxed">

          <section>
            <h2 class="text-base font-semibold text-foreground mb-3">About these terms</h2>
            <p class="text-muted-foreground">
              These Terms of Service ("Terms") govern your use of Our Story, operated by
              <span class="text-foreground font-medium">[LEGAL ENTITY NAME]</span> ("<span class="text-foreground font-medium">we</span>", "<span class="text-foreground font-medium">us</span>", or "<span class="text-foreground font-medium">our</span>").
              By creating an account or using the app, you agree to these Terms.
              If you do not agree, do not use Our Story.
            </p>
          </section>

          <section>
            <h2 class="text-base font-semibold text-foreground mb-3">Your account</h2>
            <div class="flex flex-col gap-3 text-muted-foreground">
              <p>You must be 13 or older to use Our Story. By creating an account, you confirm that you meet this requirement.</p>
              <p>You are responsible for keeping your account secure. We use magic links and Google OAuth — there are no passwords to manage. If you believe your account has been compromised, contact us immediately.</p>
              <p>You may not create accounts on behalf of others without their consent, or use Our Story for any unlawful purpose.</p>
            </div>
          </section>

          <section>
            <h2 class="text-base font-semibold text-foreground mb-3">Your content</h2>
            <div class="flex flex-col gap-3 text-muted-foreground">
              <p>You own the photos, videos, and notes you upload to Our Story. We do not claim any ownership over your content.</p>
              <p>By uploading content, you grant us a limited licence to store, process, and deliver it to the members of your circle — solely for the purpose of operating the service. We do not use your content for any other purpose.</p>
              <p>You are responsible for ensuring you have the right to upload and share any content you add to Our Story. Do not upload content that infringes third-party rights, is illegal, or violates the rights or privacy of others.</p>
              <p>We reserve the right to remove content that violates these Terms, though we do not actively monitor user content.</p>
            </div>
          </section>

          <section>
            <h2 class="text-base font-semibold text-foreground mb-3">Circles and members</h2>
            <div class="flex flex-col gap-3 text-muted-foreground">
              <p>Circles are private and invite-only. As a circle owner, you are responsible for who you invite and the content shared within your circle.</p>
              <p>Circle owners may remove members at any time. Removed members lose access to the circle immediately.</p>
              <p>If you are a circle owner and you delete your account, you must first transfer ownership of any circles with other members, or delete those circles. We will prompt you to resolve this before your account can be deleted.</p>
            </div>
          </section>

          <section>
            <h2 class="text-base font-semibold text-foreground mb-3">Subscriptions and billing</h2>
            <div class="flex flex-col gap-3 text-muted-foreground">
              <p>Our Story offers a free tier and paid plans. Paid plans are billed monthly and can be cancelled at any time from Account Settings.</p>
              <p>Cancelling a paid plan downgrades your account to the Free tier at the end of the current billing period. Your existing memories are never deleted as a result of downgrading — new uploads are restricted only if you exceed the Free tier storage limit.</p>
              <p>We reserve the right to change pricing with at least 30 days' notice to existing subscribers.</p>
              <p>Refunds are handled on a case-by-case basis. Contact us at <span class="text-foreground font-medium">[SUPPORT EMAIL]</span> if you have a billing issue.</p>
            </div>
          </section>

          <section>
            <h2 class="text-base font-semibold text-foreground mb-3">Acceptable use</h2>
            <p class="text-muted-foreground mb-3">You agree not to:</p>
            <ul class="flex flex-col gap-2 text-muted-foreground">
              <li class="flex items-start gap-2">
                <svg class="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                Upload content that is illegal, abusive, harassing, or that violates the privacy or rights of others.
              </li>
              <li class="flex items-start gap-2">
                <svg class="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                Attempt to access another user's account or circle without authorisation.
              </li>
              <li class="flex items-start gap-2">
                <svg class="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                Reverse-engineer, scrape, or otherwise attempt to extract data from the service.
              </li>
              <li class="flex items-start gap-2">
                <svg class="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                Use the service in a way that could damage, disable, or impair its operation.
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-base font-semibold text-foreground mb-3">Service availability</h2>
            <p class="text-muted-foreground">
              We aim to keep Our Story available and reliable, but we do not guarantee uninterrupted access.
              We may perform maintenance, fix bugs, or update the service at any time.
              We will try to give advance notice of planned downtime where possible.
            </p>
          </section>

          <section>
            <h2 class="text-base font-semibold text-foreground mb-3">Termination</h2>
            <div class="flex flex-col gap-3 text-muted-foreground">
              <p>You may delete your account at any time from Account Settings.</p>
              <p>We may suspend or terminate accounts that violate these Terms, with or without notice depending on the severity of the violation. In cases of serious abuse, termination may be immediate.</p>
            </div>
          </section>

          <section>
            <h2 class="text-base font-semibold text-foreground mb-3">Limitation of liability</h2>
            <p class="text-muted-foreground">
              To the maximum extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of Our Story.
              Our total liability for any claim arising from these Terms or your use of the service is limited to the amount you paid us in the 12 months prior to the claim.
            </p>
          </section>

          <section>
            <h2 class="text-base font-semibold text-foreground mb-3">Governing law</h2>
            <p class="text-muted-foreground">
              These Terms are governed by the laws of <span class="text-foreground font-medium">[JURISDICTION]</span>.
              Any disputes will be resolved in the courts of <span class="text-foreground font-medium">[JURISDICTION]</span>.
            </p>
          </section>

          <section>
            <h2 class="text-base font-semibold text-foreground mb-3">Changes to these terms</h2>
            <p class="text-muted-foreground">
              We may update these Terms from time to time. If we make material changes, we will notify you by email at least 14 days before they take effect.
              Continued use of Our Story after that date constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 class="text-base font-semibold text-foreground mb-3">Contact</h2>
            <p class="text-muted-foreground">
              Questions about these Terms: <span class="text-foreground font-medium">[SUPPORT EMAIL]</span><br>
              <span class="text-foreground font-medium">[LEGAL ENTITY NAME]</span><br>
              <span class="text-foreground font-medium">[ADDRESS]</span>
            </p>
          </section>

        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="border-t border-border mt-16">
      <div class="max-w-[1280px] mx-auto px-5 py-6 flex items-center justify-between gap-4 flex-wrap">
        <p class="text-[9px] font-bold tracking-[0.18em] text-accent uppercase select-none">Our Story</p>
        <div class="flex items-center gap-5">
          <NuxtLink to="/privacy" class="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy</NuxtLink>
          <NuxtLink to="/terms" class="text-xs text-foreground font-medium">Terms</NuxtLink>
          <NuxtLink to="/pricing" class="text-xs text-muted-foreground hover:text-foreground transition-colors">Pricing</NuxtLink>
        </div>
      </div>
    </footer>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ auth: false })

useSeoMeta({
  title: 'Terms of Service — Our Story',
  description: 'The terms governing your use of Our Story.',
})
</script>
