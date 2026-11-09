import React from 'react';
import { HRIcon, HRButton, Panel, Badge } from '../components.jsx';
import { msgText } from './text.js';

// Small building blocks shared by the HR portal and admin console authoring
// screens. Same look as the sprint 1 habit template builder.

export function inputStyle(T, hasError = false) {
  return {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px',
    background: T.panelSunk, border: `1px solid ${hasError ? T.danger : T.border}`, borderRadius: 9,
    color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
  };
}

export function Field({ theme, label, hint, children, style, optional, lang }) {
  const T = theme;
  return (
    <div style={{ marginBottom: 18, ...style }}>
      {label && (
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>
          {label}
          {optional && <span style={{ fontWeight: 500, color: T.textMuted }}>{lang === 'ar' ? ' (اختياري)' : ' (optional)'}</span>}
        </div>
      )}
      {children}
      {hint && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

export function ErrorText({ theme, lang, error, style }) {
  if (!error) return null;
  return <div role="alert" style={{ fontSize: 11, color: theme.danger, marginTop: 5, ...style }}>{msgText(error, lang)}</div>;
}

export function Choice({ theme, selected, onClick, children, style, disabled, title }) {
  const T = theme;
  return (
    <button type="button" onClick={onClick} aria-pressed={!!selected} disabled={disabled} title={title} style={{
      fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'start',
      background: selected ? T.accentSoft : T.panelSunk, color: T.text,
      border: `1.5px solid ${selected ? T.accent : T.border}`, borderRadius: 10,
      padding: '7px 12px', fontSize: 12, fontWeight: 600, opacity: disabled ? 0.5 : 1,
      ...style,
    }}>{children}</button>
  );
}

// Segmented tabs: [{ id, label }].
export function Tabs({ theme, tabs, value, onChange, style, label }) {
  const T = theme;
  return (
    <div role="tablist" aria-label={label} style={{
      display: 'flex', gap: 4, background: T.panelSunk, padding: 4, borderRadius: 10,
      border: `1px solid ${T.border}`, width: 'fit-content', flexWrap: 'wrap', ...style,
    }}>
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} style={{
          padding: '7px 14px', borderRadius: 7, border: 'none', fontFamily: 'inherit',
          background: value === t.id ? T.panel : 'transparent',
          color: value === t.id ? T.text : T.textMuted,
          boxShadow: value === t.id ? T.shadowSm : 'none',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>{t.label}</button>
      ))}
    </div>
  );
}

const langTag = (T, code) => (
  <span className="mono" style={{ fontSize: 10, color: T.textFaint, fontWeight: 700, marginBottom: 4, display: 'block' }}>{code}</span>
);

// An English + Arabic pair of inputs bound to form[`${base}_en`] / form[`${base}_ar`].
export function LangPair({
  theme, lang, form, base, label, onChange, errors = {}, multiline = false, rows = 3, max,
  placeholderEn = '', placeholderAr = '', arOptional = true,
}) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
      {['en', 'ar'].map((code) => {
        const key = `${base}_${code}`;
        const err = errors[key];
        const props = {
          value: form[key] ?? '', dir: code === 'ar' ? 'rtl' : 'ltr', lang: code, maxLength: max,
          placeholder: code === 'ar' ? placeholderAr : placeholderEn,
          'aria-label': `${label} (${code === 'ar' ? s('Arabic', 'بالعربي') : s('English', 'بالإنجليزي')})`,
          'aria-invalid': err ? true : undefined,
          onChange: (e) => onChange(key, e.target.value),
          style: multiline ? { ...inputStyle(T, !!err), minHeight: 60, resize: 'vertical', lineHeight: 1.5 } : inputStyle(T, !!err),
        };
        return (
          <div key={code}>
            {langTag(T, code === 'ar' ? (arOptional ? s('AR · optional', 'عربي · اختياري') : 'AR') : 'EN')}
            {multiline ? <textarea rows={rows} {...props}/> : <input {...props}/>}
            <ErrorText theme={T} lang={lang} error={err}/>
          </div>
        );
      })}
    </div>
  );
}

export function Flash({ theme, flash, style }) {
  if (!flash) return null;
  const T = theme;
  return (
    <div role={flash.kind === 'err' ? 'alert' : 'status'} style={{
      fontSize: 13, marginBottom: 12, color: flash.kind === 'ok' ? T.positive : T.danger, ...style,
    }}>{flash.text}</div>
  );
}

export function Loading({ theme, lang }) {
  return (
    <div style={{ padding: '60px 0', textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>
      {lang === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}
    </div>
  );
}

export function EmptyState({ theme, density, text, action }) {
  const T = theme;
  return (
    <Panel theme={T} density={density}>
      <div style={{ padding: 28, color: T.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 1.6 }}>
        {text}
        {action && <div style={{ marginTop: 14 }}>{action}</div>}
      </div>
    </Panel>
  );
}

export function SearchBox({ theme, value, onChange, placeholder, label }) {
  const T = theme;
  return (
    <div style={{
      flex: 1, minWidth: 200, maxWidth: 360, height: 36, background: T.panelSunk, borderRadius: 9,
      border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10,
    }}>
      <HRIcon name="search" size={15} stroke={T.textMuted}/>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label || placeholder}
        style={{ flex: 1, background: 'transparent', border: 'none', color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}/>
    </div>
  );
}

export function SectionTitle({ theme, children, style }) {
  return (
    <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', margin: '0 0 10px', ...style }}>
      {children}
    </div>
  );
}

// A button that asks "Sure?" inline before running.
export function ConfirmButton({ theme, lang, label, question, yes, onConfirm, busy, variant = 'ghost', size = 'sm' }) {
  const T = theme;
  const [asking, setAsking] = React.useState(false);
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  if (!asking) return <HRButton theme={T} variant={variant} size={size} disabled={busy} onClick={() => setAsking(true)}>{label}</HRButton>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: T.textMid }}>{question}</span>
      <HRButton theme={T} variant="danger" size={size} disabled={busy} onClick={async () => { await onConfirm(); setAsking(false); }}>{yes}</HRButton>
      <HRButton theme={T} variant="ghost" size={size} onClick={() => setAsking(false)}>{s('No', 'لا')}</HRButton>
    </span>
  );
}

export function ScopeBadge({ theme, lang, scope }) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  return scope === 'public'
    ? <Badge theme={theme} tone="info">{s('Wellness House', 'Wellness House')}</Badge>
    : <Badge theme={theme} tone="positive">{s('Your company', 'شركتك')}</Badge>;
}
