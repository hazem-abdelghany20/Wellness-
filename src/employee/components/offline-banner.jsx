import React from 'react';

// Subtle non-blocking strip that surfaces when the browser reports
// offline. We don't block the UI — the app shell still works and the
// SW serves cached content; this banner just lets the user know writes
// (check-ins, claims) will retry once back online.
export function OfflineBanner({ theme, lang }) {
  const T = theme;
  const [online, setOnline] = React.useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  );

  React.useEffect(() => {
    const goOnline  = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute', left: 16, right: 16, top: 12, zIndex: 50,
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 12, padding: '8px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: T.isDark ? '0 8px 24px rgba(0,0,0,0.45)' : '0 8px 24px rgba(0,0,0,0.10)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8, height: 8, borderRadius: 8,
          background: '#F5B544', flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>
        {lang === 'ar' ? 'أنت غير متصل' : "You're offline"}
      </span>
      <span style={{ fontSize: 11, color: T.textMuted, flex: 1, minWidth: 0 }}>
        {lang === 'ar'
          ? 'سيُعاد المزامنة عند عودة الاتصال.'
          : 'Changes will sync when you reconnect.'}
      </span>
    </div>
  );
}
