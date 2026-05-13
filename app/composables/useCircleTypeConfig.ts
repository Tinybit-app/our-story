/**
 * Per-circle-type content configuration.
 * Single source of truth for all copy and quick-pick milestone chips
 * that differ between circle types.
 *
 * Pass the `t` function from `useI18n()` to get locale-aware strings.
 * Omitting `t` (e.g. in unit tests) returns the English fallback strings.
 *
 * Note: milestoneChips are intentionally kept in English because they are
 * stored verbatim as milestone_label in the database (not as i18n keys).
 */

export interface CircleTypeConfig {
  emptyTitle: string
  emptyDesc: string
  milestonePlaceholder: string // full upload panel (single-item view)
  milestoneShort: string // compact grid caption
  milestoneChips: string[] // quick-pick suggestions in the upload panel
}

// Milestone chips stay in English — they are stored verbatim in the DB.
const CHIPS: Record<string, string[]> = {
  parents: [
    'First smile',
    'First steps',
    'First word',
    'First birthday',
    'First tooth',
  ],
  couple: [
    'First date',
    'Anniversary',
    'Engaged',
    'Moved in together',
    'Wedding day',
  ],
  family: ['Family trip', 'Birthday', 'Holiday', 'Graduation', 'Reunion'],
  friends: ['Trip', 'Party', 'Concert', 'Road trip', 'Reunion'],
  caregiving: [
    'Good day',
    'Doctor visit',
    'Treatment',
    'Recovery',
    'Milestone',
  ],
  travel: ['Arrived', 'Best meal', 'Hidden gem', 'Adventure', 'Last day'],
  solo: ['Achievement', 'New chapter', 'Goal reached', 'Reflection', 'Memory'],
}

// English fallback strings — used when no `t` function is provided (e.g. unit tests).
const EN_FALLBACK: Record<string, Omit<CircleTypeConfig, 'milestoneChips'>> = {
  parents: {
    emptyTitle: 'Every milestone deserves a memory',
    emptyDesc:
      "Add your first photo or video to start documenting your little one's story.",
    milestonePlaceholder: 'e.g. First steps, First birthday… (optional)',
    milestoneShort: '✦ Milestone… (optional)',
  },
  couple: {
    emptyTitle: 'Your shared story starts here',
    emptyDesc:
      'Add your first memory together to start building your timeline.',
    milestonePlaceholder: 'e.g. First date, Our anniversary… (optional)',
    milestoneShort: '✦ Milestone… (optional)',
  },
  family: {
    emptyTitle: 'Family moments last forever',
    emptyDesc:
      'Add your first photo or video to start building your family story.',
    milestonePlaceholder: 'e.g. Family holiday, Graduation… (optional)',
    milestoneShort: '✦ Milestone… (optional)',
  },
  friends: {
    emptyTitle: 'Capture every adventure together',
    emptyDesc:
      'Add your first photo or video to start building your shared memories.',
    milestonePlaceholder: "e.g. Barcelona trip, New Year's… (optional)",
    milestoneShort: '✦ Milestone… (optional)',
  },
  caregiving: {
    emptyTitle: 'Every moment matters',
    emptyDesc:
      'Add your first photo or video to start documenting your journey.',
    milestonePlaceholder: 'e.g. Doctor visit, Recovery milestone… (optional)',
    milestoneShort: '✦ Milestone… (optional)',
  },
  travel: {
    emptyTitle: 'The adventure starts here',
    emptyDesc:
      'Add your first photo or video from the trip to start your travel story.',
    milestonePlaceholder: 'e.g. Arrived in Tokyo, Summit reached… (optional)',
    milestoneShort: '✦ Milestone… (optional)',
  },
  solo: {
    emptyTitle: 'Your story, your way',
    emptyDesc:
      'Add your first photo or video to start building your personal timeline.',
    milestonePlaceholder: 'e.g. New job, Personal achievement… (optional)',
    milestoneShort: '✦ Milestone… (optional)',
  },
}

const EN_DEFAULT: Omit<CircleTypeConfig, 'milestoneChips'> = {
  emptyTitle: 'Your story starts here',
  emptyDesc:
    'Add your first photo or video to start building your shared timeline.',
  milestonePlaceholder: 'e.g. First steps, Wedding day… (optional)',
  milestoneShort: '✦ Milestone… (optional)',
}

export function useCircleTypeConfig(
  circleType: string | null | undefined,
  t?: (key: string) => string,
): CircleTypeConfig {
  const chips = circleType && CHIPS[circleType] ? CHIPS[circleType]! : []

  if (t) {
    const typeKey = circleType && CHIPS[circleType] ? circleType : 'default'
    return {
      emptyTitle: t(`circleTypeConfig.${typeKey}.emptyTitle`),
      emptyDesc: t(`circleTypeConfig.${typeKey}.emptyDesc`),
      milestonePlaceholder: t(
        `circleTypeConfig.${typeKey}.milestonePlaceholder`,
      ),
      milestoneShort: t('upload.milestoneShort'),
      milestoneChips: chips,
    }
  }

  const fallback =
    circleType && EN_FALLBACK[circleType]
      ? EN_FALLBACK[circleType]!
      : EN_DEFAULT
  return { ...fallback, milestoneChips: chips }
}
