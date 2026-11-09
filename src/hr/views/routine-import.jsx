import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader, Badge } from '../../shared/components.jsx';
import { Field, Choice, inputStyle, LangPair } from '../../shared/authoring/ui.jsx';
import { sheetToRoutineRows, importReasonLabel, MAX_ROUTINE_ROWS } from '../../shared/authoring/routine-sheet.js';
import { readRoutineFile, downloadRoutineTemplate } from '../../shared/authoring/sheet-files.js';
import { libraryError } from '../../shared/authoring/errors.js';
import { fmtNum, upcomingSunday, clean } from '../../shared/authoring/text.js';
import { previewRoutineImport, importRoutine } from '../../lib/supabase-routines';

function Stat({ theme, label, value, tone }) {
  const T = theme;
  const color = tone === 'danger' ? T.danger : tone === 'positive' ? T.positive : tone === 'caution' ? T.caution : T.text;
  return (
    <div style={{ padding: '10px 14px', background: T.panelSunk, borderRadius: 10, border: `1px solid ${T.border}`, minWidth: 110 }}>
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{label}</div>
      <div className="display" style={{ fontSize: 26, color, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function IssueTable({ theme, lang, title, items, tone }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  if (!items.length) return null;
  const th = { fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: T.textMuted, fontWeight: 700, textAlign: 'start', padding: '6px 10px' };
  const td = { padding: '6px 10px', fontSize: 12, color: T.text, borderTop: `1px solid ${T.divider}` };
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: tone === 'danger' ? T.danger : T.caution, marginBottom: 6 }}>{title}</div>
      <div style={{ maxHeight: 220, overflowY: 'auto', border: `1px solid ${T.border}`, borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: T.panelSunk }}><th style={th}>{s('Row', 'الصف')}</th><th style={th}>{s('What’s wrong', 'المشكلة')}</th></tr></thead>
          <tbody>
            {items.map((p, i) => (
              <tr key={`${p.row}-${p.reason}-${i}`}>
                <td className="mono" style={{ ...td, width: 60 }}>{p.row ?? '—'}</td>
                <td style={{ ...td, color: tone === 'danger' ? T.danger : T.text }}>
                  {importReasonLabel(p.reason, lang)}{p.value ? ` (“${p.value}”)` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const fileTitle = (name) => clean(String(name || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ')).slice(0, 120);

// Import a routine from the coach's sheet: template → upload → preview
// (problems, warnings, new exercises) → import (optionally assign).
export function RoutineImportPanel({ theme, lang, density, teams = [], today, onImported, onClose, api }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const preview = api?.preview || previewRoutineImport;
  const save = api?.save || importRoutine;
  const fileRef = React.useRef(null);
  const [form, setForm] = React.useState({ title_en: '', title_ar: '' });
  const [parsed, setParsed] = React.useState(null);   // { rows, warnings, fileName }
  const [summary, setSummary] = React.useState(null);
  const [assign, setAssign] = React.useState('none'); // 'none' | 'all' | 'team'
  const [teamId, setTeamId] = React.useState('');
  const [startsOn, setStartsOn] = React.useState(() => upcomingSunday(today));
  const [busy, setBusy] = React.useState(null);       // 'read' | 'save'
  const [error, setError] = React.useState(null);

  const header = () => ({
    title_en: clean(form.title_en), ...(clean(form.title_ar) ? { title_ar: clean(form.title_ar) } : {}),
    ...(assign !== 'none' ? { assign: true, team_id: assign === 'team' ? teamId : null, starts_on: startsOn } : {}),
  });

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    setError(null); setSummary(null); setParsed(null); setBusy('read');
    try {
      const sheet = await readRoutineFile(file);
      const out = sheetToRoutineRows(sheet);
      if (out.missing.length) {
        setError(s('We couldn’t find an “exercise” column. Use the template, or name the columns: time, exercise, sets_reps, weekday, body_areas, youtube.',
                   'ملقيناش عمود «التمرين». استخدم القالب، أو سمّي الأعمدة: الوقت، التمرين، العدد، اليوم، منطقة الجسم، يوتيوب.'));
        return;
      }
      if (!out.rows.length) { setError(s('The sheet has no rows under the headers.', 'الشيت مفيهوش صفوف تحت العناوين.')); return; }
      if (out.tooMany) { setError(s(`At most ${MAX_ROUTINE_ROWS} rows per routine.`, `لحد ${fmtNum(MAX_ROUTINE_ROWS, 'ar')} صف في الروتين.`)); return; }
      const title = clean(form.title_en) || fileTitle(file.name) || 'Routine';
      if (!clean(form.title_en)) setForm((f) => ({ ...f, title_en: title }));
      setParsed({ rows: out.rows, warnings: out.warnings, fileName: file.name });
      // The preview only checks the rows; assigning happens on Import.
      setSummary(await preview({ title_en: title, ...(clean(form.title_ar) ? { title_ar: clean(form.title_ar) } : {}) }, out.rows));
    } catch (err) {
      setError(err?.code === 'unsupported_file'
        ? s('Use an .xlsx or .csv file (in Excel: File → Save As → Excel Workbook or CSV UTF-8).', 'استخدم ملف ‎.xlsx أو ‎.csv (في Excel: ملف ← حفظ باسم ← مصنف Excel أو CSV UTF-8).')
        : libraryError(err, lang));
    } finally {
      setBusy(null);
    }
  }

  async function doImport() {
    if (!clean(form.title_en)) { setError(s('Add the routine name in English.', 'اكتب اسم الروتين بالإنجليزي.')); return; }
    if (assign === 'team' && !teamId) { setError(s('Pick the team.', 'اختار الفريق.')); return; }
    setBusy('save'); setError(null);
    try {
      const out = await save(header(), parsed.rows);
      if (!out?.saved) {
        setSummary(out);
        setError(s('No row could be imported. Fix the rows below and upload again.', 'مفيش صف ينفع يتضاف. صلّح الصفوف اللي تحت وارفع تاني.'));
        return;
      }
      onImported?.(out);
    } catch (err) {
      setError(libraryError(err, lang));
    } finally {
      setBusy(null);
    }
  }

  const problems = summary?.problems || [];
  const warnings = [...(parsed?.warnings || []), ...(summary?.warnings || [])];

  return (
    <Panel theme={T} density={density} pad={false} style={{ marginBottom: DENSITY[density].gap }}>
      <PanelHeader theme={T} density={density} title={s('Import a routine from a sheet', 'استورد روتين من شيت')}
        subtitle={s('The coach’s Excel or CSV: one row per exercise. Nothing is saved until you press Import.', 'ملف Excel أو CSV بتاع المدرب: صف لكل تمرين. مفيش حاجة بتتحفظ غير لما تدوس استيراد.')}
        right={<HRButton theme={T} variant="ghost" size="sm" icon="close" onClick={onClose}>{s('Close', 'قفل')}</HRButton>}/>
      <div style={{ padding: DENSITY[density].cardPad }}>
        <Field theme={T} label={s('1 · Get the template', '١ · نزّل القالب')}
          hint={s('Columns: time · exercise · sets_reps · weekday · body_areas · youtube. Leave weekday empty for every workday.',
                  'الأعمدة: الوقت · التمرين · العدد · اليوم · منطقة الجسم · يوتيوب. سيب اليوم فاضي لكل أيام الشغل.')}>
          <HRButton theme={T} variant="secondary" size="sm" icon="download" onClick={() => downloadRoutineTemplate(lang).catch((e) => setError(libraryError(e, lang)))}>
            {s('Download template', 'نزّل القالب')}
          </HRButton>
        </Field>

        <Field theme={T} label={s('2 · Name it and upload the sheet', '٢ · سمّيه وارفع الشيت')}>
          <LangPair theme={T} lang={lang} form={form} base="title" label={s('Routine name', 'اسم الروتين')}
            onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))} max={120} placeholderEn="Daily desk routine" placeholderAr="روتين المكتب اليومي"/>
          <input ref={fileRef} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={onFile} style={{ display: 'none' }} aria-label={s('Choose the sheet', 'اختار الشيت')}/>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <HRButton theme={T} variant="primary" size="sm" icon="plus" disabled={!!busy} onClick={() => fileRef.current?.click()}>
              {busy === 'read' ? s('Reading…', 'جارٍ القراءة…') : parsed ? s('Upload another file', 'ارفع ملف تاني') : s('Upload .xlsx or .csv', 'ارفع ‎.xlsx أو ‎.csv')}
            </HRButton>
            {parsed && <span className="mono" style={{ fontSize: 11, color: T.textMuted }}>{parsed.fileName}</span>}
          </div>
        </Field>

        {summary && (
          <Field theme={T} label={s('3 · Check and import', '٣ · راجع واستورد')}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Stat theme={T} label={s('Rows in the sheet', 'صفوف الشيت')} value={fmtNum(summary.rows, lang)}/>
              <Stat theme={T} label={s('Will be added', 'هتتضاف')} value={fmtNum(summary.items, lang)} tone="positive"/>
              <Stat theme={T} label={s('Exercises found', 'تمارين موجودة')} value={fmtNum(summary.exercises_matched, lang)}/>
              <Stat theme={T} label={s('New exercises', 'تمارين جديدة')} value={fmtNum(summary.exercises_created, lang)}/>
              {problems.length > 0 && <Stat theme={T} label={s('Rows skipped', 'صفوف هتتساب')} value={fmtNum(problems.length, lang)} tone="danger"/>}
            </div>
            {(summary.new_exercises || []).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: T.textMid, marginBottom: 6 }}>
                  {s('These exercises are new and will be added to your library (add their videos later in Exercises):',
                     'التمارين دي جديدة وهتتضاف لمكتبتك (ضيف الفيديوهات بعدين من التمارين):')}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {summary.new_exercises.map((n) => <Badge key={n} theme={T} tone="info">{n}</Badge>)}
                </div>
              </div>
            )}
            <IssueTable theme={T} lang={lang} tone="danger" items={problems} title={s('Skipped rows (fix them in the sheet and upload again)', 'صفوف هتتساب (صلّحها في الشيت وارفعه تاني)')}/>
            <IssueTable theme={T} lang={lang} tone="caution" items={warnings} title={s('Imported, with a note', 'هتتضاف، مع ملاحظة')}/>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>{s('Give it to people now?', 'توزّعه على الناس دلوقتي؟')}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Choice theme={T} selected={assign === 'none'} onClick={() => setAssign('none')}>{s('Not yet', 'لسه')}</Choice>
                <Choice theme={T} selected={assign === 'all'} onClick={() => setAssign('all')}>{s('Everyone', 'كل الموظفين')}</Choice>
                {teams.length > 0 && <Choice theme={T} selected={assign === 'team'} onClick={() => setAssign('team')}>{s('One team', 'فريق واحد')}</Choice>}
                {assign === 'team' && (
                  <select value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label={s('Team', 'الفريق')} style={{ ...inputStyle(T), width: 200 }}>
                    <option value="">{s('Pick a team…', 'اختار فريق…')}</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
                {assign !== 'none' && (
                  <input type="date" value={startsOn} min={today} onChange={(e) => setStartsOn(e.target.value)}
                    aria-label={s('Start date', 'تاريخ البداية')} style={{ ...inputStyle(T), width: 170 }}/>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }}>
              <HRButton theme={T} variant="primary" icon="check" disabled={!!busy || !summary.items} onClick={doImport}>
                {busy === 'save' ? s('Importing…', 'جارٍ الاستيراد…') : s(`Import ${summary.items} ${summary.items === 1 ? 'row' : 'rows'}`, `استورد ${fmtNum(summary.items, 'ar')} صف`)}
              </HRButton>
              <span style={{ fontSize: 12, color: T.textMuted }}>{s('You can still edit every row afterwards.', 'تقدر تعدّل أي صف بعدين.')}</span>
            </div>
          </Field>
        )}
        {error && <div role="alert" style={{ fontSize: 13, color: T.danger, marginTop: 8 }}>{error}</div>}
      </div>
    </Panel>
  );
}
