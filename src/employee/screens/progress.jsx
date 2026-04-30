import React from 'react';
import {
  typeStyles, Icon, Card, Chip, SectionLabel, Sparkline,
} from '../design-system.jsx';

// --- screens-progress-profile.jsx ---
// Progress / insights screen + Profile

function ScreenProgress({ theme, t, dir, go }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const [metric, setMetric] = React.useState('sleep');
  const metrics = [
    { id: 'sleep', label: t('sleep'), icon: 'moon', values: [6.2,6.8,6.1,7.2,6.9,7.4,7.1,7.0,6.8,7.3,7.5,7.2,7.4,7.6], current: '7.3h', delta: '+0.8h', dir: 'up' },
    { id: 'stress', label: t('stress'), icon: 'leaf', values: [6,7,6,5,6,4,5,4,5,4,3,4,3,3], current: '3.4', delta: '-2.1', dir: 'down' },
    { id: 'energy', label: t('energy'), icon: 'bolt', values: [4,5,4,5,6,6,7,6,7,7,8,7,8,7], current: '7.1', delta: '+2.3', dir: 'up' },
    { id: 'mood', label: t('mood'), icon: 'smile', values: [5,6,5,6,6,7,6,7,7,8,7,8,8,8], current: '7.8', delta: '+1.6', dir: 'up' },
  ];
  const m = metrics.find(x => x.id === metric);

  return (
    <div style={{ height: '100%', background: T.bg, overflow: 'auto', paddingTop: 54, paddingBottom: 100, boxSizing: 'border-box' }}>
      <div style={{ padding: '16px 22px 10px' }}>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 30, letterSpacing: -0.5, color: T.text }}>{t('progressTitle')}</div>
        <div style={{ color: T.textMuted, fontSize: 13, marginTop: 2 }}>{t('last30')}</div>
      </div>

      {/* Metric chips */}
      <div style={{ padding: '6px 22px 14px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {metrics.map(mm => (
          <Chip key={mm.id} theme={T} active={metric === mm.id} onClick={() => setMetric(mm.id)} icon={mm.icon}>
            {mm.label}
          </Chip>
        ))}
      </div>

      {/* Big chart */}
      <div style={{ padding: '0 16px' }}>
        <Card theme={T} pad={20} radius={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 12, color: T.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>
                {m.label}
              </div>
              <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 46, color: T.text, lineHeight: 1, marginTop: 6, letterSpacing: -1 }}>
                {m.current}
              </div>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: T.positive + '22', color: T.positive, padding: '6px 10px', borderRadius: 999,
              fontSize: 12, fontWeight: 600,
            }}>
              <Icon name={m.dir === 'up' ? 'chevUp' : 'chevDown'} size={12}/>
              {m.delta}
            </div>
          </div>
          <Sparkline theme={T} values={m.values} height={120} stroke={T.accent}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: T.textFaint, letterSpacing: 0.5 }}>
            <span>30d</span><span>21d</span><span>14d</span><span>7d</span><span>{lang==='ar'?'اليوم':'today'}</span>
          </div>
        </Card>
      </div>

      {/* Insights */}
      <div style={{ padding: '22px 16px 0' }}>
        <SectionLabel theme={T} style={{ padding: '0 4px' }}>{t('insights')}</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <InsightCard theme={T} icon="moon" tone="positive"
            title={lang==='ar' ? 'النوم تحسَّن ٠٫٨ ساعة' : 'Sleep improved 0.8h'}
            body={lang==='ar' ? 'الاتجاه بدأ بعد إضافة تنفس المساء قبل أسبوعين.' : 'The trend started after you added evening breathing 2 weeks ago.'} />
          <InsightCard theme={T} icon="leaf" tone="info"
            title={lang==='ar' ? 'التوتر أقل أيام الخميس' : 'Stress lowest on Thursdays'}
            body={lang==='ar' ? 'أعلى ارتفاع في التوتر يوم الأحد.' : 'Your highest stress spikes consistently land on Sundays.'} />
          <InsightCard theme={T} icon="activity" tone="neutral"
            title={lang==='ar' ? '١٤ تسجيلاً في ١٤ يوماً' : '14 check-ins in 14 days'}
            body={lang==='ar' ? 'العادة استقرت. جرّب أضف ملاحظة هذا الأسبوع.' : 'Your streak is stable. Try adding a note this week.'} />
        </div>
      </div>
    </div>
  );
}

function InsightCard({ theme, icon, tone, title, body }) {
  const T = theme;
  const colorMap = { positive: T.positive, info: T.info, neutral: T.textMuted };
  const c = colorMap[tone];
  return (
    <Card theme={T} pad={16}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: c + '22', color: c,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name={icon} size={18}/></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>{body}</div>
        </div>
      </div>
    </Card>
  );
}

export { ScreenProgress };
