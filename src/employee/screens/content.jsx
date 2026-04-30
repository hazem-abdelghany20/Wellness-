import React from 'react';
import {
  typeStyles, Icon, Card, Chip, SectionLabel,
} from '../design-system.jsx';
import { TopBack } from './onboarding.jsx';
import { IconBtn } from './home.jsx';

// --- screens-content.jsx ---
// Content library + audio/video/article player + Notifications

function ScreenLibrary({ theme, t, dir, go }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const [cat, setCat] = React.useState('all');
  const cats = [
    { id: 'all', label: { en: 'All', ar: 'الكل' }, icon: 'sparkle' },
    { id: 'sleep', label: { en: 'Sleep', ar: 'النوم' }, icon: 'moon' },
    { id: 'stress', label: { en: 'Stress', ar: 'التوتر' }, icon: 'leaf' },
    { id: 'move', label: { en: 'Move', ar: 'حركة' }, icon: 'activity' },
    { id: 'focus', label: { en: 'Focus', ar: 'تركيز' }, icon: 'target' },
  ];
  const items = [
    { id: 'sleep-onset', kind: 'audio', mins: 6, cat: 'sleep', title: { en: 'Sleep onset — a cue for tonight', ar: 'بداية النوم — إشارة لهذه الليلة' }, tag: { en: 'Recommended', ar: 'موصى به' } },
    { id: 'box-breath', kind: 'audio', mins: 2, cat: 'stress', title: { en: 'Box breathing, guided', ar: 'تنفس مربع، موجَّه' } },
    { id: 'desk-mob', kind: 'video', mins: 4, cat: 'move', title: { en: 'Desk mobility flow', ar: 'حركات مكتبية' } },
    { id: 'reset', kind: 'audio', mins: 3, cat: 'focus', title: { en: 'A 3-minute reset between meetings', ar: 'استراحة 3 دقائق بين الاجتماعات' } },
    { id: 'wind-down', kind: 'article', mins: 5, cat: 'sleep', title: { en: 'Build an evening wind-down', ar: 'بناء روتين استرخاء مسائي' } },
    { id: 'caffeine', kind: 'article', mins: 4, cat: 'sleep', title: { en: 'Caffeine cut-off, in plain terms', ar: 'الكافيين بلغة واضحة' } },
  ];
  const filtered = cat === 'all' ? items : items.filter(i => i.cat === cat);

  return (
    <div style={{ height: '100%', background: T.bg, overflow: 'auto', paddingTop: 54, paddingBottom: 100, boxSizing: 'border-box' }}>
      <div style={{ padding: '16px 22px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 30, letterSpacing: -0.5, color: T.text }}>
          {lang==='ar' ? 'المكتبة' : 'Library'}
        </div>
        <IconBtn theme={T} icon="search" onClick={()=>{}}/>
      </div>

      <div style={{ padding: '4px 22px 14px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {cats.map(c => (
          <Chip key={c.id} theme={T} active={cat === c.id} onClick={() => setCat(c.id)} icon={c.icon}>
            {c.label[lang]}
          </Chip>
        ))}
      </div>

      {/* Featured hero */}
      {cat === 'all' && (
        <div style={{ padding: '0 16px 18px' }}>
          <Card theme={T} pad={0} radius={24} style={{ overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => go('player', { id: 'sleep-onset' })}>
            <div style={{
              height: 180, position: 'relative',
              background: `linear-gradient(135deg, ${T.accent}, ${T.accentSoft})`,
            }}>
              <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
                <defs>
                  <pattern id="wave" width="24" height="24" patternUnits="userSpaceOnUse">
                    <path d="M0 12 Q6 6 12 12 T24 12" stroke={T.accentInk} strokeWidth="1" fill="none" opacity="0.25"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#wave)"/>
              </svg>
              <div style={{
                position: 'absolute', bottom: 16, right: 16,
                width: 56, height: 56, borderRadius: 999,
                background: T.accentInk, color: T.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><Icon name="play" size={22}/></div>
            </div>
            <div style={{ padding: '16px 18px 18px' }}>
              <div style={{ fontSize: 10, letterSpacing: 1, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
                {lang==='ar'?'صوت · 6 د · موصى به':'AUDIO · 6 MIN · FOR YOU'}
              </div>
              <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 22, color: T.text, marginTop: 6, letterSpacing: -0.3, lineHeight: 1.2 }}>
                {lang==='ar'?'بداية النوم — إشارة لهذه الليلة':'Sleep onset — a cue for tonight'}
              </div>
            </div>
          </Card>
        </div>
      )}

      <SectionLabel theme={T}>{lang==='ar'?'استكشف':'Explore'}</SectionLabel>
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {filtered.map(it => (
          <Card key={it.id} theme={T} pad={0} radius={18} onClick={() => go('player', { id: it.id })}
                style={{ overflow: 'hidden', cursor: 'pointer' }}>
            <div style={{
              height: 100, position: 'relative',
              background: it.kind === 'video'
                ? `linear-gradient(135deg, ${T.accent}44, ${T.surfaceAlt})`
                : it.kind === 'article'
                ? `linear-gradient(135deg, ${T.surfaceAlt}, ${T.surface})`
                : `linear-gradient(135deg, ${T.accentSoft}, ${T.surfaceAlt})`,
            }}>
              <div style={{
                position: 'absolute', top: 10, left: 10,
                padding: '3px 8px', borderRadius: 999,
                background: T.bg + 'cc', color: T.text,
                fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
              }}>{it.kind}</div>
              <div style={{
                position: 'absolute', bottom: 10, right: 10,
                width: 32, height: 32, borderRadius: 999,
                background: T.accent, color: T.accentInk,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={it.kind === 'article' ? 'book' : 'play'} size={14}/>
              </div>
            </div>
            <div style={{ padding: '10px 12px 14px' }}>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 500, lineHeight: 1.3, minHeight: 34 }}>
                {it.title[lang]}
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>{it.mins} {t('minutes')}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ScreenPlayer({ theme, t, dir, go, state }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const item = state.playerItem || { id: 'sleep-onset', kind: 'audio', mins: 6, title: { en: 'Sleep onset — a cue for tonight', ar: 'بداية النوم — إشارة لهذه الليلة' } };
  const [playing, setPlaying] = React.useState(true);
  const [pos, setPos] = React.useState(0);
  const dur = item.mins * 60;

  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setPos(p => {
        if (p + 1 >= dur) { setPlaying(false); return dur; }
        return p + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [playing, dur]);

  const fmt = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const isVideo = item.kind === 'video';
  const isArticle = item.kind === 'article';

  if (isArticle) {
    return (
      <div style={{ height: '100%', background: T.bg, overflow: 'auto', paddingTop: 54, paddingBottom: 40, boxSizing: 'border-box' }}>
        <div style={{ padding: '14px 22px 0' }}>
          <TopBack theme={T} onBack={() => go('library')} dir={dir}/>
        </div>
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
            {lang==='ar'?'مقال · ':'ARTICLE · '}{item.mins} {t('minutes')}
          </div>
          <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 34, color: T.text, marginTop: 10, letterSpacing: -0.5, lineHeight: 1.1 }}>
            {item.title[lang]}
          </div>
          <div style={{ marginTop: 24, color: T.text, fontSize: 16, lineHeight: 1.6, fontFamily: typeStyles(T).sansFont }}>
            {lang==='ar'
              ? 'روتين الاسترخاء المسائي ليس مجرد طقس. إنه إشارة لدماغك بأن اليوم انتهى. ابدأ بخطوات صغيرة: خفّت الأضواء قبل النوم بساعة، ضع الهاتف خارج الغرفة، ودوّن ثلاثة أشياء سارت بشكل جيد.'
              : "An evening wind-down isn't ritual for ritual's sake. It's a signal to your brain that the day is done. Start small: dim the lights an hour before bed, put the phone outside the bedroom, and jot down three things that went well."}
          </div>
          <div style={{ marginTop: 28, padding: '20px 22px', background: T.surface, borderRadius: 18, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, letterSpacing: 1, color: T.accent, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
              {lang==='ar'?'جربه الليلة':'Try tonight'}
            </div>
            <div style={{ fontSize: 16, color: T.text, lineHeight: 1.5 }}>
              {lang==='ar'?'خفّت الأضواء عند الساعة 9:30، وتنفس مربع لدقيقتين قبل النوم.':'Dim lights at 9:30pm and do 2 minutes of box breathing before bed.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', background: T.bg, paddingTop: 54, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <TopBack theme={T} onBack={() => go('library')} dir={dir}/>
        <IconBtn theme={T} icon="plus"/>
      </div>

      {/* Artwork */}
      <div style={{ padding: '20px 30px 10px' }}>
        <div style={{
          aspectRatio: '1/1', width: '100%', borderRadius: 28,
          background: isVideo
            ? `linear-gradient(135deg, ${T.surfaceAlt}, ${T.bg})`
            : `linear-gradient(135deg, ${T.accent}, ${T.accentSoft})`,
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isVideo ? (
            <>
              <svg width="80%" height="80%" viewBox="0 0 100 100" style={{ opacity: 0.4 }}>
                <path d="M20 60 Q30 40 50 50 T80 40" stroke={T.accent} strokeWidth="2" fill="none"/>
                <path d="M20 70 Q30 50 50 60 T80 50" stroke={T.accent} strokeWidth="2" fill="none" opacity="0.6"/>
              </svg>
              <div style={{
                position: 'absolute', width: 80, height: 80, borderRadius: 999,
                background: T.accent, color: T.accentInk,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><Icon name={playing ? 'pause' : 'play'} size={32}/></div>
            </>
          ) : (
            <svg width="70%" height="70%" viewBox="0 0 100 100" style={{ opacity: 0.7 }}>
              {[20,35,50,65,80].map((x,i) => {
                const h = 20 + Math.abs(Math.sin((pos + i*3)/4)) * 40;
                return <rect key={i} x={x-4} y={50-h/2} width="8" height={h} rx="4" fill={T.accentInk}/>;
              })}
            </svg>
          )}
        </div>
      </div>

      <div style={{ padding: '22px 30px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: 1.2, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
          {(isVideo ? (lang==='ar'?'فيديو':'VIDEO') : (lang==='ar'?'صوت':'AUDIO'))} · {item.mins} {t('minutes')}
        </div>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 26, color: T.text, marginTop: 8, letterSpacing: -0.4, lineHeight: 1.15 }}>
          {item.title[lang]}
        </div>
      </div>

      {/* Scrubber */}
      <div style={{ padding: '24px 30px 0' }}>
        <div style={{ height: 4, borderRadius: 4, background: T.track, position: 'relative' }}>
          <div style={{ width: `${(pos/dur)*100}%`, height: '100%', background: T.accent, borderRadius: 4 }}/>
          <div style={{
            position: 'absolute', left: `calc(${(pos/dur)*100}% - 6px)`, top: -4,
            width: 12, height: 12, borderRadius: 999, background: T.accent,
          }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: typeStyles(T).monoFont, fontSize: 11, color: T.textMuted }}>
          <span>{fmt(pos)}</span><span>-{fmt(dur - pos)}</span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: '18px 30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
        <button onClick={() => setPos(Math.max(0, pos - 15))} style={{
          background: 'transparent', border: 'none', color: T.text, cursor: 'pointer', padding: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>
          </svg>
          <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>15s</div>
        </button>
        <button onClick={() => setPlaying(!playing)} style={{
          width: 72, height: 72, borderRadius: 999, background: T.accent, color: T.accentInk,
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 10px 30px ${T.accent}55`,
        }}>
          <Icon name={playing ? 'pause' : 'play'} size={30}/>
        </button>
        <button onClick={() => setPos(Math.min(dur, pos + 30))} style={{
          background: 'transparent', border: 'none', color: T.text, cursor: 'pointer', padding: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>
          </svg>
          <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>30s</div>
        </button>
      </div>
    </div>
  );
}

export { ScreenLibrary, ScreenPlayer };
