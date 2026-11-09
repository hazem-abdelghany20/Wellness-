import { describe, it, expect } from 'vitest';
import {
  parseCsv, decodeCsvBytes, sheetToRecords, normalizeRole, validateImportRows,
  buildJoinLink, buildInviteLink, readJoinParams, inviteSheetRows, sheetHeaders,
  countByStatus, roleLabel, reasonLabel, MAX_IMPORT_ROWS,
} from '../people-import.js';

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas and newlines inside quotes, CRLF and a BOM', () => {
    const text = '﻿name,email,team,role\r\n"Hassan, Amira",amira@acme.com,"Sales ""East""",employee\r\n"Two\nLines",two@acme.com,Ops,\r\n';
    expect(parseCsv(text)).toEqual([
      ['name', 'email', 'team', 'role'],
      ['Hassan, Amira', 'amira@acme.com', 'Sales "East"', 'employee'],
      ['Two\nLines', 'two@acme.com', 'Ops', ''],
    ]);
  });

  it('detects semicolon and tab delimiters (Excel in Arabic / European locales)', () => {
    expect(parseCsv('name;email\nLina;lina@acme.com')).toEqual([['name', 'email'], ['Lina', 'lina@acme.com']]);
    expect(parseCsv('name\temail\nLina\tlina@acme.com')).toEqual([['name', 'email'], ['Lina', 'lina@acme.com']]);
  });

  it('keeps a last line without a trailing newline', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('decodeCsvBytes', () => {
  it('decodes UTF-8 with a BOM (Excel "CSV UTF-8") with Arabic intact', () => {
    const bytes = new Uint8Array([0xEF, 0xBB, 0xBF, ...new TextEncoder().encode('الاسم,email\nيوسف نجيب,y@acme.com')]);
    expect(decodeCsvBytes(bytes)).toBe('الاسم,email\nيوسف نجيب,y@acme.com');
  });

  it('falls back to windows-1256 for a plain Arabic-Windows CSV', () => {
    // "يوسف" in windows-1256
    const bytes = new Uint8Array([0xED, 0xE6, 0xD3, 0xDD, 0x2C, 0x61]);
    expect(decodeCsvBytes(bytes)).toBe('يوسف,a');
  });

  it('decodes UTF-16LE ("Unicode text")', () => {
    const s = 'name\tيوسف';
    const buf = new Uint8Array(2 + s.length * 2);
    buf[0] = 0xFF; buf[1] = 0xFE;
    for (let i = 0; i < s.length; i += 1) { const c = s.charCodeAt(i); buf[2 + i * 2] = c & 0xFF; buf[3 + i * 2] = c >> 8; }
    expect(decodeCsvBytes(buf)).toBe(s);
  });
});

describe('sheetToRecords', () => {
  it('maps English headers in any order/case and keeps spreadsheet row numbers', () => {
    const { records, missingColumns } = sheetToRecords([
      [],
      ['Email', 'Role', 'Full Name', 'Department'],
      ['a@acme.com', 'manager', 'Amira', 'Sales'],
      ['', '', '', ''],
      ['b@acme.com', null, 'Badr', 'Ops'],
    ]);
    expect(missingColumns).toEqual([]);
    expect(records).toEqual([
      { row: 3, name: 'Amira', email: 'a@acme.com', team: 'Sales', role: 'manager' },
      { row: 5, name: 'Badr', email: 'b@acme.com', team: 'Ops', role: '' },
    ]);
  });

  it('maps the Arabic template headers', () => {
    const { records } = sheetToRecords([
      sheetHeaders('ar'),
      ['يوسف نجيب', 'y@acme.com', 'العمليات', 'مدير'],
    ]);
    expect(records[0]).toEqual({ row: 2, name: 'يوسف نجيب', email: 'y@acme.com', team: 'العمليات', role: 'مدير' });
  });

  it('accepts "name / الاسم"-style bilingual headers', () => {
    const { records } = sheetToRecords([['name / الاسم', 'email (required)'], ['Lina', 'l@acme.com']]);
    expect(records[0]).toMatchObject({ name: 'Lina', email: 'l@acme.com' });
  });

  it('reports a missing email column', () => {
    expect(sheetToRecords([['name', 'team'], ['Lina', 'Ops']]).missingColumns).toEqual(['email']);
    expect(sheetToRecords([]).missingColumns).toEqual(['email']);
  });

  it('turns numbers and dates into text', () => {
    const { records } = sheetToRecords([['email', 'team'], ['n@acme.com', 42]]);
    expect(records[0].team).toBe('42');
  });
});

describe('normalizeRole', () => {
  it('maps EN / AR aliases and treats blank as employee', () => {
    expect(normalizeRole('')).toBe('employee');
    expect(normalizeRole('Employee')).toBe('employee');
    expect(normalizeRole('موظف')).toBe('employee');
    expect(normalizeRole('Manager')).toBe('manager');
    expect(normalizeRole('مدير')).toBe('manager');
    expect(normalizeRole('HR_Admin')).toBe('hr_admin');
    expect(normalizeRole('hr-admin')).toBe('hr_admin');
    expect(normalizeRole('company_admin')).toBe('hr_admin');
    expect(normalizeRole('مسؤول الموارد البشرية')).toBe('hr_admin');
    expect(normalizeRole('مسئول')).toBe('hr_admin'); // ئ / ؤ spelling variants
    expect(normalizeRole('أدمن')).toBe('hr_admin');
    expect(normalizeRole('ceo')).toBe(null);
  });
});

describe('validateImportRows', () => {
  const rec = (row, email, team = 'Sales', role = 'employee', name = 'X') => ({ row, name, email, team, role });

  it('flags bad and missing emails', () => {
    const { problems, ready } = validateImportRows([
      rec(2, 'not-an-email'), rec(3, 'a@b'), rec(4, ''), rec(5, 'ok@acme.com'),
    ]);
    expect(problems).toEqual([
      { row: 2, email: 'not-an-email', reason: 'invalid_email', value: undefined },
      { row: 3, email: 'a@b', reason: 'invalid_email', value: undefined },
      { row: 4, email: '', reason: 'missing_email', value: undefined },
    ]);
    expect(ready.map((r) => r.email)).toEqual(['ok@acme.com']);
  });

  it('flags duplicates case-insensitively and keeps the first', () => {
    const { problems, ready } = validateImportRows([rec(2, 'Amira@Acme.com'), rec(3, ' amira@acme.com ')]);
    expect(ready).toEqual([{ row: 2, name: 'X', email: 'amira@acme.com', team: 'Sales', role: 'employee' }]);
    expect(problems).toEqual([{ row: 3, email: 'amira@acme.com', reason: 'duplicate_in_file', value: undefined }]);
  });

  it('flags an unknown role and says what was typed', () => {
    const { problems } = validateImportRows([rec(2, 'a@acme.com', 'Sales', 'CEO')]);
    expect(problems).toEqual([{ row: 2, email: 'a@acme.com', reason: 'unknown_role', value: 'CEO' }]);
  });

  it('requires a team except for HR admins', () => {
    const { problems, ready } = validateImportRows([
      rec(2, 'emp@acme.com', ''), rec(3, 'mgr@acme.com', '  ', 'manager'), rec(4, 'hr@acme.com', '', 'hr_admin'),
    ]);
    expect(problems.map((p) => [p.row, p.reason])).toEqual([[2, 'missing_team'], [3, 'missing_team']]);
    expect(ready).toEqual([{ row: 4, name: 'X', email: 'hr@acme.com', team: '', role: 'hr_admin' }]);
  });

  it('lists only teams that do not exist yet (case / spacing-insensitive)', () => {
    const { newTeams } = validateImportRows(
      [rec(2, 'a@acme.com', 'sales'), rec(3, 'b@acme.com', 'Customer  Care'), rec(4, 'c@acme.com', 'customer care'), rec(5, 'd@acme.com', 'العمليات')],
      { existingTeams: [{ id: 't1', name: 'Sales' }] },
    );
    expect(newTeams).toEqual(['Customer Care', 'العمليات']);
  });

  it('counts roles and rejects over-long names', () => {
    const { counts, problems } = validateImportRows([
      rec(2, 'a@acme.com', 'Sales', ''), rec(3, 'b@acme.com', 'Sales', 'manager'), rec(4, 'c@acme.com', '', 'hr_admin'),
      rec(5, 'd@acme.com', 'Sales', 'employee', 'x'.repeat(121)),
    ]);
    expect(counts).toEqual({ total: 4, ready: 3, problems: 1, byRole: { employee: 1, manager: 1, hr_admin: 1 } });
    expect(problems[0].reason).toBe('name_too_long');
  });

  it('marks files over the row limit', () => {
    const many = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => rec(i + 2, `p${i}@acme.com`));
    expect(validateImportRows(many).tooMany).toBe(true);
    expect(validateImportRows(many.slice(0, 500)).tooMany).toBe(false);
  });

  it('keeps Arabic names and teams as typed', () => {
    const { ready } = validateImportRows([{ row: 2, name: 'يوسف  نجيب', email: 'y@acme.com', team: 'العمليات', role: 'مدير' }]);
    expect(ready[0]).toEqual({ row: 2, name: 'يوسف نجيب', email: 'y@acme.com', team: 'العمليات', role: 'manager' });
  });
});

describe('links', () => {
  it('builds the company join link from the origin', () => {
    expect(buildJoinLink('https://main.d1c79md4n000h6.amplifyapp.com', 'ab-1234')).toBe('https://main.d1c79md4n000h6.amplifyapp.com/?code=AB-1234');
    expect(buildJoinLink('http://localhost:5173/', 'WH-4782')).toBe('http://localhost:5173/?code=WH-4782');
  });

  it('sends HR admins to the HR portal and everyone else to the employee app', () => {
    const o = 'https://main.d1c79md4n000h6.amplifyapp.com';
    expect(buildInviteLink(o, 'abc123def456', 'employee')).toBe(`${o}/?invite=abc123def456`);
    expect(buildInviteLink(o, 'abc123def456', 'manager')).toBe(`${o}/?invite=abc123def456`);
    expect(buildInviteLink(o, 'abc123def456', 'hr_admin')).toBe(`${o}/hr.html?invite=abc123def456`);
    expect(buildInviteLink('http://localhost:5173', 'abc123def456', 'company_admin')).toBe('http://localhost:5173/hr.html?invite=abc123def456');
  });

  it('reads ?code= and ?invite= and drops junk', () => {
    expect(readJoinParams('?code=ab-1234&invite=0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c')).toEqual({ code: 'AB-1234', invite: '0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c' });
    expect(readJoinParams('')).toEqual({ code: '', invite: '' });
    expect(readJoinParams('?code=<script>&invite=short')).toEqual({ code: '', invite: '' });
  });
});

describe('invite sheet rows', () => {
  const invites = [
    { name: 'يوسف نجيب', email: 'y@acme.com', team: 'العمليات', role: 'manager', token: 'tok1tok1tok1', status: 'pending' },
    { name: 'Omar HR', email: 'o@acme.com', team: null, role: 'hr_admin', token: 'tok2tok2tok2', status: 'joined' },
  ];

  it('writes name, email, team, role, personal link, status (EN)', () => {
    const rows = inviteSheetRows(invites, { origin: 'http://localhost:5173', lang: 'en' });
    expect(rows).toEqual([
      ['name', 'email', 'team', 'role', 'link', 'status'],
      ['يوسف نجيب', 'y@acme.com', 'العمليات', 'manager', 'http://localhost:5173/?invite=tok1tok1tok1', 'pending'],
      ['Omar HR', 'o@acme.com', '', 'hr_admin', 'http://localhost:5173/hr.html?invite=tok2tok2tok2', 'joined'],
    ]);
  });

  it('uses Arabic headers/labels in AR that the importer reads back', () => {
    const rows = inviteSheetRows(invites, { origin: 'http://localhost:5173', lang: 'ar' });
    expect(rows[0][0]).toBe('الاسم');
    const { records } = sheetToRecords(rows);
    const { ready } = validateImportRows(records);
    expect(ready.map((r) => [r.email, r.role])).toEqual([['y@acme.com', 'manager'], ['o@acme.com', 'hr_admin']]);
  });

  it('counts statuses', () => {
    expect(countByStatus([...invites, { status: 'expired' }])).toEqual({ joined: 1, pending: 1, expired: 1 });
  });
});

describe('labels', () => {
  it('labels HR admin and company admin the same', () => {
    expect(roleLabel('company_admin', 'en')).toBe('HR admin');
    expect(roleLabel('hr_admin', 'en')).toBe('HR admin');
    expect(roleLabel('company_admin', 'ar')).toBe(roleLabel('hr_admin', 'ar'));
  });

  it('has an Arabic text for every problem reason', () => {
    for (const r of ['missing_email', 'invalid_email', 'unknown_role', 'missing_team', 'duplicate_in_file', 'other_company', 'account_deleted']) {
      expect(reasonLabel(r, 'ar')).not.toBe(reasonLabel(r, 'en'));
      expect(reasonLabel(r, 'ar')).toMatch(/[؀-ۿ]/);
    }
  });
});
