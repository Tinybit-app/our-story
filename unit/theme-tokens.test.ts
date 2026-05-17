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
