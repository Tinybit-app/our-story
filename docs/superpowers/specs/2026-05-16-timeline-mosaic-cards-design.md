# Timeline redesign + monochrome theme overhaul

**Status:** Design — pending implementation plan
**Date:** 2026-05-16
**Scope:** Global theme repaint (cream/amber → monochrome) **+** timeline layout replacement (`TimelinePolaroid` → unified Mosaic across viewports) **+** memory-modal redesign **+** restyling of month, settings, members, and viewer-link surfaces in the new system

---

## 1. Motivation

The current product is built on a "warm & nostalgic" identity: cream-and-espresso surfaces, amber accents, Caveat handwritten labels, tilted polaroid cards. It is distinctive but reads costumey and twee — a "scrapbook of dad jokes" rather than a sleek personal archive. We want the product to feel **modern, sleek, photo-first**.

Two coupled changes:

### 1.1 Theme overhaul (foundation)

Repaint the **entire app** from warm/nostalgic to strict monochrome.

- **Dark — Obsidian.** `#050505` page, `#0f0f0f` raised, `#141414` card, `#f4f4f4` text. Zero chroma — photos provide all the color.
- **Light — Porcelain.** `#fafaf7` page (slightly warm off-white), `#f1f1ec` raised, `#ffffff` card, `#0a0a0a` text. The inversion of Obsidian, not a separate design.

This affects every surface that uses `bg-background`, `text-foreground`, `bg-card`, etc. — onboarding, settings, members, invites, viewer-link sheets, modals. Amber accent (`#c8a882`) is removed entirely from the app shell. Email templates are unaffected (they are separate inlined-style surfaces).

### 1.2 Timeline layout replacement

Replace `TimelinePolaroid.vue` with a **single Mosaic layout that scales across viewports**:

- **Desktop (≥ 768px).** Four-column edge-to-edge grid, 3px gutters, no card chrome, photos are the design. Apple Photos / Are.na.
- **Mobile (< 768px).** Same grid, three columns. Same cells, same `.note` quick-note treatment, same year/month markers. The only difference between viewports is column count, expressed in CSS.

This is a simplification: one component (`TimelineMosaic`), one mental model. No dual-layout viewport swap, no first-paint flash.

Note: an earlier revision of this design used a separate "Diary Cards" pattern on mobile. That was rejected because: (a) maintaining two memory-display layouts in one app is costly and creates two mental models to learn, and (b) the mosaic is the brand of Our Story — making it consistent across viewports lets the recipient of any URL (timeline, month page, viewer link) see the same visual language.

The new layout is applied identically across:

- `/timeline` — the owner's main timeline
- `/timeline/[year]/[month]` — the focused single-month view (with a personalized "spread" header — §5.1)
- `/view/[token]` — the public viewer link (with a personalized "For [recipient]" header — §5.4)

### 1.3 Coupling between theme + layout + other surfaces

The theme repaint, the timeline replacement, the memory modal redesign (§6), and the supporting page upgrades (month, settings, members, viewer link — §5) are all coupled. Shipping any subset in isolation creates a design island. They merge as one body of work.

---

## 2. Visual system

### 2.1 Color tokens — repaint the existing names

The existing theme system in [app/assets/css/globals.css](../../app/assets/css/globals.css) defines HSL custom properties (`--background`, `--foreground`, `--card`, `--accent`, …) wired into [tailwind.config.ts](../../tailwind.config.ts) as Tailwind color utilities (`bg-background`, `text-foreground`, etc.). The mechanism is sound; we **keep the names and Tailwind wiring** and replace the values.

The dark-mode selector is `.dark` (configured via `@nuxtjs/color-mode` with `classSuffix: ''` in `nuxt.config.ts:78`).

**New values (HSL, the format the file expects):**

| Token | Porcelain (`:root`, light) | Obsidian (`.dark`) | Was (light → dark) |
|---|---|---|---|
| `--background` | `60 14% 97%` (`#fafaf7`) | `0 0% 2%` (`#050505`) | `33 20% 94%` → `25 15% 9%` |
| `--foreground` | `0 0% 4%` (`#0a0a0a`) | `0 0% 96%` (`#f4f4f4`) | `20 16% 14%` → `33 30% 92%` |
| `--card` | `0 0% 100%` (`#ffffff`) | `0 0% 8%` (`#141414`) | `0 0% 100%` → `20 16% 14%` |
| `--card-foreground` | `0 0% 4%` | `0 0% 96%` | — |
| `--popover` | `0 0% 100%` | `0 0% 8%` | — |
| `--popover-foreground` | `0 0% 4%` | `0 0% 96%` | — |
| `--primary` | `0 0% 4%` | `0 0% 96%` | `20 16% 14%` → `33 40% 65%` (amber) |
| `--primary-foreground` | `60 14% 97%` | `0 0% 2%` | — |
| `--secondary` | `0 0% 95%` (raised) | `0 0% 6%` (raised, `#0e0e0e`) | `33 14% 88%` → `22 8% 22%` |
| `--secondary-foreground` | `0 0% 4%` | `0 0% 96%` | — |
| `--muted` | `0 0% 95%` | `0 0% 6%` | — |
| `--muted-foreground` | `0 0% 42%` | `0 0% 60%` | `26 10% 49%` (shared) |
| `--accent` | `0 0% 4%` | `0 0% 96%` | `33 40% 65%` (amber, shared) |
| `--accent-foreground` | `60 14% 97%` | `0 0% 2%` | — |
| `--destructive` | `0 84% 60%` | `0 72% 55%` | unchanged |
| `--destructive-foreground` | `0 0% 98%` | `0 0% 98%` | unchanged |
| `--border` | `0 0% 90%` | `0 0% 14%` | `30 14% 88%` → `22 8% 22%` |
| `--input` | `0 0% 90%` | `0 0% 14%` | — |
| `--ring` | `0 0% 30%` | `0 0% 80%` | `33 40% 65%` (amber) |

Plus two new tokens scoped for the timeline-specific text gradations (existing tokens are too coarse — Tailwind's `text-muted-foreground` is the only secondary level, but timeline needs three: body, muted meta, faint date):

| Token | Porcelain | Obsidian | Used by |
|---|---|---|---|
| `--foreground-faint` | `0 0% 4% / 0.42` (alpha-suffixed)¹ | `0 0% 96% / 0.4` | `.year-rib .tally`, `.month-row .mc`, mono dates |
| `--photo-hover` | `0.95` (brightness multiplier, unitless) | `1.08` | `filter: brightness(var(--photo-hover))` on hovered photos |

¹ Tailwind v3 / HSL custom props support the `<value> / <alpha>` syntax inside `hsl(...)` in modern CSS. If the existing project's Tailwind doesn't compile alpha-suffixed HSL, fall back to a raw `rgba(...)` value for these two tokens.

### 2.2 No chromatic accent

Strictly monochrome in both modes. The amber accent (`33 40% 65%` = `#c8a882`) that previously drove `--primary` (dark mode CTA), `--accent`, and `--ring` is **fully removed**. Buttons that were amber become foreground-flipped (light text on dark surface in dark mode; dark text on light surface in light mode). Focus rings become near-white in dark / near-black in light.

The amber-tinted scrollbar styling in [globals.css](../../app/assets/css/globals.css) (lines 78, 86, 91, 97) updates to use `hsl(var(--foreground) / N)` opacities instead of `hsl(var(--accent) / N)`. Same visual *behavior* (a hairline scrollbar that intensifies on hover), monochromatic.

### 2.3 Side effects across the app

Because the token names are unchanged, every page automatically picks up the new palette. Visible changes outside the timeline:

- **Onboarding** ([pages/onboarding/](../../app/pages/onboarding/)) — cream background becomes Porcelain off-white; amber CTAs become near-black-on-cream (light) / near-white-on-charcoal (dark).
- **Settings, members, notification-settings, circle-settings** — same surface and CTA changes.
- **Viewer-link sheets** (`ShareLinksSheet`, `CreateLinkSheet`) — amber accents around link cards become monochrome.
- **Login & invite/[token] pages** — same.
- **PushPromptBanner, InstallPromptBanner, MilestoneBanner** — these still render above the timeline. Their amber backgrounds become `bg-secondary` (the new raised grey/black). The "primary CTA" inside each becomes foreground-flipped.
- **Memory detail modal** (`MemoryShell`) — fully redesigned per §6 (Drawer + Hero on mobile, side-by-side panel on desktop). Not just a recolor.
- **Comments, reactions, member-tagging UI inside the modal** — re-styled monochromatically and laid out per the new `MemoryDetail.vue` (§6.6).
- **Avatar fallbacks** (initials on grey) — neutral, unchanged.
- **Email templates** (`server/utils/email.ts` and components in `emails/`) — **unaffected**. Emails use inlined hex values, not the runtime tokens. Email branding intentionally stays warm — that surface lives in different inboxes and benefits from softer color than the app.
- **Sentry / PostHog / Supabase configs** — unaffected.

Any component that hard-coded an amber hex (e.g. `#c8a882`) inline rather than reading `hsl(var(--accent))` is a bug to fix in step 1 of the build. Audit with `rg "c8a882|caveat|amber"` before merging.

**Fonts** (Google Fonts):

- **Hanken Grotesk** — 300/400/500/700/800. Single sans family, drives all UI text and body copy.
- **JetBrains Mono** — 400/500. Used exclusively for dates and metadata (e.g. `MAY 14`, `8:17 AM`, member counts, year tallies). Provides the modern technical-archive flourish without leaning on chromatic accent.
- **Instrument Serif** — italic only. Used **only** as an opening quote-mark glyph on quick-note cells/cards, and as the *"this year" / "last year"* italic suffix on year ribbons. A whisper of warmth, not a system font.

These three fonts replace the current `Caveat`, `Playfair Display`, `DM Sans` set used in the polaroid timeline.

**Spacing rhythm:** 3px gutters in the grid; 12–14px between cards on mobile; 22–28px between months; 28px between years. Sticky offset for month anchors = 60px (allows for sticky header).

---

## 3. Architecture

### 3.1 New components

```
app/components/
├── TimelineMosaic.vue        # NEW — the single timeline grid (responsive 3-col / 4-col)
├── MosaicCell.vue            # NEW — single grid cell (photo, video, or .note variant)
├── MemoryViewer.vue          # NEW — photo carousel + swipe-nav (modal §6)
├── MemoryDetail.vue          # NEW — note + reactions + comments (modal §6)
├── MonthSpreadHeader.vue     # NEW — italic month-title hero + sticky prev/next pill (§5.1)
└── ViewerSpreadHeader.vue    # NEW — "For [recipient]" italic gift header (§5.4)
```

`MemoryShell.vue` is **rewritten** in place (same file, replaced content) — it becomes the viewport-aware container that composes `MemoryViewer` + `MemoryDetail`. Public API preserved.

`pages/timeline/index.vue`, `pages/timeline/[year]/[month].vue`, `pages/view.vue`, `pages/notification-settings.vue`, `pages/settings/account.vue`, `pages/circle-settings.vue`, and `pages/members.vue` are all touched. Page integration details for each are in §4 (main timeline) and §5 (other surfaces).

### 3.2 Components removed

```
app/components/
├── TimelinePolaroid.vue      # DELETE
├── PolaroidCard.vue          # DELETE
├── QuickNoteCard.vue         # DELETE — replaced by .note variant of MosaicCell
├── MemoryModal.vue           # DELETE — content extracted into MemoryDetail.vue
└── QuickNoteModal.vue        # DELETE — handled as a MemoryDetail variant
```

`TimelineCards.vue`, `DiaryCard.vue`, and `TimelineFrame.vue` from an earlier revision of this spec are **not** built — the unified mosaic in §4 removes the need for them.

### 3.3 Page integration

[`app/pages/timeline/index.vue`](../../app/pages/timeline/index.vue) currently renders `<TimelinePolaroid …>`. Replace with `<TimelineMosaic …>`. Props, events, and ref API (`scrollToYear`, `@year-change`, `@open-memory`, `@reaction-update`, `@load-more`) are preserved 1:1 so the parent page does not change.

### 3.4 Data shape — unchanged

`useTimeline.ts` (`monthGroups`, `yearInfos`, `MonthGroup`, `Memory`) is **not modified**. Both new layouts consume `monthGroups` exactly as today.

---

## 4. Timeline Mosaic (`TimelineMosaic.vue`)

A single grid that scales by column count. **Three columns on mobile (< 768px), four columns on desktop (≥ 768px).** Same cells, same year/month markers, same `.note` treatment, same gestures. Used identically by the main timeline (`/timeline`), the month view body (`/timeline/[y]/[m]`, §5.1), and the viewer link body (`/view/[token]`, §5.4).

### 4.1 Structure

```
Page header (existing — unchanged styling beyond brand-color usage)

For each year (desc):
  ┌ Year ribbon ─────────────────────────────────┐
  │ 2026  this year                  38 MEMORIES │   <- bottom hairline
  └──────────────────────────────────────────────┘

  For each month in year (desc):
    Month row    May  ·  2026                07 MEMORIES
    Photo grid (3 cols mobile / 4 cols desktop, 3px gap, mixed spans)
```

### 4.2 Year ribbon

- Container: full width, bottom hairline `hsl(var(--foreground) / 0.16)`, 28px top margin (collapses to 0 on first ribbon), 22px bottom margin.
- Year number: Hanken Grotesk 800, 22px, `-0.01em` tracking, `--foreground`.
- Italic suffix: Instrument Serif italic 400, 22px, `--muted-foreground`. Computed:
  - current calendar year → `"this year"`
  - current year − 1 → `"last year"`
  - otherwise → omitted
- Right-aligned tally: JetBrains Mono 500, 10px, `0.12em` tracking, `--foreground-faint`. Text: `"{N} MEMORIES"` (i18n key reused: `timeline.memories`).

### 4.3 Month row

- Hanken Grotesk 800, 12px, uppercase, `0.22em` letter-spacing — month name (e.g. `MAY`).
- Hanken Grotesk 500, 11px, `--foreground-faint` — year number.
- Right-aligned: JetBrains Mono 400, 10px, `0.08em`, `--foreground-faint` — count.
- 12px bottom padding, no rule below (the photo grid itself anchors the eye).
- Anchor id: `id="month-{year}-{month}"` (preserves current jump-to-month behavior in [pages/timeline/index.vue](../../app/pages/timeline/index.vue#L1033)).

### 4.4 Photo grid

```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
}
@media (min-width: 768px) {
  .grid { grid-template-columns: repeat(4, 1fr); }
}
```

- Each `MosaicCell` defaults to `aspect-ratio: 1 / 1`.
- Variant modifiers via a class:
  - `.wide` → `grid-column: span 2; aspect-ratio: 2 / 1;`
  - `.tall` → `grid-row: span 2; aspect-ratio: 1 / 2;`
- Span semantics are the same on mobile (in a 3-col grid) and desktop (in a 4-col grid). A `.wide` cell takes 2/3 of a row on mobile and 2/4 on desktop — both read as "this photo is the moment of the row." No row-orphan handling needed; the deterministic hash (§4.5) produces enough variety that gaps are rare and acceptable.
- Cell minimum width: roughly 118px on a 360px viewport, roughly 320px on a 1280px viewport. Both are readable photo sizes.
- Hover: `img { filter: brightness(var(--photo-hover)); transform: scale(1.04); transition: .3s; }`. Dark mode brightens (`1.08`); light mode darkens (`0.95`) so photos visibly respond against either background. No border or shadow change — the lift is purely photographic.
- Click anywhere on cell → emits `openMemory` with `{ memory, rect, tilt: 0 }`. (Tilt stays in the emitted shape to satisfy the existing `MemoryShell` signature in [pages/timeline/index.vue](../../app/pages/timeline/index.vue#L777); the value is always `0` now.)

### 4.5 Cell variant assignment

Variants must be **deterministic** (no layout shift on re-render or on load-more). Reuse the existing hash function from `TimelinePolaroid.isWideMemory` (id-based modulo). Promote it to a shared helper:

```ts
// app/composables/useTimeline.ts (append)
export function mosaicVariant(id: string): 'square' | 'wide' | 'tall' {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const m = h % 100
  if (m < 15) return 'wide'   // ~15% wide
  if (m < 28) return 'tall'   // ~13% tall
  return 'square'             // ~72% square
}
```

The first memory of each month is forced to `wide` to anchor the month visually, **only if** the resulting cell would not orphan the row (i.e. always; with 4 columns a leading 2-wide is safe).

### 4.6 Quick-note cell (text-only memory)

When `memory.memorymedia.length === 0 && memory.note`:

- Render as a `.note` MosaicCell (square only — never spans).
- Background `--secondary`, 1px `--border` border.
- 16px padding.
- Decorative open-quote: Instrument Serif italic 36px, `hsl(var(--foreground) / 0.35)`, line-height 0.5, top-left.
- Body: Hanken Grotesk 400, 13px, line-height 1.4, `--foreground` (88%). Truncated with `-webkit-line-clamp: 4` and ellipsis.
- Within body, the memory's `note` text is rendered with a regex replace that wraps **single-quoted** phrases (e.g. `'mama'`) in `<em>` styled with Instrument Serif italic — the only place serif appears in body copy. Single-word italicization makes a flat note feel typeset.
- Footer meta: JetBrains Mono 500, 9px, uppercase, `0.14em` tracking, `--foreground-faint`. Format: `"MAY 14 · MEI"` — date abbrev + first name of `memory.user`.

### 4.7 Header & year pill

The existing page header in [pages/timeline/index.vue](../../app/pages/timeline/index.vue#L4) is structurally preserved. Visual updates within this spec:

- Background: `--background` at 78% opacity + 24px `backdrop-filter: blur`.
- Border-bottom: `--border`.
- Brand `"OUR STORY"` kicker: Hanken Grotesk 800 9px, `0.28em` tracking, `--muted-foreground`. (Previously `text-accent` amber — now monochrome.)
- Circle name: Hanken Grotesk 700, 14px.
- `/` separator: 11px, `hsl(var(--foreground) / 0.18)`.
- Year pill: existing rounded-full, monochrome — JetBrains Mono 700, 10px, `--foreground`, 1px `hsl(var(--foreground) / 0.16)` border, transparent background.

Avatar, "Add memory" button, share button, etc. keep their current geometry — visual restyling (border colors, hover states) follows the same monochrome rules but is not the focus of this spec.

---

## 5. Other surfaces

Four pages adopt the same monochrome system and lean on the unified `TimelineMosaic`, but each has its own header treatment shaped by purpose. All four are mobile-first; desktop is a layout adaptation where it diverges.

### 5.1 Month view — `/timeline/[year]/[month]` (`MonthSpreadHeader`)

The focused single-month page. Reuses `TimelineMosaic` filtered to one month for the body. The header signals "you're somewhere intentional" with a magazine-spread treatment.

**`MonthSpreadHeader` anatomy** (replaces the current minimal header in [pages/timeline/[year]/[month].vue:4](../../app/pages/timeline/[year]/[month].vue#L4)):

```
┌─ Back ─ Our Story · The Zheng Family · 2026 ──────────┐    <- page strip (compact)
├─ "The Zheng Family · 2026" (kicker) ───────────────────┤
│                                                        │
│   April                                                │    <- Instrument Serif italic
│                                                        │       clamp(56px, 18vw, 96px)
│   12 Memories · 2 Milestones · 3 Members              │    <- JetBrains Mono kicker
│                                                        │
├─ ◀ MAR ──── APR · 2026 ──── MAY ▶ ────────────────────┤    <- sticky pill nav
└────────────────────────────────────────────────────────┘
[ TimelineMosaic — filtered to April 2026 ]
```

- **Page strip** — same back button + brand kicker as elsewhere. The kicker becomes `"The Zheng Family"`, the title becomes `"April 2026"` (locale-aware via `Intl.DateTimeFormat`).
- **Hero block** — padding `28px 18px 18px` mobile, `48px 32px 30px` desktop. Contains:
  - Kicker row: `{Circle name}` (left) + `{Year}` (right), both `font: 500 9px/1 'JetBrains Mono', monospace; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted-foreground)`.
  - Italic month name: `font-family: 'Instrument Serif', serif; font-style: italic; font-weight: 400; font-size: clamp(56px, 18vw, 96px); line-height: 0.95; letter-spacing: -0.025em; color: var(--foreground)`.
  - Meta row: `{N} Memories · {N} Milestones · {N} Members` (each separated by a dim `·`), `font: 500 10px/1.4 'JetBrains Mono'; letter-spacing: 0.16em; uppercase; color: var(--muted-foreground)`. Milestones and Members are computed server-side; if zero, the segment is omitted.
- **Sticky month-nav pill bar** — `position: sticky; top: 60px`. Three slots: prev-month pill (`◀ MAR`), current pill (centered, filled `--secondary`, contains `APR · 2026`), next-month pill (`MAY ▶`). Each prev/next pill is a route link to the adjacent month if memories exist there (server returns adjacency in the existing API response or via a separate `/api/timeline/months-with-data` call). If no memories exist for the adjacent month, the pill is muted and non-tappable.
- **Body** — `<TimelineMosaic :memories="filteredMemories" />`, filtered to year+month server-side. Year ribbon is suppressed in this view (the spread header is the year-and-month identifier); month row is suppressed inside the body for the only month visible.

**Data fetching**: existing endpoint `/api/timeline?circleId&year&month` already supports month-scoped queries. The page calls it once at mount.

**Sharing affordance** (header right): a `Share` icon pill (top-right, in the page strip) lets the owner copy a direct `/timeline/2026/04` deep link to clipboard. Implementation reuses the existing `useShare` composable.

### 5.2 Settings pages — Apple Rows pattern

Applies to all three settings pages: [pages/notification-settings.vue](../../app/pages/notification-settings.vue), [pages/settings/account.vue](../../app/pages/settings/account.vue), [pages/circle-settings.vue](../../app/pages/circle-settings.vue). Same pattern, different content. Owner-only restrictions on `/circle-settings` are preserved.

**Anatomy**:

```
┌─ Back ─ Our Story · Notifications ────────────────────┐    <- page strip
│                                                        │
│   How we find you                                      │    <- Instrument Serif italic
│   When to ping, when to leave you alone.              │    <- subtitle
│                                                        │
├─ PUSH ─────────────────────────────────────────────────┤    <- mono section label
│  ┌────────────────────────────────────────────────┐   │
│  │ [🔔] Push notifications              [ON]      │   │    <- row
│  │      New memories, comments, reactions          │   │
│  ├────────────────────────────────────────────────┤   │
│  │ [⏰] Quiet hours              10 – 7  ▸         │   │
│  └────────────────────────────────────────────────┘   │
├─ EMAIL ────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────┐   │
│  │ [✉] Weekly digest                      [ON]    │   │
│  ...
```

- **Page title block** (`22px 18px 14px 18px` padding):
  - Italic display title: `font: 400 30-34px/1.05 'Instrument Serif', serif; color: var(--foreground)`. Per-page text — e.g. *"How we find you"* (notifications), *"You"* (profile), *"The Zheng Family"* (circle).
  - Subtitle: `font: 400 12.5px/1.5 'Hanken Grotesk'; color: var(--muted-foreground)`. One-line description of what the page is about.
- **Section label** (above each group, `0 0 8px 14px` margin): `font: 700 9px/1 'JetBrains Mono'; letter-spacing: 0.22em; uppercase; color: var(--muted-foreground)`. Examples: `PUSH`, `EMAIL`, `PER-CIRCLE`, `PROFILE`, `LANGUAGE`, `CIRCLE`, `MILESTONES`, `DANGER`.
- **Section card** (`--card`, 14px radius, 1px `var(--border)`, rows separated by `1px hsl(var(--foreground) / 0.05)` hairlines):
  - Each row: `13px 14px` padding, `flex; align-items: center; gap: 14px`.
  - **Icon slot** (28×28, 8px radius, `hsl(var(--foreground) / 0.06)` background): single-line stroke icon at 14px, `hsl(var(--foreground) / 0.78)`. Optional — not all rows have icons.
  - **Label stack**: label (`font: 500 14px 'Hanken Grotesk'; color: var(--foreground)`) on top, hint (`font: 400 11px/1.35 'Hanken Grotesk'; color: var(--muted-foreground)`) below.
  - **Control slot** (right-aligned):
    - **Toggle**: 40×22 pill. Off = `hsl(var(--foreground) / 0.1)` track + white knob. On = `var(--foreground)` track + inverted-foreground knob. 200ms transition.
    - **Value + chevron**: muted value text (`13px 'Hanken Grotesk'; color: var(--muted-foreground)`) + `>` chevron — indicates the row drills into a sub-page or sheet.
    - **Segmented control**: 4–5px-padded inline pill group, `hsl(var(--foreground) / 0.06)` background, selected option `--foreground` background + `--background` text.

**Per-page content** (no scope change — just visual restyling of existing forms):

- `/notification-settings`: Push (notifications toggle, quiet-hours sub-row) · Email (digest segmented daily/weekly/monthly/off, milestone-nudges toggle) · Per-Circle (one drill-row per circle the user belongs to, showing current preference).
- `/settings/account`: Profile (first name input, last name input, avatar uploader drill-row) · Language (radio rows: English / 中文 / Français) · Account (email read-only row, password change drill-row, log out row, delete account row in red).
- `/circle-settings` (owner only): About (circle name input, circle type segmented control, anniversary date drill-row) · Members (count summary row, drill-rows for invite + manage) · Children (one drill-row per child profile + an "add child" row) · Danger (delete circle row, destructive).

**Save behavior**: auto-save on toggle/segmented change with a brief "Saved" pill animation top-right (existing behavior in [pages/notification-settings.vue](../../app/pages/notification-settings.vue) — preserve). Text-input rows debounce-save on blur or after 800ms idle.

### 5.3 Members — `/members` (Roster pattern)

Same vocabulary as the Apple Rows settings (§5.2) for consistency, but with member-shaped content. Reuses no special component beyond the row primitives.

```
┌─ Back ─ The Zheng Family · Members ───────────────────┐
├─ Hero card ────────────────────────────────────────────┤
│  THE ZHENG FAMILY                                      │
│  Four of us.                                           │    <- italic display title
│  3 Members · 1 Pending · Since Aug 2024                │    <- mono meta
│  ┌──────────────────────────────────┐                  │
│  │ + Invite someone                 │  (primary CTA)   │
│  └──────────────────────────────────┘                  │
├─ ACTIVE ───────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────┐   │
│  │ [Av] Dao  YOU         Joined Aug '24 ·  187 m   │   │  Owner chip (filled)
│  ├────────────────────────────────────────────────┤   │
│  │ [Av] Mei              Joined Aug '24 ·  142 m   │   │  Admin chip (outlined)
│  ├────────────────────────────────────────────────┤   │
│  │ [Av] Lily             Joined Oct '24 ·   12 m   │   │  Member chip (muted)
│  └────────────────────────────────────────────────┘   │
├─ PENDING ──────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────┐   │
│  │ [+ ] grandma@…        Invited 2d ago · Resend   │   │  Pending chip (muted)
│  └────────────────────────────────────────────────┘   │
```

- **Hero card** (`--card-elevated`, `18px` radius, `1px var(--border)`, `18px 16px` padding): kicker (the circle name in `9px mono uppercase` muted), italic display title (`Instrument Serif 30px`), mono meta line, and a full-width primary CTA pill ("Invite Someone" — opens the existing invite sheet).
- **Section labels**: `ACTIVE` / `PENDING` in mono uppercase, same treatment as §5.2.
- **Member row** (`12px 14px` padding, hairlines between rows):
  - **Avatar** (36×36, 50% radius). Falls back to initials on `--secondary` background.
  - **Name stack**: Name (`font: 600 14px 'Hanken Grotesk'`) with optional `YOU` tag inline (`font: 400 10px/1 'JetBrains Mono'; letter-spacing: 0.16em; muted; uppercase`). Hint below: `Joined {month '24} · {N} memories`.
  - **Role chip** (right):
    - Owner — `--foreground` background, `--background` text. Filled.
    - Admin — `1px var(--foreground)` border, transparent. Outlined.
    - Member — `var(--muted-foreground)` text, no chip background. Just text.
    - Pending — same as Member but row body is `opacity: 0.7`, avatar is a dashed-circle `+` placeholder.
  - **Chevron** (for the owner / admin viewing the row): drills into the member detail sheet (kick, change role) which already exists at [pages/member/[userId].vue](../../app/pages/member/[userId].vue). The row is non-tappable for non-admin viewers.

### 5.4 Viewer link — `/view/[token]` (`ViewerSpreadHeader`)

The public, non-authed surface. Reuses `TimelineMosaic` for the body. Only the header differs — it's personalized to make the link feel like a gift rather than a generic gallery.

**`ViewerSpreadHeader` anatomy** (replaces the current minimal header in [pages/view.vue:88](../../app/pages/view.vue#L88)):

```
┌─ Our Story · From The Zheng Family ─────── Sign in ───┐    <- compact top strip
│                                                        │
│   A PRIVATE COLLECTION                                 │    <- mono uppercase label
│                                                        │
│   For Grandma                                          │    <- italic display title
│                                                        │
│   — Mei & Dao  ·  38 Memories                          │    <- italic signoff + mono meta
│                                                        │
└────────────────────────────────────────────────────────┘
[ TimelineMosaic — filtered to allowed memories ]
```

- **Compact top strip** (sticky, `12px 14px` padding):
  - Left: small brand kicker (`Our Story` mono uppercase) + italic `"From {Circle Name}"` underneath in serif italic.
  - Right: `Sign in` pill (existing route to `/login`). Subtle, not a primary CTA.
- **Hero block** (`26px 18px 18px` padding mobile, scales up on desktop):
  - Italic mono label (top, muted): `"A private collection"` for `mode === 'full'`, `"A selected collection"` for `mode === 'selected'`. (Same `linkLabel` data the current page reads.) Localizable.
  - Italic display title: `font: 400 36px/1.05 'Instrument Serif'`. Text: `"For {recipient name}"` — the recipient name is whatever the owner specified when creating the link (existing `linkLabel` field already supports this). If no recipient name, falls back to `"For you"`.
  - Signoff row: `— {owner first name(s) of the circle, comma-joined}` in italic serif, followed by `· N Memories` in mono. E.g. `— Mei & Dao · 38 Memories`.
- **Body**: `<TimelineMosaic :memories="signedMemories" :viewer-mode="true" />` — same grid, same cells. The `viewer-mode` prop disables the year-pill jump button (no header to host it) and emits open events to a viewer-tuned modal (see §6 desktop & mobile already work; we add a `:viewer-mode` prop that hides the owner-only actions inside).
- **Empty state**: when `memories.length === 0`, the hero block stays; the body shows a centered "Mei is still gathering memories for you." card in `--secondary`. Reuses the existing empty-state translation key.
- **Loading state**: same monochrome spinner as the timeline.
- **Reactions**: viewers can already react with a guest name (existing behavior). The reaction picker inside the modal stays — the modal redesign in §6 fully supports the viewer mode (input box becomes a "react as {guestName}" affordance instead of a comment input — see §6.6).
- **Splash, expired, invalid states**: keep current logic, restyle:
  - Splash: full-bleed background with the latest memory's photo at 50% opacity, italic display title `"{Owner} has shared with you"`, CTA `"Open the collection"`. Same as current but in Obsidian/Porcelain palette and the new typography.
  - Expired: monochrome icon + italic title + body + `"Ask for a fresh link"` CTA (existing behavior).
  - Invalid: same treatment, different copy.

---

## 6. Memory modal — Drawer + Hero (`MemoryShell.vue`)

The current modal floats as a centered card with backdrop. On mobile this wastes most of the screen and offers no swipe navigation — to see another memory you must close and re-tap. Mobile is the primary surface for this app; the modal needs to be designed mobile-first, with desktop as a layout adaptation.

**Design pattern: Drawer + Hero.** Mobile-first.

### 6.1 Architecture

```
app/components/
├── MemoryShell.vue          # REWRITTEN — full-screen viewport-aware container
├── MemoryViewer.vue         # NEW — photo carousel with horizontal swipe nav
└── MemoryDetail.vue         # NEW — note + reactions + comments + input
                             #       (replaces the bulk of current MemoryModal.vue + QuickNoteModal.vue)
```

`MemoryShell` decides the layout per viewport using `useMediaQuery('(min-width: 768px)')` (VueUse) — the only place the codebase swaps components by viewport (the timeline itself uses pure CSS, §8). The two child components (`MemoryViewer`, `MemoryDetail`) are unchanged across viewports — only their composition inside `MemoryShell` changes.

Removed in this section's scope:

```
app/components/
├── MemoryModal.vue          # DELETE — content moves into MemoryDetail.vue
└── QuickNoteModal.vue       # DELETE — quick-note rendering becomes a MemoryDetail variant
```

Public API on `MemoryShell` is preserved: props `memories`, `startIndex`, `origin-rect`, `tilt`, `children`, `members`, and events `close`, `update`. Page integration in [pages/timeline/index.vue](../../app/pages/timeline/index.vue) does not change.

### 6.2 Mobile layout (< 768px) — the primary design

```
┌──────────────────────────────────────────┐
│  ╳            1 / 3            ⇪         │ <- floating chrome (close · counter · share)
│                                          │
│            ┌──────────────┐              │
│         ←  │              │  →            │ <- prev/next memory hint
│            │    PHOTO     │              │    (small arrows, fade out after 1s)
│            │              │              │
│            └──────────────┘              │
│                                          │
│           ━━━ photo-strip ━━━            │ <- 3 thumbs (multi-photo only)
│                                          │
├──────────────────────────────────────────┤
│        ━━━ (grabber) ━━━                 │ <- drawer
│                                          │
│  12   SAT                       ❤️3 🥹1   │
│       4:15 PM · Dao                      │
│                                          │
│  Dolores Park. She found a *dandelion*,  │
│  blew it slowly, and laughed at the      │
│  seeds.                                  │
│                                          │
│  ┌─ Mei ─────────────────────────┐       │
│  │ This is the best one.         │       │
│  │ Save it for the year-end.     │       │
│  └───────────────────────────────┘       │
│                                          │
│  ┌─ Lily ────────────────────────┐       │
│  │ Aww 🥺 print this one         │       │
│  └───────────────────────────────┘       │
│                                          │
│  ┌─────────────────────────────────┐     │
│  │ ☻ Add a comment…           😊   │     │ <- sticky input
│  └─────────────────────────────────┘     │
└──────────────────────────────────────────┘
                ━━━━ (home indicator) ━━━━
```

**Photo region** (top):

- Fills the area above the drawer.
- One photo at a time. Multi-photo memories add a 3-up thumbnail strip below the photo (taps switch). Single-photo memories omit the strip.
- Horizontal swipe on the photo → **prev / next memory** (not prev/next photo within the memory — thumb strip handles that). Spring animation with neighbor preview at the edges.
- Vertical swipe down on the photo → dismiss the modal (with parallax).
- Tap on the photo → toggle chrome visibility (full immersion mode hides close button and counter).
- Floating chrome (top): close button (top-left), `"1 / 3"` photo counter (top-center), share/more (top-right). All on translucent dark pills with backdrop-blur.
- Small ←/→ hint arrows fade in on photo-tap and fade out after 1s — they are affordances, not the primary navigation (which is swipe).

**Drawer** (bottom):

- Three snap points:
  - **Peek** (`120px` tall) — grabber + day numeral + weekday + first ~10 words of note.
  - **Default** (`50vh`) — opens here on memory load. Shows day/meta, full note, reaction summary, first 2-3 comments.
  - **Full** (`88vh`) — covers the photo down to a `40px` peek strip. All comments scroll inside the drawer body.
- Drag the grabber (28px hit zone above the visible 36×4px pill) to switch snap points. Drag releases respect velocity (flick to jump two snaps).
- Surface: `--background` (full dark), top-left/top-right radius `22px`, top shadow `0 -16px 40px rgba(0,0,0,0.5)`.
- Above the drawer in default snap, the photo remains tappable for navigation gestures — drag distinguishes from tap via VueUse's `usePointerSwipe`.

**Drawer content** (top to bottom):

- **Grabber** — 36×4px pill, `hsl(var(--foreground) / 0.32)`, 8px top margin, centered.
- **Head row** (14px 18px 8px padding):
  - Day numeral: Hanken Grotesk 800, 24px, `-0.02em`, `--foreground`.
  - Weekday (Hanken Grotesk 700, 9px, `0.18em`, uppercase, `--muted-foreground`) + time/author (Hanken Grotesk 400, 11px, `--foreground-faint`) — stacked below numeral.
  - Right: **reaction summary pill** — `hsl(var(--foreground) / 0.07)` background, 999px radius, top-3 emojis separated by ` · `. Pill is tappable to expand into the reactor list (deferred to a sub-component reused from current `MemoryModal`).
- **Note** (`6px 18px 16px` padding):
  - Hanken Grotesk 400, 14.5px, line-height 1.55, `hsl(var(--foreground) / 0.9)`.
  - Single-quote → Instrument Serif italic regex (same as the mosaic `.note` cell in §4.6).
  - Long notes truncate with `line-clamp: 6` in default snap, full text in `Full` snap.
- **Milestone label** (if `memory.milestone_label`): same pill style as §10.5, rendered above the note.
- **Comments list**:
  - Each comment: 24×24px avatar (or initials fallback), name (Hanken Grotesk 700, 12px), text (Hanken Grotesk 400, 13px, line-height 1.4, `hsl(var(--foreground) / 0.82)`). Time relative ("3h", "yesterday") in mono 9.5px below the name on hover/tap (collapsed by default to save space).
  - Fade-out gradient at bottom when content is cropped by the drawer height.
- **Sticky input bar** (always anchored to bottom of drawer):
  - 24×24px self-avatar.
  - Round input pill: `--secondary` background, 12.5px Hanken Grotesk, placeholder `"Add a comment…"`. Tap expands the drawer to `Full` snap and focuses the input.
  - 24px bottom padding (account for home indicator).

**Quick-note (text-only) memories on mobile:**

- Drawer opens to `Full` snap by default (no photo to hero).
- Photo region collapses to a short `bg-secondary` strip at top with the open-quote glyph centered, just enough vertical presence to anchor the chrome.
- Or alternative (decide during implementation, default to this): no photo region at all on quick-notes — the modal is just the drawer at 100vh. Cleaner.

### 6.3 Desktop layout (≥ 768px)

The Drawer + Hero pattern doesn't translate well past a phone form factor — a draggable drawer at 1280px feels strange. Desktop reuses the same components but composed side-by-side:

```
┌───────────────────────────────────────────────────────────────┐
│  ╳                                                            │
│                                                               │
│                                                ┌──────────┐   │
│                                                │ 12 SAT   │   │
│   ┌────────────────────────────────┐           │ 4:15 PM  │   │
│   │                                │           │ · Dao    │   │
│   │                                │           ├──────────┤   │
│   │                                │           │          │   │
│   │            PHOTO               │           │  Note    │   │
│ ←  │                                │ →         │  text…   │   │
│   │                                │           │          │   │
│   │                                │           ├──────────┤   │
│   │                                │           │ ❤️ 3      │   │
│   │                                │           │ 🥹 1      │   │
│   └────────────────────────────────┘           ├──────────┤   │
│                                                │ Comments │   │
│         •  •  •  (photo dots)                   │  Mei …   │   │
│                                                │  Lily …  │   │
│                                                ├──────────┤   │
│                                                │ Input…   │   │
│                                                └──────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

- **Backdrop:** `rgba(0,0,0,0.78)` + 6px backdrop-blur. Click to dismiss.
- **Layout:** two-column flex inside a centered container. Photo `~65%`, detail `~35%` (min 360px, max 440px).
- **Photo region** (`MemoryViewer` reused) — no drawer; rounded 12px corners, 16:10 max aspect, contained with `object-fit: contain` (letterboxed if photo is portrait — black bars match the backdrop).
- **Detail panel** (`MemoryDetail` reused) — surface `--background`, 12px radius, scroll-y if comments overflow, sticky input at bottom. Same internal anatomy as the mobile drawer.
- **Prev / next memory:** large 40×40px circular buttons floating outside the photo, at the vertical center of the modal (replaces the existing arrow pattern). Plus `← →` keyboard shortcuts.
- **Close:** top-right floating button outside the photo, replaces the current corner-stuck close.

The decorative "pin" element on the current `MemoryShell` (the red dot at top-center) is removed — it was part of the polaroid aesthetic.

### 6.4 Shared gestures and keyboard

| Gesture / key | Action | Where it works |
|---|---|---|
| Swipe left/right on photo | Prev / next memory | Mobile + desktop touchpads |
| `←` / `→` arrow keys | Prev / next memory | Desktop |
| Swipe down on photo | Dismiss with parallax | Mobile only |
| Drag drawer grabber | Snap to peek / default / full | Mobile only |
| Tap photo | Toggle chrome (immersion mode) | Mobile only |
| Tap backdrop | Dismiss | Desktop only |
| `Esc` | Dismiss | Both |
| `Space` | Toggle drawer (mobile) / play video (both) | Both |
| Tap thumb in strip | Switch photo within memory | Both (multi-photo) |

### 6.5 Animations and motion

- **Open:** zoom-in from the clicked card's `rect` (preserves current `origin-rect` prop). Spring duration 280ms, cubic-bezier `(.4, 0, .2, 1)`. Tilt becomes `0` for both mosaic and cards origins (no tilt in either timeline layout).
- **Close:** reverse — zoom back to origin rect.
- **Prev/next memory swipe:** photo slides out 100%, new photo slides in. 220ms spring. Drawer stays put (note/comments cross-fade with the new memory's data after the photo settles).
- **Drawer snap:** 280ms spring. Velocity-aware — a hard flick jumps two snaps.

### 6.6 Component contract — `MemoryDetail.vue`

Used by both mobile drawer and desktop panel. Props:

```ts
defineProps<{
  memory: Memory                    // from useTimeline.ts
  children: ChildProfile[]
  members: CircleMember[]
  currentUserId: string | null
  selfAvatarUrl: string | null
  selfInitials: string
  layout: 'drawer' | 'panel'        // affects: head padding, comment density, input position
}>()

const emit = defineEmits<{
  update: [patch: Pick<Memory, 'id'> & Partial<Memory>]
}>()
```

Internally renders:

- Milestone label (if any).
- Note (with single-quote serif-italic regex).
- Reactions list + add-reaction picker.
- Comments list + comment input + autosave draft (existing behavior in `MemoryModal`).
- Member-tag and child-tag display.

All of this exists in `MemoryModal.vue` today and is extracted as-is into `MemoryDetail.vue` with monochrome restyling per §2.

### 6.7 Component contract — `MemoryViewer.vue`

Photo / video viewer with internal navigation between memories' first-media items. Props:

```ts
defineProps<{
  memories: Memory[]
  currentIndex: number
  fitMode: 'cover' | 'contain'      // mobile = cover, desktop = contain
}>()

const emit = defineEmits<{
  navigate: ['prev' | 'next']        // user-initiated
  dismiss: []                        // swipe-down on mobile
  togglechrome: []                   // tap photo on mobile
}>()
```

Handles:

- Showing the first-media item of the current memory (or note-as-image for text-only).
- Horizontal swipe gestures (mobile) with neighbor preview at the edges.
- Vertical-swipe-to-dismiss (mobile, with parallax follow).
- Multi-photo thumb strip below the main photo (mobile only — desktop shows full-size in main panel).
- Video controls (existing behavior, preserved).

---

## 7. Year / month behavior

### 7.1 IntersectionObserver — current year

Existing pattern from `TimelinePolaroid` (lines 200+): observe year-ribbon elements, emit `year-change` with the year of the most-visible ribbon. Re-implement identically inside `TimelineMosaic`, so the year pill in the page header updates as the user scrolls.

### 7.2 `scrollToYear()` ref method

Preserved on `TimelineMosaic`. Implementation finds `#anchor-{year}` (year ribbon) and smooth-scrolls to it.

### 7.3 Jump-to-month

Existing `document.getElementById('month-{year}-{month}')` selector in [pages/timeline/index.vue:1033](../../app/pages/timeline/index.vue#L1033) continues to work because `TimelineMosaic` uses the same anchor IDs the polaroid version used.

### 7.4 Infinite scroll

Existing `useIntersectionObserver` on a load-more sentinel ([TimelinePolaroid.vue:204](../../app/components/TimelinePolaroid.vue#L204)) is re-implemented inside `TimelineMosaic` at the bottom of the grid. Same emit contract (`load-more`).

---

## 8. Breakpoint

The timeline layout no longer swaps components by viewport — `TimelineMosaic` is always rendered, with the column count handled in pure CSS:

```css
grid-template-columns: repeat(3, 1fr);
@media (min-width: 768px) { grid-template-columns: repeat(4, 1fr); }
```

The single 768px breakpoint matches Tailwind's `md:` and is used by every "this is a desktop layout" decision elsewhere in the codebase. There is no SSR / first-paint flash because there is no component swap — only a CSS media query.

The memory modal (§6) **does** swap layout by viewport (mobile drawer vs. desktop side-by-side panel), since drawer mechanics genuinely don't work at desktop sizes. That swap is documented in §6.3.

---

## 9. Page-shell parity (no spec change)

These already work on the timeline page and continue working — they are listed only to confirm scope:

- `MilestoneBanner` (above timeline)
- `PushPromptBanner` / `InstallPromptBanner`
- `AddMemorySheet` / `QuickNoteForm` (the *write* surfaces)
- Circle switcher, invite dialog, locale picker, share link sheets
- Anniversary display in header

The memory detail modal (`MemoryShell`) is **not** in this list — it is redesigned in §6.

---

## 10. Edge cases

### 10.1 Empty state

Both layouts render the existing empty state when `monthGroups.length === 0 && !loading`. Restyled monochromatically:

- Container: `flex flex-col items-center justify-center py-32 text-center`.
- Icon: outlined camera (16x16 viewbox), `--muted-foreground`.
- Title: Hanken Grotesk 700, 16px, `--foreground`. Text from `typeConfig.emptyTitle` (existing).
- Body: Hanken Grotesk 400, 14px, line-height 1.55, `--muted-foreground`, max-width 320px. Text from `typeConfig.emptyDesc`.

No "scrapbook" iconography. No amber accents.

### 10.2 Loading skeleton (first load)

- Centered spinner: 20px, 2px border, monochrome (`--foreground` over `transparent`).
- Caption: Hanken Grotesk 400, 12px, `--muted-foreground`. Text from `t('timeline.loading')`.

### 10.3 Loading more (pagination)

Bottom sentinel; while `loading && monthGroups.length > 0`, render a single-row spinner in the grid (desktop) or a 60px tall card-skeleton (mobile). No "Loading…" label — the spinner alone is enough.

### 10.4 Single-photo memory in mobile

Standard `.img-block` 4:3. No grid.

### 10.5 Memory with milestone label

Milestone labels (e.g. "First steps") render as a small pill above the copy text, 9px JetBrains Mono uppercase, `0.18em` tracking, `--muted-foreground`, 1px `--border` border, transparent background. **Not** colored — monochrome.

In the mosaic cell variant, milestone labels are hidden (they would clutter the photo). They only appear in the modal and the mobile cards.

### 10.6 Memory without `user` (e.g. orphaned after member removal)

Use `memory.former_owner_name` if present, else `"Member"`. This already exists in the data shape.

---

## 11. i18n

All copy uses existing i18n keys:

- `timeline.memories` (count → `"N MEMORIES"` / `"N 个回忆"`)
- `timeline.months` (count, for year tally)
- `timeline.loading`
- `nav.*` for page header (unchanged)

New strings:

- `timeline.thisYearSuffix` — default `"this year"`. Rendered in Instrument Serif italic next to the current year on the year ribbon.
- `timeline.lastYearSuffix` — default `"last year"`. Rendered the same way for the previous year.
- `viewerLink.privateCollectionLabel` — default `"A private collection"`. Mono kicker label above the "For X" title on the viewer link (§5.4).
- `viewerLink.selectedCollectionLabel` — default `"A selected collection"`. Same slot, used when the link is for a curated subset of memories (`mode === 'selected'`).
- `viewerLink.viewerHeroTitleFallback` — default `"For you"`. Used when the link has no explicit recipient name.
- `viewerLink.viewerSignoffMemories` — default `"{n} Memories"`. Mono meta tail in the signoff row.

Locale files updated for `en`, `zh-CN`, `fr`. Translators may render shorter forms (e.g. `zh-CN: "今年"` / `"去年"`) since the italic styling carries the typographic flourish regardless of length.

Month names continue to be locale-aware via `new Intl.DateTimeFormat(locale, { month: 'long' })` (current behavior in `useTimeline`).

Page-strip titles (back-button labels): the month view uses `Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })`. Settings pages reuse the existing `nav.notificationSettings`, `nav.profileSettings`, `nav.circleSettings` keys for their page-strip titles.

---

## 12. Tests

### 12.1 Unit (`unit/`)

- `unit/mosaicVariant.test.ts` — NEW. Verify `mosaicVariant()` returns deterministic values for given ids, and that distribution across 10k random ids is ~15% wide, ~13% tall, ~72% square (within 2% tolerance).
- `unit/useTimeline.test.ts` — existing, no changes (the composable is untouched).

### 12.2 E2E (`tests/`)

- `tests/timeline-year.spec.ts` — update selectors. The test currently asserts polaroid tape labels; rewrite to check for year-ribbon elements with text `"2026 this year"` and the JetBrains Mono tally.
- `tests/quick-note.spec.ts` — update: a circle with only a text-only memory should render a `.note` cell on desktop (with `"` glyph) and a `.note` card on mobile.
- `tests/month-overflow.spec.ts` — selectors only (month-row class names change).
- NEW: `tests/timeline-mosaic-viewports.spec.ts` — at viewport 800×600 the timeline renders a 4-column grid; at 375×600 it renders a 3-column grid. Assert via `computedStyle.gridTemplateColumns`.
- NEW: `tests/memory-modal-mobile.spec.ts` — at viewport 375×800, opening a memory shows the drawer at the `default` snap; dragging the grabber up snaps to `full`; swiping the photo left advances to the next memory; swiping down dismisses.
- NEW: `tests/month-view.spec.ts` — navigate to `/timeline/2026/4`, assert the spread header renders the italic month name and the sticky prev/next pill nav, then click the next-month pill and verify URL change.
- NEW: `tests/viewer-link-personalized.spec.ts` — open a viewer link created with recipient name "Grandma", assert the hero renders `"For Grandma"` and the signoff line, then react as a guest and verify the reaction lands.

### 12.3 RLS / pgTAP

No DB changes → no new RLS tests.

---

## 13. Out of scope (explicit)

These are **not** changed in this work and will be handled separately if at all:

- The `AddMemory` upload flow's *layout* (its surfaces flip color automatically via tokens; its layout is unchanged).
- The `QuickNoteForm` modal — the *write* surface (where the user composes a quick note). Only the *display* of quick notes changes (§4.6 for the timeline cell, §6 for the modal).
- The header chrome beyond the brand kicker / year pill recoloring.
- The Caveat handwritten font. It is dropped from the timeline and modal. It may still appear in email templates and is **explicitly not removed** there as part of this work.
- On-this-day / digest / recap surfaces. These render memories outside the timeline and are not affected layout-wise (surfaces flip color via tokens like everything else).
- The view-only public viewer link page (`pages/view.vue`). Uses its own simpler list; not in scope.
- Reactor list / commenter-tagging picker UI inside the modal — extracted from current `MemoryModal` and reused as-is, restyled monochromatically. Their *contents* and *interaction* don't change in this work.

---

## 14. Build sequence (high-level — detailed plan to follow)

1. **Repaint the theme tokens** in [app/assets/css/globals.css](../../app/assets/css/globals.css): replace the existing `:root` and `.dark` blocks with the Obsidian + Porcelain values from §2.1. Add `--foreground-faint` and `--photo-hover` tokens. Wire `foreground-faint` into Tailwind via the `colors` map in `tailwind.config.ts`. Verify every existing page (onboarding, settings, members, viewer link, etc.) still renders correctly in both modes before any timeline-specific work begins. Fix obvious breaks (e.g. components that hard-coded the amber accent inline rather than reading from the token).
2. Add `mosaicVariant()` to `useTimeline.ts` + unit test.
3. Build `MosaicCell.vue` (photo, video, and `.note` variants) in isolation. Render in a dev sandbox page that shows a sample memory of each variant in both color modes.
4. Verify `MosaicCell` against a stress dataset: text-only with 200-word note, photo-only, photo+1-comment, photo+50-reactions, memory with milestone label. Catch text-overflow / pill-overflow before the cell ships in the grid.
5. Build `TimelineMosaic.vue` consuming `monthGroups`. Verify both column counts and both color modes.
6. Swap `<TimelinePolaroid>` → `<TimelineMosaic>` in [pages/timeline/index.vue](../../app/pages/timeline/index.vue). Year-pill + jump menu + IntersectionObserver + load-more sentinel + `scrollToYear` ref API all live inside `TimelineMosaic` now (no separate frame component).
7. Extract `MemoryDetail.vue` from the bulk of [MemoryModal.vue](../../app/components/MemoryModal.vue). Verify it renders standalone with a mock memory.
8. Build `MemoryViewer.vue` — photo carousel, gestures, dismiss/navigate emit contract.
9. Rewrite `MemoryShell.vue` — viewport-aware composition. Mobile: drawer with snap points (use a small purpose-built `useSnapDrawer` composable; reach for `@vueuse/gesture` only if friction emerges). Desktop: side-by-side flex.
10. Manual-test the modal in both viewports with a variety of memories (photos, videos, multi-photo, text-only quick notes, memories with milestones, memories with 0/1/many reactions, memories with 0/1/many comments).
11. Delete `MemoryModal.vue` and `QuickNoteModal.vue` after `MemoryShell` rewrite is functional.
12. **Month view (§5.1)** — build `MonthSpreadHeader.vue`. Update `pages/timeline/[year]/[month].vue` to use it + filtered `TimelineMosaic`. Wire prev/next month links to `/api/timeline/months-with-data` (new lightweight endpoint returning `{ prevMonth, nextMonth }` for a given circle + year + month — keeps the page from needing the whole monthGroups payload). Add `Share` action that copies the deep-link to clipboard.
13. **Settings pages (§5.2)** — rewrite the three settings pages with the Apple Rows pattern. Build a small `<SettingsRow>` component (icon slot, label, hint, control slot) so the three pages compose the same primitives. Apply to `/notification-settings`, `/settings/account`, `/circle-settings`. Auto-save behavior preserved.
14. **Members page (§5.3)** — rewrite `pages/members.vue` with the hero card + active/pending sections. Reuse the existing member-detail navigation to [pages/member/[userId].vue](../../app/pages/member/[userId].vue) for the chevron drill.
15. **Viewer link (§5.4)** — build `ViewerSpreadHeader.vue`. Rewrite `pages/view.vue` to compose the new top strip + spread hero + `TimelineMosaic` with `:viewer-mode="true"`. Restyle splash, expired, and invalid states. Verify the existing guest-name flow still works.
16. Update E2E tests for new selectors. Specifically: prev/next navigation works on mobile, drawer snap behavior, swipe-to-dismiss, multi-photo thumb strip, month-view prev/next pill navigation, settings save indicators, members invite flow.
17. Add `timeline.thisYearSuffix` / `timeline.lastYearSuffix` i18n keys. Add `viewerLink.privateCollection` / `viewerLink.selectedCollection` / `viewerLink.signoff` keys for the new viewer header.
18. Delete `TimelinePolaroid.vue`, `PolaroidCard.vue`, `QuickNoteCard.vue`.
19. Run `pnpm test`, `pnpm test:e2e`, `pnpm db:test` (the last for completeness — no DB changes).
20. Manual full-flow test: load timeline with 50+ memories, multiple years, mix of photos / videos / text-only / multi-photo memories. Open a memory in both viewports. Swipe / drag / dismiss / navigate. Navigate from main timeline → month view via the year-jump menu, then prev/next-month between months. Walk through all three settings pages — toggle every control, verify auto-save indicator. Walk through members page — invite a fake address, view a member, kick. Open a viewer link with the test account, verify the "For [recipient]" header renders, react as a guest, switch to the test account's owner view and verify the same memory shows the new reaction. Verify Obsidian ↔ Porcelain switch via the theme toggle on every surface. Verify year pill updates on scroll. Verify jump-to-month from header. Verify load-more on scroll to bottom.

---

## 15. Risks

- **The `.note` cell can clash with photos around it** (both 3-col mobile and 4-col desktop). Mitigation: the `--secondary` background and hairline border make it read as a distinct surface; the Instrument Serif quote glyph signals "text" before the eye lands on the body. If it still looks busy in practice, fallback is to force `.note` cells to row-start positions only (so they sit next to a `.tall` photo and span vertically too) — track and decide during implementation.
- **Determinism across load-more.** The hash function only depends on memory id, so newly-fetched memories slot in with the right variant immediately. No re-shuffling.
- **3-column mobile cells are small.** At a 360px viewport with 3px gutters, each cell is roughly 118px. That's smaller than the previous polaroid card photos but still readable for photos. The `.note` cell text at 11px / 1.4 line-height fits ~4 short lines. If usage data shows users frequently can't read note cells without tapping in, raise to `line-clamp: 5` and reduce font to 10.5px. Tap-to-modal remains the fallback.
- **Span variety in 3-col grid.** With only 3 columns, a `.wide` cell takes 2/3 of a row and leaves a single-column gap, which can create awkward orphan slots. Mitigation: the deterministic hash produces a `.wide` rarely enough (~15%) that gaps occur in 1–2 rows per month at most, and feel intentional rather than broken. If observed in practice, an alternative is to suppress `.wide` on mobile (mobile gets only `.square` and `.tall`) — a 2-line CSS change.
- **Long quick-note text in a cell.** A 200-word quick-note in a single mosaic cell will truncate via `line-clamp: 4`; the full text is one tap away in the modal. If users complain about losing context, raise the clamp to 6 lines (acceptable in both 3-col mobile and 4-col desktop since the cell stays square).
- **Scope breadth.** This work touches the global theme, the timeline, the memory modal, the month view, three settings pages, the members page, and the viewer-link page. Steps 1, 5, 7–11, 12, 13, 14, 15 each touch a distinct user-facing surface. Reviewers can sequence them as a series of PRs against a feature branch rather than one mega-PR; the migration plan (separate doc) should propose the PR slicing. Skipping the migration-plan step is the main delivery risk.
- **Tests assume polaroid structure today.** Updating selectors is mechanical but must not be skipped (call it out in the plan as a discrete step).
- **Hard-coded amber hex outside the token system.** Some components may have inlined `#c8a882` or referenced `text-accent` directly. The audit (`rg "c8a882"` and `rg "text-accent\|bg-accent"`) in Step 1 catches these. If the audit finds anything, decide per-instance whether the component should switch to a different token (`--primary`, `--foreground`) or genuinely needs a non-monochrome treatment (e.g. an explicit "warning amber" semantic — unlikely in this app's surfaces).
- **Light-mode regression in pages we haven't visually re-checked.** The blast radius is everywhere. Step 1 verification must include a quick visual sweep of each route: `/login`, `/`, `/onboarding`, `/timeline`, `/settings/account`, `/members`, `/notification-settings`, `/circle-settings`, `/invite/[token]` (in both modes), in addition to `/view/[code]` to confirm scope boundary.
- **Drawer drag gesture vs. swipe-to-navigate gesture.** Both live on the mobile modal. The drag region (drawer + grabber) and the swipe region (photo) are spatially separated, but a swipe that starts on the boundary could be ambiguous. Mitigation: prefer Y-axis gestures to consume the drawer, X-axis gestures to consume the photo navigator, decide by direction within the first 12px of movement. Keep the drawer drag start zone hit-target generous (28px above the visible grabber) so the user isn't fighting the photo's swipe target.
- **Drawer snap implementation.** Snap-point drawers with three positions and velocity-aware flicks are non-trivial. The plan starts with a hand-rolled implementation (CSS `translateY` + `pointer events` + `requestAnimationFrame`). If unforeseen issues arise (e.g. iOS Safari scroll chaining, momentum overshoot), fall back to `@vueuse/gesture` or `motion-v`. Do not let perfect-drawer-physics block the merge — a 2-snap drawer (default + full only) is acceptable if 3-snap proves fiddly.
- **Quick-note memories on the new modal.** A text-only memory has no photo to hero. The chosen fallback (§6.2) is "drawer at 100vh, no photo region." Verify this reads well against a memory with a 200-word note. If it feels empty, add a subtle pattern/texture behind the note text (existing `repeating-linear-gradient` notebook-line pattern from current `MemoryModal.vue:33` is a candidate — restyled monochromatically).
- **Existing `MemoryModal.vue` is 2375 lines.** Extracting `MemoryDetail.vue` from it is the largest single mechanical change in this work. Plan must call out which parts move where (note rendering, reactions list, reaction picker, comment list, comment input, comment edit, member tagging, child tagging, milestone label, media share/download buttons) so the extraction is auditable rather than a sea of unreviewable diff. Step 7 of the build sequence should be split into ~4 sub-PRs if the diff is too large to review in one pass.
