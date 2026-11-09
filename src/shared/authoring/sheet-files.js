// Spreadsheet files for the routine screens: the import template and the
// routine report export. Same lazy-loaded libraries as sheet-io.js so they
// stay out of the portal's first paint.
import { routineTemplateHeaders, routineTemplateHelpRows } from './routine-sheet.js';
import { reportSheets } from './report-shape.js';
import { sheetFileName } from '../people-import.js';

export { readPeopleFile as readRoutineFile, UnsupportedFileError } from '../sheet-io.js';

async function writer() {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  return writeXlsxFile;
}

const bold = (value) => ({ value, fontWeight: 'bold' });
const cell = (v) => (v === '' || v == null ? null : (typeof v === 'number' ? { value: v, type: Number } : String(v)));
const rowsOf = (rows) => rows.map((r, i) => r.map((v) => (i === 0 && v !== '' && v != null ? bold(String(v)) : cell(v))));

export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function routineTemplateBlob(lang) {
  const write = await writer();
  const ar = lang === 'ar';
  return write([
    {
      sheet: ar ? 'الروتين' : 'Routine',
      data: [routineTemplateHeaders(lang).map((h) => bold(h))],
      columns: [{ width: 12 }, { width: 30 }, { width: 18 }, { width: 16 }, { width: 26 }, { width: 40 }],
      rightToLeft: ar,
      stickyRowsCount: 1,
    },
    {
      sheet: ar ? 'تعليمات' : 'How to fill',
      data: rowsOf(routineTemplateHelpRows(lang)),
      columns: [{ width: 22 }, { width: 80 }, { width: 24 }],
      rightToLeft: ar,
    },
  ]).toBlob();
}

export async function downloadRoutineTemplate(lang) {
  saveBlob(await routineTemplateBlob(lang), lang === 'ar' ? 'قالب-الروتين-wellness-plus.xlsx' : 'wellness-plus-routine-template.xlsx');
}

export async function routineReportBlob(report, people, lang) {
  const write = await writer();
  const ar = lang === 'ar';
  return write(reportSheets(report, people, lang).map((s) => ({
    sheet: s.sheet.slice(0, 31),
    data: rowsOf(s.rows),
    columns: s.rows[0].map((_, i) => ({ width: i === 0 ? 30 : 16 })),
    rightToLeft: ar,
    stickyRowsCount: 1,
  }))).toBlob();
}

export async function downloadRoutineReport(report, people, { lang, companyName } = {}) {
  saveBlob(await routineReportBlob(report, people, lang), sheetFileName('wellness-plus-routine-report', companyName));
}
