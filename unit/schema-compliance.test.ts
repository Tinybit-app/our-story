/**
 * Schema compliance tests
 *
 * These tests read the migration SQL files and assert that the tables,
 * columns, constraints, RLS helpers, and policies match what the build
 * plan (docs/build-plan.md §2.1–2.4) and design spec require.
 *
 * They are intentionally structural — catching regressions where a rename
 * or edit accidentally removes a required definition.
 */

import { readFileSync } from "fs"
import { resolve } from "path"
import { describe, it, expect } from "vitest"

const root = resolve(__dirname, "..")

function sql(filename: string): string {
  return readFileSync(resolve(root, "supabase/migrations", filename), "utf-8")
}

// All migrations combined — represents the full deployed schema
const allMigrations = [
  sql("001_initial_schema.sql"),
  sql("002_rls_policies.sql"),
  sql("003_storage.sql"),
  sql("004_schema_additions.sql"),
  sql("026_push_subscriptions.sql"),
  sql("027_digest_monthly_default.sql"),
  sql("028_circle_digest_tracking.sql"),
].join("\n")

// ============================================================
// 2.1 — Initial schema: tables and columns
// ============================================================
describe("Step 2.1 — Schema tables", () => {
  it("defines public.User with required columns", () => {
    expect(allMigrations).toContain("CREATE TABLE public.User")
    expect(allMigrations).toContain("stripe_customer_id")
    expect(allMigrations).toContain("stripe_subscription_id")
    expect(allMigrations).toContain("subscription_status")
    expect(allMigrations).toContain("referral_code")
    expect(allMigrations).toContain("deletion_requested_at")
    expect(allMigrations).toContain("deleted_at")
  })

  it("User.locale CHECK includes en, zh-Hans, and fr", () => {
    // 004 expands the CHECK — combined migrations must include all three
    expect(allMigrations).toMatch(/locale.*IN.*'en'/)
    expect(allMigrations).toMatch(/locale.*IN.*'zh-Hans'/)
    expect(allMigrations).toContain("'fr'")
  })

  it("defines public.Circle with required columns", () => {
    expect(allMigrations).toContain("CREATE TABLE public.Circle")
    expect(allMigrations).toContain("circle_type")
    expect(allMigrations).toContain("subscription_status")
    expect(allMigrations).toContain("first_memory_at")
    expect(allMigrations).toContain("last_memory_at")
    expect(allMigrations).toContain("memory_count")
    expect(allMigrations).toContain("quiet_nudge_count")
    expect(allMigrations).toContain("quiet_nudge_last_sent_at")
    expect(allMigrations).toContain("deleted_at")
    expect(allMigrations).toContain("deletion_initiated_by")
  })

  it("Circle.circle_type CHECK includes all 8 types from design spec", () => {
    // Design spec: 'parents','couple','family','friends','caregiving','travel','solo','custom'
    // Note: 'family' here is a circle_type DATA VALUE — not a table name. Must be preserved.
    const circleTypeValues = ["'parents'", "'couple'", "'family'", "'friends'", "'caregiving'", "'travel'", "'solo'", "'custom'"]
    for (const v of circleTypeValues) {
      expect(allMigrations).toContain(v)
    }
  })

  it("Memory.visibility CHECK is exactly ('private', 'circle') — not 'family'", () => {
    // Visibility was renamed from 'family' → 'circle'. Must not contain old value.
    expect(allMigrations).toMatch(/visibility.*IN.*'private'.*'circle'|visibility.*IN.*'circle'.*'private'/)
    // Ensure the old 'family' visibility value is gone from the visibility constraint
    // (but 'family' still appears as a circle_type value — that's intentional)
    expect(allMigrations).not.toMatch(/visibility\s+TEXT.*CHECK.*'family'/)
  })

  it("defines public.CircleMember (not FamilyMember)", () => {
    expect(allMigrations).toContain("CREATE TABLE public.CircleMember")
    expect(allMigrations).not.toContain("CREATE TABLE public.FamilyMember")
    expect(allMigrations).not.toContain("CREATE TABLE public.familymember")
  })

  it("CircleMember.role CHECK includes caregiver role", () => {
    expect(allMigrations).toContain("'caregiver'")
    expect(allMigrations).toMatch(/role.*IN.*'owner'.*'admin'.*'member'.*'caregiver'|role.*IN.*'owner'.*'member'/)
  })

  it("defines public.CircleInvite with admin role (from 004)", () => {
    expect(allMigrations).toContain("CREATE TABLE public.CircleInvite")
    expect(allMigrations).not.toContain("CREATE TABLE public.FamilyInvite")
    // 004 expands role CHECK to include 'admin'
    expect(allMigrations).toMatch(/circleinvite_role_check[\s\S]*?'admin'/)
  })

  it("defines public.Memory with memory_date (not created_at) ordering column", () => {
    expect(allMigrations).toContain("memory_date TIMESTAMPTZ")
    expect(allMigrations).toContain("idx_memory_circle_date")
    // Index must order by memory_date — the key requirement from CLAUDE.md
    expect(allMigrations).toMatch(/idx_memory_circle_date.*memory_date/)
  })

  it("defines public.MemoryMedia with audio type (from 004)", () => {
    expect(allMigrations).toContain("CREATE TABLE public.MemoryMedia")
    // 004 expands media_type CHECK to include 'audio'
    expect(allMigrations).toContain("'audio'")
  })

  it("defines public.AccountStorage with 5 GB default quota", () => {
    expect(allMigrations).toContain("CREATE TABLE public.AccountStorage")
    expect(allMigrations).toContain("5368709120")  // 5 GB in bytes
  })

  it("defines public.ExportJob for GDPR data portability", () => {
    expect(allMigrations).toContain("CREATE TABLE")
    expect(allMigrations).toContain("ExportJob")
    expect(allMigrations).toContain("download_url")
  })

  it("defines public.ChildProfile for milestone nudges", () => {
    expect(allMigrations).toContain("ChildProfile")
    expect(allMigrations).toContain("date_of_birth")
  })

  it("defines public.NewsletterRecipient with unsubscribe_token", () => {
    expect(allMigrations).toContain("NewsletterRecipient")
    expect(allMigrations).toContain("unsubscribe_token")
    expect(allMigrations).toContain("join_prompt_count")
  })

  it("storage_path column is defined but never returned (API rule)", () => {
    expect(allMigrations).toContain("storage_path TEXT NOT NULL")
    // The security rule (never expose storage_path) is enforced in API routes,
    // not in SQL. This test documents the column exists for internal use only.
  })
})

// ============================================================
// 2.1 — Triggers
// ============================================================
describe("Step 2.1 — Triggers", () => {
  it("has handle_new_user trigger on auth.users", () => {
    expect(allMigrations).toContain("handle_new_user")
    expect(allMigrations).toContain("on_auth_user_created")
  })

  it("has handle_new_account_storage trigger on public.User", () => {
    expect(allMigrations).toContain("handle_new_account_storage")
    expect(allMigrations).toContain("on_user_created_storage")
  })

  it("has handle_memory_insert trigger that updates Circle counters", () => {
    expect(allMigrations).toContain("handle_memory_insert")
    expect(allMigrations).toContain("on_memory_created")
    expect(allMigrations).toContain("first_memory_at")
    expect(allMigrations).toContain("last_memory_at")
    expect(allMigrations).toContain("memory_count")
    expect(allMigrations).toContain("quiet_nudge_count")
  })
})

// ============================================================
// 2.2 — RLS policies
// ============================================================
describe("Step 2.2 — RLS policies", () => {
  it("enables RLS on all core tables", () => {
    const tables = ["User", "Circle", "CircleMember", "CircleInvite", "AccountStorage", "Memory", "MemoryMedia", "MemoryComment", "MemoryReaction"]
    for (const t of tables) {
      expect(allMigrations).toMatch(new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`))
    }
  })

  it("uses SECURITY DEFINER helper functions to avoid RLS recursion", () => {
    expect(allMigrations).toContain("get_my_circle_ids")
    expect(allMigrations).toContain("get_my_circle_ids_as_role")
    expect(allMigrations).toContain("SECURITY DEFINER")
    expect(allMigrations).toContain("SET search_path = ''")  // prevents search_path injection
  })

  it("has RESTRICTIVE policy blocking non-owners from private memories", () => {
    expect(allMigrations).toContain("AS RESTRICTIVE")
    expect(allMigrations).toContain("private memories owner only")
  })

  it("has RESTRICTIVE policy blocking caregivers from private memories", () => {
    expect(allMigrations).toContain("caregiver cannot read private memories")
    // Caregiver policy must use = 'private' (not != 'circle') — logic inversion bug guard
    expect(allMigrations).toMatch(/caregiver cannot read private memories[\s\S]*?visibility = 'private'/)
  })

  it("Memory SELECT permissive policy uses 'circle' visibility (not 'family')", () => {
    expect(allMigrations).toContain("visibility = 'circle'")
    // No permissive policy should reference visibility = 'family'
    expect(allMigrations).not.toMatch(/visibility\s*=\s*'family'/)
  })

  it("CircleMember uses get_my_circle_ids (not get_my_family_ids)", () => {
    expect(allMigrations).toContain("get_my_circle_ids")
    expect(allMigrations).not.toContain("get_my_family_ids")
  })

  it("NotificationPreference has read and upsert policies", () => {
    expect(allMigrations).toContain("users can read own notification preferences")
    expect(allMigrations).toContain("users can upsert own notification preferences")
  })

  it("ChildProfile and NewsletterRecipient have RLS policies", () => {
    expect(allMigrations).toContain("members can read child profiles in their circles")
    expect(allMigrations).toContain("owner and admin can manage newsletter recipients")
  })
})

// ============================================================
// 2.4 — Storage bucket
// ============================================================
describe("Step 2.4 — Storage bucket setup", () => {
  const storage = sql("003_storage.sql")

  it("creates memories-private bucket as private (public: false)", () => {
    expect(storage).toContain("memories-private")
    // The INSERT has each value on its own line; check for the false value on its own line
    expect(storage).toMatch(/['"]memories-private['"],\s*\n\s*false,/)
    expect(storage).toContain("524288000")       // 500 MB file size limit
  })

  it("blocks direct reads — no-direct-reads policy uses USING (false)", () => {
    expect(storage).toContain("no direct reads")
    expect(storage).toMatch(/FOR SELECT[\s\S]*?USING \(false\)/)
  })

  it("storage upload policy scopes to user's own path", () => {
    expect(storage).toContain("authenticated users can upload")
    expect(storage).toContain("storage.foldername")
  })

  it("FeatureFlag has RLS enabled with no authenticated user SELECT policy", () => {
    expect(storage).toContain("ALTER TABLE public.FeatureFlag ENABLE ROW LEVEL SECURITY")
    // The only SELECT policy is the "no direct reads" deny-all on storage.objects.
    // There must be no permissive SELECT policy granting authenticated users access to FeatureFlag.
    expect(storage).not.toMatch(/ON public\.FeatureFlag[\s\S]*?FOR SELECT/)
  })
})

// ============================================================
// Rename guard: no Family→Circle renames missed
// ============================================================
describe("Rename guard — no Family/family_id references in migrations", () => {
  it("migrations contain no FamilyMember, FamilyInvite, or family_id table/column names", () => {
    expect(allMigrations).not.toContain("FamilyMember")
    expect(allMigrations).not.toContain("FamilyInvite")
    expect(allMigrations).not.toContain("family_id")
    expect(allMigrations).not.toContain("family_muted")
    expect(allMigrations).not.toContain("get_my_family_ids")
  })
})

// ============================================================
// Step 10.1 — PushSubscription table
// ============================================================
describe("Step 10.1 — PushSubscription table", () => {
  const m026 = sql("026_push_subscriptions.sql")

  it("defines PushSubscription table with required columns", () => {
    expect(m026).toContain("CREATE TABLE PushSubscription")
    expect(m026).toContain("user_id")
    expect(m026).toContain("endpoint")
    expect(m026).toContain("p256dh")
    expect(m026).toContain("auth")
    expect(m026).toContain("created_at")
  })

  it("has unique constraint on endpoint", () => {
    expect(m026).toContain("UNIQUE")
  })

  it("enables RLS", () => {
    expect(m026).toContain("ENABLE ROW LEVEL SECURITY")
  })

  it("has RLS policies for own subscriptions", () => {
    expect(m026).toContain("users can read own push subscriptions")
    expect(m026).toContain("users can insert own push subscriptions")
    expect(m026).toContain("users can delete own push subscriptions")
  })
})

// ============================================================
// Step 10.3 — Monthly digest default
// ============================================================
describe("Step 10.3 — Monthly digest default", () => {
  const m027 = sql("027_digest_monthly_default.sql")

  it("adds monthly to CHECK constraint", () => {
    expect(m027).toContain("monthly")
  })

  it("changes default to monthly", () => {
    expect(m027).toContain("SET DEFAULT 'monthly'")
  })
})

// ============================================================
// Step 12.1 — Circle digest tracking
// ============================================================
describe("Step 12.1 — Circle digest tracking", () => {
  const m028 = sql("028_circle_digest_tracking.sql")

  it("adds last_weekly_digest_sent_at column", () => {
    expect(m028).toContain("last_weekly_digest_sent_at TIMESTAMPTZ")
  })

  it("adds last_monthly_digest_sent_at column", () => {
    expect(m028).toContain("last_monthly_digest_sent_at TIMESTAMPTZ")
  })
})
