import React from 'react';
import {
  HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, Bullet,
} from '../components.jsx';

function TeamDrawer({ theme, team, onClose, S, lang, chartStyle }) {
  const T = theme;
  if (!team) return null;
  // fabricate a 30-day mini-trend for the team
  const trend = [6.4, 6.2, 6.0, 5.9, 5.8, 5.7, 5.6, 5.7, 5.6, 5.5, 5.4, 5.3, 5.2, 5.2, 5.1, 5.0, 5.0, 4.9, 4.8, 4.9, 4.8, 4.7, 4.6, 4.6, 4.7, 4.6, 4.5, 4.5, 4.6, 4.6];
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.36)', zIndex: 50,
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxWidth: '92vw', height: '100vh', background: T.panel,
        borderInlineStart: `1px solid ${T.border}`,
        display: 'flex', flexDirection: 'column',
        animation: 'drawerIn .25s ease both',
      }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{team.dept || 'Team'}</div>
            <div style={{ fontSize: 18, color: T.text, fontWeight: 700, letterSpacing: -0.2, marginTop: 2 }}>{team.team}</div>
          </div>
          <HRButton theme={T} variant="secondary" size="sm">{S.message}</HRButton>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: T.textMid, cursor: 'pointer' }}>
            <HRIcon name="close" size={18}/>
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
            <Panel theme={T} density="compact">
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{S.index}</div>
              <div className="display" style={{ fontSize: 32, color: T.text, letterSpacing: -0.8, marginTop: 4 }}>{team.index}</div>
              <Delta theme={T} value={team.trend}/>
            </Panel>
            <Panel theme={T} density="compact">
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{S.size}</div>
              <div className="display" style={{ fontSize: 32, color: T.text, letterSpacing: -0.8, marginTop: 4 }}>{team.size || '—'}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{team.head}</div>
            </Panel>
            <Panel theme={T} density="compact">
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{S.risk}</div>
              <div style={{ marginTop: 8 }}>
                <Badge theme={T} tone={team.risk === 'high' ? 'danger' : team.risk === 'med' ? 'caution' : 'positive'} dot>
                  {team.risk === 'high' ? S.high : team.risk === 'med' ? S.med : S.low}
                </Badge>
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 10 }}>
                {(team.reason && team.reason[lang]) || (lang==='ar'?'تتبع الاتجاه':'Watchlist')}
              </div>
            </Panel>
          </div>

          <Panel theme={T} density="comfortable" pad={false} style={{ marginBottom: 18 }}>
            <PanelHeader theme={T} density="comfortable" title={lang==='ar'?'مؤشر الرفاهية · 30 يوماً':'Wellbeing index · 30 days'}/>
            <div style={{ padding: 16 }}>
              <Spark theme={T} values={trend} width={500} height={90} chartStyle={chartStyle === 'bar' ? 'bar' : 'area'} color={T.danger} showDots={false}/>
            </div>
          </Panel>

          {team.sleep !== undefined && (
            <Panel theme={T} density="comfortable" style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 12 }}>
                {lang==='ar'?'تفصيل المقاييس':'Metric breakdown'}
              </div>
              {[['sleep', S.sleep, team.sleep], ['stress', S.stress, team.stress], ['energy', S.energy, team.energy], ['mood', S.mood, team.mood]].map(([k, l, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0' }}>
                  <div style={{ width: 78, fontSize: 12, color: T.textMid, fontWeight: 600 }}>{l}</div>
                  <div style={{ flex: 1 }}>
                    <Bullet theme={T} value={v} max={10}
                      color={v >= 6.5 ? T.positive : v >= 5 ? T.caution : T.danger}/>
                  </div>
                  <div className="mono" style={{ width: 40, textAlign: 'end', fontSize: 13, color: T.text, fontWeight: 600 }}>{v.toFixed(1)}</div>
                </div>
              ))}
            </Panel>
          )}

          <Panel theme={T}>
            <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 10 }}>
              {S.actions}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <HRButton theme={T} variant="soft" icon="broadcasts">{S.nudge}</HRButton>
              <HRButton theme={T} variant="secondary" icon="content">{lang==='ar'?'اقتراح محتوى':'Recommend content'}</HRButton>
              <HRButton theme={T} variant="secondary" icon="challenges">{lang==='ar'?'إطلاق تحدٍّ':'Launch challenge'}</HRButton>
              <HRButton theme={T} variant="secondary" icon="reports">{lang==='ar'?'تصدير':'Export'}</HRButton>
            </div>
          </Panel>
        </div>
      </div>
      <style>{`@keyframes drawerIn { from { transform: translateX(100%); } to { transform: none; } }`}</style>
    </div>
  );
}

export { TeamDrawer };
