import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  listTierConfigurations, upsertTierConfiguration,
  listScheduledChallenges,
} from '../../lib/supabase-hr';

const TIERS = ['bronze', 'silver', 'gold'];

export function useTierConfig(competitionId) {
  const [configs, setConfigs] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [cfgs, comps] = await Promise.all([
        listTierConfigurations(competitionId),
        // Real scheduled challenges, not catalogue templates — the
        // tier_configurations.competition_id FK points at challenges.id.
        listScheduledChallenges(),
      ]);
      setConfigs(cfgs);
      setCompetitions(comps || []);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => { refetch(); }, [refetch]);

  // For the active competition, return one entry per tier — either the
  // existing config or a draft default. The UI can edit and save.
  const tierMap = useMemo(() => {
    const out = {};
    for (const tier of TIERS) {
      const existing = configs.find(c => c.tier === tier);
      out[tier] = existing || {
        tier,
        competition_id: competitionId || null,
        gift_catalog_item_id: null,
        allow_employee_choice: false,
        choice_options: [],
        value_minor_override: null,
      };
    }
    return out;
  }, [configs, competitionId]);

  const save = useCallback(async (tierConfig) => {
    if (!competitionId) throw new Error('no_competition');
    const saved = await upsertTierConfiguration({
      ...tierConfig,
      competition_id: competitionId,
    });
    await refetch();
    return saved;
  }, [competitionId, refetch]);

  return { tierMap, configs, competitions, loading, error, save, refetch };
}

export const TIER_LIST = TIERS;
