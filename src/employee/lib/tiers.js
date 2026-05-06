// Streak tier model for Wellness+ v2.
// Sprint 1: tier color tokens + labels live in src/shared/tokens.jsx
// (cross-app — Wallet, HR Gifts, future Admin). This module owns only
// the streak-thresholds and the derive-tier-from-streak logic.
import { TIER_TOKENS } from '../../shared/tokens.jsx';

export const TIER_THRESHOLDS = Object.freeze({ silver: 7, gold: 21 });

export function tierFor(streak = 0) {
  const s = Math.max(0, Math.floor(Number(streak) || 0));
  if (s >= TIER_THRESHOLDS.gold) {
    return {
      tier: 'gold',
      label: TIER_TOKENS.gold.label,
      color: TIER_TOKENS.gold.accent,
      colorSoft: TIER_TOKENS.gold.accentSoft,
      progress: 1, next: null, daysToNext: 0,
    };
  }
  if (s >= TIER_THRESHOLDS.silver) {
    const span = TIER_THRESHOLDS.gold - TIER_THRESHOLDS.silver;
    return {
      tier: 'silver',
      label: TIER_TOKENS.silver.label,
      color: TIER_TOKENS.silver.accent,
      colorSoft: TIER_TOKENS.silver.accentSoft,
      progress: (s - TIER_THRESHOLDS.silver) / span,
      next: 'gold', nextLabel: TIER_TOKENS.gold.label,
      daysToNext: TIER_THRESHOLDS.gold - s,
    };
  }
  return {
    tier: 'bronze',
    label: TIER_TOKENS.bronze.label,
    color: TIER_TOKENS.bronze.accent,
    colorSoft: TIER_TOKENS.bronze.accentSoft,
    progress: TIER_THRESHOLDS.silver === 0 ? 1 : s / TIER_THRESHOLDS.silver,
    next: 'silver', nextLabel: TIER_TOKENS.silver.label,
    daysToNext: TIER_THRESHOLDS.silver - s,
  };
}
