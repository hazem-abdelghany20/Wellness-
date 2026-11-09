import { useState, useEffect, useCallback } from 'react';
import { getRecognitionBoard } from '../../lib/supabase-routines';
import { boardView } from '../lib/recognition.js';

// The company board for 'today' or 'week'. `view` is null when the company
// has it off, or when it can't be loaded (the board is a bonus, never a blocker).
export function useRecognitionBoard(period = 'today', enabled = true) {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setBoard(await getRecognitionBoard(period)); }
    catch (e) { setError(e); setBoard(null); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { if (enabled) refetch(); else setLoading(false); }, [enabled, refetch]);

  return { board, view: boardView(board), loading, error, refetch };
}
