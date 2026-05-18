<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <header
      class="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md"
    >
      <div
        class="mx-auto flex max-w-[1280px] items-center gap-2 px-4 py-3 sm:gap-3 sm:px-5 sm:py-3.5"
      >
        <!-- Circle name / member count -->
        <div class="min-w-0 flex-1">
          <p
            class="mb-1.5 select-none text-[9px] font-bold uppercase leading-none tracking-[0.18em] text-accent"
          >
            Our Story
          </p>
          <div class="flex min-w-0 items-center gap-1.5">
            <!-- Circle name — clickable when user has multiple circles -->
            <button
              class="flex items-center gap-1 truncate text-sm font-semibold leading-none text-foreground transition-opacity hover:opacity-70"
              @click="circleSwitcherOpen = true"
            >
              {{ circle?.name ?? '…' }}
              <svg
                class="h-3 w-3 flex-shrink-0 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <!-- Circle settings shortcut (owner only). Hidden on mobile —
                 accessible via the avatar dropdown's profile flow instead. -->
            <NuxtLink
              v-if="circle?.role === 'owner'"
              :to="circleId ? `/circle-settings?circle=${circleId}` : '/circle-settings'"
              class="hidden flex-shrink-0 rounded p-1 text-muted-foreground/40 transition-colors hover:text-muted-foreground sm:block"
              :title="t('nav.circleSettings')"
            >
              <svg
                class="h-3 w-3"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                />
              </svg>
            </NuxtLink>
            <!-- Notification settings (all members). Hidden on mobile. -->
            <NuxtLink
              :to="circleId ? `/notification-settings?circle=${circleId}` : '/notification-settings'"
              class="hidden flex-shrink-0 rounded p-1 text-muted-foreground/40 transition-colors hover:text-muted-foreground sm:block"
              :title="t('notificationSettings.title')"
            >
              <svg
                class="h-3 w-3"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </NuxtLink>
            <template v-if="circle?.memberCount">
              <span
                class="hidden flex-shrink-0 text-xs leading-none text-border sm:inline"
                >/</span
              >
              <NuxtLink
                :to="circleId ? `/members?circle=${circleId}` : '/members'"
                class="group hidden flex-shrink-0 items-center gap-1 whitespace-nowrap text-[11px] leading-none text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              >
                {{ t('nav.members', circle.memberCount) }}
                <svg
                  class="h-2.5 w-2.5 -translate-x-1 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </NuxtLink>
            </template>
          </div>
          <!-- Anniversary display: "Year N together · Since [date]" -->
          <p
            v-if="anniversaryDisplay"
            class="mt-1 select-none text-[10px] leading-none text-muted-foreground/70"
          >
            {{ anniversaryDisplay }}
          </p>
        </div>

        <!-- Year pill -->
        <button
          v-if="currentYear"
          class="flex h-7 flex-shrink-0 items-center gap-1 rounded-full border border-border px-3 text-[11px] font-semibold text-foreground transition-colors hover:bg-secondary"
          @click="openJump"
        >
          {{ currentYear }}
          <svg
            class="h-3 w-3 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        <!-- Add memory — icon-only on mobile, icon+label on sm+ -->
        <button
          v-if="circleId"
          class="flex h-8 flex-shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary text-[11px] font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-95 sm:h-7 sm:pl-2.5 sm:pr-3"
          :class="'aspect-square sm:aspect-auto'"
          :title="t('nav.addMemory')"
          :aria-label="t('nav.addMemory')"
          @click="addMemorySheetOpen = true"
        >
          <svg
            class="h-4 w-4 flex-shrink-0 sm:h-3.5 sm:w-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path
              d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
            />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span class="hidden sm:inline">{{ t('nav.addMemory') }}</span>
        </button>

        <!-- Share link (owner only) — icon-only on mobile -->
        <button
          v-if="circle?.role === 'owner'"
          type="button"
          class="flex h-8 flex-shrink-0 items-center justify-center gap-1.5 rounded-full border border-border text-[11px] font-semibold text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground sm:h-7 sm:px-3"
          :class="'aspect-square sm:aspect-auto'"
          :title="t('viewerLink.shareButton')"
          :aria-label="t('viewerLink.shareButton')"
          @click="openShareSheet"
        >
          <svg
            class="h-4 w-4 sm:h-3.5 sm:w-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path
              d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
            />
            <path
              d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
            />
          </svg>
          <span class="hidden sm:inline">{{
            t('viewerLink.shareButton')
          }}</span>
        </button>

        <!-- Language toggle — desktop only. Mobile users get an inline
             pill switcher inside the user dropdown below. -->
        <LocalePicker class="hidden flex-shrink-0 sm:flex" />

        <!-- Avatar + dropdown -->
        <div ref="menuRef" class="relative flex-shrink-0">
          <button
            class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-secondary ring-2 ring-border transition-all hover:ring-ring"
            @click="menuOpen = !menuOpen"
          >
            <img
              v-if="userAvatarUrl"
              :src="userAvatarUrl"
              class="h-full w-full object-cover"
            />
            <span v-else class="text-[10px] font-bold text-foreground">{{
              userInitials
            }}</span>
          </button>

          <!-- Dropdown -->
          <Transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="opacity-0 scale-95 -translate-y-1"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="opacity-100 scale-100 translate-y-0"
            leave-to-class="opacity-0 scale-95 -translate-y-1"
          >
            <div
              v-if="menuOpen"
              class="absolute right-0 top-full mt-2 w-56 origin-top-right overflow-hidden rounded-[14px] border border-border bg-card shadow-xl"
            >
              <!-- User identity -->
              <div class="border-b border-border px-4 py-3">
                <p class="truncate text-sm font-semibold text-foreground">
                  {{ userDisplayName }}
                </p>
                <p class="mt-0.5 truncate text-xs text-muted-foreground">
                  {{ authUser?.email }}
                </p>
              </div>

              <!-- Actions -->
              <div class="py-1">
                <NuxtLink
                  to="/settings/account"
                  class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                  @click="menuOpen = false"
                >
                  <svg
                    class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                  {{ t('nav.profileSettings') }}
                </NuxtLink>

                <!-- Members / Notifications / Circle settings: mobile-only.
                     On sm+ the inline header icons handle these entry points,
                     so showing them here too is redundant. -->
                <NuxtLink
                  v-if="circle?.memberCount"
                  :to="circleId ? `/members?circle=${circleId}` : '/members'"
                  class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary sm:hidden"
                  @click="menuOpen = false"
                >
                  <svg
                    class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  {{ t('nav.members', circle.memberCount) }}
                </NuxtLink>

                <NuxtLink
                  :to="circleId ? `/notification-settings?circle=${circleId}` : '/notification-settings'"
                  class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary sm:hidden"
                  @click="menuOpen = false"
                >
                  <svg
                    class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {{ t('notificationSettings.title') }}
                </NuxtLink>

                <NuxtLink
                  v-if="circle?.role === 'owner'"
                  :to="circleId ? `/circle-settings?circle=${circleId}` : '/circle-settings'"
                  class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary sm:hidden"
                  @click="menuOpen = false"
                >
                  <svg
                    class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path
                      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                    />
                  </svg>
                  {{ t('nav.circleSettings') }}
                </NuxtLink>

                <button
                  v-if="canInvite"
                  class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                  @click="((menuOpen = false), (inviteOpen = true))"
                >
                  <svg
                    class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                  {{ t('nav.inviteMember') }}
                </button>

                <!-- Language picker — mobile only.
                     Desktop has the LocalePicker pill in the header.
                     On mobile the header is icon-only for space, so this row
                     gives mobile users the same control without leaving the page. -->
                <div
                  class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground sm:hidden"
                >
                  <svg
                    class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
                  </svg>
                  <div class="flex flex-1 gap-0.5 rounded-[10px] border border-border bg-card p-0.5">
                    <button
                      v-for="loc in locales"
                      :key="loc.code"
                      @click="pickLocale(loc.code)"
                      class="flex-1 rounded-[8px] px-2 py-1 text-xs font-medium transition-colors"
                      :class="
                        locale === loc.code
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:text-foreground'
                      "
                    >
                      {{ (loc as any).shortLabel ?? loc.code.toUpperCase() }}
                    </button>
                  </div>
                </div>

                <!-- Theme toggle -->
                <button
                  class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                  @click="toggleTheme"
                >
                  <svg
                    v-if="isDark"
                    class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="5" />
                    <path
                      d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                    />
                  </svg>
                  <svg
                    v-else
                    class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                  {{ isDark ? t('nav.lightMode') : t('nav.darkMode') }}
                </button>

                <div class="mx-3 h-px bg-border" />
                <button
                  class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-secondary"
                  @click="doLogout"
                >
                  <svg
                    class="h-3.5 w-3.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  {{ t('nav.logOut') }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </header>

    <!-- Feed -->
    <main class="mx-auto max-w-[1280px] px-5 py-6">
      <PushPromptBanner />
      <InstallPromptBanner />
      <MilestoneBanner
        :milestone="upcomingMilestone"
        :enabled="milestoneNudgesEnabled"
        @add="onMilestoneAdd"
      />
      <!-- Timeline -->
      <TimelineMosaic
        ref="timelineMosaicRef"
        :month-groups="monthGroups"
        :loading="loading"
        :has-next-page="!!prevYear"
        :circle-type="circle?.circle_type ?? null"
        :circle-id="circleId"
        @load-more="fetchTimeline(prevYear ?? undefined)"
        @year-change="onYearChange"
        @open-memory="onOpenMemory"
      />
    </main>

    <!-- Jump modal -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="jumpOpen"
        class="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20"
      >
        <div
          class="absolute inset-0 bg-black/45 backdrop-blur-sm"
          @click="jumpOpen = false"
        />
        <div
          class="relative w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl"
          @click.stop
        >
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-foreground">
              {{ t('nav.jumpTo') }}
            </h2>
            <button
              class="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
              @click="jumpOpen = false"
            >
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div
            v-for="info in yearInfos"
            :key="info.year"
            class="mb-4 last:mb-0"
          >
            <div
              class="grid gap-1.5"
              style="grid-template-columns: 44px repeat(12, 1fr)"
            >
              <button
                class="py-1 text-left text-xs font-bold text-foreground transition-colors hover:text-accent"
                @click="jumpToYear(info.year)"
              >
                {{ info.year }}
              </button>
              <button
                v-for="m in 12"
                :key="m"
                class="h-7 rounded text-[10px] font-medium transition-colors"
                :class="
                  info.months.includes(m)
                    ? 'cursor-pointer bg-secondary text-muted-foreground hover:bg-accent hover:text-background'
                    : 'pointer-events-none cursor-default bg-transparent text-transparent'
                "
                :disabled="!info.months.includes(m)"
                @click="jumpToMonth(info.year, m)"
              >
                {{ info.months.includes(m) ? monthAbbr(m) : '' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Invite member dialog -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="inviteOpen"
        class="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="closeInvite"
        />

        <!-- Sheet -->
        <div
          class="relative w-full max-w-sm rounded-[20px] border border-border bg-card p-6 shadow-2xl"
        >
          <h2 class="mb-1 font-display text-lg font-bold text-foreground">
            {{ t('nav.inviteSomeone') }}
          </h2>
          <p class="mb-5 text-xs text-muted-foreground">
            {{ t('nav.inviteDesc', { circle: circle?.name ?? 'your circle' }) }}
          </p>

          <form @submit.prevent="sendInvite">
            <input
              v-model="inviteEmail"
              type="email"
              placeholder="their@email.com"
              required
              :disabled="inviteSending"
              class="mb-3 w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />

            <p v-if="inviteError" class="mb-3 text-xs text-destructive">
              {{ inviteError }}
            </p>
            <p
              v-if="inviteSentTo"
              class="mb-3 text-xs text-green-600 dark:text-green-400"
            >
              {{ t('nav.inviteSentTo', { email: inviteSentTo }) }}
            </p>

            <div class="flex gap-2">
              <button
                type="button"
                class="flex-1 rounded-[10px] border border-border py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                @click="closeInvite"
              >
                {{ t('nav.cancel') }}
              </button>
              <button
                type="submit"
                :disabled="inviteSending || !inviteEmail"
                class="flex-1 rounded-[10px] bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {{ inviteSending ? t('nav.sending') : t('nav.sendInvite') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- Upload memory (headless) -->
    <UploadMemory
      v-if="circleId"
      ref="uploadRef"
      :circle-id="circleId"
      :circle-type="circle?.circle_type ?? null"
      :children="children"
      :members="members"
      :prefill-milestone-label="prefillMilestoneLabel"
      hide-trigger
      @uploaded="onUploaded"
    />

    <!-- Add memory choice sheet -->
    <AddMemorySheet
      :open="addMemorySheetOpen"
      @close="addMemorySheetOpen = false"
      @photo="onChoosePhoto"
      @quick-note="onChooseQuickNote"
    />

    <!-- Quick note form -->
    <QuickNoteForm
      v-if="quickNoteOpen && circleId"
      :circle-id="circleId"
      :members="members"
      :children="children"
      @close="quickNoteOpen = false"
      @saved="onQuickNoteSaved"
    />

    <!-- Circle switcher -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="circleSwitcherOpen"
        class="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="circleSwitcherOpen = false"
        />
        <div
          class="relative w-full max-w-sm overflow-hidden rounded-[20px] border border-border bg-card shadow-2xl"
        >
          <!-- Header -->
          <div class="border-b border-border px-5 pb-3 pt-5">
            <p
              class="text-xs font-bold uppercase tracking-widest text-muted-foreground"
            >
              {{ t('nav.yourCircles') }}
            </p>
          </div>

          <!-- Circle list -->
          <ul class="px-3 py-2">
            <li v-for="c in allCircles" :key="c.id">
              <button
                class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors"
                :class="
                  c.id === circleId ? 'bg-secondary' : 'hover:bg-secondary/60'
                "
                @click="switchCircle(c.id)"
              >
                <div
                  class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-xs font-bold text-foreground"
                >
                  {{ c.name?.[0]?.toUpperCase() ?? '?' }}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-foreground">
                    {{ c.name }}
                  </p>
                  <p class="text-[11px] text-muted-foreground">
                    {{ roleLabel(c.role) }}
                  </p>
                </div>
                <svg
                  v-if="c.id === circleId"
                  class="h-4 w-4 flex-shrink-0 text-foreground"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            </li>
          </ul>

          <!-- Create new circle -->
          <div class="mt-1 border-t border-border px-3 pb-3 pt-1">
            <button
              class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-secondary/60"
              @click="startNewCircle"
            >
              <div
                class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-border"
              >
                <svg
                  class="h-4 w-4 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <p class="text-sm font-medium text-foreground">
                {{ t('nav.createNewCircle') }}
              </p>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Unified memory modal (handles photo, video, and quick note) -->
    <MemoryShell
      :memories="memoriesFlat"
      :start-index="selectedIndex"
      :origin-rect="selectedRect"
      :tilt="selectedTilt"
      :children="children"
      :members="members"
      @close="selectedIndex = null"
      @update="onMemoryUpdate"
    />

    <!-- Viewer link management sheets (owner-only) -->
    <ShareLinksSheet
      ref="shareLinksSheetRef"
      :open="shareSheetOpen"
      :circle-id="circleId ?? ''"
      @close="shareSheetOpen = false"
      @create="((createSheetOpen = true), (editingLink = null))"
      @renew="renewViewerLink"
      @edit="
        (link) => {
          editingLink = {
            id: link.id,
            memoryIds: link.memoryIds ?? [],
            label: link.label,
          }
          createSheetOpen = true
        }
      "
    />
    <CreateLinkSheet
      :open="createSheetOpen"
      :circle-id="circleId ?? ''"
      :edit-link="editingLink"
      @close="((createSheetOpen = false), (editingLink = null))"
      @created="onLinkCreated"
    />
  </div>
</template>

<script setup lang="ts">
import type { Memory } from '~/composables/useTimeline'
import { useAnalytics } from '~/composables/useAnalytics'
import { useOnboardingIntent } from '~/composables/useOnboardingIntent'

// ── i18n ───────────────────────────────────────────────────
const { t, locale, locales, setLocale } = useI18n()

async function pickLocale(code: string) {
  await setLocale(code as 'en' | 'zh-CN' | 'fr')
  $fetch('/api/profile', { method: 'PATCH', body: { locale: code } }).catch(
    () => {},
  )
}
const { track } = useAnalytics()

// Locale-aware month abbreviation using Intl (auto-adapts to zh-CN)
function monthAbbr(month: number): string {
  return new Intl.DateTimeFormat(locale.value, { month: 'short' }).format(
    new Date(2000, month - 1, 1),
  )
}

// ── Memory modal ───────────────────────────────────────────
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
  rect: DOMRect | null
}) {
  selectedRect.value = rect
  selectedTilt.value = tilt
  selectedIndex.value = memoriesFlat.value.findIndex((m) => m.id === memory.id)
}

function onMemoryUpdate(patch: Pick<Memory, 'id'> & Partial<Memory>) {
  const i = memoriesFlat.value.findIndex((m) => m.id === patch.id)
  if (i !== -1)
    memoriesFlat.value[i] = { ...memoriesFlat.value[i], ...patch } as Memory
}

const supabase = useSupabaseClient()
const authUser = useSupabaseUser()
const router = useRouter()

// ── User identity ──────────────────────────────────────────
const { data: profile } = await useFetch<{
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  locale: string | null
}>('/api/profile')

// Apply saved locale from DB profile
if (profile.value?.locale) {
  setLocale(profile.value.locale as 'en' | 'zh-CN')
}

const userAvatarUrl = computed(() => profile.value?.avatarUrl ?? null)

const userDisplayName = computed(() => {
  const parts = [profile.value?.firstName, profile.value?.lastName].filter(
    Boolean,
  )
  return parts.length
    ? parts.join(' ')
    : (authUser.value?.email?.split('@')[0] ?? 'You')
})

const userInitials = computed(() => {
  const first = profile.value?.firstName?.[0] ?? ''
  const last = profile.value?.lastName?.[0] ?? ''
  return (
    (first + last).toUpperCase() ||
    userDisplayName.value.slice(0, 2).toUpperCase()
  )
})

// ── Dropdown ───────────────────────────────────────────────
const menuOpen = ref(false)
const menuRef = ref<HTMLElement>()
const uploadRef = ref<{ open: () => void; isOpen: ComputedRef<boolean> }>()

// ── Add memory sheet ───────────────────────────────────────
const addMemorySheetOpen = ref(false)
const quickNoteOpen = ref(false)
const prefillMilestoneLabel = ref<string | undefined>(undefined)

function onChoosePhoto() {
  addMemorySheetOpen.value = false
  nextTick(() => uploadRef.value?.open())
}

function onMilestoneAdd(labelSuggestion: string) {
  prefillMilestoneLabel.value = labelSuggestion
  nextTick(() => uploadRef.value?.open())
}

function onChooseQuickNote() {
  addMemorySheetOpen.value = false
  quickNoteOpen.value = true
}

function onQuickNoteSaved() {
  quickNoteOpen.value = false
  fetchTimeline()
}
onClickOutside(menuRef, () => {
  menuOpen.value = false
})

// ── Theme ──────────────────────────────────────────────────
const colorMode = useColorMode()
const prefersDark = usePreferredDark()
const isDark = computed(() =>
  colorMode.preference === 'system'
    ? prefersDark.value
    : colorMode.preference === 'dark',
)
function toggleTheme() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
  menuOpen.value = false
}

// ── Auth ───────────────────────────────────────────────────
async function doLogout() {
  const { clear } = useUserState()
  await supabase.auth.signOut()
  clear()
  router.replace('/login')
}

// ── Data ───────────────────────────────────────────────────
const route = useRoute()
const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
const allCircles = computed(() => circlesData.value?.circles ?? [])

// Active circle: prefer ?circle=<id> URL param, fallback to first
const circle = computed(() => {
  const paramId = route.query.circle as string | undefined
  if (paramId) {
    const found = allCircles.value.find((c: any) => c.id === paramId)
    if (found) return found
  }
  return allCircles.value[0] ?? null
})
const circleId = computed<string | null>(() => circle.value?.id ?? null)

// Anniversary display — available to all circle types
const anniversaryDisplay = computed(() => {
  const c = circle.value
  if (!c?.anniversary_date) return null
  return computeAnniversaryDisplay(
    c.anniversary_date,
    new Date(),
    locale.value,
    c.circle_type,
    c.name,
  )
})

interface ChildProfile {
  id: string
  name: string
  date_of_birth: string
}
interface CircleMember {
  userId: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
}

const memoriesFlat = ref<Memory[]>([])
const monthCounts = ref<Record<string, number>>({})
const prevYear = ref<number | null>(null)
const children = ref<ChildProfile[]>([])
const members = ref<CircleMember[]>([])
const loading = ref(false)

interface UpcomingMilestone {
  scopeType: 'child' | 'couple' | 'trip'
  name: string
  milestoneKey: string
  phase: 'T-3' | 'T0' | 'T+3'
  daysUntil: number
  milestoneLabelSuggestion: string
}

const upcomingMilestone = ref<UpcomingMilestone | null>(null)
const milestoneNudgesEnabled = ref(true)

async function fetchTimeline(year?: number) {
  if (loading.value || !circleId.value) return
  loading.value = true
  try {
    const data = await $fetch<{
      memories: Memory[]
      prevYear: number | null
      monthCounts?: Record<string, number>
      children: ChildProfile[]
      members: CircleMember[]
      upcomingMilestone?: UpcomingMilestone | null
      milestoneNudgesEnabledForActiveCircle?: boolean
    }>('/api/timeline', {
      query: { circleId: circleId.value, ...(year ? { year } : {}) },
    })
    memoriesFlat.value = year
      ? [...memoriesFlat.value, ...data.memories]
      : data.memories
    monthCounts.value = year
      ? { ...monthCounts.value, ...(data.monthCounts ?? {}) }
      : (data.monthCounts ?? {})
    prevYear.value = data.prevYear
    if (!year) {
      children.value = data.children ?? []
      members.value = data.members ?? []
      upcomingMilestone.value = data.upcomingMilestone ?? null
      milestoneNudgesEnabled.value =
        data.milestoneNudgesEnabledForActiveCircle ?? true
    }
  } catch (err) {
    console.error('[timeline] fetch error:', err)
  } finally {
    loading.value = false
  }
}

function onUploaded() {
  fetchTimeline()
}

onMounted(() => fetchTimeline())

const { monthGroups, yearInfos } = useTimeline(memoriesFlat, monthCounts)

// ── Year badge ─────────────────────────────────────────────
const currentYear = ref<number | null>(null)
const timelineMosaicRef = ref<{ scrollToYear: (y: number) => void }>()

function onYearChange(year: number) {
  currentYear.value = year
}

watch(
  monthGroups,
  (groups) => {
    if (groups.length && !currentYear.value) {
      currentYear.value = groups[0]?.year ?? null
    }
  },
  { immediate: true },
)

// ── Jump modal ─────────────────────────────────────────────
const jumpOpen = ref(false)

function openJump() {
  jumpOpen.value = true
  menuOpen.value = false
}

function jumpToYear(year: number) {
  jumpOpen.value = false
  nextTick(() => timelineMosaicRef.value?.scrollToYear(year))
}

function jumpToMonth(year: number, month: number) {
  jumpOpen.value = false
  // Wait for the modal leave transition (100ms) to complete before scrolling
  setTimeout(() => {
    const el = document.getElementById(`month-${year}-${month}`)
    if (el)
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 120,
        behavior: 'smooth',
      })
  }, 120)
}

// ── Circle switcher ────────────────────────────────────────
const circleSwitcherOpen = ref(false)

function roleLabel(role: string): string {
  if (role === 'owner') return t('members.roleOwner')
  if (role === 'admin') return t('members.roleAdmin')
  return t('members.roleMember')
}

function switchCircle(id: string) {
  circleSwitcherOpen.value = false
  memoriesFlat.value = []
  monthCounts.value = {}
  prevYear.value = null
  // Only put ?circle= in the URL when it's not the default first circle,
  // so single-circle users see a clean /timeline URL.
  const isDefault = allCircles.value[0]?.id === id
  router.push({ query: isDefault ? {} : { circle: id } })
}

function startNewCircle() {
  circleSwitcherOpen.value = false
  useOnboardingIntent().value = true
  router.push('/onboarding')
}

// Reload timeline when the active circle changes
watch(circleId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    memoriesFlat.value = []
    monthCounts.value = {}
    prevYear.value = null
    currentYear.value = null
    fetchTimeline()
  }
})

// ── Invite ─────────────────────────────────────────────────
const canInvite = computed(() => {
  const role = circle.value?.role
  return role === 'owner' || role === 'admin'
})

const inviteOpen = ref(false)
const inviteEmail = ref('')
const inviteSending = ref(false)
const inviteError = ref('')
const inviteSentTo = ref('')

function closeInvite() {
  inviteOpen.value = false
  inviteEmail.value = ''
  inviteError.value = ''
  inviteSentTo.value = ''
}

async function sendInvite() {
  if (!circleId.value || !inviteEmail.value) return
  inviteSending.value = true
  inviteError.value = ''
  inviteSentTo.value = ''
  try {
    await $fetch('/api/circles/invite', {
      method: 'POST',
      body: { circleId: circleId.value, email: inviteEmail.value },
    })
    track('member_invited', {
      circle_id: circleId.value,
      invite_method: 'link',
    })
    inviteSentTo.value = inviteEmail.value
    inviteEmail.value = ''
  } catch (err: any) {
    const msg = err?.data?.message ?? ''
    if (msg.includes('already been sent'))
      inviteError.value = t('nav.inviteAlreadySent')
    else if (msg.includes('Max 10'))
      inviteError.value = t('nav.inviteMaxPending')
    else inviteError.value = t('nav.inviteFailed')
  } finally {
    inviteSending.value = false
  }
}

// ── Viewer links (owner-only) ──────────────────────────────────────────────────
const shareSheetOpen = ref(false)
const createSheetOpen = ref(false)
const editingLink = ref<{
  id: string
  memoryIds: string[]
  label: string
} | null>(null)
const shareLinksSheetRef = ref<{ refresh: () => void } | null>(null)

function openShareSheet() {
  shareSheetOpen.value = true
}

async function renewViewerLink(link: { id: string }) {
  if (!circleId.value) return
  try {
    await $fetch(`/api/circles/${circleId.value}/viewer-links/${link.id}`, {
      method: 'DELETE',
    })
    createSheetOpen.value = true
  } catch {
    // Error logged server-side; silently ignore on client — user can try again from the sheet
  }
}

function onLinkCreated() {
  // Refresh the sheet list after a new link is created
  shareLinksSheetRef.value?.refresh()
}
</script>
