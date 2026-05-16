# Theme Repaint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repaint the entire app from "warm & nostalgic" (cream + espresso + amber accent) to strict monochrome (Obsidian dark + Porcelain light). No new components, no layout changes — only token values in `globals.css`, one Tailwind config entry, and a regression sweep across every page.

**Architecture:** The existing token system (HSL CSS custom properties wired into Tailwind in `tailwind.config.ts`) is sound. We **keep the names and Tailwind wiring** and replace the values. Two new tokens (`--foreground-faint`, `--photo-hover`) are introduced for surfaces that follow in later sub-plans. Because token names are unchanged, every page picks up the new palette automatically — onboarding, settings, members, viewer-link, modals, banners — all flip via the same `:root` / `.dark` blocks.

This is Sub-plan #1 of 7 (see [the spec](../specs/2026-05-16-timeline-mosaic-cards-design.md) §15). It is the foundation everything else stacks on. Ships as one PR.

**Source spec:** [docs/superpowers/specs/2026-05-16-timeline-mosaic-cards-design.md](../specs/2026-05-16-timeline-mosaic-cards-design.md) (commit `87beaee`). The exact values come from spec §2.1.

**Tech Stack:** Nuxt 3 + Tailwind v3 + `@nuxtjs/color-mode` (with `classSuffix: ''`, so the dark-mode selector is `.dark`). Tests: Vitest in `unit/` (`pnpm test`).

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `app/assets/css/globals.css` | Modify | Replace `:root` and `.dark` token values; add `--foreground-faint` and `--photo-hover`; switch scrollbar opacities from `--accent` to `--foreground` |
| `tailwind.config.ts` | Modify | Add `foreground-faint` to the `colors` map so `text-foreground-faint` / `border-foreground-faint` Tailwind utilities work |
| `unit/theme-tokens.test.ts` | Create | Pin the new token values + guard the source tree against re-introduced amber hex (`#c8a882`) and warm-mode HSL (`33 40% 65%`) |

That is the complete change set. No Vue components are touched in this sub-plan — every component reads from the tokens already.

---

## Task 1: Pin the new token values with a failing test

**Files:**
- Create: `unit/theme-tokens.test.ts`

This is the TDD-style entry point. The test reads `globals.css` as a string and asserts the new Porcelain + Obsidian values are present. It will fail until Task 2 lands.

- [ ] **Step 1: Write the failing test**

Create `unit/theme-tokens.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

const cssPath = join(__dirname, '..', 'app', 'assets', 'css', 'globals.css')
const css = readFileSync(cssPath, 'utf-8')

describe('theme-tokens · Porcelain (`:root`, light mode)', () => {
  const porcelainBlock = css.match(/:root\s*{[^}]+}/)?.[0] ?? ''

  test('--background is the slightly-warm off-white', () => {
    expect(porcelainBlock).toMatch(/--background:\s*60\s+14%\s+97%/)
  })
  test('--foreground is near-black', () => {
    expect(porcelainBlock).toMatch(/--foreground:\s*0\s+0%\s+4%/)
  })
  test('--card is pure white', () => {
    expect(porcelainBlock).toMatch(/--card:\s*0\s+0%\s+100%/)
  })
  test('--secondary is the raised surface grey', () => {
    expect(porcelainBlock).toMatch(/--secondary:\s*0\s+0%\s+95%/)
  })
  test('--accent is foreground-flipped (no amber)', () => {
    expect(porcelainBlock).toMatch(/--accent:\s*0\s+0%\s+4%/)
    expect(porcelainBlock).not.toMatch(/--accent:\s*33\s+40%\s+65%/)
  })
  test('--ring is mid-grey (no amber)', () => {
    expect(porcelainBlock).toMatch(/--ring:\s*0\s+0%\s+30%/)
  })
})

describe('theme-tokens · Obsidian (`.dark`)', () => {
  const darkBlock = css.match(/\.dark\s*{[^}]+}/)?.[0] ?? ''

  test('--background is near-pure-black', () => {
    expect(darkBlock).toMatch(/--background:\s*0\s+0%\s+2%/)
  })
  test('--foreground is near-pure-white', () => {
    expect(darkBlock).toMatch(/--foreground:\s*0\s+0%\s+96%/)
  })
  test('--card is the lifted dark surface', () => {
    expect(darkBlock).toMatch(/--card:\s*0\s+0%\s+8%/)
  })
  test('--secondary is the raised dark surface', () => {
    expect(darkBlock).toMatch(/--secondary:\s*0\s+0%\s+6%/)
  })
  test('--primary is foreground-flipped (no amber)', () => {
    expect(darkBlock).toMatch(/--primary:\s*0\s+0%\s+96%/)
    expect(darkBlock).not.toMatch(/--primary:\s*33\s+40%\s+65%/)
  })
})

describe('theme-tokens · new tokens for the timeline mosaic', () => {
  const porcelainBlock = css.match(/:root\s*{[^}]+}/)?.[0] ?? ''
  const darkBlock = css.match(/\.dark\s*{[^}]+}/)?.[0] ?? ''

  test('--foreground-faint exists in both Porcelain and Obsidian', () => {
    expect(porcelainBlock).toMatch(/--foreground-faint:/)
    expect(darkBlock).toMatch(/--foreground-faint:/)
  })
  test('--photo-hover is 0.95 in Porcelain and 1.08 in Obsidian', () => {
    expect(porcelainBlock).toMatch(/--photo-hover:\s*0\.95/)
    expect(darkBlock).toMatch(/--photo-hover:\s*1\.08/)
  })
})

describe('theme-tokens · amber accent fully removed', () => {
  test('no warm-amber HSL anywhere in globals.css', () => {
    // 33 40% 65% = #c8a882 = the old amber. Must not appear.
    expect(css).not.toMatch(/33\s+40%\s+65%/)
  })
  test('no warm-cream HSL anywhere in globals.css', () => {
    // 33 20% 94% was the old --background. Must not appear.
    expect(css).not.toMatch(/33\s+20%\s+94%/)
    // 25 15% 9% was the old dark --background. Must not appear.
    expect(css).not.toMatch(/25\s+15%\s+9%/)
  })
  test('no inlined #c8a882 hex anywhere in globals.css', () => {
    expect(css.toLowerCase()).not.toContain('#c8a882')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test unit/theme-tokens.test.ts`

Expected: every test fails (current `globals.css` still has the warm values).

- [ ] **Step 3: Commit the failing test**

```bash
git add unit/theme-tokens.test.ts
git commit -m "test(theme): pin Obsidian + Porcelain token values

Failing guard for the upcoming globals.css repaint. Reads the CSS as a
string and asserts the new HSL values + the absence of the old amber
(33 40% 65% / #c8a882) and warm-cream (33 20% 94%) values."
```

---

## Task 2: Replace `:root` and `.dark` blocks in `globals.css`

**Files:**
- Modify: `app/assets/css/globals.css:26-72`

- [ ] **Step 1: Replace the `:root` block**

Find the block at line 26 of `app/assets/css/globals.css` that starts with `:root {` and `Warm & nostalgic — light mode`. Replace the entire block (everything between `:root {` and the closing `}`) with:

```css
  :root {
    /* Monochrome — Porcelain (light mode) */
    --background: 60 14% 97%; /* #fafaf7 slightly-warm off-white */
    --foreground: 0 0% 4%; /* #0a0a0a near-black */
    --card: 0 0% 100%; /* #ffffff pure white surface */
    --card-foreground: 0 0% 4%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 4%;
    --primary: 0 0% 4%; /* foreground-flipped CTA */
    --primary-foreground: 60 14% 97%;
    --secondary: 0 0% 95%; /* #f1f1ec raised surface */
    --secondary-foreground: 0 0% 4%;
    --muted: 0 0% 95%;
    --muted-foreground: 0 0% 42%;
    --accent: 0 0% 4%; /* no chroma — equals foreground */
    --accent-foreground: 60 14% 97%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 90%;
    --input: 0 0% 90%;
    --ring: 0 0% 30%;
    --foreground-faint: 0 0% 4% / 0.42;
    --photo-hover: 0.95;
    --radius: 0.75rem;
  }
```

- [ ] **Step 2: Replace the `.dark` block**

Find the block at line 50 (`.dark {` / `Warm & nostalgic — dark mode`). Replace the entire block with:

```css
  .dark {
    /* Monochrome — Obsidian (dark mode) */
    --background: 0 0% 2%; /* #050505 base */
    --foreground: 0 0% 96%; /* #f4f4f4 primary text */
    --card: 0 0% 8%; /* #141414 default surface */
    --card-foreground: 0 0% 96%;
    --popover: 0 0% 8%;
    --popover-foreground: 0 0% 96%;
    --primary: 0 0% 96%; /* foreground-flipped CTA */
    --primary-foreground: 0 0% 2%;
    --secondary: 0 0% 6%; /* #0f0f0f raised surface */
    --secondary-foreground: 0 0% 96%;
    --muted: 0 0% 6%;
    --muted-foreground: 0 0% 60%;
    --accent: 0 0% 96%; /* no chroma — equals foreground */
    --accent-foreground: 0 0% 2%;
    --destructive: 0 72% 55%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 14%;
    --input: 0 0% 14%;
    --ring: 0 0% 80%;
    --foreground-faint: 0 0% 96% / 0.4;
    --photo-hover: 1.08;
    --radius: 0.75rem;
  }
```

- [ ] **Step 3: Run the guard test to verify it passes**

Run: `pnpm test unit/theme-tokens.test.ts`

Expected: all tests in `theme-tokens.test.ts` PASS. Every assertion now sees the new HSL values.

- [ ] **Step 4: Run the full unit suite**

Run: `pnpm test`

Expected: full Vitest suite passes. No theme-related regression elsewhere because token names are unchanged.

- [ ] **Step 5: Commit**

```bash
git add app/assets/css/globals.css
git commit -m "feat(theme): repaint app to Obsidian + Porcelain monochrome

Replaces the warm cream/amber palette with strict monochrome:
- Light (Porcelain): #fafaf7 base, #0a0a0a text, no chroma.
- Dark (Obsidian): #050505 base, #f4f4f4 text, no chroma.
- Amber accent (33 40% 65% / #c8a882) fully removed; --primary,
  --accent, and --ring now flip with --foreground.
- Adds --foreground-faint and --photo-hover tokens for the upcoming
  timeline mosaic.

Token names are unchanged so every page picks up the new palette
automatically. Validated by the theme-tokens guard test."
```

---

## Task 3: Switch scrollbar styling from `--accent` to `--foreground`

**Files:**
- Modify: `app/assets/css/globals.css:78-99` (the `.scroll-styled` block — the four `hsl(var(--accent) / N)` references)

- [ ] **Step 1: Read the current scrollbar block**

Open `app/assets/css/globals.css` and locate the `.scroll-styled` block (starts around line 78). Confirm it contains four references to `hsl(var(--accent) / 0.4)`, `hsl(var(--accent) / 0.06)`, `hsl(var(--accent) / 0.38)`, `hsl(var(--accent) / 0.65)`.

- [ ] **Step 2: Replace `--accent` with `--foreground` in the four scrollbar references**

Find this block:

```css
/* Consistent thin scrollbar — apply to any overflow-y-auto container */
.scroll-styled {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--accent) / 0.4) hsl(var(--accent) / 0.06);
}

.scroll-styled::-webkit-scrollbar {
  width: 4px;
}

.scroll-styled::-webkit-scrollbar-track {
  background: hsl(var(--accent) / 0.06);
  border-radius: 999px;
}

.scroll-styled::-webkit-scrollbar-thumb {
  background: hsl(var(--accent) / 0.38);
  border-radius: 999px;
  transition: background 200ms ease;
}

.scroll-styled::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--accent) / 0.65);
}
```

Replace it with:

```css
/* Consistent thin scrollbar — apply to any overflow-y-auto container */
.scroll-styled {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--foreground) / 0.32) hsl(var(--foreground) / 0.05);
}

.scroll-styled::-webkit-scrollbar {
  width: 4px;
}

.scroll-styled::-webkit-scrollbar-track {
  background: hsl(var(--foreground) / 0.05);
  border-radius: 999px;
}

.scroll-styled::-webkit-scrollbar-thumb {
  background: hsl(var(--foreground) / 0.28);
  border-radius: 999px;
  transition: background 200ms ease;
}

.scroll-styled::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--foreground) / 0.55);
}
```

(The opacities are slightly reduced because near-pure-black/white at the old amber's opacity reads too heavy. These values were tuned in the Obsidian/Porcelain mockup gallery in the brainstorm.)

- [ ] **Step 3: Verify in browser**

Run: `pnpm dev`

Open `http://localhost:3000/timeline` (you'll need to be logged in; if you're not, use any page with a tall scrolling region). Confirm the scrollbar is now a thin grey-on-grey hairline instead of amber.

- [ ] **Step 4: Add a regression assertion to the guard test**

In `unit/theme-tokens.test.ts`, append a new `describe` block at the end:

```ts
describe('theme-tokens · scrollbar uses --foreground (not --accent)', () => {
  test('.scroll-styled does not reference --accent', () => {
    const scrollblock = css.match(/\.scroll-styled\s*{[\s\S]*?}/)?.[0] ?? ''
    expect(scrollblock).not.toMatch(/var\(--accent\)/)
  })
  test('scrollbar thumb uses --foreground at low opacity', () => {
    expect(css).toMatch(/scrollbar-thumb[\s\S]*?hsl\(var\(--foreground\)/)
  })
})
```

- [ ] **Step 5: Run the test**

Run: `pnpm test unit/theme-tokens.test.ts`

Expected: all tests PASS including the new scrollbar assertions.

- [ ] **Step 6: Commit**

```bash
git add app/assets/css/globals.css unit/theme-tokens.test.ts
git commit -m "feat(theme): scrollbar uses --foreground instead of amber --accent

Same hairline-on-hover behavior, monochromatic. Guard test ensures
--accent is not reintroduced inside .scroll-styled."
```

---

## Task 4: Add `foreground-faint` to the Tailwind colors map

**Files:**
- Modify: `tailwind.config.ts:28-65` (the `colors` block inside `theme.extend`)

The CSS variable `--foreground-faint` exists after Task 2, but Tailwind needs to know about it before utilities like `text-foreground-faint` resolve. Without this step, components written in later sub-plans will silently render the default text color when they expect the faint variant.

- [ ] **Step 1: Add `foreground-faint` to the `colors` map**

In `tailwind.config.ts`, find the `extend.colors` block. After the `foreground` entry on line 32 (`foreground: 'hsl(var(--foreground))',`), insert:

```ts
        'foreground-faint': 'hsl(var(--foreground-faint))',
```

The result should look like:

```ts
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        'foreground-faint': 'hsl(var(--foreground-faint))',
        primary: {
          // ...rest unchanged
```

- [ ] **Step 2: Write a Vitest assertion that the new color is wired**

Append to `unit/theme-tokens.test.ts`:

```ts
describe('tailwind config · foreground-faint is wired', () => {
  test('tailwind.config.ts maps foreground-faint to the CSS variable', () => {
    const configPath = join(__dirname, '..', 'tailwind.config.ts')
    const config = readFileSync(configPath, 'utf-8')
    expect(config).toMatch(
      /['"]foreground-faint['"]:\s*['"]hsl\(var\(--foreground-faint\)\)['"]/,
    )
  })
})
```

- [ ] **Step 3: Run the test**

Run: `pnpm test unit/theme-tokens.test.ts`

Expected: all tests PASS.

- [ ] **Step 4: Verify the Tailwind utility compiles**

A quick smoke check that `text-foreground-faint` actually generates CSS. Create a one-off probe by adding `<p class="text-foreground-faint">probe</p>` somewhere visible (e.g. inside `<main>` on `pages/timeline/index.vue`), then:

```bash
pnpm dev
```

Open the page and inspect the probe. Expected: rendered text uses `color: hsl(var(--foreground-faint))` — visibly fainter than `--foreground`.

Remove the probe before committing.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts unit/theme-tokens.test.ts
git commit -m "feat(theme): wire foreground-faint Tailwind utility

Maps text-foreground-faint / border-foreground-faint / etc. to the
new --foreground-faint CSS variable. Required for the timeline mosaic
year-ribbon tally and other faint-text surfaces in upcoming sub-plans."
```

---

## Task 5: Audit the source tree for hard-coded amber

§15 of the spec flags this risk: some components may have inlined `#c8a882` or used `text-accent` directly, in which case they need a per-instance decision. The audit is one command; the fix-up is whatever it finds.

**Files:**
- Modify: Whatever the audit finds. Likely candidates: `app/components/`, `app/pages/`.
- Add: A guard test that prevents the amber hex from being reintroduced.

- [ ] **Step 1: Run the amber-hex audit**

```bash
rg --no-config -n -i "c8a882" app/
```

Expected: A small list of files (or empty). Record the findings.

Note: `rg` will also match comments. Don't blindly delete them. Each hit needs human judgment.

- [ ] **Step 2: Run the Tailwind-class audit**

```bash
rg --no-config -n "\b(text|bg|border|ring|fill|stroke|from|to|via)-accent\b" app/
```

Expected: a list of components using `text-accent`, `bg-accent`, etc. These will *automatically* render monochromatic now because `--accent` is foreground-flipped. **Do not change them unless** the component is broken visually.

- [ ] **Step 3: For each `#c8a882` hit, decide and fix**

Walk through every result from Step 1. For each:

| If the hit is… | Then… |
|---|---|
| A comment like `/* #c8a882 amber */` | Delete the comment if it documents the *old* warm-mode token. Update the comment if it's still relevant. |
| An inline `style="color: #c8a882"` or `:style="{ color: '#c8a882' }"` | Replace with `color: hsl(var(--accent))` or a Tailwind class like `text-accent`. The component now renders monochromatic. |
| A CSS-in-JS or `<style>` block referencing `#c8a882` directly | Replace with `hsl(var(--accent))`. Same rule. |
| A test fixture | Update the fixture to reflect the new value. |

Make all changes in this step. Run `pnpm dev` after each change to confirm the affected component renders correctly in both modes (toggle via the user-dropdown light/dark switch in the timeline page header).

- [ ] **Step 4: Add an automated source-tree guard**

Append to `unit/theme-tokens.test.ts`. The walker uses pure `fs` — no child processes — so it works in any sandbox:

```ts
import { readdirSync, statSync } from 'node:fs'

function walkSource(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walkSource(full, acc)
    } else if (/\.(vue|ts|js|css)$/.test(entry)) {
      acc.push(full)
    }
  }
  return acc
}

describe('source-tree audit · amber hex must not be reintroduced', () => {
  test('no #c8a882 in any .vue/.ts/.js/.css file under app/', () => {
    const appDir = join(__dirname, '..', 'app')
    const offenders: string[] = []
    for (const file of walkSource(appDir)) {
      const content = readFileSync(file, 'utf-8').toLowerCase()
      if (content.includes('#c8a882')) {
        offenders.push(file.slice(appDir.length + 1))
      }
    }
    expect(offenders).toEqual([])
  })
})
```

- [ ] **Step 5: Run the test**

Run: `pnpm test unit/theme-tokens.test.ts`

Expected: all tests PASS. The `source-tree audit` test should pass after Step 3's fixes are applied.

If the test fails, the failure message lists the offending file paths. Fix them and re-run.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(theme): audit and remove inline amber hex references

Replaces every inline #c8a882 in the source tree with the appropriate
token reference (typically hsl(var(--accent)), now foreground-flipped).
Adds a guard test that walks app/ and asserts no file reintroduces the
amber hex."
```

(If Step 3 found nothing, the only change in this commit is the guard test itself — still worth committing as the regression guard.)

---

## Task 6: Manual visual regression sweep

There is no automated visual-diff harness in this repo. The sweep is manual but exhaustive: every route, both color modes, at one mobile and one desktop viewport. Goal is to catch any component that hard-coded a warm value or relied on the amber accent for legibility.

**Files:** None modified in this task — pure verification.

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`

Open: `http://localhost:3000`

- [ ] **Step 2: Sweep these routes at desktop viewport (≥ 1280px wide), in dark mode**

Toggle to dark mode via the user-avatar dropdown (`Dark mode`) on the timeline. For each route below, scroll the whole page and confirm:
- No amber color anywhere
- All text legible against its background
- All interactive states (hover, focus rings, active) visible

Routes to visit:
- `/login`
- `/`
- `/onboarding` (start a new circle flow; abandon at any step)
- `/timeline` (the polaroid layout is still in place; that's expected — only colors change)
- `/timeline/2026/4` or any month with data
- `/settings/account`
- `/members`
- `/notification-settings`
- `/circle-settings` (if logged-in user is an owner)
- `/invite/<expired-or-test-token>` — to exercise the invite landing
- `/view/<test-link-code>` — to exercise the viewer-link landing (use a known test code or generate one from `/circle-settings` → Share)

For each route, write a one-line note in your scratchpad: `OK` or `REGRESSION: <description>`.

- [ ] **Step 3: Repeat the sweep in light mode**

Toggle back to light mode via the same dropdown. Re-visit every route above. The Porcelain palette should feel like a slightly-warm off-white with near-black text — light cream surfaces, no amber, no eye fatigue.

- [ ] **Step 4: Repeat at mobile viewport (Chrome devtools, 375×667)**

Open Chrome DevTools, toggle device emulation, pick an iPhone preset (375×667). Walk every route again in both color modes. Pay special attention to:
- Mobile dropdown menu chrome (LocalePicker pill, etc.)
- Sticky headers
- Bottom action sheets (`AddMemorySheet`, `QuickNoteForm`, `ShareLinksSheet`)
- Banner backgrounds (`PushPromptBanner`, `MilestoneBanner`)

- [ ] **Step 5: Address every regression found**

For each `REGRESSION` entry from your scratchpad:

1. Identify the component file (use DevTools Element Inspector).
2. Determine whether it's reading from a token or hard-coded.
3. If hard-coded, swap to a token (typically `bg-secondary`, `text-foreground`, `text-muted-foreground`, `border-border`).
4. If reading from a token but rendering incorrectly: open the spec §2 token table and verify which token the component *should* be using; switch.
5. Re-verify the route in both modes.

- [ ] **Step 6: Commit the fixes (if any)**

```bash
git add -A
git commit -m "fix(theme): resolve regressions found in manual sweep

<one bullet per regression fixed>"
```

If no regressions were found, skip this step and proceed directly to Task 7.

---

## Task 7: Final verification, push, and open PR

- [ ] **Step 1: Run the full test suite one more time**

```bash
pnpm test
```

Expected: all unit tests pass, including the four new `describe` blocks added in `unit/theme-tokens.test.ts`.

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck 2>/dev/null || pnpm nuxi typecheck
```

(The repo's exact typecheck script lives in `package.json` — use whichever exists.)

Expected: no type errors. The Tailwind config change is type-checked because the file is `.ts`.

- [ ] **Step 3: Confirm Playwright E2E suite still passes**

```bash
pnpm test:e2e
```

Expected: all E2E tests pass. No selectors changed — the tests should be unaffected because no component structure changed in this sub-plan. If a test fails, it's likely a fixture that asserted a warm color; update the fixture and re-run.

- [ ] **Step 4: Push the branch**

```bash
git push -u origin HEAD
```

- [ ] **Step 5: Open the PR**

```bash
gh pr create --title "Theme repaint — Obsidian + Porcelain monochrome" --body "$(cat <<'EOF'
## Summary
- Repaints the entire app from warm cream/amber to strict monochrome (Obsidian dark + Porcelain light) per [spec §2](../docs/superpowers/specs/2026-05-16-timeline-mosaic-cards-design.md#2-visual-system).
- Token names are unchanged; only values change. Every page picks up the new palette automatically.
- Adds `--foreground-faint` and `--photo-hover` tokens for upcoming sub-plans.
- Wires `text-foreground-faint` etc. as Tailwind utilities.
- Switches scrollbar styling from `--accent` to `--foreground`.
- Adds a guard test that pins the new HSL values and prevents the amber hex from being reintroduced anywhere under `app/`.

This is sub-plan #1 of 7 from the [timeline-redesign spec](../docs/superpowers/specs/2026-05-16-timeline-mosaic-cards-design.md). It is the foundation everything else stacks on; no layouts or components change yet.

## Test plan
- [ ] `pnpm test` passes (includes new `unit/theme-tokens.test.ts`)
- [ ] `pnpm test:e2e` passes (no selectors changed)
- [ ] `pnpm typecheck` passes
- [ ] Manual sweep: every route at desktop + mobile, in both color modes — see plan Task 6 checklist.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Verify the PR URL works and the description renders**

The PR URL is returned by `gh pr create`. Open it in a browser, confirm the description and checklist render correctly.

---

## Definition of done

- [ ] `pnpm test` passes — including all assertions in `unit/theme-tokens.test.ts`.
- [ ] `pnpm test:e2e` passes.
- [ ] `pnpm typecheck` passes.
- [ ] Every route in the spec §15 visual-sweep list renders correctly in both Obsidian (dark) and Porcelain (light) modes at mobile and desktop viewports.
- [ ] `rg "c8a882" app/` returns zero results.
- [ ] No layout changes — `pages/timeline/index.vue` still renders the polaroid timeline; it just renders it on the new palette. (The polaroid replacement is sub-plan #2.)
- [ ] PR open and CI green.

When all checked: ready to merge. Once merged, sub-plan #2 (Timeline Mosaic) can begin.

---

## Out of scope for this sub-plan

These belong to later sub-plans. Do **not** start them in this PR:

- Replacing the polaroid timeline with `TimelineMosaic` — sub-plan #2.
- Memory modal redesign — sub-plans #3 and #4.
- Month view, settings, members, viewer link redesigns — sub-plans #5–7.
- Loading Hanken Grotesk / JetBrains Mono / Instrument Serif Google fonts — they're only used by components in later sub-plans. Adding them here would just inflate the bundle without rendering anywhere.
- Removing the Caveat font — still used by the polaroid timeline until sub-plan #2 ships.
- Email template restyling — emails are intentionally out of scope per spec §13.
