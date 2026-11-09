import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader, Badge } from '../../shared/components.jsx';
import { inputStyle, Flash } from '../../shared/authoring/ui.jsx';
import { fmtNum, clean } from '../../shared/authoring/text.js';
import { createTeam, renameTeam, deleteTeam } from '../../lib/supabase-teams';
import { teamErrorText, LEAD_NOTE } from '../lib/teams.js';

const defaultApi = { createTeam, renameTeam, deleteTeam };

// People → Teams: create, rename (and department), delete. Leads are set
// from the People list ("Make team lead").
export function TeamsPanel({ theme, lang, density, teams = [], noTeam = 0, loadError, onChanged, api = defaultApi }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const n = (v) => fmtNum(v, lang);
  const [form, setForm] = React.useState({ name: '', department: '' });
  const [editing, setEditing] = React.useState(null);   // { id, name, department }
  const [deleting, setDeleting] = React.useState(null); // { id, move }
  const [busy, setBusy] = React.useState(null);
  const [flash, setFlash] = React.useState(null);
  const [rowError, setRowError] = React.useState({});   // team id → text

  async function run(key, fn) {
    setBusy(key); setFlash(null);
    try { return await fn(); } finally { setBusy(null); }
  }

  async function onCreate(e) {
    e?.preventDefault?.();
    const name = clean(form.name);
    if (!name) { setFlash({ kind: 'err', text: s('Type the team’s name.', 'اكتب اسم الفريق.') }); return; }
    await run('create', async () => {
      try {
        await api.createTeam(name, clean(form.department) || null);
        setForm({ name: '', department: '' });
        setFlash({ kind: 'ok', text: s(`Team “${name}” created. Move people into it from the People tab.`, `فريق «${name}» اتعمل. انقل الناس ليه من تبويب الأشخاص.`) });
        await onChanged?.();
      } catch (err) {
        setFlash({ kind: 'err', text: teamErrorText(err, lang, name) });
      }
    });
  }

  async function onRename(team) {
    const name = clean(editing?.name);
    if (!name) { setRowError((r) => ({ ...r, [team.id]: s('Type the team’s name.', 'اكتب اسم الفريق.') })); return; }
    await run(`rename-${team.id}`, async () => {
      try {
        await api.renameTeam(team.id, name === team.name ? null : name, clean(editing.department));
        setEditing(null);
        setRowError((r) => ({ ...r, [team.id]: null }));
        setFlash({ kind: 'ok', text: s('Team saved.', 'الفريق اتحفظ.') });
        await onChanged?.();
      } catch (err) {
        setRowError((r) => ({ ...r, [team.id]: teamErrorText(err, lang, name) }));
      }
    });
  }

  async function onDelete(team, move) {
    await run(`delete-${team.id}`, async () => {
      try {
        const out = await api.deleteTeam(team.id, { moveMembers: !!move });
        setDeleting(null);
        setRowError((r) => ({ ...r, [team.id]: null }));
        const moved = out?.moved || 0;
        setFlash({ kind: 'ok', text: moved
          ? s(`“${team.name}” deleted. ${moved} ${moved === 1 ? 'person is' : 'people are'} now in “No team”.`, `«${team.name}» اتحذف. ${n(moved)} بقوا في «من غير فريق».`)
          : s(`“${team.name}” deleted.`, `«${team.name}» اتحذف.`) });
        await onChanged?.();
      } catch (err) {
        if (/team_not_empty/.test(String(err?.message || ''))) {
          // Someone joined meanwhile: offer the move.
          setDeleting({ id: team.id, move: true, count: Number(err?.details) || null });
        } else {
          setDeleting(null);
        }
        setRowError((r) => ({ ...r, [team.id]: teamErrorText(err, lang, team.name) }));
      }
    });
  }

  const pad = DENSITY[density].cardPad;

  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={s('Teams', 'الفرق')}
        subtitle={s('Group people the way your company works. Routines, challenges and messages can go to one team.',
                    'قسّم الناس زي ما شركتك شغالة. الروتين والتحديات والرسايل ممكن تروح لفريق واحد.')}/>
      <div style={{ padding: pad }}>
        {loadError && <Flash theme={T} flash={{ kind: 'err', text: teamErrorText(loadError, lang) }}/>}
        <Flash theme={T} flash={flash}/>
        <form onSubmit={onCreate} aria-label={s('New team', 'فريق جديد')}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <input value={form.name} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={s('New team name, e.g. Finance', 'اسم الفريق الجديد، مثلاً المالية')} aria-label={s('Team name', 'اسم الفريق')}
            style={{ ...inputStyle(T), flex: '2 1 200px', width: 'auto' }}/>
          <input value={form.department} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
            placeholder={s('Department (optional)', 'القسم (اختياري)')} aria-label={s('Department', 'القسم')}
            style={{ ...inputStyle(T), flex: '1 1 160px', width: 'auto' }}/>
          <HRButton theme={T} type="submit" variant="primary" icon="plus" disabled={busy === 'create'}>
            {busy === 'create' ? s('Creating…', 'جارٍ الإنشاء…') : s('Create team', 'اعمل فريق')}
          </HRButton>
        </form>

        {teams.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: T.textMuted }}>
            {s('No teams yet. Create the first one above, or import people with a team column.', 'لسه مفيش فرق. اعمل أول واحد فوق، أو استورد الناس بعمود الفريق.')}
          </div>
        ) : (
          <div role="list" aria-label={s('Teams', 'الفرق')} style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {teams.map((t, i) => {
              const isEditing = editing?.id === t.id;
              const isDeleting = deleting?.id === t.id;
              const members = deleting?.id === t.id && deleting.count ? deleting.count : t.members || 0;
              const leads = (t.leads || []).map((l) => l.display_name).filter(Boolean);
              return (
                <div role="listitem" key={t.id} aria-label={t.name} style={{
                  padding: '12px 14px', borderTop: i ? `1px solid ${T.divider}` : 'none', background: isEditing || isDeleting ? T.panelSunk : 'transparent',
                }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input value={editing.name} maxLength={80} autoFocus aria-label={s('Team name', 'اسم الفريق')}
                        onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') onRename(t); if (e.key === 'Escape') setEditing(null); }}
                        style={{ ...inputStyle(T), flex: '2 1 180px', width: 'auto' }}/>
                      <input value={editing.department} maxLength={80} aria-label={s('Department', 'القسم')}
                        placeholder={s('Department (optional)', 'القسم (اختياري)')}
                        onChange={(e) => setEditing((x) => ({ ...x, department: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') onRename(t); if (e.key === 'Escape') setEditing(null); }}
                        style={{ ...inputStyle(T), flex: '1 1 140px', width: 'auto' }}/>
                      <HRButton theme={T} size="sm" variant="primary" disabled={busy === `rename-${t.id}`} onClick={() => onRename(t)}>{s('Save', 'احفظ')}</HRButton>
                      <HRButton theme={T} size="sm" variant="ghost" onClick={() => setEditing(null)}>{s('Cancel', 'إلغاء')}</HRButton>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                          {t.department ? `${t.department} · ` : ''}
                          {leads.length ? s(`Lead: ${leads.join(', ')}`, `القائد: ${leads.join('، ')}`) : s('No lead yet', 'لسه مفيش قائد')}
                        </div>
                      </div>
                      <Badge theme={T} tone="neutral">{s(`${t.members || 0} ${(t.members || 0) === 1 ? 'person' : 'people'}`, `${n(t.members || 0)} شخص`)}</Badge>
                      {!isDeleting && (
                        <>
                          <HRButton theme={T} size="sm" variant="secondary" onClick={() => { setDeleting(null); setEditing({ id: t.id, name: t.name, department: t.department || '' }); }}>
                            {s('Rename', 'غيّر الاسم')}
                          </HRButton>
                          <HRButton theme={T} size="sm" variant="ghost" onClick={() => { setEditing(null); setRowError((r) => ({ ...r, [t.id]: null })); setDeleting({ id: t.id, move: (t.members || 0) > 0 }); }}>
                            {s('Delete', 'احذف')}
                          </HRButton>
                        </>
                      )}
                    </div>
                  )}
                  {isDeleting && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                      <span style={{ fontSize: 12, color: T.textMid }}>
                        {deleting.move
                          ? s(`“${t.name}” has ${members} ${members === 1 ? 'person' : 'people'}. Move them to “No team” and delete the team?`,
                              `«${t.name}» فيه ${n(members)} شخص. ننقلهم لـ«من غير فريق» ونحذف الفريق؟`)
                          : s(`Delete “${t.name}”?`, `نحذف «${t.name}»؟`)}
                      </span>
                      <HRButton theme={T} size="sm" variant="danger" disabled={busy === `delete-${t.id}`} onClick={() => onDelete(t, deleting.move)}>
                        {deleting.move ? s('Move them and delete', 'انقلهم واحذف') : s('Delete', 'احذف')}
                      </HRButton>
                      <HRButton theme={T} size="sm" variant="ghost" onClick={() => setDeleting(null)}>{s('Keep it', 'سيبه')}</HRButton>
                    </div>
                  )}
                  {rowError[t.id] && <div role="alert" style={{ fontSize: 12, color: T.danger, marginTop: 8 }}>{rowError[t.id]}</div>}
                </div>
              );
            })}
            <div style={{ padding: '10px 14px', borderTop: `1px solid ${T.divider}`, fontSize: 12, color: T.textMuted, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{s('No team', 'من غير فريق')}</span>
              <span>{s(`${noTeam} ${noTeam === 1 ? 'person' : 'people'}`, `${n(noTeam)} شخص`)}</span>
            </div>
          </div>
        )}
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 12, lineHeight: 1.55 }}>
          {s('To make someone a team lead, open the People tab and press “Make team lead” on their row. ',
             'علشان تخلي حد قائد فريق، افتح تبويب الأشخاص ودوس «اجعله قائد الفريق» في السطر بتاعه. ')}
          {lang === 'ar' ? LEAD_NOTE.ar : LEAD_NOTE.en}
        </div>
      </div>
    </Panel>
  );
}
