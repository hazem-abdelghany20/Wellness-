// The reader (ScreenPlayer) expects { id, kind, mins, title: {en, ar},
// body: {en, ar} }. Library cards build that shape; anything else that
// opens content (home recommendation, daily plan, challenge article) must
// pass through here or the reader shows "This article is being prepared".
export function toPlayerItem(row) {
  if (!row) return null;
  if (row.title && typeof row.title === 'object') return row;
  return {
    id: row.id,
    kind: row.kind || 'article',
    mins: row.duration_mins ?? row.mins ?? 0,
    title: { en: row.title_en || '', ar: row.title_ar || row.title_en || '' },
    body: (row.body_en || row.body_ar)
      ? { en: row.body_en || '', ar: row.body_ar || row.body_en || '' }
      : null,
  };
}
