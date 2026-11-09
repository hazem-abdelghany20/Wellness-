import { useState, useEffect } from 'react';
import { getBroadcastMedia } from '../../lib/supabase-broadcasts';

// Which of my notifications' broadcasts carry an audio message:
// { [broadcast_id]: { media_duration_s, media_mime, … } }. One batch call
// per distinct set of ids; failures just mean no players are shown.
export function useBroadcastMedia(list) {
  const ids = [...new Set((list || []).map((n) => n?.broadcast_id).filter(Boolean))].sort();
  const key = ids.join(',');
  const [media, setMedia] = useState({});

  useEffect(() => {
    let alive = true;
    if (!key) { setMedia({}); return undefined; }
    getBroadcastMedia(key.split(','))
      .then((rows) => {
        if (!alive) return;
        const map = {};
        for (const r of rows || []) if (r?.broadcast_id) map[r.broadcast_id] = r;
        setMedia(map);
      })
      .catch(() => { if (alive) setMedia({}); });
    return () => { alive = false; };
  }, [key]);

  return media;
}
