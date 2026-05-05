// Streak tier model for Wellness+ v2 (Sprint 0).
// Sprint 1 will move the color tokens into the design system; for now
// they live here so the Today screen and Wallet hero share one source.
export const TIER_THRESHOLDS = Object.freeze({ silver: 7, gold: 21 });

const TIER_COLORS = Object.freeze({
  bronze: '#C08458',
  silver: '#A0AEC0',
  gold:   '#D4A65A',
});

const TIER_LABELS = Object.freeze({
  bronze: { en: 'Bronze', ar: 'برونزي' },
  silver: { en: 'Silver', ar: 'فضي' },
  gold:   { en: 'Gold',   ar: 'ذهبي' },
});

export function tierFor(streak = 0) {
  const s = Math.max(0, Math.floor(Number(streak) || 0));
  if (s >= TIER_THRESHOLDS.gold) {
    return {
      tier: 'gold', label: TIER_LABELS.gold, color: TIER_COLORS.gold,
      progress: 1, next: null, daysToNext: 0,
    };
  }
  if (s >= TIER_THRESHOLDS.silver) {
    const span = TIER_THRESHOLDS.gold - TIER_THRESHOLDS.silver;
    return {
      tier: 'silver', label: TIER_LABELS.silver, color: TIER_COLORS.silver,
      progress: (s - TIER_THRESHOLDS.silver) / span,
      next: 'gold', nextLabel: TIER_LABELS.gold,
      daysToNext: TIER_THRESHOLDS.gold - s,
    };
  }
  return {
    tier: 'bronze', label: TIER_LABELS.bronze, color: TIER_COLORS.bronze,
    progress: TIER_THRESHOLDS.silver === 0 ? 1 : s / TIER_THRESHOLDS.silver,
    next: 'silver', nextLabel: TIER_LABELS.silver,
    daysToNext: TIER_THRESHOLDS.silver - s,
  };
}
