// Reading and writing the people spreadsheets. The xlsx libraries are loaded
// on demand so they stay out of the first paint of the HR / admin portals.
import {
  decodeCsvBytes, parseCsv, sheetHeaders, templateHelpRows, inviteSheetRows, sheetFileName,
} from './people-import.js';

export class UnsupportedFileError extends Error {
  constructor(name) {
    super('unsupported_file');
    this.code = 'unsupported_file';
    this.fileName = name;
  }
}

async function bytesOf(file) {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Response(file).arrayBuffer();
}

// → array of rows (array of cells), first sheet only.
export async function readPeopleFile(file) {
  const name = String(file?.name || '').toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  if (ext === '.csv' || ext === '.txt' || (!ext && file?.type === 'text/csv')) {
    return parseCsv(decodeCsvBytes(await bytesOf(file)));
  }
  if (ext === '.xlsx') {
    const { readSheet } = await import('read-excel-file/browser');
    return readSheet(file);
  }
  throw new UnsupportedFileError(file?.name);
}

const bold = (value) => ({ value, fontWeight: 'bold' });
const cells = (row, header = false) => row.map((v) => (header ? bold(String(v)) : (v === '' || v == null ? null : String(v))));

async function writer() {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  return writeXlsxFile;
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function templateBlob(lang) {
  const write = await writer();
  const ar = lang === 'ar';
  const help = templateHelpRows(lang);
  return write([
    {
      sheet: ar ? 'الأشخاص' : 'People',
      data: [cells(sheetHeaders(lang), true)],
      columns: [{ width: 28 }, { width: 34 }, { width: 22 }, { width: 22 }],
      rightToLeft: ar,
      stickyRowsCount: 1,
    },
    {
      sheet: ar ? 'تعليمات' : 'How to fill',
      data: help.map((r, i) => cells(r, i === 0 || i === 6 || i === 7)),
      columns: [{ width: 24 }, { width: 70 }, { width: 22 }, { width: 24 }],
      rightToLeft: ar,
    },
  ]).toBlob();
}

export async function downloadTemplate(lang) {
  saveBlob(await templateBlob(lang), lang === 'ar' ? 'قالب-الموظفين-wellness-plus.xlsx' : 'wellness-plus-people-template.xlsx');
}

// invites: rows from list_people_invites().
export async function inviteSheetBlob(invites, { origin, lang } = {}) {
  const write = await writer();
  const ar = lang === 'ar';
  const [header, ...body] = inviteSheetRows(invites, { origin, lang });
  return write(
    [cells(header, true), ...body.map((r) => cells(r))],
    {
      sheet: ar ? 'الدعوات' : 'Invites',
      columns: [{ width: 26 }, { width: 32 }, { width: 20 }, { width: 22 }, { width: 70 }, { width: 14 }],
      rightToLeft: ar,
      stickyRowsCount: 1,
    },
  ).toBlob();
}

export async function downloadInviteSheet(invites, { origin, lang, companyName } = {}) {
  saveBlob(await inviteSheetBlob(invites, { origin, lang }), sheetFileName('wellness-plus-invites', companyName));
}
