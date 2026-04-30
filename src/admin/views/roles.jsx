import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, Badge } from '../../shared/components.jsx';

function AdminRolesView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const roles = [
    { name: s('Super admin','مسؤول أعلى'), members: 4, scope: s('Everything','كل شيء'), tone:'danger' },
    { name: s('Platform admin','مسؤول منصة'), members: 8, scope: s('Tenants, content, flags','عملاء، محتوى، خصائص'), tone:'caution' },
    { name: s('Content ops','عمليات المحتوى'), members: 12, scope: s('Library, moderation','مكتبة، إشراف'), tone:'info' },
    { name: s('Customer success','نجاح العملاء'), members: 14, scope: s('Tenants (read), broadcasts','عملاء (قراءة)'), tone:'info' },
    { name: s('Support','دعم'), members: 22, scope: s('Tickets, audit (read)','تذاكر، تدقيق (قراءة)'), tone:'neutral' },
    { name: s('Read-only','قراءة فقط'), members: 6, scope: s('Dashboards only','لوحات فقط'), tone:'neutral' },
  ];
  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Users & roles','المستخدمون والأدوار')}
        title={s('Internal access','الوصول الداخلي')}
        sub={s('66 staff · 6 roles · MFA enforced','٦٦ موظف · ٦ أدوار · MFA مُفعّل')}
        right={<HRButton theme={T} icon="plus">{s('Invite teammate','ادعُ زميلًا')}</HRButton>}/>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap: DENSITY[density].gap }}>
        {roles.map((r,i) => (
          <Panel key={i} theme={T} density={density}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, color: T.text, fontWeight: 700 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{r.scope}</div>
              </div>
              <Badge theme={T} tone={r.tone}>{r.members} {s('members','عضو')}</Badge>
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop: 10, borderTop: `1px solid ${T.divider}` }}>
              <div style={{ display:'flex' }}>
                {Array.from({ length: Math.min(5, r.members) }).map((_,j) => (
                  <div key={j} style={{
                    width: 26, height: 26, borderRadius: 999,
                    background: ['#7AB8A6','#F5B544','#E08A6B','#A39EDB','#92C7CF'][j],
                    border: `2px solid ${T.panel}`,
                    marginInlineStart: j === 0 ? 0 : -8,
                    color: '#fff', fontSize: 10, fontWeight: 700,
                    display:'grid', placeItems:'center',
                  }}>{['M','N','P','T','S'][j]}</div>
                ))}
                {r.members > 5 && (
                  <div style={{
                    width: 26, height: 26, borderRadius: 999, background: T.panelSunk,
                    border: `2px solid ${T.panel}`, marginInlineStart: -8,
                    color: T.textMuted, fontSize: 10, fontWeight: 700,
                    display:'grid', placeItems:'center',
                  }}>+{r.members - 5}</div>
                )}
              </div>
              <HRButton theme={T} variant="ghost" size="sm" iconR="chev">{s('Manage','إدارة')}</HRButton>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}

export { AdminRolesView };
