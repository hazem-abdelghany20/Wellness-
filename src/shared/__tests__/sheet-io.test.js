import { describe, it, expect } from 'vitest';
import writeXlsxNode from 'write-excel-file/node';
import { readSheet } from 'read-excel-file/browser';
import { readPeopleFile, inviteSheetBlob, templateBlob, UnsupportedFileError } from '../sheet-io.js';
import { sheetToRecords, validateImportRows, sheetHeaders } from '../people-import.js';

const asFile = (bytes, name, type = '') => new File([bytes], name, { type });

describe('readPeopleFile', () => {
  it('reads an .xlsx made in Excel-like tooling, Arabic included', async () => {
    const buf = await writeXlsxNode([
      ['name', 'email', 'team', 'role'],
      ['يوسف نجيب', 'yusuf@acme.com', 'العمليات', 'مدير'],
      ['Amira Hassan', 'Amira@Acme.com', 'Sales', null],
    ]).toBuffer();
    const rows = await readPeopleFile(asFile(buf, 'People.XLSX'));
    const { records } = sheetToRecords(rows);
    const { ready, problems } = validateImportRows(records);
    expect(problems).toEqual([]);
    expect(ready).toEqual([
      { row: 2, name: 'يوسف نجيب', email: 'yusuf@acme.com', team: 'العمليات', role: 'manager' },
      { row: 3, name: 'Amira Hassan', email: 'amira@acme.com', team: 'Sales', role: 'employee' },
    ]);
  });

  it('reads a UTF-8 CSV with a BOM', async () => {
    const text = '﻿name,email,team,role\nلينا فاروق,lina@acme.com,المبيعات,موظف\n';
    const rows = await readPeopleFile(asFile(new TextEncoder().encode(text), 'people.csv', 'text/csv'));
    expect(sheetToRecords(rows).records).toEqual([
      { row: 2, name: 'لينا فاروق', email: 'lina@acme.com', team: 'المبيعات', role: 'موظف' },
    ]);
  });

  it('refuses other file types', async () => {
    await expect(readPeopleFile(asFile(new Uint8Array([1, 2]), 'people.xls'))).rejects.toBeInstanceOf(UnsupportedFileError);
  });
});

describe('generated sheets', () => {
  it('invite sheet round-trips Arabic names and carries personal links', async () => {
    const invites = [
      { name: 'يوسف نجيب', email: 'yusuf@acme.com', team: 'العمليات', role: 'manager', token: 'aaaabbbbccccdddd', status: 'pending' },
      { name: 'Omar HR', email: 'omar@acme.com', team: null, role: 'hr_admin', token: 'eeeeffff00001111', status: 'joined' },
    ];
    const blob = await inviteSheetBlob(invites, { origin: 'http://localhost:5173', lang: 'en' });
    const rows = await readSheet(blob);
    expect(rows).toEqual([
      ['name', 'email', 'team', 'role', 'link', 'status'],
      ['يوسف نجيب', 'yusuf@acme.com', 'العمليات', 'manager', 'http://localhost:5173/?invite=aaaabbbbccccdddd', 'pending'],
      ['Omar HR', 'omar@acme.com', null, 'hr_admin', 'http://localhost:5173/hr.html?invite=eeeeffff00001111', 'joined'],
    ]);
  });

  it('Arabic invite sheet can be uploaded again as an import', async () => {
    const blob = await inviteSheetBlob(
      [{ name: 'نادية كامل', email: 'nadia@acme.com', team: '', role: 'hr_admin', token: 'aaaabbbbccccdddd', status: 'pending' }],
      { origin: 'http://localhost:5173', lang: 'ar' },
    );
    const { records } = sheetToRecords(await readSheet(blob));
    expect(validateImportRows(records).ready).toEqual([
      { row: 2, name: 'نادية كامل', email: 'nadia@acme.com', team: '', role: 'hr_admin' },
    ]);
  });

  it('template has the import columns on its first sheet', async () => {
    for (const lang of ['en', 'ar']) {
      const rows = await readSheet(await templateBlob(lang));
      expect(rows).toEqual([sheetHeaders(lang)]);
      expect(sheetToRecords(rows).missingColumns).toEqual([]);
    }
  });
});
