import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader, Badge } from '../../shared/components.jsx';
import { useChallengeTemplates } from '../hooks/use-challenge-templates.js';

function NewTemplateForm({ theme, lang, onCreate, busy }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [slug, setSlug] = React.useState('');
  const [titleEn, setTitleEn] = React.useState('');
  const [titleAr, setTitleAr] = React.useState('');
  const [kind, setKind] = React.useState('movement');
  const [windowDays, setWindowDays] = React.useState('14');
  const [target, setTarget] = React.useState('');
  const [metric, setMetric] = React.useState('steps');
  const [err, setErr] = React.useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!slug.trim() || !titleEn.trim()) return;
    setErr(null);
    try {
      await onCreate({
        slug: slug.trim(),
        title_en: titleEn.trim(),
        title_ar: titleAr.trim() || undefined,
        kind,
        default_window_days: parseInt(windowDays, 10) || 14,
        target: target ? parseInt(target, 10) : undefined,
        metric,
      });
      setSlug(''); setTitleEn(''); setTitleAr(''); setTarget('');
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  const inputStyle = {
    height: 32, padding: '0 10px', borderRadius: 8,
    background: T.panelSunk, border: `1px solid ${T.border}`,
    color: T.text, fontSize: 12, outline: 'none',
  };

  return (
    <form onSubmit={submit} style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: 8,
      padding: 12, borderTop: `1px solid ${T.divider}`,
    }}>
      <input value={slug} onChange={(e) => setSlug(e.target.value)}
        placeholder={s('slug (e.g. 10k-steps)','معرّف')} style={inputStyle}/>
      <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)}
        placeholder={s('Title (EN)','العنوان (EN)')} style={inputStyle}/>
      <input value={titleAr} onChange={(e) => setTitleAr(e.target.value)}
        placeholder={s('Title (AR, optional)','العنوان (AR)')} style={inputStyle}/>
      <select value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle}>
        <option value="movement">movement</option>
        <option value="sleep">sleep</option>
        <option value="mood">mood</option>
        <option value="hydration">hydration</option>
      </select>
      <input value={windowDays} onChange={(e) => setWindowDays(e.target.value)} type="number"
        placeholder={s('Window days','الأيام')} style={inputStyle}/>
      <input value={target} onChange={(e) => setTarget(e.target.value)} type="number"
        placeholder={s('Target','الهدف')} style={inputStyle}/>
      <input value={metric} onChange={(e) => setMetric(e.target.value)}
        placeholder={s('Metric','المقياس')} style={inputStyle}/>
      <div/>
      <HRButton theme={T} type="submit" disabled={busy || !slug.trim() || !titleEn.trim()} icon="plus">
        {busy ? s('Creating…','جارٍ الإنشاء…') : s('Create template','أنشئ قالبًا')}
      </HRButton>
      {err && <span style={{ gridColumn: '1 / -1', fontSize: 12, color: T.danger }}>{err}</span>}
    </form>
  );
}

function AdminChallengeTemplatesView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { templates, loading, create } = useChallengeTemplates();
  const [busy, setBusy] = React.useState(false);

  async function handleCreate(payload) {
    setBusy(true);
    try { await create(payload); } finally { setBusy(false); }
  }

  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Challenge templates','قوالب التحديات')}
        title={s('Library','المكتبة')}
        sub={loading
          ? s('Loading…','جارٍ التحميل…')
          : `${templates.length} ${s('templates','قالب')}`}
        right={<HRButton theme={T} icon="plus">{s('New template','قالب جديد')}</HRButton>}/>

      {loading ? (
        <Panel theme={T} density={density}>
          <div style={{ padding: 48, display: 'grid', placeItems: 'center', color: T.textMuted, fontSize: 13 }}>
            {s('Loading…','جارٍ التحميل…')}
          </div>
        </Panel>
      ) : (
        <>
          {templates.length === 0 ? (
            <Panel theme={T} density={density}>
              <div style={{ padding: 32, color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
                {s('No templates yet — create the first one below.','لا توجد قوالب بعد — أنشئ أولها أدناه.')}
              </div>
            </Panel>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: DENSITY[density].gap }}>
              {templates.map((t) => (
                <Panel key={t.id || t.slug} theme={T} density={density}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div className="mono" style={{ fontSize: 11, color: T.textMuted }}>{t.slug}</div>
                    <Badge theme={T} tone="neutral">{t.kind || '—'}</Badge>
                  </div>
                  <div style={{ fontSize: 14, color: T.text, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }}>
                    {lang === 'ar' && t.title_ar ? t.title_ar : (t.title_en || t.slug)}
                  </div>
                  {t.title_ar && lang !== 'ar' && (
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{t.title_ar}</div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.divider}` }}>
                    <div>
                      <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>{s('Window','المدة')}</div>
                      <div className="mono" style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{t.default_window_days ?? '—'} {s('days','يوم')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700, textAlign: 'end' }}>{s('Target','الهدف')}</div>
                      <div className="mono" style={{ fontSize: 13, color: T.accent, fontWeight: 600, textAlign: 'end' }}>
                        {t.target ?? '—'} {t.metric || ''}
                      </div>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          )}

          <Panel theme={T} density={density} pad={false}>
            <PanelHeader theme={T} density={density}
              title={s('New template','قالب جديد')}
              subtitle={s('Define a slug, EN/AR titles, kind, and target.','حدِّد المعرّف والعناوين والنوع والهدف.')}/>
            <NewTemplateForm theme={T} lang={lang} onCreate={handleCreate} busy={busy}/>
          </Panel>
        </>
      )}
    </>
  );
}

export { AdminChallengeTemplatesView };
