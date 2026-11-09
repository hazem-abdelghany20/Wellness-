import React from 'react';
import { renderSVG } from 'uqr';
import { HRButton } from './components.jsx';
import { buildJoinLink } from './people-import.js';

// Copy text to the clipboard; falls back to a hidden textarea for browsers
// (or iframes) without the async clipboard API.
export async function copyText(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({ theme, lang, text, size = 'sm', variant = 'secondary', label }) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const [state, setState] = React.useState(null);
  React.useEffect(() => {
    if (!state) return undefined;
    const id = setTimeout(() => setState(null), 2000);
    return () => clearTimeout(id);
  }, [state]);
  return (
    <HRButton theme={theme} size={size} variant={variant} icon={state === 'ok' ? 'check' : undefined}
      onClick={async () => setState((await copyText(text)) ? 'ok' : 'err')}>
      {state === 'ok' ? s('Copied', 'تم النسخ') : state === 'err' ? s('Copy failed', 'تعذّر النسخ') : (label || s('Copy', 'نسخ'))}
    </HRButton>
  );
}

export function LinkField({ theme, value }) {
  const T = theme;
  return (
    <input readOnly value={value} dir="ltr" onFocus={(e) => e.target.select()}
      style={{
        flex: 1, minWidth: 0, height: 32, padding: '0 10px', borderRadius: 8,
        background: T.panelSunk, border: `1px solid ${T.border}`, color: T.text,
        fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', outline: 'none',
      }}/>
  );
}

// QR rendered locally (uqr) — no network call. Always dark-on-white so phone
// cameras read it in either theme.
export function QrCode({ value, size = 148, label }) {
  const src = React.useMemo(() => {
    const svg = renderSVG(value, { border: 2, ecc: 'M', whiteColor: '#ffffff', blackColor: '#111111' });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [value]);
  return (
    <img src={src} width={size} height={size} alt={label || value}
      style={{ display: 'block', background: '#fff', borderRadius: 10, padding: 6, flexShrink: 0 }}/>
  );
}

function downloadQr(link, fileName) {
  const svg = renderSVG(link, { border: 4, ecc: 'M', pixelSize: 16, whiteColor: '#ffffff', blackColor: '#111111' });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The company join link (employee app, code pre-filled) with copy + QR.
export function JoinLinkCard({ theme, lang, code, companyName, compact = false, origin }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  if (!code) return null;
  const link = buildJoinLink(origin || window.location.origin, code);
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: compact ? 'center' : 'flex-start', flexWrap: 'wrap' }}>
      <QrCode value={link} size={compact ? 96 : 148} label={s('Join link QR code', 'رمز QR لرابط الانضمام')}/>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8, lineHeight: 1.5 }}>
          {s('Anyone with this link joins as an employee. Print the QR for the office, or paste the link in a group chat. Imported people can also sign in with just their email.',
             'أي شخص معه هذا الرابط ينضم كموظف. اطبع رمز QR للمكتب أو الصق الرابط في مجموعة. ومن تم استيرادهم يقدرون يسجلوا بالبريد الإلكتروني فقط.')}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <LinkField theme={T} value={link}/>
          <CopyButton theme={T} lang={lang} text={link} label={s('Copy link', 'نسخ الرابط')}/>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: T.textMuted }}>{s('Company code', 'رمز الشركة')}:</span>
          <span className="mono" dir="ltr" style={{ fontSize: 13, color: T.text, fontWeight: 700, letterSpacing: 1 }}>{code}</span>
          {!compact && (
            <HRButton theme={T} size="sm" variant="ghost" icon="download"
              onClick={() => downloadQr(link, `wellness-plus-join-${String(companyName || code).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`)}>
              {s('Download QR', 'تنزيل رمز QR')}
            </HRButton>
          )}
        </div>
      </div>
    </div>
  );
}
