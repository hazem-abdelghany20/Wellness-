import React from 'react';
import {
  typeStyles, Icon, Card, Chip, SectionLabel, Sparkline,
} from '../design-system.jsx';
import { useProgress } from '../hooks/use-progress.js';
import { useInsights } from '../hooks/use-insights.js';

// --- screens-progress-profile.jsx ---
// Progress / insights screen + Profile

const METRIC_DEFS = [
  { id: 'sleep',  labelKey: 'sleep',  icon: 'moon',     unit: 'h', positiveDir: 'up'   },
  { id: 'stress', labelKey: 'stress', icon: 'leaf',     unit: '',  positiveDir: 'down' },
  { id: 'energy', labelKey: 'energy', icon: 'bolt',     unit: '',  positiveDir: 'up'   },
  { id: 'mood',   labelKey: 'mood',   icon: 'smile',    unit: '',  positiveDir: 'up'   },
];

function fmtCurrent(metricId, val) {
  if (val == null || Number.isNaN(val)) return '—';
  if (metricId === 'sleep') return `${Number(val).toFixed(1)}h`;
  return Number(val).toFixed(1);
}

function fmtDelta(metricId, delta) {
  if (delta == null || Number.isNaN(delta)) return '—';
  const sign = delta > 0 ? '+' : '';
  if (metricId === 'sleep') return `${sign}${delta.toFixed(1)}h`;
  return `${sign}${delta.toFixed(1)}`;
}

function ScreenProgress({ theme, t, dir, go }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const [metric, setMetric] = React.useState('sleep');
  const { stats, loading } = useProgress();
  const { insights } = useInsights();

  if (loading || !stats) return <ProgressLoading theme={T} dir={dir}/>;

  const history = Array.isArray(stats.history) ? stats.history : [];
  const values = history.map(h => Number(h?.[metric] ?? 0));
  const avgKey = `avg_${metric}`;
  const current = stats[avgKey];

  // Delta = latest history reading vs the first reading in the window.
  let delta = null;
  if (history.length >= 2) {
    const first = Number(history[0]?.[metric] ?? 0);
    const last  = Number(history[history.length - 1]?.[metric] ?? 0);
    delta = last - first;
  }

  const metrics = METRIC_DEFS.map(def => ({
    ...def,
    label: t(def.labelKey),
  }));
  const m = metrics.find(x => x.id === metric) || metrics[0];

  // For "stress" lower is better, so invert the delta direction.
  const goingUp = delta != null && delta > 0;
  const isPositive =
    delta == null ? true :
    m.positiveDir === 'up' ? delta >= 0 :
    delta <= 0;
  const deltaColor = isPositive ? T.positive : T.danger || T.warning || T.textMuted;

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
                {fmtCurrent(metric, current)}
              </div>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: deltaColor + '22', color: deltaColor, padding: '6px 10px', borderRadius: 999,
              fontSize: 12, fontWeight: 600,
            }}>
              <Icon name={goingUp ? 'chevUp' : 'chevDown'} size={12}/>
              {fmtDelta(metric, delta)}
            </div>
          </div>
          <Sparkline theme={T} values={values.length ? values : [0,0]} height={120} stroke={T.accent}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: T.textFaint, letterSpacing: 0.5 }}>
            <span>30d</span><span>21d</span><span>14d</span><span>7d</span><span>{lang==='ar'?'اليوم':'today'}</span>
          </div>
        </Card>
      </div>

      {/* Streak summary */}
      <div style={{ padding: '18px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <StatTile theme={T} icon="flame" label={lang==='ar'?'سلسلة حالية':'Current streak'} value={`${stats.streak_current ?? 0}`} unit={lang==='ar'?'يوماً':'days'} />
        <StatTile theme={T} icon="trophy" label={lang==='ar'?'أفضل سلسلة':'Best streak'} value={`${stats.streak_best ?? 0}`} unit={lang==='ar'?'يوماً':'days'} />
      </div>

      {/* Insights */}
      <div style={{ padding: '22px 16px 0' }}>
        <SectionLabel theme={T} style={{ padding: '0 4px' }}>{t('insights')}</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(insights && insights.length > 0) ? (
            insights.map((ins, i) => (
              <InsightCard
                key={ins.id ?? i}
                theme={T}
                icon={ins.icon || 'sparkle'}
                tone={ins.tone || 'info'}
                title={pickLang(ins, 'title', lang)}
                body={pickLang(ins, 'body', lang)}
              />
            ))
          ) : (
            <Card theme={T} pad={16}>
              <div style={{ fontSize: 13, color: T.textMuted, textAlign: 'center' }}>
                {lang==='ar' ? 'لا توجد ملاحظات بعد. تابع التسجيل اليومي.' : 'No insights yet. Keep checking in.'}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function pickLang(obj, base, lang) {
  if (!obj) return '';
  // Accept either { title_en/title_ar } or { title: { en, ar } } or { title: '...' }.
  const localized = obj[`${base}_${lang}`];
  if (localized) return localized;
  const fallback = obj[`${base}_en`];
  if (fallback) return fallback;
  const v = obj[base];
  if (v && typeof v === 'object') return v[lang] || v.en || '';
  if (typeof v === 'string') return v;
  return '';
}

function StatTile({ theme, icon, label, value, unit }) {
  const T = theme;
  return (
    <Card theme={T} pad={16}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: T.accentSoft, color: T.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name={icon} size={15}/></div>
        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{label}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 28, color: T.text, letterSpacing: -0.5, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: T.textMuted }}>{unit}</div>
      </div>
    </Card>
  );
}

function ProgressLoading({ theme, dir }) {
  const T = theme;
  const text = dir === 'rtl' ? 'جارٍ التحميل…' : 'Loading…';
  return (
    <div style={{
      height: '100%', background: T.bg, paddingTop: 54, paddingBottom: 100,
      boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ color: T.textMuted, fontSize: 14, letterSpacing: 0.5 }}>{text}</div>
    </div>
  );
}

function InsightCard({ theme, icon, tone, title, body }) {
  const T = theme;
  const colorMap = { positive: T.positive, info: T.info, neutral: T.textMuted };
  const c = colorMap[tone] || T.info || T.accent;
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
