# Login Page & App Theme Design

**Date:** 2026-04-13
**Status:** Approved

---

## Overview

Redesign the `/login` page and establish the global visual theme for Our Story. The app is a private memory keeper for individuals, families, and friends — the design should feel warm, personal, and timeless rather than clinical or corporate.

---

## Login Page

### Layout
- Editorial, left-aligned layout on a warm cream background
- No centered card — content sits directly on the page background
- Max width ~380px, vertically centered on screen

### Copy
- **Wordmark:** `OUR STORY` — small caps, tight tracking, system sans-serif
- **Headline:** "Every moment worth keeping, in one place." — Georgia serif, 26px, bold
- **Subtitle:** "For you, your family, your friends." — system sans-serif, 14px, muted warm stone

### Sign-in methods (in order)
1. **Continue with Google** — white button, `1.5px solid #e8e4df` border, subtle shadow `0 1px 4px rgba(0,0,0,0.06)`
2. **Divider** — "or" with horizontal rules
3. **Email input** — `your@email.com` placeholder, white bg, same border radius
4. **Continue with email** — full-width, dark espresso bg `#2c2420`, cream text

### Footer note
`"We'll send you a sign-in link — no password needed."` — 11px, centered, muted

---

## Global Theme

### Tone
Warm & nostalgic — feels like a physical photo album or journal. Not minimal/cold. Not pastel/cute. Think Day One meets a well-designed printed book.

### Light Mode Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#f4f1ee` | Page background — warm cream |
| `--text` | `#2c2420` | Primary text & CTA buttons — dark espresso |
| `--muted` | `#8a7f74` | Secondary text, placeholders — warm stone |
| `--accent` | `#c8a882` | Highlights, active states, links — warm amber |
| `--card` | `#ffffff` | Cards, inputs — white lift |
| `--border` | `#e8e4df` | Dividers, input borders |

### Dark Mode Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#1a1512` | Page background — dark espresso brown |
| `--text` | `#f0ebe4` | Primary text — warm off-white |
| `--muted` | `#8a7f74` | Secondary text — same warm stone (shared) |
| `--accent` | `#c8a882` | CTA buttons, highlights — same amber (shared) |
| `--card` | `#2c2420` | Cards, inputs — lifted dark brown |
| `--border` | `#3d3530` | Dividers, input borders |

**Key principles:**
- Dark bg stays warm brown `#1a1512`, never cold blue-grey
- Amber accent `#c8a882` is identical in both modes — brand consistency
- CTA flips: dark espresso bg in light → amber bg in dark
- Muted `#8a7f74` works in both modes without adjustment

### Typography
- **Headlines:** Georgia serif — gives journal/album warmth
- **Body & UI:** System sans-serif (`-apple-system, sans-serif`) — readable, no extra weight
- Headlines use `font-weight: 700`, body uses `500` or `400`

### Border radius
- Buttons & inputs: `12px`
- Cards: `16px`
- Small chips/tags: `8px`

---

## Implementation Notes

- Theme CSS variables go in `app/assets/css/globals.css` under `[data-theme="light"]` and `[data-theme="dark"]` (or `@media (prefers-color-scheme: dark)`)
- `login.vue` uses the editorial layout — no wrapper card
- Auth pages (`/login`, `/confirm`) exclude the global nav layout
- Google sign-in button keeps white background in both modes per Google's brand guidelines — in dark mode use `#2c2420` card bg instead
