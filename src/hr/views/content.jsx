import React, { useState } from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, Badge } from '../../shared/components.jsx';
import { HRPageHeader } from './_header.jsx';
import { useContent } from '../hooks/use-content.js';
import { Tabs, Flash, EmptyState, ConfirmButton } from '../../shared/authoring/ui.jsx';
import { ContentEditor } from './content-editor.jsx';
import { categoryLabel } from '../../shared/authoring/content-form.js';
import { libraryError } from '../../shared/authoring/errors.js';
import { fmtNum, pickLang } from '../../shared/authoring/text.js';
import { saveContentItem, setLibraryStatus, setLibraryPref } from '../../lib/supabase-routines';

// ── CONTENT PAGE ─────────────────────────────────────────────────
// Two libraries: "Your company" (HR's own articles and facts: write, edit,
// publish / unpublish, archive) and "Wellness House" (shared with every
// company: hide or pin for this company only, never edited).
function HRContentPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const { items, loading, error, update, refetch } = useContent();
  const [tab, setTab] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [flash, setFlash] = useState(null);
  const [editing, setEditing] = useState(null); // { item, key }

  if (loading && !(items || []).length) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
        {s('Loading…', 'جارٍ التحميل…')}
      </div>
    );
  }

  const iconFor = { audio: 'headphones', video: 'play', article: 'book', fact: 'sparkle', breath: 'leaf' };
  const all = items || [];
  // Rows from before sprint 2 have no scope: treat company_id as the rule.
  const isOwn = (c) => (c.scope ? c.scope === 'company' : !!c.company_id);
  const own = all.filter(isOwn).filter((c) => c.status !== 'archived');
  const pub = all.filter((c) => !isOwn(c));
  const current = tab || (own.length ? 'company' : 'public');
  const visible = current === 'company' ? own : pub;

  const run = async (id, fn, okText) => {
    setBusyId(id); setFlash(null);
    try { await fn(); if (okText) setFlash({ id, kind: 'ok', text: okText }); await refetch(); }
    catch (e) { setFlash({ id, kind: 'err', text: libraryError(e, lang) }); }
    finally { setBusyId(null); }
  };

  // Wellness House items: hide / show and pin for this company (no shared row is written).
  const togglePublicHidden = (c) => {
    const hidden = !!c.hidden || c.status === 'hidden';
    return run(c.id, () => update(c.id, { status: hidden ? 'published' : 'draft' }),
      hidden ? s('Shown again for your company.', 'رجع يظهر لشركتك.') : s('Hidden for your company only.', 'اتخفى من شركتك بس.'));
  };
  const togglePin = (c) => run(c.id, () => (isOwn(c) ? setLibraryPref('content', c.id, { pinned: !c.pinned }) : update(c.id, { pinned: !c.pinned })),
    c.pinned ? s('Unpinned.', 'اتشال التثبيت.') : s('Pinned: it shows first in the Library.', 'اتثبّت: هيظهر الأول في المكتبة.'));

  async function handleSave(input) {
    await saveContentItem(input);
    setEditing(null);
    setTab('company');
    setFlash({ kind: 'ok', text: input.status === 'published'
      ? s('Published. Your employees see it in their Library now.', 'اتنشر. الموظفين هيشوفوه في المكتبة دلوقتي.')
      : s('Saved as a draft. Only HR sees it.', 'اتحفظ كمسودة. الـ HR بس اللي بيشوفه.') });
    await refetch();
  }

  const open = (item) => { setFlash(null); setEditing({ item, key: `${item?.id || 'new'}-${Date.now()}` }); };

  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Content library', 'مكتبة المحتوى')}
        title={s('Content', 'المحتوى')}
        sub={s(`${own.length} of your own · ${pub.length} from Wellness House`, `${fmtNum(own.length, 'ar')} من عندك · ${fmtNum(pub.length, 'ar')} من Wellness House`)}
        right={!editing ? <HRButton theme={T} variant="primary" icon="plus" onClick={() => open(null)}>{s('Write', 'اكتب')}</HRButton> : null}/>

      {error && <Flash theme={T} flash={{ kind: 'err', text: libraryError(error, lang) }}/>}
      {flash && !flash.id && <Flash theme={T} flash={flash}/>}

      {editing && (
        <ContentEditor key={editing.key} theme={T} lang={lang} density={density} item={editing.item}
          onSave={handleSave} onCancel={() => setEditing(null)}/>
      )}

      <Tabs theme={T} value={current} onChange={setTab} label={s('Library', 'المكتبة')} style={{ marginBottom: DENSITY[density].gap }} tabs={[
        { id: 'company', label: `${s('Your company', 'شركتك')} · ${fmtNum(own.length, lang)}` },
        { id: 'public', label: `${s('Wellness House', 'Wellness House')} · ${fmtNum(pub.length, lang)}` },
      ]}/>
      {current === 'public' && (
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: -8, marginBottom: 14 }}>
          {s('Shared with every company. Hiding or pinning changes it for your company only.', 'متاحة لكل الشركات. الإخفاء أو التثبيت بيأثر على شركتك بس.')}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState theme={T} density={density}
          text={current === 'company'
            ? s('Nothing of your own yet. Write a short article or a one-line fact for your team.', 'لسه مفيش حاجة من عندك. اكتب مقال قصير أو معلومة في سطر لفريقك.')
            : s('No content items in this view.', 'لا يوجد محتوى في هذا العرض.')}
          action={current === 'company' && !editing ? <HRButton theme={T} variant="primary" size="sm" icon="plus" onClick={() => open(null)}>{s('Write', 'اكتب')}</HRButton> : null}/>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: DENSITY[density].gap }}>
          {visible.map((c) => {
            const mine = isOwn(c);
            const kind = c.kind || 'article';
            const published = mine ? (c.status || 'published') === 'published' : !(c.hidden || c.status === 'hidden');
            const title = pickLang(lang, c.title_en, c.title_ar) || '—';
            const factText = kind === 'fact' ? pickLang(lang, c.body_en, c.body_ar) : '';
            const msg = flash?.id === c.id ? flash : null;
            return (
              <Panel key={c.id} theme={T} density={density} style={{ display: 'flex', flexDirection: 'column', opacity: !mine && !published ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 8 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: T.panelSunk, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <HRIcon name={iconFor[kind] || 'book'} size={20} stroke={T.accent}/>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {kind === 'fact' && <Badge theme={T} tone="info">{s('Fact', 'معلومة')}</Badge>}
                    {c.pinned && <Badge theme={T} tone="info" dot>{s('Pinned', 'مثبَّت')}</Badge>}
                    {mine
                      ? <Badge theme={T} tone={published ? 'positive' : 'neutral'} dot>{published ? s('Published', 'منشور') : s('Draft', 'مسودة')}</Badge>
                      : <Badge theme={T} tone={published ? 'positive' : 'neutral'} dot>{published ? s('Shown', 'ظاهر') : s('Hidden', 'مخفي')}</Badge>}
                  </div>
                </div>
                <div style={{ fontSize: 14, color: T.text, fontWeight: 700, lineHeight: 1.35, marginBottom: 6 }}>{title}</div>
                {factText
                  ? <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.5, flex: 1 }}>{factText}</div>
                  : <div style={{ fontSize: 11, color: T.textMuted, flex: 1 }}>{categoryLabel(c.category, lang)} · {fmtNum(c.duration_mins ?? 0, lang)} {s('min', 'د')}</div>}
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {mine ? (
                    <>
                      <HRButton theme={T} variant="secondary" size="sm" onClick={() => open(c)}>{s('Edit', 'تعديل')}</HRButton>
                      <HRButton theme={T} variant="ghost" size="sm" disabled={busyId === c.id}
                        onClick={() => run(c.id, () => setLibraryStatus('content', c.id, published ? 'draft' : 'published'),
                          published ? s('Unpublished. Employees no longer see it.', 'اتشال من النشر. الموظفين مش هيشوفوه.') : s('Published.', 'اتنشر.'))}>
                        {published ? s('Unpublish', 'إلغاء النشر') : s('Publish', 'نشر')}
                      </HRButton>
                      <HRButton theme={T} variant="ghost" size="sm" disabled={busyId === c.id} onClick={() => togglePin(c)}>
                        {c.pinned ? s('Unpin', 'شيل التثبيت') : s('Pin', 'ثبّت')}
                      </HRButton>
                      <ConfirmButton theme={T} lang={lang} label={s('Archive', 'أرشفة')} busy={busyId === c.id}
                        question={s('Archive it?', 'تأرشفه؟')} yes={s('Yes, archive', 'أيوه، أرشف')}
                        onConfirm={() => run(c.id, () => setLibraryStatus('content', c.id, 'archived'), s('Archived.', 'اتأرشف.'))}/>
                    </>
                  ) : (
                    <>
                      <HRButton theme={T} variant="ghost" size="sm" disabled={busyId === c.id} onClick={() => togglePin(c)}>
                        {c.pinned ? s('Unpin', 'شيل التثبيت') : s('Pin', 'ثبّت')}
                      </HRButton>
                      <HRButton theme={T} variant="ghost" size="sm" disabled={busyId === c.id} onClick={() => togglePublicHidden(c)}>
                        {published ? s('Hide', 'اخفيه') : s('Show', 'أظهره')}
                      </HRButton>
                    </>
                  )}
                  {msg && <span style={{ fontSize: 11, color: msg.kind === 'ok' ? T.positive : T.danger, flexBasis: '100%' }}>{msg.text}</span>}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}

export { HRContentPage };
