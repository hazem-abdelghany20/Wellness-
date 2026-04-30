import { useAuth } from '../state/auth-context.jsx';
import { updateMyProfile } from '../../lib/supabase';

export function useProfile() {
  const { profile, refreshProfile } = useAuth();
  const update = async (patch) => {
    await updateMyProfile(patch);
    await refreshProfile();
  };
  return { profile, update, refresh: refreshProfile };
}
