import React from 'react';
import { HRButton } from './components.jsx';
import { CopyButton, LinkField } from './join-link-card.jsx';
import { buildInviteLink } from './people-import.js';
import { downloadInviteSheet } from './sheet-io.js';
import { listPeopleInvites } from '../lib/supabase-invites';
import { friendlyErrorI18n } from '../lib/errors';

export function adminInviteErrorText(err, lang) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const msg = String(err?.message || err || '');
  if (/email_in_other_company/i.test(msg)) return s('This email already has an account in another company.', 'هذا البريد لديه حساب في شركة أخرى.');
  if (/invalid_email/i.test(msg)) return s('Not a valid email.', 'بريد إلكتروني غير صالح.');
  if (/company_not_found/i.test(msg)) return s('Company not found.', 'الشركة غير موجودة.');
  return friendlyErrorI18n(err, lang);
}

// What "Invite admin" shows instead of "Invite sent": nothing is emailed, so
// the admin copies the HR sign-up link (or downloads the invite sheet).
export function AdminInviteResult({ theme, lang, result, companyName, origin }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  if (!result) return null;
  const base = origin || window.location.origin;

  if (result.status === 'already_admin') {
    const portal = `${String(base).replace(/\/+$/, '')}/hr.html`;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
        <div style={{ fontSize: 12, color: T.positive }}>
          {s(`${result.email} is already an HR admin here. They sign in at:`,
             `${result.email} مسؤول موارد بشرية هنا بالفعل. يسجل الدخول من:`)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <LinkField theme={T} value={portal}/>
          <CopyButton theme={T} lang={lang} text={portal} label={s('Copy link', 'نسخ الرابط')}/>
        </div>
      </div>
    );
  }

  const link = buildInviteLink(base, result.token, 'hr_admin');
  async function sheet() {
    setBusy(true); setErr(null);
    try {
      const invites = await listPeopleInvites(result.company_id);
      await downloadInviteSheet(invites, { origin: base, lang, companyName });
    } catch (e) {
      setErr(friendlyErrorI18n(e, lang));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <div style={{ fontSize: 12, color: T.positive }}>
        {result.existing_account
          ? s(`${result.email} already has an account. No email is sent — give them this link; they open it and sign in with their current password to become HR admin (works for 90 days):`,
              `${result.email} لديه حساب بالفعل. لا يُرسل أي بريد — أعطه هذا الرابط؛ يفتحه ويسجل الدخول بكلمة مروره الحالية ليصبح مسؤول موارد بشرية (صالح ٩٠ يومًا):`)
          : s(`Invite ready for ${result.email}. No email is sent — give them this HR sign-up link (works for 90 days):`,
              `الدعوة جاهزة لـ ${result.email}. لا يُرسل أي بريد — أعطه رابط التسجيل هذا لبوابة الموارد البشرية (صالح ٩٠ يومًا):`)}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <LinkField theme={T} value={link}/>
        <CopyButton theme={T} lang={lang} text={link} label={s('Copy link', 'نسخ الرابط')}/>
        <HRButton theme={T} size="sm" variant="ghost" icon="download" onClick={sheet} disabled={busy}>
          {busy ? s('Preparing…', 'جارٍ التجهيز…') : s('Invite sheet', 'ملف الدعوات')}
        </HRButton>
      </div>
      {err && <div style={{ fontSize: 12, color: T.danger }}>{err}</div>}
    </div>
  );
}
