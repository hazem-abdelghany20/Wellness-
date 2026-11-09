import React from 'react';
import { supabase } from '../lib/supabase';

// First-run walkthrough shared by the three portals.
//
// A tour is a list of steps; each step names the screen it belongs to and a
// short EN/AR title + body. The portal passes `onNavigate(step.screen)` so the
// tour moves through the real screens instead of pointing at DOM nodes (which
// would break every time a screen changes).
//
// "Seen" is stored on the account (auth user_metadata.tours_seen[key]) so it
// doesn't replay on another device, with a localStorage copy so it never
// flashes again while the metadata write is in flight or if it fails.

const LS_PREFIX = 'wellness-plus-tour-seen:';

export function tourSeen(user, key) {
  if (!user) return true;
  if (user.user_metadata?.tours_seen?.[key]) return true;
  try { return localStorage.getItem(`${LS_PREFIX}${key}:${user.id}`) === '1'; } catch { return false; }
}

export async function markTourSeen(user, key) {
  if (!user) return;
  try { localStorage.setItem(`${LS_PREFIX}${key}:${user.id}`, '1'); } catch { /* storage blocked */ }
  try {
    const prev = user.user_metadata?.tours_seen || {};
    await supabase.auth.updateUser({ data: { tours_seen: { ...prev, [key]: new Date().toISOString() } } });
  } catch { /* the local copy is enough to stop repeats on this device */ }
}

export function useWalkthrough({ key, user, steps, onNavigate, autoStart = true }) {
  const [index, setIndex] = React.useState(-1);
  const startedFor = React.useRef(null);
  // Portals pass a fresh navigate function on every render; keep the latest
  // in a ref so the auto-start timer isn't cancelled by re-renders.
  const navRef = React.useRef(onNavigate);
  navRef.current = onNavigate;
  const userRef = React.useRef(user);
  userRef.current = user;

  const goTo = React.useCallback((i) => {
    const step = steps[i];
    if (step?.screen && navRef.current) navRef.current(step.screen);
    setIndex(i);
  }, [steps]);

  const userId = user?.id;
  React.useEffect(() => {
    if (!autoStart || !userId || startedFor.current === userId) return;
    if (tourSeen(userRef.current, key)) { startedFor.current = userId; return; }
    const id = setTimeout(() => { startedFor.current = userId; goTo(0); }, 700);
    return () => clearTimeout(id);
  }, [autoStart, userId, key, goTo]);

  const close = React.useCallback(() => {
    setIndex(-1);
    markTourSeen(user, key);
  }, [user, key]);

  return {
    open: index >= 0,
    index,
    step: index >= 0 ? steps[index] : null,
    total: steps.length,
    start: () => goTo(0),
    next: () => (index + 1 < steps.length ? goTo(index + 1) : close()),
    back: () => (index > 0 ? goTo(index - 1) : null),
    close,
  };
}

// colors: { panel, text, muted, border, accent, accentInk }
export function WalkthroughCard({ tour, lang = 'en', colors, placement = 'corner', bottomOffset = 24 }) {
  const cardRef = React.useRef(null);
  React.useEffect(() => {
    if (!tour.open) return;
    cardRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') tour.close();
      if (e.key === 'ArrowRight') (lang === 'ar' ? tour.back : tour.next)();
      if (e.key === 'ArrowLeft') (lang === 'ar' ? tour.next : tour.back)();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tour, lang]);

  if (!tour.open || !tour.step) return null;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const C = colors;
  const last = tour.index === tour.total - 1;
  const pos = placement === 'sheet'
    ? { left: 12, right: 12, bottom: bottomOffset }
    : { insetInlineEnd: 24, bottom: bottomOffset, width: 360, maxWidth: 'calc(100vw - 48px)' };

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-labelledby="wp-tour-title"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      style={{
        position: placement === 'sheet' ? 'absolute' : 'fixed', zIndex: 80, ...pos,
        background: C.panel, color: C.text, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: '16px 16px 14px', outline: 'none',
        boxShadow: '0 18px 50px rgba(0,0,0,0.35)', boxSizing: 'border-box',
        animation: 'wpTourIn .28s ease both',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: C.accent }}>
          {s('Quick tour', 'جولة سريعة')} · {tour.index + 1}/{tour.total}
        </div>
        <button onClick={tour.close} style={{
          background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer',
          fontSize: 13, fontWeight: 600, padding: 4,
        }}>{s('Skip', 'تخطّي')}</button>
      </div>
      <div id="wp-tour-title" style={{ fontSize: 17, fontWeight: 700, margin: '8px 0 6px', lineHeight: 1.3 }}>
        {s(tour.step.title_en, tour.step.title_ar)}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.5, color: C.muted }}>
        {s(tour.step.body_en, tour.step.body_ar)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 10 }}>
        <div style={{ display: 'flex', gap: 5 }} aria-hidden="true">
          {Array.from({ length: tour.total }).map((_, i) => (
            <span key={i} style={{
              width: i === tour.index ? 16 : 6, height: 6, borderRadius: 3,
              background: i === tour.index ? C.accent : C.border, transition: 'width .2s',
            }}/>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tour.index > 0 && (
            <button onClick={tour.back} style={{
              background: 'transparent', color: C.text, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{s('Back', 'رجوع')}</button>
          )}
          <button onClick={tour.next} style={{
            background: C.accent, color: C.accentInk, border: 'none',
            borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>{last ? s('Done', 'تمام') : s('Next', 'التالي')}</button>
        </div>
      </div>
      <style>{`@keyframes wpTourIn{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:none}}
        @media (prefers-reduced-motion: reduce){[role=dialog]{animation:none!important}}`}</style>
    </div>
  );
}

// Floating "?" for the desktop portals: replay the tour or open the guide.
export function HelpButton({ lang = 'en', colors, onReplay, guideHref }) {
  const [open, setOpen] = React.useState(false);
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const C = colors;
  const item = {
    display: 'block', width: '100%', textAlign: 'start', background: 'transparent', border: 'none',
    color: C.text, padding: '10px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', textDecoration: 'none', boxSizing: 'border-box',
  };
  return (
    <div style={{ position: 'fixed', insetInlineEnd: 24, bottom: 24, zIndex: 70 }}>
      {open && (
        <div role="menu" style={{
          position: 'absolute', bottom: 52, insetInlineEnd: 0, width: 220,
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 6,
          boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
        }}>
          <button role="menuitem" style={item} onClick={() => { setOpen(false); onReplay(); }}>
            {s('Replay the tour', 'أعد الجولة')}
          </button>
          <a role="menuitem" style={item} href={guideHref} target="_blank" rel="noopener" onClick={() => setOpen(false)}>
            {s('Open the guide', 'افتح الدليل')} ↗
          </a>
        </div>
      )}
      <button
        aria-label={s('Help', 'مساعدة')}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          width: 42, height: 42, borderRadius: 21, border: `1px solid ${C.border}`,
          background: C.accent, color: C.accentInk, fontSize: 18, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
        }}>?</button>
    </div>
  );
}

export function guideHref(role, lang) {
  return `/guides/${role}.html${lang === 'ar' ? '#ar' : ''}`;
}
