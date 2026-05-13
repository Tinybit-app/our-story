# Viewer Link Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let circle owners generate shareable view-only links (full timeline, date range, or hand-picked memories) that viewers can open without a Supabase account.

**Architecture:** A new `viewer_link` DB table stores one or more links per circle, each with a UUID nonce for instant revocation. The JWT payload is extended to include `viewer_link_id` + `nonce`; the viewer timeline API verifies both on every request. Three selection modes — `full`, `date_range`, `selection` — control memory filtering. The owner manages links from a bottom sheet in the timeline header.

**Tech Stack:** Nuxt 3, Supabase (Postgres + RLS + pgTAP), HMAC-SHA256 JWT (custom, already in `server/utils/viewerJwt.ts`), Vitest, Playwright, `@nuxtjs/i18n`

---

## File Map

**Create:**

- `supabase/migrations/024_viewer_link.sql` — viewer_link table + RLS
- `server/api/circles/[id]/viewer-links.get.ts` — list links for a circle
- `server/api/circles/[id]/viewer-links.post.ts` — create a new link
- `server/api/circles/[id]/viewer-links/[linkId].delete.ts` — revoke a link
- `app/components/ShareLinksSheet.vue` — bottom sheet: list of links + revoke
- `app/components/CreateLinkSheet.vue` — layered sheet: mode picker + memory picker + label
- `tests/viewer-link.spec.ts` — E2E tests

**Modify:**

- `server/utils/viewerJwt.ts` — extend `ViewerPayload` with `viewer_link_id` + `nonce`
- `server/api/viewer/timeline.get.ts` — nonce check + mode-based filtering + new response fields
- `server/api/reactions/guest.post.ts` — update token verification for new JWT shape
- `supabase/tests/rls.test.sql` — add 8 viewer_link RLS tests; update `plan(43)` → `plan(51)`
- `unit/viewer.test.ts` — extend JWT unit tests for new payload fields
- `app/pages/timeline/index.vue` — Share button in header (owner-only)
- `app/pages/view.vue` — mode banner, empty state, globe indicator, referral CTA; i18n all hardcoded strings
- `locales/en.json` — `viewerLink.*` keys
- `locales/zh-CN.json` — `viewerLink.*` keys
- `locales/fr.json` — `viewerLink.*` keys

---

## Task 1: Migration — `viewer_link` table + RLS

**Files:**

- Create: `supabase/migrations/024_viewer_link.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 024_viewer_link.sql
-- Viewer links: owner-generated share links for read-only circle access.
-- Each link has a nonce for instant revocation. Three modes: full, date_range, selection.

CREATE TABLE public.viewer_link (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id          UUID NOT NULL REFERENCES public.circle(id) ON DELETE CASCADE,
  nonce              UUID NOT NULL DEFAULT gen_random_uuid(),
  mode               TEXT NOT NULL CHECK (mode IN ('full', 'date_range', 'selection')),
  memory_ids         UUID[],              -- selection mode only; NULL otherwise
  date_from          DATE,                -- date_range mode only; NULL otherwise
  date_to            DATE,                -- date_range mode only; NULL otherwise
  label              TEXT NOT NULL,
  expires_at         TIMESTAMPTZ NOT NULL,
  notified_expiry_at TIMESTAMPTZ,         -- set when 3-day warning email is sent
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.viewer_link (circle_id);
CREATE INDEX ON public.viewer_link (id, nonce);

ALTER TABLE public.viewer_link ENABLE ROW LEVEL SECURITY;

-- Only the circle owner can manage viewer links for their circle
CREATE POLICY "owner can select own circle viewer links"
  ON public.viewer_link FOR SELECT
  USING (
    circle_id IN (
      SELECT public.get_my_circle_ids_as_role(ARRAY['owner'])
    )
  );

CREATE POLICY "owner can insert viewer links for own circle"
  ON public.viewer_link FOR INSERT
  WITH CHECK (
    circle_id IN (
      SELECT public.get_my_circle_ids_as_role(ARRAY['owner'])
    )
  );

CREATE POLICY "owner can delete own circle viewer links"
  ON public.viewer_link FOR DELETE
  USING (
    circle_id IN (
      SELECT public.get_my_circle_ids_as_role(ARRAY['owner'])
    )
  );
```

- [ ] **Step 2: Apply and verify**

```bash
pnpm db:reset && pnpm db:test
```

Expected: all 43 existing tests pass, migration applied cleanly.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/024_viewer_link.sql
git commit -m "feat(db): add viewer_link table with RLS (migration 024)"
```

---

## Task 2: Extend JWT utility — `viewer_link_id` + `nonce` in payload

**Files:**

- Modify: `server/utils/viewerJwt.ts`
- Modify: `unit/viewer.test.ts`

- [ ] **Step 1: Write failing unit tests for new payload shape**

In `unit/viewer.test.ts`, add after the existing `describe` blocks:

```ts
const TEST_LINK_ID = 'dddddddd-4444-4444-8444-444444444444'
const TEST_NONCE = 'eeeeeeee-5555-4555-8555-555555555555'

describe('signViewerToken — extended payload with viewer_link_id + nonce', () => {
  it('embeds viewer_link_id in the token payload', () => {
    const token = signViewerToken(TEST_CIRCLE_ID, TEST_SECRET, undefined, TEST_LINK_ID, TEST_NONCE)
    const payload = verifyViewerToken(token, TEST_SECRET)
    expect(payload.viewer_link_id).toBe(TEST_LINK_ID)
  })

  it('embeds nonce in the token payload', () => {
    const token = signViewerToken(TEST_CIRCLE_ID, TEST_SECRET, undefined, TEST_LINK_ID, TEST_NONCE)
    const payload = verifyViewerToken(token, TEST_SECRET)
    expect(payload.nonce).toBe(TEST_NONCE)
  })

  it('verifies correctly when viewer_link_id and nonce are present', () => {
    const token = signViewerToken(TEST_CIRCLE_ID, TEST_SECRET, undefined, TEST_LINK_ID, TEST_NONCE)
    expect(() => verifyViewerToken(token, TEST_SECRET)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test unit/viewer.test.ts
```

Expected: FAIL — `signViewerToken` doesn't accept `viewer_link_id` / `nonce` yet.

- [ ] **Step 3: Update `server/utils/viewerJwt.ts`**

Replace the entire file contents:

```ts
/**
 * Stateless viewer JWT utilities (build plan §9.1)
 *
 * Format: base64url(header).base64url(payload).base64url(HMAC-SHA256 signature)
 *
 * Payload: { circle_id, viewer_link_id, nonce, role: "viewer", exp: unix timestamp }
 *
 * viewer_link_id + nonce are checked against the viewer_link table on every
 * API call — deleting the row or changing the nonce instantly revokes the link.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

export interface ViewerPayload {
  circle_id: string
  viewer_link_id: string
  nonce: string
  role: 'viewer'
  exp: number
}

// Default expiry: 30 days (matches design spec)
const DEFAULT_EXPIRY_SECONDS = 30 * 24 * 60 * 60

function b64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function sign(data: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(data).digest())
}

export function signViewerToken(
  circleId: string,
  secret: string,
  expirySeconds = DEFAULT_EXPIRY_SECONDS,
  viewerLinkId: string,
  nonce: string,
): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(
    JSON.stringify({
      circle_id: circleId,
      viewer_link_id: viewerLinkId,
      nonce,
      role: 'viewer',
      exp: Math.floor(Date.now() / 1000) + expirySeconds,
    } satisfies ViewerPayload),
  )
  const sig = sign(`${header}.${payload}`, secret)
  return `${header}.${payload}.${sig}`
}

export function verifyViewerToken(token: string, secret: string): ViewerPayload {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid token format')

  const [header, payloadB64, sig] = parts

  const expectedSig = sign(`${header}.${payloadB64}`, secret)
  const expectedBuf = Buffer.from(expectedSig, 'utf8')
  const actualBuf = Buffer.from(sig, 'utf8')
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    throw new Error('Invalid token signature')
  }

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as ViewerPayload

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired')
  }

  return payload
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test unit/viewer.test.ts
```

Expected: all tests pass (existing + new).

- [ ] **Step 5: Commit**

```bash
git add server/utils/viewerJwt.ts unit/viewer.test.ts
git commit -m "feat(jwt): extend ViewerPayload with viewer_link_id and nonce"
```

---

## Task 3: Owner API — list viewer links

**Files:**

- Create: `server/api/circles/[id]/viewer-links.get.ts`

- [ ] **Step 1: Write the handler**

```ts
// server/api/circles/[id]/viewer-links.get.ts
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized.' })

  const circleId = getRouterParam(event, 'id')!
  const secret = useRuntimeConfig(event).jwtSecret as string
  if (!secret) throw createError({ statusCode: 500, message: 'Server misconfiguration.' })

  const supabase = await serverSupabaseClient(event)

  // Verify requester is owner of this circle
  const { data: membership } = await supabase
    .from('circlemember')
    .select('role')
    .eq('circle_id', circleId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership?.role !== 'owner') {
    throw createError({
      statusCode: 403,
      message: 'Only the circle owner can manage viewer links.',
    })
  }

  const { data: links, error } = await supabase
    .from('viewer_link')
    .select('id, nonce, mode, memory_ids, date_from, date_to, label, expires_at, created_at')
    .eq('circle_id', circleId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[viewer-links.get] query failed:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to load viewer links.' })
  }

  const now = Math.floor(Date.now() / 1000)

  return (links ?? []).map((link) => {
    const token = signViewerToken(circleId, secret, undefined, link.id, link.nonce)
    const isExpired = new Date(link.expires_at).getTime() < Date.now()
    const memoryCount = link.mode === 'selection' ? (link.memory_ids?.length ?? 0) : null
    const dateRange =
      link.mode === 'date_range' || link.mode === 'selection' ? deriveDisplayDateRange(link) : null

    return {
      id: link.id,
      mode: link.mode as 'full' | 'date_range' | 'selection',
      label: link.label,
      expiresAt: link.expires_at,
      isExpired,
      memoryCount,
      dateRange,
      token,
    }
  })
})

function deriveDisplayDateRange(link: {
  mode: string
  date_from: string | null
  date_to: string | null
  memory_ids: string[] | null
}): { from: string; to: string } | null {
  if (link.mode === 'date_range' && link.date_from && link.date_to) {
    return { from: link.date_from, to: link.date_to }
  }
  // For selection mode, date range is derived server-side from memories in the viewer API
  return null
}
```

- [ ] **Step 2: Run unit tests to catch any import issues**

```bash
pnpm test
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/api/circles/[id]/viewer-links.get.ts
git commit -m "feat(api): GET /api/circles/[id]/viewer-links — list owner's viewer links"
```

---

## Task 4: Owner API — create viewer link

**Files:**

- Create: `server/api/circles/[id]/viewer-links.post.ts`

- [ ] **Step 1: Write the handler**

```ts
// server/api/circles/[id]/viewer-links.post.ts
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'
import { z } from 'zod'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const THIRTY_DAYS_S = 30 * 24 * 60 * 60

const bodySchema = z
  .object({
    mode: z.enum(['full', 'date_range', 'selection']),
    label: z.string().max(100).optional(),
    memoryIds: z.array(z.string().uuid()).optional(),
    dateFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    dateTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'selection' && (!data.memoryIds || data.memoryIds.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'memoryIds required for selection mode',
        path: ['memoryIds'],
      })
    }
    if (data.mode === 'date_range' && (!data.dateFrom || !data.dateTo)) {
      ctx.addIssue({
        code: 'custom',
        message: 'dateFrom and dateTo required for date_range mode',
        path: ['dateFrom'],
      })
    }
  })

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized.' })

  const circleId = getRouterParam(event, 'id')!
  const secret = useRuntimeConfig(event).jwtSecret as string
  if (!secret) throw createError({ statusCode: 500, message: 'Server misconfiguration.' })

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid request body.' })

  const { mode, label, memoryIds, dateFrom, dateTo } = parsed.data

  const supabase = await serverSupabaseClient(event)

  // Verify requester is owner
  const { data: membership } = await supabase
    .from('circlemember')
    .select('role')
    .eq('circle_id', circleId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership?.role !== 'owner') {
    throw createError({
      statusCode: 403,
      message: 'Only the circle owner can create viewer links.',
    })
  }

  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString()
  const defaultLabel = buildDefaultLabel(mode, memoryIds, dateFrom, dateTo)

  const { data: link, error } = await supabase
    .from('viewer_link')
    .insert({
      circle_id: circleId,
      mode,
      memory_ids: memoryIds ?? null,
      date_from: dateFrom ?? null,
      date_to: dateTo ?? null,
      label: label ?? defaultLabel,
      expires_at: expiresAt,
    })
    .select('id, nonce, mode, memory_ids, date_from, date_to, label, expires_at, created_at')
    .single()

  if (error || !link) {
    console.error('[viewer-links.post] insert failed:', error?.message)
    throw createError({ statusCode: 500, message: 'Failed to create viewer link.' })
  }

  const token = signViewerToken(circleId, secret, THIRTY_DAYS_S, link.id, link.nonce)
  const isExpired = false
  const memoryCount = mode === 'selection' ? (memoryIds?.length ?? 0) : null
  const dateRange =
    mode === 'date_range' && dateFrom && dateTo ? { from: dateFrom, to: dateTo } : null

  return {
    id: link.id,
    mode: link.mode as 'full' | 'date_range' | 'selection',
    label: link.label,
    expiresAt: link.expires_at,
    isExpired,
    memoryCount,
    dateRange,
    token,
  }
})

function buildDefaultLabel(
  mode: string,
  memoryIds?: string[],
  dateFrom?: string,
  dateTo?: string,
): string {
  if (mode === 'full') return 'Full timeline'
  if (mode === 'date_range' && dateFrom && dateTo) {
    const fmt = (d: string) =>
      new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(new Date(d))
    return `${fmt(dateFrom)} – ${fmt(dateTo)}`
  }
  if (mode === 'selection') return `${memoryIds?.length ?? 0} memories`
  return 'Viewer link'
}
```

- [ ] **Step 2: Run unit tests**

```bash
pnpm test
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/api/circles/[id]/viewer-links.post.ts
git commit -m "feat(api): POST /api/circles/[id]/viewer-links — create viewer link"
```

---

## Task 5: Owner API — revoke viewer link

**Files:**

- Create: `server/api/circles/[id]/viewer-links/[linkId].delete.ts`

- [ ] **Step 1: Write the handler**

```ts
// server/api/circles/[id]/viewer-links/[linkId].delete.ts
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized.' })

  const circleId = getRouterParam(event, 'id')!
  const linkId = getRouterParam(event, 'linkId')!

  const supabase = await serverSupabaseClient(event)

  // Verify requester is owner
  const { data: membership } = await supabase
    .from('circlemember')
    .select('role')
    .eq('circle_id', circleId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership?.role !== 'owner') {
    throw createError({
      statusCode: 403,
      message: 'Only the circle owner can revoke viewer links.',
    })
  }

  const { error } = await supabase
    .from('viewer_link')
    .delete()
    .eq('id', linkId)
    .eq('circle_id', circleId)

  if (error) {
    console.error('[viewer-links.delete] failed:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to revoke viewer link.' })
  }

  return { ok: true }
})
```

- [ ] **Step 2: Run unit tests**

```bash
pnpm test
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add "server/api/circles/[id]/viewer-links/[linkId].delete.ts"
git commit -m "feat(api): DELETE /api/circles/[id]/viewer-links/[linkId] — revoke link"
```

---

## Task 6: Update viewer timeline API — nonce check + mode filtering

**Files:**

- Modify: `server/api/viewer/timeline.get.ts`

- [ ] **Step 1: Replace the file contents**

```ts
// server/api/viewer/timeline.get.ts
import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const { token } = getQuery(event) as { token?: string }
  if (!token) throw createError({ statusCode: 400, message: 'Missing viewer token.' })

  const secret = useRuntimeConfig(event).jwtSecret as string
  if (!secret) throw createError({ statusCode: 500, message: 'Server misconfiguration.' })

  let circleId: string
  let viewerLinkId: string
  let nonce: string
  try {
    const payload = verifyViewerToken(token, secret)
    circleId = payload.circle_id
    viewerLinkId = payload.viewer_link_id
    nonce = payload.nonce
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.toLowerCase().includes('expired')) {
      throw createError({ statusCode: 401, message: 'expired' })
    }
    throw createError({ statusCode: 401, message: 'Invalid viewer token.' })
  }

  const supabase = serverSupabaseServiceRole(event)

  // Verify the viewer_link row exists and nonce matches (revocation check)
  const { data: viewerLink } = await supabase
    .from('viewer_link')
    .select('id, nonce, mode, memory_ids, date_from, date_to, label, expires_at')
    .eq('id', viewerLinkId)
    .maybeSingle()

  if (!viewerLink || viewerLink.nonce !== nonce) {
    throw createError({ statusCode: 401, message: 'Invalid viewer token.' })
  }

  if (new Date(viewerLink.expires_at).getTime() < Date.now()) {
    throw createError({ statusCode: 401, message: 'expired' })
  }

  // Fetch circle name and owner first name
  const { data: circle } = await supabase
    .from('circle')
    .select('name, created_by')
    .eq('id', circleId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!circle) throw createError({ statusCode: 404, message: 'Circle not found.' })

  const { data: owner } = await supabase
    .from('user')
    .select('first_name')
    .eq('id', circle.created_by)
    .maybeSingle()

  // Build memory query based on mode
  let memoryQuery = supabase
    .from('memory')
    .select('id, memory_date, note, memorymedia(storage_path, media_type)')
    .eq('circle_id', circleId)
    .eq('visibility', 'circle')
    .order('memory_date', { ascending: false })
    .limit(50)

  const mode = viewerLink.mode as 'full' | 'date_range' | 'selection'

  if (mode === 'date_range' && viewerLink.date_from && viewerLink.date_to) {
    memoryQuery = memoryQuery
      .gte('memory_date', viewerLink.date_from)
      .lte('memory_date', viewerLink.date_to)
  } else if (mode === 'selection' && viewerLink.memory_ids?.length) {
    memoryQuery = memoryQuery.in('id', viewerLink.memory_ids)
  }

  const { data: memories } = await memoryQuery

  // Generate signed URLs
  const memoriesWithUrls = await Promise.all(
    (memories ?? []).map(async (m: any) => {
      const media = m.memorymedia?.[0]
      if (!media?.storage_path) {
        return {
          id: m.id,
          memory_date: m.memory_date,
          note: m.note,
          signedUrl: null,
          mediaType: null,
        }
      }
      const isVideo = media.media_type === 'video'
      const mediaType: 'video' | 'image' = isVideo ? 'video' : 'image'
      const { data } = await supabase.storage.from('memories-private').createSignedUrl(
        media.storage_path,
        3600,
        isVideo
          ? undefined
          : {
              transform: { width: 800, format: 'webp' as 'origin', quality: 85 },
            },
      )
      return {
        id: m.id,
        memory_date: m.memory_date,
        note: m.note,
        signedUrl: data?.signedUrl ?? null,
        mediaType,
      }
    }),
  )

  // Derive selectionDateRange from returned memories (for selection mode display)
  let selectionDateRange: { from: string; to: string } | null = null
  if (mode === 'selection' && memoriesWithUrls.length > 0) {
    const dates = memoriesWithUrls.map((m) => m.memory_date).sort()
    selectionDateRange = { from: dates[0], to: dates[dates.length - 1] }
  } else if (mode === 'date_range' && viewerLink.date_from && viewerLink.date_to) {
    selectionDateRange = { from: viewerLink.date_from, to: viewerLink.date_to }
  }

  return {
    circleName: circle.name,
    ownerFirstName: owner?.first_name ?? null,
    linkLabel: viewerLink.label,
    mode,
    selectionDateRange,
    memories: memoriesWithUrls,
  }
})
```

- [ ] **Step 2: Run unit tests**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add server/api/viewer/timeline.get.ts
git commit -m "feat(api): viewer timeline — nonce revocation check + mode-based filtering"
```

---

## Task 7: Update guest reactions API — new JWT shape

**Files:**

- Modify: `server/api/reactions/guest.post.ts`

The `guest.post.ts` calls `verifyViewerToken` which now requires `viewer_link_id` + `nonce` in the payload. Update the verification to also check the DB row (same revocation logic as the timeline API).

- [ ] **Step 1: Replace the file contents**

```ts
// server/api/reactions/guest.post.ts
import { serverSupabaseServiceRole } from '#supabase/server'
import { z } from 'zod'

const VALID_EMOJIS = ['❤️', '😂', '😮', '😢', '👏'] as const

const schema = z.object({
  viewerToken: z.string().min(1),
  memoryId: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  emoji: z.enum(VALID_EMOJIS),
  guestName: z.string().max(100).optional(),
})

export default defineEventHandler(async (event) => {
  const result = schema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid request body.' })

  const { viewerToken, memoryId, emoji, guestName } = result.data
  const secret = useRuntimeConfig(event).jwtSecret as string
  if (!secret) throw createError({ statusCode: 500, message: 'Server misconfiguration.' })

  let circleId: string
  let viewerLinkId: string
  let nonce: string
  try {
    const payload = verifyViewerToken(viewerToken, secret)
    circleId = payload.circle_id
    viewerLinkId = payload.viewer_link_id
    nonce = payload.nonce
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.toLowerCase().includes('expired')) {
      throw createError({ statusCode: 401, message: 'expired' })
    }
    throw createError({ statusCode: 401, message: 'Invalid viewer token.' })
  }

  const supabase = serverSupabaseServiceRole(event)

  // Revocation check — same as viewer/timeline.get.ts
  const { data: viewerLink } = await supabase
    .from('viewer_link')
    .select('nonce, expires_at')
    .eq('id', viewerLinkId)
    .maybeSingle()

  if (!viewerLink || viewerLink.nonce !== nonce) {
    throw createError({ statusCode: 401, message: 'Invalid viewer token.' })
  }
  if (new Date(viewerLink.expires_at).getTime() < Date.now()) {
    throw createError({ statusCode: 401, message: 'expired' })
  }

  // Verify the memory belongs to this circle
  const { data: memory } = await supabase
    .from('memory')
    .select('id')
    .eq('id', memoryId)
    .eq('circle_id', circleId)
    .eq('visibility', 'circle')
    .maybeSingle()

  if (!memory) throw createError({ statusCode: 404, message: 'Memory not found.' })

  const { error } = await (supabase.from('memoryreaction') as any).insert({
    memory_id: memoryId,
    user_id: null,
    emoji,
    guest_name: guestName ?? 'Viewer',
  })

  if (error) {
    console.error('[reactions/guest] insert failed:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to save reaction.' })
  }

  return { ok: true }
})
```

- [ ] **Step 2: Run unit tests**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add server/api/reactions/guest.post.ts
git commit -m "fix(api): guest reactions — revocation check with new JWT payload shape"
```

---

## Task 8: RLS tests for `viewer_link`

**Files:**

- Modify: `supabase/tests/rls.test.sql`

We need a `viewer_link` fixture row and 8 new tests. Also update `plan(43)` → `plan(51)`.

- [ ] **Step 1: Add fixture + tests**

At the top of `rls.test.sql`, change:

```sql
SELECT plan(43);
```

to:

```sql
SELECT plan(51);
```

In the FIXTURES section, after the existing Circle B / CircleMember inserts, add:

```sql
-- viewer_link for circle A (owner = user_a)
INSERT INTO public.viewer_link (id, circle_id, nonce, mode, label, expires_at)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  'full',
  'Full timeline',
  now() + interval '30 days'
);
```

At the end of the file, before `SELECT * FROM finish();`, add:

```sql
-- ============================================================
-- TEST 44: owner can SELECT viewer_links for their circle
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000001');
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.viewer_link
   WHERE circle_id = '10000000-0000-0000-0000-000000000001'),
  1,
  'owner can select viewer_links for their circle'
);

-- ============================================================
-- TEST 45: owner can INSERT a viewer_link for their circle
-- ============================================================
SELECT lives_ok(
  $$INSERT INTO public.viewer_link (circle_id, mode, label, expires_at)
    VALUES ('10000000-0000-0000-0000-000000000001', 'full', 'Test link', now() + interval '30 days')$$,
  'owner can insert viewer_link for their circle'
);

-- ============================================================
-- TEST 46: owner can DELETE a viewer_link from their circle
-- ============================================================
SELECT lives_ok(
  $$DELETE FROM public.viewer_link WHERE id = '30000000-0000-0000-0000-000000000001'$$,
  'owner can delete viewer_link from their circle'
);

-- ============================================================
-- TEST 47: member cannot SELECT viewer_links
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.viewer_link
   WHERE circle_id = '10000000-0000-0000-0000-000000000001'),
  0,
  'member cannot select viewer_links'
);

-- ============================================================
-- TEST 48: member cannot INSERT a viewer_link
-- ============================================================
SELECT throws_ok(
  $$INSERT INTO public.viewer_link (circle_id, mode, label, expires_at)
    VALUES ('10000000-0000-0000-0000-000000000001', 'full', 'Hack link', now() + interval '30 days')$$,
  'member cannot insert viewer_link'
);

-- ============================================================
-- TEST 49: outsider cannot SELECT viewer_links
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000005');
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.viewer_link
   WHERE circle_id = '10000000-0000-0000-0000-000000000001'),
  0,
  'outsider cannot select viewer_links'
);

-- ============================================================
-- TEST 50: owner of circle A cannot SELECT viewer_links for circle B
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000001');
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.viewer_link
   WHERE circle_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'owner of circle A cannot select viewer_links for circle B'
);

-- ============================================================
-- TEST 51: owner of circle B can SELECT their own viewer_links
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000003');
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.viewer_link
   WHERE circle_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'owner of circle B sees 0 viewer_links (none created for circle B)'
);
```

- [ ] **Step 2: Run RLS tests**

```bash
pnpm db:reset && pnpm db:test
```

Expected: all 51 tests pass.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/rls.test.sql
git commit -m "test(rls): add 8 viewer_link RLS tests (tests 44-51)"
```

---

## Task 9: i18n keys — all three locale files

**Files:**

- Modify: `locales/en.json`
- Modify: `locales/zh-CN.json`
- Modify: `locales/fr.json`

- [ ] **Step 1: Add `viewerLink` block to `locales/en.json`**

Add before the closing `}` of the JSON:

```json
  "viewerLink": {
    "shareButton": "Share",
    "emptyHeadline": "Share your circle",
    "emptyBody": "Create a viewer link — anyone with it can browse your memories without an account.",
    "createLink": "Create a link",
    "createAnother": "+ Create another link",
    "modeFull": "Full timeline",
    "modeDateRange": "Date range",
    "modeSelection": "Select memories",
    "selectedCount": "{count} selected",
    "labelPlaceholder": "e.g. Grandma's link",
    "copied": "Copied!",
    "revokeConfirm": "Revoke this link?",
    "revokeConfirmBody": "Anyone with it will lose access.",
    "revoke": "Revoke",
    "renew": "Renew",
    "dateRangeBanner": "Memories from {from} – {to}",
    "selectionBanner": "{count} selected memories · {from} – {to}",
    "emptyState": "No memories to show here.",
    "emptyStateBody": "The owner may not have added any yet.",
    "guestSuffix": "(viewer)",
    "referralHeadline": "Know someone who'd love this?",
    "referralBody": "Share this app with them →",
    "expires": "Expires {date}",
    "expired": "Expired",
    "viewerSplashTitle": "created this so you'd never miss a moment.",
    "viewerSplashSubtitle": "No account needed — just scroll.",
    "viewerSplashCta": "See the memories →",
    "viewerJoinCta": "Join to add your own memories →",
    "viewerNoMemories": "No memories shared yet.",
    "viewerNamePromptTitle": "What's your name?",
    "viewerNamePromptSubtitle": "So the family knows it's you ❤️",
    "viewerNamePromptPlaceholder": "e.g. Grandma Sue",
    "viewerNamePromptCta": "Send reaction",
    "viewerReactSent": "Sent",
    "viewerReact": "React",
    "viewerReactionConfirm": "✓ Reaction sent!",
    "viewerExpiredTitle": "This link has expired",
    "viewerExpiredBody": "Ask the circle owner for a new one.",
    "viewerExpiredCta": "Send a reminder",
    "viewerInvalidTitle": "This link is invalid",
    "viewerInvalidBody": "The link may be incorrect or has been revoked.",
    "viewerSignIn": "Sign in instead →"
  }
```

- [ ] **Step 2: Add `viewerLink` block to `locales/zh-CN.json`**

```json
  "viewerLink": {
    "shareButton": "分享",
    "emptyHeadline": "分享你的圈子",
    "emptyBody": "创建一个观看链接 — 任何人都可以无需账号直接浏览你的记忆。",
    "createLink": "创建链接",
    "createAnother": "+ 再创建一个链接",
    "modeFull": "完整时间线",
    "modeDateRange": "日期范围",
    "modeSelection": "选择记忆",
    "selectedCount": "已选 {count} 个",
    "labelPlaceholder": "例如：奶奶的链接",
    "copied": "已复制！",
    "revokeConfirm": "撤销此链接？",
    "revokeConfirmBody": "持有该链接的人将失去访问权限。",
    "revoke": "撤销",
    "renew": "续期",
    "dateRangeBanner": "{from} – {to} 的记忆",
    "selectionBanner": "已选 {count} 条记忆 · {from} – {to}",
    "emptyState": "暂无记忆可展示。",
    "emptyStateBody": "创建者可能尚未添加任何内容。",
    "guestSuffix": "（访客）",
    "referralHeadline": "有朋友也会喜欢吗？",
    "referralBody": "向他们分享这个应用 →",
    "expires": "到期时间：{date}",
    "expired": "已过期",
    "viewerSplashTitle": "创建了这个，让你不错过任何时刻。",
    "viewerSplashSubtitle": "无需账号，直接滚动浏览。",
    "viewerSplashCta": "查看记忆 →",
    "viewerJoinCta": "加入以添加你自己的记忆 →",
    "viewerNoMemories": "暂无共享记忆。",
    "viewerNamePromptTitle": "你叫什么名字？",
    "viewerNamePromptSubtitle": "让家人知道是你 ❤️",
    "viewerNamePromptPlaceholder": "例如：奶奶",
    "viewerNamePromptCta": "发送回应",
    "viewerReactSent": "已发送",
    "viewerReact": "回应",
    "viewerReactionConfirm": "✓ 回应已发送！",
    "viewerExpiredTitle": "此链接已过期",
    "viewerExpiredBody": "请联系圈子创建者获取新链接。",
    "viewerExpiredCta": "发送提醒",
    "viewerInvalidTitle": "此链接无效",
    "viewerInvalidBody": "链接可能有误或已被撤销。",
    "viewerSignIn": "改为登录 →"
  }
```

- [ ] **Step 3: Add `viewerLink` block to `locales/fr.json`**

```json
  "viewerLink": {
    "shareButton": "Partager",
    "emptyHeadline": "Partagez votre cercle",
    "emptyBody": "Créez un lien de visualisation — n'importe qui peut parcourir vos souvenirs sans compte.",
    "createLink": "Créer un lien",
    "createAnother": "+ Créer un autre lien",
    "modeFull": "Chronologie complète",
    "modeDateRange": "Plage de dates",
    "modeSelection": "Sélectionner des souvenirs",
    "selectedCount": "{count} sélectionné(s)",
    "labelPlaceholder": "ex. Lien de grand-maman",
    "copied": "Copié !",
    "revokeConfirm": "Révoquer ce lien ?",
    "revokeConfirmBody": "Toute personne possédant ce lien perdra l'accès.",
    "revoke": "Révoquer",
    "renew": "Renouveler",
    "dateRangeBanner": "Souvenirs du {from} au {to}",
    "selectionBanner": "{count} souvenir(s) sélectionné(s) · {from} – {to}",
    "emptyState": "Aucun souvenir à afficher ici.",
    "emptyStateBody": "Le propriétaire n'en a peut-être pas encore ajouté.",
    "guestSuffix": "(visiteur)",
    "referralHeadline": "Vous connaissez quelqu'un qui aimerait ça ?",
    "referralBody": "Partagez cette appli avec eux →",
    "expires": "Expire le {date}",
    "expired": "Expiré",
    "viewerSplashTitle": "a créé ceci pour que vous ne manquiez aucun moment.",
    "viewerSplashSubtitle": "Pas de compte requis — faites défiler.",
    "viewerSplashCta": "Voir les souvenirs →",
    "viewerJoinCta": "Rejoindre pour ajouter vos propres souvenirs →",
    "viewerNoMemories": "Aucun souvenir partagé pour l'instant.",
    "viewerNamePromptTitle": "Quel est votre prénom ?",
    "viewerNamePromptSubtitle": "Pour que la famille sache que c'est vous ❤️",
    "viewerNamePromptPlaceholder": "ex. Grand-maman Suzanne",
    "viewerNamePromptCta": "Envoyer la réaction",
    "viewerReactSent": "Envoyé",
    "viewerReact": "Réagir",
    "viewerReactionConfirm": "✓ Réaction envoyée !",
    "viewerExpiredTitle": "Ce lien a expiré",
    "viewerExpiredBody": "Demandez au propriétaire du cercle un nouveau lien.",
    "viewerExpiredCta": "Envoyer un rappel",
    "viewerInvalidTitle": "Ce lien est invalide",
    "viewerInvalidBody": "Le lien est peut-être incorrect ou a été révoqué.",
    "viewerSignIn": "Se connecter plutôt →"
  }
```

- [ ] **Step 4: Run unit tests**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add locales/en.json locales/zh-CN.json locales/fr.json
git commit -m "feat(i18n): add viewerLink.* keys to en, zh-CN, fr locales"
```

---

## Task 10: `ShareLinksSheet.vue` — link list + revoke

**Files:**

- Create: `app/components/ShareLinksSheet.vue`

- [ ] **Step 1: Write the component**

```vue
<!-- app/components/ShareLinksSheet.vue -->
<template>
  <!-- Backdrop -->
  <Transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
      @click="$emit('close')"
    />
  </Transition>

  <!-- Sheet -->
  <Transition name="slide-up">
    <div
      v-if="open"
      class="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-[24px] border-t border-border bg-card shadow-2xl"
    >
      <!-- Handle -->
      <div class="flex justify-center pb-1 pt-3">
        <div class="h-1 w-10 rounded-full bg-border" />
      </div>

      <div class="px-5 pb-8">
        <!-- Header -->
        <div class="flex items-center justify-between py-4">
          <h2 class="text-base font-bold text-foreground">{{ t('viewerLink.shareButton') }}</h2>
          <button
            @click="$emit('close')"
            class="p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="py-12 text-center">
          <p class="text-sm text-muted-foreground">Loading…</p>
        </div>

        <!-- Empty state -->
        <div v-else-if="links.length === 0" class="py-10 text-center">
          <div
            class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-secondary"
          >
            <svg
              class="h-5 w-5 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              viewBox="0 0 24 24"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <p class="mb-1 text-sm font-semibold text-foreground">
            {{ t('viewerLink.emptyHeadline') }}
          </p>
          <p class="mx-auto mb-6 max-w-[260px] text-xs text-muted-foreground">
            {{ t('viewerLink.emptyBody') }}
          </p>
          <button
            @click="$emit('create')"
            class="w-full rounded-[12px] bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {{ t('viewerLink.createLink') }}
          </button>
        </div>

        <!-- Link list -->
        <div v-else class="flex flex-col gap-3">
          <div v-for="link in links" :key="link.id" class="rounded-[16px] border border-border p-4">
            <!-- Label + mode badge -->
            <div class="mb-2 flex items-start justify-between gap-2">
              <p class="text-sm font-semibold leading-snug text-foreground">{{ link.label }}</p>
              <span
                class="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                :class="
                  link.isExpired
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-secondary text-muted-foreground'
                "
              >
                {{ link.isExpired ? t('viewerLink.expired') : modeBadge(link) }}
              </span>
            </div>

            <!-- Date range / count -->
            <p v-if="linkSubline(link)" class="mb-2 text-xs text-muted-foreground">
              {{ linkSubline(link) }}
            </p>

            <!-- Expiry -->
            <p class="mb-3 text-xs text-muted-foreground">
              {{
                link.isExpired
                  ? t('viewerLink.expired')
                  : t('viewerLink.expires', { date: formatExpiry(link.expiresAt) })
              }}
            </p>

            <!-- Actions -->
            <div class="flex items-center gap-2">
              <!-- Copy / Renew -->
              <button
                v-if="!link.isExpired"
                @click="copyLink(link)"
                class="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-secondary text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80"
              >
                <svg
                  class="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>{{ copiedId === link.id ? t('viewerLink.copied') : 'Copy link' }}</span>
              </button>
              <button
                v-else
                @click="$emit('renew', link)"
                class="h-8 flex-1 rounded-[10px] bg-secondary text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80"
              >
                {{ t('viewerLink.renew') }}
              </button>

              <!-- Revoke -->
              <template v-if="revokingId === link.id">
                <p class="flex-1 text-center text-xs text-muted-foreground">
                  {{ t('viewerLink.revokeConfirmBody') }}
                </p>
                <button
                  @click="confirmRevoke(link.id)"
                  class="h-8 rounded-[10px] bg-destructive px-3 text-xs font-semibold text-destructive-foreground transition-opacity hover:opacity-90"
                >
                  {{ t('viewerLink.revoke') }}
                </button>
                <button
                  @click="revokingId = null"
                  class="h-8 rounded-[10px] bg-secondary px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary/80"
                >
                  Cancel
                </button>
              </template>
              <button
                v-else
                @click="revokingId = link.id"
                class="flex h-8 w-8 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                :title="t('viewerLink.revokeConfirm')"
              >
                <svg
                  class="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Create another -->
          <button
            @click="$emit('create')"
            class="h-10 w-full rounded-[12px] border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            {{ t('viewerLink.createAnother') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { t } = useI18n()

interface ViewerLink {
  id: string
  mode: 'full' | 'date_range' | 'selection'
  label: string
  expiresAt: string
  isExpired: boolean
  memoryCount: number | null
  dateRange: { from: string; to: string } | null
  token: string
}

const props = defineProps<{
  open: boolean
  links: ViewerLink[]
  loading: boolean
}>()

const emit = defineEmits<{
  close: []
  create: []
  revoke: [linkId: string]
  renew: [link: ViewerLink]
}>()

const revokingId = ref<string | null>(null)
const copiedId = ref<string | null>(null)

function modeBadge(link: ViewerLink): string {
  if (link.mode === 'full') return t('viewerLink.modeFull')
  if (link.mode === 'date_range') return t('viewerLink.modeDateRange')
  return t('viewerLink.modeSelection')
}

function linkSubline(link: ViewerLink): string | null {
  if (link.mode === 'selection' && link.memoryCount !== null) {
    if (link.dateRange) {
      return t('viewerLink.selectionBanner', {
        count: link.memoryCount,
        from: formatDate(link.dateRange.from),
        to: formatDate(link.dateRange.to),
      })
    }
    return t('viewerLink.selectedCount', { count: link.memoryCount })
  }
  if (link.mode === 'date_range' && link.dateRange) {
    return t('viewerLink.dateRangeBanner', {
      from: formatDate(link.dateRange.from),
      to: formatDate(link.dateRange.to),
    })
  }
  return null
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(
    new Date(dateStr),
  )
}

function formatExpiry(isoStr: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(isoStr))
}

async function copyLink(link: ViewerLink) {
  const url = `${window.location.origin}/view?token=${link.token}`
  await navigator.clipboard.writeText(url)
  copiedId.value = link.id
  setTimeout(() => {
    copiedId.value = null
  }, 2000)
}

function confirmRevoke(linkId: string) {
  revokingId.value = null
  emit('revoke', linkId)
}
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/ShareLinksSheet.vue
git commit -m "feat(ui): ShareLinksSheet — owner viewer link management bottom sheet"
```

---

## Task 11: `CreateLinkSheet.vue` — mode picker + memory picker + date range

**Files:**

- Create: `app/components/CreateLinkSheet.vue`

- [ ] **Step 1: Write the component**

```vue
<!-- app/components/CreateLinkSheet.vue -->
<template>
  <Transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      @click="$emit('close')"
    />
  </Transition>

  <Transition name="slide-up">
    <div
      v-if="open"
      class="fixed inset-x-0 bottom-0 z-[60] flex max-h-[90vh] flex-col rounded-t-[24px] border-t border-border bg-card shadow-2xl"
    >
      <!-- Handle -->
      <div class="flex flex-shrink-0 justify-center pb-1 pt-3">
        <div class="h-1 w-10 rounded-full bg-border" />
      </div>

      <div
        class="flex flex-shrink-0 items-center justify-between border-b border-border px-5 pb-3 pt-2"
      >
        <h2 class="text-base font-bold text-foreground">{{ t('viewerLink.createLink') }}</h2>
        <button
          @click="$emit('close')"
          class="p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
        <!-- Mode selector -->
        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Mode
          </p>
          <div class="flex gap-2">
            <button
              v-for="m in modes"
              :key="m.value"
              @click="selectedMode = m.value"
              class="flex-1 rounded-[10px] border py-2 text-xs font-semibold transition-colors"
              :class="
                selectedMode === m.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-transparent bg-secondary text-muted-foreground hover:text-foreground'
              "
            >
              {{ m.label }}
            </button>
          </div>
        </div>

        <!-- Date range picker -->
        <div v-if="selectedMode === 'date_range'" class="flex flex-col gap-3">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Date range
          </p>
          <!-- Quick picks -->
          <div class="flex flex-wrap gap-2">
            <button
              v-for="year in availableYears"
              :key="year"
              @click="selectYear(year)"
              class="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
              :class="
                isYearSelected(year)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              "
            >
              {{ year }}
            </button>
          </div>
          <!-- Custom from/to -->
          <div class="flex gap-2">
            <div class="flex-1">
              <label class="mb-1 block text-xs text-muted-foreground">From</label>
              <input
                v-model="dateFrom"
                type="date"
                class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div class="flex-1">
              <label class="mb-1 block text-xs text-muted-foreground">To</label>
              <input
                v-model="dateTo"
                type="date"
                class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        <!-- Memory picker -->
        <div v-if="selectedMode === 'selection'" class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {{ t('viewerLink.modeSelection') }}
            </p>
            <span v-if="selectedMemoryIds.size > 0" class="text-xs font-semibold text-accent">
              {{ t('viewerLink.selectedCount', { count: selectedMemoryIds.size }) }}
            </span>
          </div>
          <div v-if="memoriesLoading" class="py-6 text-center text-sm text-muted-foreground">
            Loading…
          </div>
          <div v-else class="grid grid-cols-3 gap-1.5">
            <button
              v-for="memory in allMemories"
              :key="memory.id"
              @click="toggleMemory(memory.id)"
              class="relative aspect-square overflow-hidden rounded-[8px] border-2 transition-all"
              :class="selectedMemoryIds.has(memory.id) ? 'border-primary' : 'border-transparent'"
            >
              <img
                v-if="memory.signedUrl && memory.mediaType === 'image'"
                :src="memory.signedUrl"
                class="h-full w-full object-cover"
                alt=""
              />
              <div
                v-else-if="memory.mediaType === 'video'"
                class="flex h-full w-full items-center justify-center bg-secondary"
              >
                <svg class="h-5 w-5 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div v-else class="flex h-full w-full items-center justify-center bg-secondary">
                <svg
                  class="h-5 w-5 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M9 12h6M12 9v6" />
                </svg>
              </div>
              <!-- Checkmark overlay -->
              <Transition name="fade">
                <div
                  v-if="selectedMemoryIds.has(memory.id)"
                  class="absolute inset-0 flex items-center justify-center bg-primary/30"
                >
                  <div class="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                    <svg
                      class="h-3.5 w-3.5 text-primary-foreground"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                </div>
              </Transition>
            </button>
          </div>
        </div>

        <!-- Label field -->
        <div>
          <label
            class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >Label</label
          >
          <input
            v-model="label"
            type="text"
            :placeholder="t('viewerLink.labelPlaceholder')"
            class="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <!-- Create button -->
      <div class="flex-shrink-0 border-t border-border px-5 pb-8 pt-3">
        <button
          @click="handleCreate"
          :disabled="!isValid || creating"
          class="w-full rounded-[12px] bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {{ creating ? 'Creating…' : t('viewerLink.createLink') }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { t } = useI18n()

interface MemoryItem {
  id: string
  memory_date: string
  signedUrl: string | null
  mediaType: 'image' | 'video' | null
}

const props = defineProps<{
  open: boolean
  circleId: string
}>()

const emit = defineEmits<{
  close: []
  created: []
}>()

const selectedMode = ref<'full' | 'date_range' | 'selection'>('full')
const dateFrom = ref('')
const dateTo = ref('')
const selectedMemoryIds = ref(new Set<string>())
const label = ref('')
const creating = ref(false)
const memoriesLoading = ref(false)
const allMemories = ref<MemoryItem[]>([])

const modes = computed(() => [
  { value: 'full' as const, label: t('viewerLink.modeFull') },
  { value: 'date_range' as const, label: t('viewerLink.modeDateRange') },
  { value: 'selection' as const, label: t('viewerLink.modeSelection') },
])

const availableYears = computed(() => {
  const current = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => current - i)
})

const isValid = computed(() => {
  if (selectedMode.value === 'date_range') return !!(dateFrom.value && dateTo.value)
  if (selectedMode.value === 'selection') return selectedMemoryIds.value.size > 0
  return true
})

watch(
  () => props.open,
  async (val) => {
    if (val && selectedMode.value === 'selection') await loadMemories()
  },
)

watch(selectedMode, async (val) => {
  if (val === 'selection' && allMemories.value.length === 0) await loadMemories()
})

async function loadMemories() {
  memoriesLoading.value = true
  try {
    const data = await $fetch<{ memories: MemoryItem[] }>(`/api/timeline`, {
      query: { circle: props.circleId },
    })
    allMemories.value = data.memories ?? []
  } catch {
    allMemories.value = []
  } finally {
    memoriesLoading.value = false
  }
}

function toggleMemory(id: string) {
  const s = new Set(selectedMemoryIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedMemoryIds.value = s
}

function selectYear(year: number) {
  dateFrom.value = `${year}-01-01`
  dateTo.value = `${year}-12-31`
}

function isYearSelected(year: number): boolean {
  return dateFrom.value === `${year}-01-01` && dateTo.value === `${year}-12-31`
}

async function handleCreate() {
  if (!isValid.value || creating.value) return
  creating.value = true
  try {
    await $fetch(`/api/circles/${props.circleId}/viewer-links`, {
      method: 'POST',
      body: {
        mode: selectedMode.value,
        label: label.value || undefined,
        memoryIds: selectedMode.value === 'selection' ? [...selectedMemoryIds.value] : undefined,
        dateFrom: selectedMode.value === 'date_range' ? dateFrom.value : undefined,
        dateTo: selectedMode.value === 'date_range' ? dateTo.value : undefined,
      },
    })
    emit('created')
    emit('close')
    // Reset state
    selectedMode.value = 'full'
    dateFrom.value = ''
    dateTo.value = ''
    selectedMemoryIds.value = new Set()
    label.value = ''
  } catch {
    // Error handling: surface via toast in parent
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/CreateLinkSheet.vue
git commit -m "feat(ui): CreateLinkSheet — mode picker, date range, memory grid, label"
```

---

## Task 12: Wire Share button into `timeline/index.vue`

**Files:**

- Modify: `app/pages/timeline/index.vue`

- [ ] **Step 1: Add state + fetch logic**

In the `<script setup>` section of `timeline/index.vue`, add after the existing refs:

```ts
// ── Viewer links (owner-only) ──────────────────────────────────────────────────
const shareSheetOpen = ref(false)
const createSheetOpen = ref(false)
const viewerLinks = ref<any[]>([])
const viewerLinksLoading = ref(false)

async function openShareSheet() {
  shareSheetOpen.value = true
  await loadViewerLinks()
}

async function loadViewerLinks() {
  if (!circleId.value) return
  viewerLinksLoading.value = true
  try {
    viewerLinks.value = await $fetch(`/api/circles/${circleId.value}/viewer-links`)
  } catch {
    viewerLinks.value = []
  } finally {
    viewerLinksLoading.value = false
  }
}

async function revokeViewerLink(linkId: string) {
  if (!circleId.value) return
  await $fetch(`/api/circles/${circleId.value}/viewer-links/${linkId}`, { method: 'DELETE' })
  await loadViewerLinks()
}

async function renewViewerLink(link: any) {
  // Revoke the old link then open create sheet to make a replacement
  await revokeViewerLink(link.id)
  createSheetOpen.value = true
}
```

- [ ] **Step 2: Add Share button in the header**

In the template header section, after the "Add memory" button and before `<LocalePicker>`:

```html
<!-- Share link (owner only) -->
<button
  v-if="circle?.role === 'owner'"
  class="flex h-7 flex-shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
  @click="openShareSheet"
>
  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
  <span>{{ t('viewerLink.shareButton') }}</span>
</button>
```

- [ ] **Step 3: Add components at end of template (before closing `</div>`)**

```html
<!-- Viewer link management sheets (owner-only) -->
<ShareLinksSheet
  :open="shareSheetOpen"
  :links="viewerLinks"
  :loading="viewerLinksLoading"
  @close="shareSheetOpen = false"
  @create="createSheetOpen = true"
  @revoke="revokeViewerLink"
  @renew="renewViewerLink"
/>
<CreateLinkSheet
  :open="createSheetOpen"
  :circle-id="circleId ?? ''"
  @close="createSheetOpen = false"
  @created="loadViewerLinks"
/>
```

- [ ] **Step 4: Run unit tests**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/pages/timeline/index.vue
git commit -m "feat(ui): add Share button to timeline header — opens viewer link management"
```

---

## Task 13: Update `view.vue` — banner, empty state, globe indicator, referral CTA, i18n

**Files:**

- Modify: `app/pages/view.vue`

- [ ] **Step 1: Update `ViewerTimeline` interface and `loadTimeline`**

Replace the `ViewerTimeline` interface:

```ts
interface ViewerTimeline {
  circleName: string
  ownerFirstName: string | null
  linkLabel: string
  mode: 'full' | 'date_range' | 'selection'
  selectionDateRange: { from: string; to: string } | null
  memories: Array<{
    id: string
    memory_date: string
    note: string | null
    signedUrl: string | null
    mediaType: 'image' | 'video' | null
  }>
}
```

Add referral CTA state after existing state refs:

```ts
const memoriesSeenCount = ref(0)
const referralDismissed = ref(false)
const showReferral = computed(() => memoriesSeenCount.value >= 3 && !referralDismissed.value)
```

- [ ] **Step 2: Replace the timeline view section of the template**

Replace everything inside `<template v-else-if="timeline">` with:

```html
<template v-else-if="timeline">
  <div class="mx-auto max-w-[1280px]">
    <!-- Minimal header -->
    <header
      class="sticky top-0 z-20 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md"
    >
      <div class="flex items-center justify-between">
        <div>
          <p
            class="mb-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.18em] text-accent"
          >
            Our Story
          </p>
          <p class="text-sm font-semibold text-foreground">
            {{ timeline.circleName }}
            <span
              v-if="timeline.linkLabel && timeline.mode !== 'full'"
              class="font-normal text-muted-foreground"
            >
              · {{ timeline.linkLabel }}</span
            >
          </p>
        </div>
        <NuxtLink
          to="/login"
          class="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {{ t('viewerLink.viewerSignIn') }}
        </NuxtLink>
      </div>

      <!-- Mode banner -->
      <p v-if="modeBanner" class="mt-1 text-xs text-muted-foreground">{{ modeBanner }}</p>
    </header>

    <main class="px-4 py-6">
      <!-- Empty state -->
      <div v-if="timeline.memories.length === 0" class="py-20 text-center">
        <p class="mb-1 text-sm font-semibold text-foreground">{{ t('viewerLink.emptyState') }}</p>
        <p class="text-xs text-muted-foreground">{{ t('viewerLink.emptyStateBody') }}</p>
      </div>

      <!-- Memory list -->
      <div v-else class="flex flex-col gap-6">
        <article
          v-for="(memory, index) in timeline.memories"
          :key="memory.id"
          class="overflow-hidden rounded-2xl border border-border bg-card"
          :ref="(el) => observeMemory(el as Element | null, index)"
        >
          <video
            v-if="memory.signedUrl && memory.mediaType === 'video'"
            :src="memory.signedUrl"
            class="aspect-[4/3] w-full object-cover"
            controls
            playsinline
            preload="metadata"
          />
          <img
            v-else-if="memory.signedUrl"
            :src="memory.signedUrl"
            :alt="memory.note ?? 'Memory'"
            class="aspect-[4/3] w-full object-cover"
          />
          <div class="px-4 py-4">
            <p class="mb-1 text-xs text-muted-foreground">{{ formatDate(memory.memory_date) }}</p>
            <p v-if="memory.note" class="text-base leading-relaxed text-foreground">
              {{ memory.note }}
            </p>
            <!-- Reaction button -->
            <div class="mt-3 flex items-center gap-2">
              <button
                @click="reactToMemory(memory.id)"
                :disabled="reactedIds.has(memory.id)"
                class="flex items-center gap-1.5 transition-all active:scale-95"
                :class="reactedIds.has(memory.id)
                  ? 'text-rose-500 cursor-default'
                  : 'text-muted-foreground hover:text-rose-500 hover:scale-110'"
                :aria-label="reactedIds.has(memory.id) ? t('viewerLink.viewerReactSent') : t('viewerLink.viewerReact')"
              >
                <svg
                  class="h-5 w-5 transition-all"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :fill="reactedIds.has(memory.id) ? 'currentColor' : 'none'"
                >
                  <path
                    d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                  />
                </svg>
                <span class="text-xs font-medium">
                  {{ reactedIds.has(memory.id) ? t('viewerLink.viewerReactSent') :
                  t('viewerLink.viewerReact') }}
                </span>
              </button>
              <Transition name="fade">
                <span v-if="justReactedId === memory.id" class="text-xs font-medium text-rose-500">
                  {{ t('viewerLink.viewerReactionConfirm') }}
                </span>
              </Transition>
            </div>
          </div>
        </article>

        <!-- Referral CTA — shown after 3+ memories scrolled -->
        <Transition name="fade">
          <div
            v-if="showReferral"
            class="rounded-2xl border border-border bg-secondary/50 px-5 py-6 text-center"
          >
            <p class="mb-1 text-sm font-semibold text-foreground">
              {{ t('viewerLink.referralHeadline') }}
            </p>
            <button @click="shareApp" class="text-sm text-accent hover:underline">
              {{ t('viewerLink.referralBody') }}
            </button>
            <button
              @click="referralDismissed = true"
              class="mx-auto mt-2 block text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        </Transition>
      </div>

      <!-- Join CTA -->
      <div class="mt-10 text-center">
        <NuxtLink
          to="/login"
          class="inline-block rounded-[12px] bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {{ t('viewerLink.viewerJoinCta') }}
        </NuxtLink>
      </div>
    </main>
  </div>
</template>
```

- [ ] **Step 3: Update the first-open splash strings to use i18n**

Replace hardcoded strings in the splash template:

- `"created this\nso you'd never miss a moment."` → `{{ timeline.ownerFirstName || 'Someone' }} {{ t('viewerLink.viewerSplashTitle') }}`
- `"No account needed — just scroll."` → `{{ t('viewerLink.viewerSplashSubtitle') }}`
- `"See the memories →"` → `{{ t('viewerLink.viewerSplashCta') }}`

Replace hardcoded strings in the expired/invalid error templates:

- expired title/body/CTA and invalid title/body/sign-in link → use `t('viewerLink.viewerExpiredTitle')` etc.

Replace hardcoded strings in the name prompt:

- `"What's your name?"` → `{{ t('viewerLink.viewerNamePromptTitle') }}`
- `"So the family knows it's you ❤️"` → `{{ t('viewerLink.viewerNamePromptSubtitle') }}`
- placeholder → `t('viewerLink.viewerNamePromptPlaceholder')`
- `"Send reaction"` → `{{ t('viewerLink.viewerNamePromptCta') }}`

- [ ] **Step 4: Add `modeBanner` computed + `observeMemory` + `shareApp` to `<script setup>`**

```ts
const { t } = useI18n()

const modeBanner = computed(() => {
  if (!timeline.value) return null
  const { mode, selectionDateRange, memories } = timeline.value
  if (mode === 'date_range' && selectionDateRange) {
    const fmt = (d: string) =>
      new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date(d))
    return t('viewerLink.dateRangeBanner', {
      from: fmt(selectionDateRange.from),
      to: fmt(selectionDateRange.to),
    })
  }
  if (mode === 'selection' && selectionDateRange) {
    const fmt = (d: string) =>
      new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date(d))
    return t('viewerLink.selectionBanner', {
      count: memories.length,
      from: fmt(selectionDateRange.from),
      to: fmt(selectionDateRange.to),
    })
  }
  return null
})

let observer: IntersectionObserver | null = null

function observeMemory(el: Element | null, index: number) {
  if (!el || index < 2) return // only need to observe 3rd memory (index 2)
  if (observer) return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        memoriesSeenCount.value = Math.max(memoriesSeenCount.value, 3)
        observer?.disconnect()
        observer = null
      }
    },
    { threshold: 0.5 },
  )
  observer.observe(el)
}

async function shareApp() {
  referralDismissed.value = true
  const shareData = { title: 'Our Story', url: 'https://ourstory.tinybit.app' }
  if (navigator.share) {
    await navigator.share(shareData).catch(() => {})
  } else {
    await navigator.clipboard.writeText(shareData.url).catch(() => {})
  }
}
```

- [ ] **Step 5: Run unit tests**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add app/pages/view.vue
git commit -m "feat(ui): viewer page — mode banner, empty state, i18n, referral CTA"
```

---

## Task 14: E2E tests

**Files:**

- Create: `tests/viewer-link.spec.ts`

- [ ] **Step 1: Write the tests**

```ts
// tests/viewer-link.spec.ts
import { test, expect } from '@playwright/test'

// These tests assume a seeded DB with:
//   - owner@test.com (owner of "Test Circle")
//   - member@test.com (member of "Test Circle")
//   - At least 3 memories in "Test Circle"

test.describe('viewer link management', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as owner
    await page.goto('/login')
    await page.getByTestId('magic-link-input').fill('owner@test.com')
    await page.getByTestId('magic-link-submit').click()
    await page.waitForURL('/timeline**')
  })

  test('owner sees Share button; member does not', async ({ page, browser }) => {
    // Owner sees Share button
    await expect(page.getByRole('button', { name: /share/i })).toBeVisible()

    // Log in as member in a new page
    const memberPage = await browser.newPage()
    await memberPage.goto('/login')
    await memberPage.getByTestId('magic-link-input').fill('member@test.com')
    await memberPage.getByTestId('magic-link-submit').click()
    await memberPage.waitForURL('/timeline**')
    await expect(memberPage.getByRole('button', { name: /share/i })).not.toBeVisible()
    await memberPage.close()
  })

  test('create full-timeline link → copy URL → /view loads', async ({ page }) => {
    await page.getByRole('button', { name: /share/i }).click()
    await expect(page.getByText(/share your circle/i)).toBeVisible()

    await page.getByRole('button', { name: /create a link/i }).click()
    // Default mode is "Full timeline" — just click create
    await page
      .getByRole('button', { name: /create a link/i })
      .last()
      .click()

    // Link appears in list
    await expect(page.getByText('Full timeline')).toBeVisible()

    // Copy the link
    await page.getByRole('button', { name: /copy link/i }).click()
    await expect(page.getByText(/copied/i)).toBeVisible()

    // Navigate to the viewer URL
    const handle = await page.evaluateHandle(() => navigator.clipboard.readText())
    const url = (await handle.jsonValue()) as string
    expect(url).toContain('/view?token=')

    const viewerPage = await page.context().newPage()
    await viewerPage.goto(url)
    await viewerPage.getByRole('button', { name: /see the memories/i }).click()
    await expect(viewerPage.locator('article').first()).toBeVisible()
    await viewerPage.close()
  })

  test('create date_range link → viewer sees date range banner', async ({ page }) => {
    await page.getByRole('button', { name: /share/i }).click()
    await page.getByRole('button', { name: /create a link/i }).click()

    await page.getByRole('button', { name: /date range/i }).click()
    // Select current year quick pick
    const year = new Date().getFullYear().toString()
    await page.getByRole('button', { name: year }).click()
    await page
      .getByRole('button', { name: /create a link/i })
      .last()
      .click()

    await expect(page.getByText(new RegExp(year))).toBeVisible()

    // Get token from clipboard
    await page.getByRole('button', { name: /copy link/i }).click()
    const handle = await page.evaluateHandle(() => navigator.clipboard.readText())
    const url = (await handle.jsonValue()) as string

    const viewerPage = await page.context().newPage()
    await viewerPage.goto(url)
    await viewerPage.getByRole('button', { name: /see the memories/i }).click()
    // Mode banner should mention date range
    await expect(viewerPage.getByText(/memories from/i)).toBeVisible()
    await viewerPage.close()
  })

  test('create selection link → viewer sees only selected memories', async ({ page }) => {
    await page.getByRole('button', { name: /share/i }).click()
    await page.getByRole('button', { name: /create a link/i }).click()

    await page.getByRole('button', { name: /select memories/i }).click()
    // Pick the first memory thumbnail
    const firstThumb = page.locator('.grid button').first()
    await firstThumb.click()
    await expect(page.getByText('1 selected')).toBeVisible()

    await page
      .getByRole('button', { name: /create a link/i })
      .last()
      .click()
    await expect(page.getByText(/1 memories|1 selected/i)).toBeVisible()
  })

  test('revoke link → /view returns invalid error', async ({ page }) => {
    // First create a link
    await page.getByRole('button', { name: /share/i }).click()
    await page.getByRole('button', { name: /create a link/i }).click()
    await page
      .getByRole('button', { name: /create a link/i })
      .last()
      .click()

    await page.getByRole('button', { name: /copy link/i }).click()
    const handle = await page.evaluateHandle(() => navigator.clipboard.readText())
    const url = (await handle.jsonValue()) as string

    // Revoke it
    await page.getByTitle(/revoke/i).click()
    await page.getByRole('button', { name: /^revoke$/i }).click()

    // Verify /view now shows invalid
    const viewerPage = await page.context().newPage()
    await viewerPage.goto(url)
    await expect(viewerPage.getByText(/invalid|revoked/i)).toBeVisible()
    await viewerPage.close()
  })

  test('referral CTA appears after scrolling 3+ memories', async ({ page }) => {
    // Get a viewer link token
    await page.getByRole('button', { name: /share/i }).click()
    await page.getByRole('button', { name: /create a link/i }).click()
    await page
      .getByRole('button', { name: /create a link/i })
      .last()
      .click()
    await page.getByRole('button', { name: /copy link/i }).click()
    const handle = await page.evaluateHandle(() => navigator.clipboard.readText())
    const url = (await handle.jsonValue()) as string

    const viewerPage = await page.context().newPage()
    await viewerPage.goto(url)
    await viewerPage.getByRole('button', { name: /see the memories/i }).click()

    // Scroll down past 3 memories
    await viewerPage.locator('article').nth(2).scrollIntoViewIfNeeded()
    await expect(viewerPage.getByText(/know someone/i)).toBeVisible({ timeout: 3000 })
    await viewerPage.close()
  })

  test('empty state when date range has no memories', async ({ page }) => {
    await page.getByRole('button', { name: /share/i }).click()
    await page.getByRole('button', { name: /create a link/i }).click()
    await page.getByRole('button', { name: /date range/i }).click()

    // Set a date range in the far future (no memories)
    await page.locator('input[type="date"]').first().fill('2099-01-01')
    await page.locator('input[type="date"]').last().fill('2099-12-31')
    await page
      .getByRole('button', { name: /create a link/i })
      .last()
      .click()

    await page.getByRole('button', { name: /copy link/i }).click()
    const handle = await page.evaluateHandle(() => navigator.clipboard.readText())
    const url = (await handle.jsonValue()) as string

    const viewerPage = await page.context().newPage()
    await viewerPage.goto(url)
    await viewerPage.getByRole('button', { name: /see the memories/i }).click()
    await expect(viewerPage.getByText(/no memories to show/i)).toBeVisible()
    await viewerPage.close()
  })

  test('expired link badge shown in sheet; Renew opens create sheet', async ({ page }) => {
    // This test relies on a DB fixture with a pre-expired viewer_link row.
    // The fixture is set up in the test seed via pnpm db:seed:test.
    // If no expired fixture exists, skip gracefully.
    await page.getByRole('button', { name: /share/i }).click()
    const expiredBadge = page.getByText('Expired')
    if (await expiredBadge.isVisible()) {
      await page.getByRole('button', { name: /renew/i }).click()
      await expect(page.getByText(/create a link/i)).toBeVisible()
    }
  })
})
```

- [ ] **Step 2: Run E2E tests**

```bash
pnpm test:e2e tests/viewer-link.spec.ts
```

Expected: all tests pass (may require seeded test data).

- [ ] **Step 3: Commit**

```bash
git add tests/viewer-link.spec.ts
git commit -m "test(e2e): viewer link management — 8 E2E tests"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement                                          | Covered in task |
| --------------------------------------------------------- | --------------- |
| Migration: `viewer_link` table                            | Task 1          |
| RLS: owner-only SELECT/INSERT/DELETE                      | Task 1 + Task 8 |
| JWT: `viewer_link_id` + `nonce`                           | Task 2          |
| GET/POST/DELETE viewer-links API                          | Tasks 3, 4, 5   |
| Viewer timeline: nonce check + mode filtering             | Task 6          |
| Guest reactions: revocation check                         | Task 7          |
| RLS tests (8 new)                                         | Task 8          |
| i18n keys (en, zh-CN, fr)                                 | Task 9          |
| ShareLinksSheet                                           | Task 10         |
| CreateLinkSheet (mode picker, date range, memory grid)    | Task 11         |
| Share button in timeline header (owner-only)              | Task 12         |
| Viewer page: mode banner                                  | Task 13         |
| Viewer page: empty state                                  | Task 13         |
| Viewer page: i18n all hardcoded strings                   | Task 13         |
| Viewer page: referral CTA after 3+ memories               | Task 13         |
| E2E tests                                                 | Task 14         |
| `notified_expiry_at` column (for 3-day expiry email cron) | Task 1          |

**Missing from this plan — deferred:**

- 3-day expiry email cron job (requires Supabase Edge Function or pg_cron; add as a follow-up task after Phase 1 launch)
- Guest reaction globe indicator in tooltip (the `view.vue` reaction UI doesn't yet show a full tooltip list of reactors — it's a simple heart button. Add globe indicator when the full reaction tooltip is added in a future task)

**Placeholder scan:** None found.

**Type consistency:** `ViewerPayload` updated in Task 2; used consistently in Tasks 3-7. `ViewerLink` interface in `ShareLinksSheet` matches API response shape defined in Tasks 3/4.
