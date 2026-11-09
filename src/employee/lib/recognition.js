// What the recognition board may show, from getRecognitionBoard().
//
// Rules (sprint 2 §5): effort only, never health; no bottom list; names
// only in 'named' mode and only of people who opted in (the server already
// filters to them). In 'teams' mode no person's name is ever shown, even if
// a `named` block came back.

export function boardView(board) {
  if (!board || !board.enabled || board.mode === 'off') return null;
  const mode = board.mode === 'named' ? 'named' : 'teams';
  const teams = Array.isArray(board.teams) ? board.teams.filter((t) => t && t.name) : [];
  const me = board.me || { opted_in: false, items_done: 0, streak: 0 };

  let named = null;
  if (mode === 'named' && board.named) {
    const n = board.named;
    const names = Array.isArray(n.did_everything?.names) ? n.did_everything.names : [];
    const more = Math.max(0, Number(n.did_everything?.more) || 0);
    named = {
      optedIn: Number(n.opted_in) || 0,
      top: (Array.isArray(n.top) ? n.top : []).filter((p) => p && p.display_name && (Number(p.items_done) || 0) > 0),
      didEverything: { names: names.filter((p) => p && p.display_name), more },
      didEverythingCount: names.length + more,
      longestStreak: (Array.isArray(n.longest_streak) ? n.longest_streak : [])
        .filter((p) => p && p.display_name && (Number(p.streak) || 0) > 0),
    };
  }

  const empty = teams.length === 0 && (!named
    || (named.top.length === 0 && named.didEverythingCount === 0 && named.longestStreak.length === 0));

  return {
    mode,
    period: board.period === 'week' ? 'week' : 'today',
    teams,
    topTeam: teams[0] || null,
    named,
    me: { optedIn: !!me.opted_in, itemsDone: Number(me.items_done) || 0, streak: Number(me.streak) || 0 },
    // Show the invitation only where a name could actually appear.
    inviteOptIn: mode === 'named' && !me.opted_in,
    empty,
  };
}

// The one line on the Today tab, or null when there is nothing to say.
//   { team: 'Finance' | null, didEverything: 3 | 0 }
export function topTodayLine(view) {
  if (!view) return null;
  const team = view.topTeam ? view.topTeam.name : null;
  const didEverything = view.named ? view.named.didEverythingCount : 0;
  if (!team && !didEverything) return null;
  return { team, didEverything };
}
