import React, { useState, useEffect } from 'react';
import {
  HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, Bullet,
} from '../components.jsx';
import { useTeams } from '../hooks/use-teams.js';

function TeamDrawer({ theme, team, onClose, S, lang, chartStyle }) {
  const T = theme;
  const { drilldown } = useTeams();
  const [drill, setDrill] = useState(null);

  useEffect(() => {
    if (!team) { setDrill(null); return; }
    const teamId = team.team_id || team.id;
    if (!teamId) { setDrill(null); return; }
    let cancelled = false;
    drilldown(teamId, '30d').then(d => { if (!cancelled) setDrill(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [team, drilldown]);

  if (!team) return null;
  const teamName  = team._team || team.team_name || team.team || '—';
  const teamDept  = team._dept || team.department || team.dept || 'Team';
  const teamHead  = team._head || team.head_name || team.head || '';
  const teamSize  = team._size || team.member_count || team.group_size || team.size;
  const teamIndex = team._index ?? team.index;
  const teamTrend = team._trend ?? team.trend ?? 0;
  const teamRisk  = team._risk || team.risk;

  // Pull a 30-day mini-trend out of the drilldown rows when available.
  const drillRows = Array.isArray(drill?.rows) ? drill.rows : [];
  const trend = drillRows.length > 0
    ? drillRows.map(r => Number(r.avg_mood ?? r.mood ?? r.value ?? 0))
    : null;

  // Latest aggregate row for metric breakdown (sleep/stress/energy/mood) when drilldown supplies it.
  const latest = drillRows[drillRows.length - 1] || team;
  const sleep  = Number(latest.avg_sleep  ?? team.avg_sleep  ?? team.sleep  ?? NaN);
  const stress = Number(latest.avg_stress ?? team.avg_stress ?? team.stress ?? NaN);
  const energy = Number(latest.avg_energy ?? team.avg_energy ?? team.energy ?? NaN);
  const mood   = Number(latest.avg_mood   ?? team.avg_mood   ?? team.mood   ?? NaN);
  const hasMetrics = [sleep, stress, energy, mood].every(v => Number.isFinite(v));

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
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{teamDept}</div>
            <div style={{ fontSize: 18, color: T.text, fontWeight: 700, letterSpacing: -0.2, marginTop: 2 }}>{teamName}</div>
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
              <div className="display" style={{ fontSize: 32, color: T.text, letterSpacing: -0.8, marginTop: 4 }}>{teamIndex ?? '—'}</div>
              <Delta theme={T} value={teamTrend}/>
            </Panel>
            <Panel theme={T} density="compact">
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{S.size}</div>
              <div className="display" style={{ fontSize: 32, color: T.text, letterSpacing: -0.8, marginTop: 4 }}>{teamSize || '—'}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{teamHead || ''}</div>
            </Panel>
            <Panel theme={T} density="compact">
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{S.risk}</div>
              <div style={{ marginTop: 8 }}>
                <Badge theme={T} tone={teamRisk === 'high' ? 'danger' : teamRisk === 'med' ? 'caution' : teamRisk === 'low' ? 'positive' : 'neutral'} dot>
                  {teamRisk === 'high' ? S.high : teamRisk === 'med' ? S.med : teamRisk === 'low' ? S.low : (lang==='ar'?'بلا إشارة':'No signal')}
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
              {trend && trend.length > 0 ? (
                <Spark theme={T} values={trend} width={500} height={90} chartStyle={chartStyle === 'bar' ? 'bar' : 'area'} color={teamRisk === 'high' ? T.danger : T.accent} showDots={false}/>
              ) : (
                <div style={{ padding: '30px 0', textAlign: 'center', fontSize: 12, color: T.textMuted }}>
                  {lang==='ar'?'جارٍ التحميل…':'Loading time series…'}
                </div>
              )}
            </div>
          </Panel>

          {hasMetrics && (
            <Panel theme={T} density="comfortable" style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 12 }}>
                {lang==='ar'?'تفصيل المقاييس':'Metric breakdown'}
              </div>
              {[['sleep', S.sleep, sleep], ['stress', S.stress, stress], ['energy', S.energy, energy], ['mood', S.mood, mood]].map(([k, l, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0' }}>
                  <div style={{ width: 78, fontSize: 12, color: T.textMid, fontWeight: 600 }}>{l}</div>
                  <div style={{ flex: 1 }}>
                    <Bullet theme={T} value={v} max={10}
                      color={v >= 6.5 ? T.positive : v >= 5 ? T.caution : T.danger}/>
                  </div>
                  <div className="mono" style={{ width: 40, textAlign: 'end', fontSize: 13, color: T.text, fontWeight: 600 }}>{Number(v).toFixed(1)}</div>
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
