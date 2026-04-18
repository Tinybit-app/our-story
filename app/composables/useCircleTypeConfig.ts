/**
 * Per-circle-type content configuration.
 * Single source of truth for all copy and quick-pick milestone chips
 * that differ between circle types.
 */

export interface CircleTypeConfig {
  emptyTitle: string
  emptyDesc: string
  milestonePlaceholder: string  // full upload panel (single-item view)
  milestoneShort: string        // compact grid caption
  milestoneChips: string[]      // quick-pick suggestions in the upload panel
}

const CONFIGS: Record<string, CircleTypeConfig> = {
  parents: {
    emptyTitle: "Every milestone deserves a memory",
    emptyDesc: "Add your first photo or video to start documenting your little one's story.",
    milestonePlaceholder: "e.g. First steps, First birthday… (optional)",
    milestoneShort: "✦ Milestone… (optional)",
    milestoneChips: ["First smile", "First steps", "First word", "First birthday", "First tooth"],
  },
  couple: {
    emptyTitle: "Your shared story starts here",
    emptyDesc: "Add your first memory together to start building your timeline.",
    milestonePlaceholder: "e.g. First date, Our anniversary… (optional)",
    milestoneShort: "✦ Milestone… (optional)",
    milestoneChips: ["First date", "Anniversary", "Engaged", "Moved in together", "Wedding day"],
  },
  family: {
    emptyTitle: "Family moments last forever",
    emptyDesc: "Add your first photo or video to start building your family story.",
    milestonePlaceholder: "e.g. Family holiday, Graduation… (optional)",
    milestoneShort: "✦ Milestone… (optional)",
    milestoneChips: ["Family trip", "Birthday", "Holiday", "Graduation", "Reunion"],
  },
  friends: {
    emptyTitle: "Capture every adventure together",
    emptyDesc: "Add your first photo or video to start building your shared memories.",
    milestonePlaceholder: "e.g. Barcelona trip, New Year's… (optional)",
    milestoneShort: "✦ Milestone… (optional)",
    milestoneChips: ["Trip", "Party", "Concert", "Road trip", "Reunion"],
  },
  caregiving: {
    emptyTitle: "Every moment matters",
    emptyDesc: "Add your first photo or video to start documenting your journey.",
    milestonePlaceholder: "e.g. Doctor visit, Recovery milestone… (optional)",
    milestoneShort: "✦ Milestone… (optional)",
    milestoneChips: ["Good day", "Doctor visit", "Treatment", "Recovery", "Milestone"],
  },
  travel: {
    emptyTitle: "The adventure starts here",
    emptyDesc: "Add your first photo or video from the trip to start your travel story.",
    milestonePlaceholder: "e.g. Arrived in Tokyo, Summit reached… (optional)",
    milestoneShort: "✦ Milestone… (optional)",
    milestoneChips: ["Arrived", "Best meal", "Hidden gem", "Adventure", "Last day"],
  },
  solo: {
    emptyTitle: "Your story, your way",
    emptyDesc: "Add your first photo or video to start building your personal timeline.",
    milestonePlaceholder: "e.g. New job, Personal achievement… (optional)",
    milestoneShort: "✦ Milestone… (optional)",
    milestoneChips: ["Achievement", "New chapter", "Goal reached", "Reflection", "Memory"],
  },
}

const FALLBACK: CircleTypeConfig = {
  emptyTitle: "Your story starts here",
  emptyDesc: "Add your first photo or video to start building your shared timeline.",
  milestonePlaceholder: "e.g. First steps, Wedding day… (optional)",
  milestoneShort: "✦ Milestone… (optional)",
  milestoneChips: [],
}

export function useCircleTypeConfig(circleType: string | null | undefined): CircleTypeConfig {
  return CONFIGS[circleType ?? ""] ?? FALLBACK
}
