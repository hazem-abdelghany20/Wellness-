// Splits library rows (listLibrary('content')) into the two sections the
// employee Library shows: "From your company" and "From Wellness House".
// Pinned items first in each, the server's order otherwise. Drafts, archived
// and hidden rows never reach employees (library_list filters them); they are
// dropped here too in case an HR / manager account opens the employee app.

const visible = (r) => r && r.hidden !== true
  && r.status !== 'draft' && r.status !== 'archived' && r.status !== 'review'
  && r.published !== false;

function pinnedFirst(rows) {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (Number(!!b.r.pinned) - Number(!!a.r.pinned)) || (a.i - b.i))
    .map((x) => x.r);
}

export function scopeOf(row) {
  if (row?.scope === 'company' || row?.scope === 'public') return row.scope;
  return row?.company_id ? 'company' : 'public';
}

export function splitLibrary(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter(visible);
  return {
    company: pinnedFirst(list.filter((r) => scopeOf(r) === 'company')),
    public: pinnedFirst(list.filter((r) => scopeOf(r) === 'public')),
  };
}

export const isFact = (row) => row?.kind === 'fact';
