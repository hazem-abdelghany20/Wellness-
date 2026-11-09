import React from 'react';
import { HRButton, Panel, PanelHeader, Badge } from './components.jsx';
import {
  sheetToRecords, validateImportRows, reasonLabel, roleLabel, MAX_IMPORT_ROWS,
} from './people-import.js';
import { readPeopleFile, downloadTemplate, downloadInviteSheet } from './sheet-io.js';
import { importPeople, listPeopleInvites } from '../lib/supabase-invites';
import { friendlyErrorI18n } from '../lib/errors';

const PROBLEM_ROWS_SHOWN = 200;

function fmt(n, lang) {
  return lang === 'ar' ? new Intl.NumberFormat('ar-EG').format(n) : String(n);
}

function importErrorText(e, lang) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const msg = String(e?.message || e || '');
  if (e?.code === 'unsupported_file') return s('Use an .xlsx or .csv file (in Excel: File → Save As → Excel Workbook or CSV UTF-8).', 'استخدم ملف ‎.xlsx أو ‎.csv (في Excel: ملف ← حفظ باسم ← مصنف Excel أو CSV UTF-8).');
  if (/could not find the function/i.test(msg) || e?.code === 'PGRST202') return s('The database is missing the import function — apply the latest migration first.', 'قاعدة البيانات ينقصها دالة الاستيراد — طبّق آخر ترحيل أولاً.');
  if (/too_many_rows/i.test(msg)) return s(`At most ${MAX_IMPORT_ROWS} rows per file.`, `الحد الأقصى ${fmt(MAX_IMPORT_ROWS, 'ar')} صف لكل ملف.`);
  if (/invalid|corrupt|zip|spreadsheet/i.test(msg)) return s('Could not read this file. Open it in Excel and save it again as .xlsx.', 'تعذّرت قراءة الملف. افتحه في Excel واحفظه مرة أخرى بصيغة ‎.xlsx.');
  return friendlyErrorI18n(e, lang);
}

function ProblemTable({ theme, lang, problems }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  if (!problems.length) return null;
  const shown = problems.slice(0, PROBLEM_ROWS_SHOWN);
  const th = { fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: T.textMuted, fontWeight: 700, textAlign: 'start', padding: '6px 10px' };
  const td = { padding: '6px 10px', fontSize: 12, color: T.text, borderTop: `1px solid ${T.divider}` };
  return (
    <div style={{ maxHeight: 260, overflowY: 'auto', border: `1px solid ${T.border}`, borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: T.panelSunk }}>
            <th style={th}>{s('Row', 'الصف')}</th>
            <th style={th}>{s('Email', 'البريد الإلكتروني')}</th>
            <th style={th}>{s('Problem', 'المشكلة')}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((p, i) => (
            <tr key={`${p.row}-${i}`}>
              <td className="mono" style={{ ...td, width: 60 }}>{p.row ?? '—'}</td>
              <td className="mono" dir="ltr" style={{ ...td, textAlign: lang === 'ar' ? 'right' : 'left' }}>{p.email || '—'}</td>
              <td style={{ ...td, color: T.danger }}>
                {reasonLabel(p.reason, lang)}{p.value ? ` (“${p.value}”)` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {problems.length > shown.length && (
        <div style={{ padding: 8, fontSize: 11, color: T.textMuted }}>
          {s(`…and ${problems.length - shown.length} more`, `…و${fmt(problems.length - shown.length, 'ar')} غيرها`)}
        </div>
      )}
    </div>
  );
}

function Stat({ theme, label, value, tone }) {
  const T = theme;
  const color = tone === 'danger' ? T.danger : tone === 'positive' ? T.positive : T.text;
  return (
    <div style={{ padding: '10px 14px', background: T.panelSunk, borderRadius: 10, border: `1px solid ${T.border}`, minWidth: 110 }}>
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{label}</div>
      <div className="display" style={{ fontSize: 26, color, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
    </div>
  );
}

// Import people from a sheet into one company, then hand out the invite
// sheet. Used by HR People (own company) and admin tenant detail (any).
export function PeopleImportPanel({
  theme, lang, density, companyId, companyName, existingTeams = [], onImported,
}) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const n = (v) => fmt(v ?? 0, lang);
  const fileRef = React.useRef(null);
  const [fileName, setFileName] = React.useState('');
  const [preview, setPreview] = React.useState(null);
  const [summary, setSummary] = React.useState(null);
  const [busy, setBusy] = React.useState(null); // 'read' | 'import' | 'sheet' | 'template'
  const [err, setErr] = React.useState(null);

  const reset = () => {
    setPreview(null); setFileName(''); setErr(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setSummary(null); setPreview(null); setFileName(file.name); setBusy('read');
    try {
      const rows = await readPeopleFile(file);
      const { records, missingColumns } = sheetToRecords(rows);
      if (missingColumns.length) {
        setErr(s('The sheet needs an "email" column. Download the template to see the columns.', 'الملف يحتاج عمود "البريد الإلكتروني". نزّل القالب لترى الأعمدة.'));
        return;
      }
      if (!records.length) {
        setErr(s('No people found under the header row.', 'لا يوجد أشخاص تحت صف العناوين.'));
        return;
      }
      setPreview(validateImportRows(records, { existingTeams }));
    } catch (ex) {
      setErr(importErrorText(ex, lang));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function runImport() {
    if (!preview?.ready.length) return;
    setBusy('import'); setErr(null);
    try {
      const result = await importPeople(companyId, preview.ready);
      setSummary(result);
      setPreview(null);
      onImported?.(result);
    } catch (ex) {
      setErr(importErrorText(ex, lang));
    } finally {
      setBusy(null);
    }
  }

  async function sheet() {
    setBusy('sheet'); setErr(null);
    try {
      const invites = await listPeopleInvites(companyId);
      await downloadInviteSheet(invites, { origin: window.location.origin, lang, companyName });
    } catch (ex) {
      setErr(importErrorText(ex, lang));
    } finally {
      setBusy(null);
    }
  }

  async function template() {
    setBusy('template'); setErr(null);
    try { await downloadTemplate(lang); }
    catch (ex) { setErr(importErrorText(ex, lang)); }
    finally { setBusy(null); }
  }

  const by = preview?.counts.byRole || {};
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density}
        title={s('Import people', 'استيراد الأشخاص')}
        subtitle={s('Upload a sheet with name, email, team, role. No emails are sent — download the invite sheet and share each person’s link.',
                    'ارفع ملفًا فيه الاسم والبريد والفريق والدور. لا تُرسل أي رسائل — نزّل ملف الدعوات وشارك رابط كل شخص.')}
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <HRButton theme={T} size="sm" variant="ghost" icon="download" onClick={template} disabled={!!busy}>
              {s('Template', 'القالب')}
            </HRButton>
            <HRButton theme={T} size="sm" variant="secondary" icon="download" onClick={sheet} disabled={!!busy || !companyId}>
              {busy === 'sheet' ? s('Preparing…', 'جارٍ التجهيز…') : s('Download invite sheet', 'تنزيل ملف الدعوات')}
            </HRButton>
            <HRButton theme={T} size="sm" variant="primary" icon="plus" onClick={() => fileRef.current?.click()} disabled={!!busy || !companyId}>
              {busy === 'read' ? s('Reading…', 'جارٍ القراءة…') : s('Upload sheet', 'رفع ملف')}
            </HRButton>
            <input ref={fileRef} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={onFile} style={{ display: 'none' }} data-testid="people-file"/>
          </div>
        }/>

      {(err || preview || summary) && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && <div role="alert" style={{ fontSize: 13, color: T.danger }}>{err}</div>}

          {preview && (
            <>
              <div style={{ fontSize: 12, color: T.textMuted }}>
                {s('File', 'الملف')}: <span className="mono" dir="ltr">{fileName}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Stat theme={T} label={s('Ready to import', 'جاهز للاستيراد')} value={n(preview.counts.ready)} tone="positive"/>
                <Stat theme={T} label={s('Problems', 'مشاكل')} value={n(preview.counts.problems)} tone={preview.counts.problems ? 'danger' : undefined}/>
                <Stat theme={T} label={s('New teams', 'فرق جديدة')} value={n(preview.newTeams.length)}/>
              </div>
              <div style={{ fontSize: 12, color: T.textMid }}>
                {roleLabel('employee', lang)} {n(by.employee)} · {roleLabel('manager', lang)} {n(by.manager)} · {roleLabel('hr_admin', lang)} {n(by.hr_admin)}
              </div>
              {preview.newTeams.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>{s('These teams will be created:', 'سيتم إنشاء هذه الفرق:')}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {preview.newTeams.map((t) => <Badge key={t} theme={T} tone="info">{t}</Badge>)}
                  </div>
                </div>
              )}
              {preview.problems.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>
                    {s('These rows will be skipped. Fix them in the sheet and upload again, or import the rest now.', 'سيتم تخطي هذه الصفوف. صحّحها في الملف وارفعه مرة أخرى، أو استورد الباقي الآن.')}
                  </div>
                  <ProblemTable theme={T} lang={lang} problems={preview.problems}/>
                </div>
              )}
              {preview.tooMany && (
                <div style={{ fontSize: 13, color: T.danger }}>{s(`At most ${MAX_IMPORT_ROWS} people per file — split the sheet.`, `الحد الأقصى ${fmt(MAX_IMPORT_ROWS, 'ar')} شخص لكل ملف — قسّم الملف.`)}</div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <HRButton theme={T} variant="primary" onClick={runImport} disabled={!!busy || !preview.ready.length || preview.tooMany}>
                  {busy === 'import' ? s('Importing…', 'جارٍ الاستيراد…') : s(`Import ${preview.counts.ready} people`, `استيراد ${n(preview.counts.ready)} شخص`)}
                </HRButton>
                <HRButton theme={T} variant="ghost" onClick={reset} disabled={busy === 'import'}>{s('Cancel', 'إلغاء')}</HRButton>
              </div>
            </>
          )}

          {summary && (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Stat theme={T} label={s('Invited', 'تمت دعوتهم')} value={n(summary.invited)} tone="positive"/>
                <Stat theme={T} label={s('Already in — updated', 'موجودون — تم التحديث')} value={n(summary.updated)}/>
                <Stat theme={T} label={s('Teams created', 'فرق أُنشئت')} value={n(summary.teams_created)}/>
                <Stat theme={T} label={s('Skipped', 'تم التخطي')} value={n(summary.skipped?.length)} tone={summary.skipped?.length ? 'danger' : undefined}/>
              </div>
              {summary.already_invited > 0 && (
                <div style={{ fontSize: 12, color: T.textMuted }}>
                  {s(`${summary.already_invited} already had an invite — their links did not change.`, `${n(summary.already_invited)} لديهم دعوة سابقة — روابطهم لم تتغير.`)}
                </div>
              )}
              {summary.hr_admin_links > 0 && (
                <div style={{ fontSize: 12, color: T.caution || T.textMid }}>
                  {s(`${summary.hr_admin_links} people already have an account and were listed as HR admin. They become HR admin when they open their link from the invite sheet and sign in.`,
                     `${n(summary.hr_admin_links)} لديهم حساب بالفعل ومُدرجون كمسؤولي موارد بشرية. يصبحون مسؤولين عند فتح رابطهم من ملف الدعوات وتسجيل الدخول.`)}
                </div>
              )}
              {summary.skipped?.length > 0 && <ProblemTable theme={T} lang={lang} problems={summary.skipped}/>}
              <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.5 }}>
                {s('Next: download the invite sheet and send each person their link. Links work for 90 days; importing the same sheet again keeps them.',
                   'التالي: نزّل ملف الدعوات وأرسل لكل شخص رابطه. الروابط صالحة ٩٠ يومًا، وإعادة استيراد نفس الملف تحتفظ بها.')}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <HRButton theme={T} variant="primary" icon="download" onClick={sheet} disabled={!!busy}>
                  {busy === 'sheet' ? s('Preparing…', 'جارٍ التجهيز…') : s('Download invite sheet', 'تنزيل ملف الدعوات')}
                </HRButton>
                <HRButton theme={T} variant="ghost" onClick={() => setSummary(null)}>{s('Done', 'تم')}</HRButton>
              </div>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
