import React from 'react';
import {
  typeStyles, Icon, Card, SectionLabel,
} from '../design-system.jsx';
import { TopBack } from './onboarding.jsx';

function ScreenNotifs({ theme, t, dir, go }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const sections = [
    {
      label: lang==='ar'?'اليوم':'Today',
      items: [
        { icon: 'flame', color: T.accent, title: { en: '21 day streak! Keep it going', ar: '21 يوماً متتالياً! حافظ عليها' }, time: '08:30', unread: true },
        { icon: 'trophy', color: T.positive, title: { en: 'You climbed to #2 on your team', ar: 'صعدت إلى المركز الثاني في فريقك' }, time: '07:10', unread: true },
      ],
    },
    {
      label: lang==='ar'?'هذا الأسبوع':'This week',
      items: [
        { icon: 'moon', color: T.info, title: { en: 'Sleep improved 0.8h this week', ar: 'النوم تحسَّن 0.8 ساعة هذا الأسبوع' }, time: 'Mon', unread: false },
        { icon: 'sparkle', color: T.accent, title: { en: 'New content: "Caffeine cut-off, in plain terms"', ar: 'محتوى جديد: "الكافيين بلغة واضحة"' }, time: 'Sun', unread: false },
        { icon: 'users', color: T.info, title: { en: 'Finance team just joined Move April', ar: 'فريق المالية انضم لتحدي تحرَّك أبريل' }, time: 'Sat', unread: false },
      ],
    },
  ];
  return (
    <div style={{ height: '100%', background: T.bg, overflow: 'auto', paddingTop: 54, paddingBottom: 40, boxSizing: 'border-box' }}>
      <div style={{ padding: '14px 22px 6px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <TopBack theme={T} onBack={() => go('home')} dir={dir}/>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 26, letterSpacing: -0.4, color: T.text, flex: 1 }}>
          {lang==='ar'?'الإشعارات':'Notifications'}
        </div>
        <button style={{ background:'transparent', border:'none', color:T.accent, fontSize:13, fontWeight:600, cursor:'pointer' }}>
          {lang==='ar'?'تعليم الكل':'Mark all read'}
        </button>
      </div>

      {sections.map((sec, si) => (
        <div key={si}>
          <SectionLabel theme={T} style={{ marginTop: 14 }}>{sec.label}</SectionLabel>
          <div style={{ padding: '0 16px' }}>
            <Card theme={T} pad={0} radius={20}>
              {sec.items.map((it, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 12, padding: '14px 16px', alignItems: 'flex-start',
                  borderBottom: i < sec.items.length - 1 ? `1px solid ${T.border}` : 'none',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: it.color + '22', color: it.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}><Icon name={it.icon} size={18}/></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: T.text, lineHeight: 1.4, fontWeight: it.unread ? 600 : 500 }}>
                      {it.title[lang]}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{it.time}</div>
                  </div>
                  {it.unread && <div style={{ width: 8, height: 8, borderRadius: 999, background: T.accent, marginTop: 6 }}/>}
                </div>
              ))}
            </Card>
          </div>
        </div>
      ))}
    </div>
  );
}

export { ScreenNotifs };
