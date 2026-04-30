import React from 'react';
import { DENSITY } from '../tokens.jsx';
import { HRIcon, HRButton, Panel, Badge } from '../components.jsx';
import { HRPageHeader } from './_header.jsx';

// ── CONTENT PAGE ─────────────────────────────────────────────────
function HRContentPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [tab, setTab] = React.useState('library');
  const library = [
    { kind:'audio',   title: s('Sleep onset — a cue for tonight','بداية النوم — إشارة لهذه الليلة'), mins: 6,  cat: s('Sleep','النوم'),    plays: 1240, pinned: true },
    { kind:'video',   title: s('Desk mobility flow','حركات مكتبية'),                                 mins: 4,  cat: s('Movement','حركة'),  plays: 980,  pinned: true },
    { kind:'article', title: s('Build an evening wind-down','بناء روتين استرخاء مسائي'),             mins: 5,  cat: s('Sleep','النوم'),    plays: 612,  pinned: false },
    { kind:'audio',   title: s('Box breathing — 4×4','تنفس الصندوق — ٤×٤'),                          mins: 5,  cat: s('Stress','توتر'),    plays: 1830, pinned: true },
    { kind:'video',   title: s('Stretch break','استراحة تمدد'),                                       mins: 3,  cat: s('Movement','حركة'),  plays: 770,  pinned: false },
    { kind:'audio',   title: s('Body scan for tension release','مسح الجسم لإطلاق التوتر'),           mins: 12, cat: s('Stress','توتر'),    plays: 540,  pinned: false },
    { kind:'article', title: s('Caffeine, sleep, and you','الكافيين والنوم'),                        mins: 7,  cat: s('Sleep','النوم'),    plays: 322,  pinned: false },
    { kind:'video',   title: s('Mood lift: 4-min walk','رفع المزاج: مشي ٤ دقائق'),                   mins: 4,  cat: s('Movement','حركة'),  plays: 612,  pinned: false },
    { kind:'audio',   title: s('Gratitude pause','وقفة الامتنان'),                                    mins: 3,  cat: s('Mood','مزاج'),     plays: 884,  pinned: false },
  ];
  const iconFor = { audio: 'headphones', video: 'play', article: 'book' };
  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Content library','مكتبة المحتوى')}
        title={s('Content','المحتوى')}
        sub={s('Pin items to your org · 124 items in library · 3 languages','تثبيت العناصر · ١٢٤ عنصر · ٣ لغات')}
        right={<><HRButton theme={T} variant="secondary" icon="content">{s('Request item','طلب محتوى')}</HRButton><HRButton theme={T} variant="primary" icon="plus">{s('Pin to org','تثبيت')}</HRButton></>}/>

      <div style={{ display: 'flex', gap: 4, marginBottom: DENSITY[density].gap, background: T.panelSunk, padding: 4, borderRadius: 10, border: `1px solid ${T.border}`, width: 'fit-content' }}>
        {[['library',s('All library','كل المكتبة')],['pinned',s('Pinned','مثبَّت')],['perf',s('Performance','الأداء')]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{
            padding: '8px 16px', borderRadius: 7, border: 'none',
            background: tab===k ? T.panel : 'transparent',
            color: tab===k ? T.text : T.textMuted,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: DENSITY[density].gap }}>
        {library.filter(c => tab !== 'pinned' || c.pinned).map((c, i) => (
          <Panel key={i} theme={T} density={density}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: T.panelSunk, display: 'grid', placeItems: 'center' }}>
                <HRIcon name={iconFor[c.kind]} size={22} stroke={T.accent}/>
              </div>
              {c.pinned && <Badge theme={T} tone="info" dot>{s('Pinned','مثبَّت')}</Badge>}
            </div>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 700, lineHeight: 1.35, marginBottom: 6 }}>{c.title}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>{c.cat} · {c.mins} {s('min','د')}</div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>{s('Plays · 30d','تشغيل · ٣٠ يوم')}</div>
                <div className="mono" style={{ fontSize: 14, color: T.text, fontWeight: 700 }}>{c.plays.toLocaleString()}</div>
              </div>
              <HRButton theme={T} variant="ghost" size="sm" icon="more"/>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}

export { HRContentPage };
