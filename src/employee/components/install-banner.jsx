import React from 'react';

const DISMISS_KEY = 'wellness:pwa-install-dismissed';

export function InstallBanner({ theme, lang }) {
  const T = theme;
  const [evt, setEvt] = React.useState(null);
  const [installed, setInstalled] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(() => {
    try { return !!localStorage.getItem(DISMISS_KEY); } catch { return false; }
  });

  React.useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setEvt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvt(null);
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!evt) return;
    try {
      evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
      setEvt(null);
    } catch (_e) { /* user cancelled */ }
  };

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setDismissed(true);
  };

  if (installed || dismissed || !evt) return null;

  return (
    <div style={{
      position: 'absolute', left: 16, right: 16, bottom: 96, zIndex: 45,
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 16, padding: 14,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: T.isDark ? '0 12px 36px rgba(0,0,0,0.45)' : '0 12px 36px rgba(0,0,0,0.10)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: T.accentSoft, color: T.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 700,
      }}>+</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>
          {lang === 'ar' ? 'ثبّت Wellness+' : 'Install Wellness+'}
        </div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, lineHeight: 1.3 }}>
          {lang === 'ar' ? 'وصول أسرع. يعمل بلا اتصال.' : 'Faster access. Works offline.'}
        </div>
      </div>
      <button onClick={handleDismiss} type="button" style={{
        background: 'transparent', border: 'none',
        color: T.textMuted, fontSize: 12, padding: '6px 10px', cursor: 'pointer',
      }}>{lang === 'ar' ? 'لاحقاً' : 'Later'}</button>
      <button onClick={handleInstall} type="button" style={{
        background: T.accent, color: T.accentInk, border: 'none',
        borderRadius: 9, fontWeight: 600, fontSize: 12,
        padding: '8px 14px', cursor: 'pointer',
      }}>{lang === 'ar' ? 'تثبيت' : 'Install'}</button>
    </div>
  );
}
