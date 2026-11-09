// People import, invite sheet and join links — pure helpers (no React, no
// Supabase) shared by the HR portal and the Wellness House admin portal.
//
// The server (import_people) re-validates every row with the same rules; this
// copy exists so the preview can show problems before anything is written.

export const ROLES = ['employee', 'manager', 'hr_admin'];
export const MAX_IMPORT_ROWS = 2000;
export const MAX_NAME = 120;
export const MAX_TEAM = 80;
// Same shape as the SQL check in import_people().
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s.]+$/;

// ── text helpers ─────────────────────────────────────────────

// Lowercase, trim, drop BOM / zero-width / tatweel, fold _ and - to spaces.
function norm(v) {
  return String(v ?? '')
    .replace(/[﻿​-‏ـ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

// Arabic letter variants people type interchangeably (أ/إ/آ → ا, ؤ/ئ → ء, ة → ه, ى → ي).
function foldArabic(s) {
  return s.replace(/[أإآ]/g, 'ا').replace(/[ؤئ]/g, 'ء').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
}

const key = (v) => foldArabic(norm(v));

export function cellText(v) {
  if (v == null) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  return String(v).replace(/[﻿​-‏]/g, '').replace(/\s+/g, ' ').trim();
}

// ── header + role aliases (EN / AR) ──────────────────────────

const HEADER_ALIASES = {
  name:  ['name', 'full name', 'employee name', 'display name', 'الاسم', 'الاسم الكامل', 'اسم', 'اسم الموظف'],
  email: ['email', 'e mail', 'email address', 'work email', 'mail', 'البريد', 'البريد الإلكتروني', 'الإيميل', 'البريد الالكتروني'],
  team:  ['team', 'team name', 'department', 'dept', 'الفريق', 'القسم', 'الإدارة', 'اسم الفريق'],
  role:  ['role', 'الدور', 'الصلاحية', 'الوظيفة'],
};

const ROLE_ALIASES = {
  employee: ['employee', 'staff', 'member', 'موظف', 'موظفة', 'عضو'],
  manager:  ['manager', 'team manager', 'team lead', 'lead', 'مدير', 'مديرة', 'مدير فريق', 'مدير الفريق', 'قائد فريق'],
  hr_admin: ['hr admin', 'hr', 'admin', 'company admin', 'hr manager',
             'مسؤول الموارد البشرية', 'مسؤول موارد بشرية', 'موارد بشرية', 'الموارد البشرية',
             'مدير الموارد البشرية', 'مسؤول', 'ادمن'],
};

const HEADER_LOOKUP = new Map();
for (const [field, list] of Object.entries(HEADER_ALIASES)) for (const a of list) HEADER_LOOKUP.set(key(a), field);
const ROLE_LOOKUP = new Map();
for (const [role, list] of Object.entries(ROLE_ALIASES)) for (const a of list) ROLE_LOOKUP.set(key(a), role);

export function headerField(cell) {
  const k = key(cellText(cell));
  if (HEADER_LOOKUP.has(k)) return HEADER_LOOKUP.get(k);
  // "name / الاسم", "email (required)" → try each part.
  for (const part of k.split(/[\/|()]/)) {
    const p = part.trim();
    if (p && HEADER_LOOKUP.has(p)) return HEADER_LOOKUP.get(p);
  }
  return null;
}

// '' → employee (the default). Unknown → null.
export function normalizeRole(value) {
  const k = key(cellText(value));
  if (k === '') return 'employee';
  return ROLE_LOOKUP.get(k) ?? null;
}

// ── CSV ──────────────────────────────────────────────────────

// Excel's "CSV UTF-8" carries a BOM; plain "CSV" on an Arabic Windows box is
// windows-1256, and "Unicode text" is UTF-16LE. Decode all three.
export function decodeCsvBytes(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return new TextDecoder('utf-8').decode(bytes.subarray(3));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    try { return new TextDecoder('windows-1256').decode(bytes); }
    catch { return new TextDecoder('utf-8').decode(bytes); }
  }
}

function detectDelimiter(text) {
  const firstLine = text.slice(0, Math.max(0, text.search(/\r?\n/)) || text.length);
  let best = ',', bestCount = 0;
  for (const d of [',', ';', '\t']) {
    let n = 0, quoted = false;
    for (const ch of firstLine) {
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) n += 1;
    }
    if (n > bestCount) { best = d; bestCount = n; }
  }
  return best;
}

// RFC 4180: quoted fields, "" escapes, newlines inside quotes, CRLF / LF.
export function parseCsv(text, delimiter) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const d = delimiter || detectDelimiter(src);
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === d) {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ── sheet rows → records ─────────────────────────────────────

const isBlankRow = (r) => !r || r.every((c) => cellText(c) === '');

// rows: array of arrays (first non-blank row = headers). Returns records with
// the spreadsheet row number (1-based, header included) so problems can point
// at the exact line in Excel.
export function sheetToRecords(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const headerAt = list.findIndex((r) => !isBlankRow(r));
  if (headerAt === -1) return { records: [], missingColumns: ['email'], columns: {} };

  const columns = {};
  list[headerAt].forEach((cell, idx) => {
    const f = headerField(cell);
    if (f && columns[f] == null) columns[f] = idx;
  });
  const missingColumns = columns.email == null ? ['email'] : [];

  const records = [];
  for (let i = headerAt + 1; i < list.length; i += 1) {
    const r = list[i];
    if (isBlankRow(r)) continue;
    const at = (f) => (columns[f] == null ? '' : cellText(r[columns[f]]));
    records.push({ row: i + 1, name: at('name'), email: at('email'), team: at('team'), role: at('role') });
  }
  return { records, missingColumns, columns };
}

// ── validation ───────────────────────────────────────────────

// Same matching as the server: trimmed, whitespace collapsed, case-insensitive.
const teamKey = (v) => cellText(v).toLowerCase();

export function validateImportRows(records, { existingTeams = [] } = {}) {
  const known = new Map();
  for (const t of existingTeams) {
    const name = typeof t === 'string' ? t : t?.name;
    if (name) known.set(teamKey(name), name);
  }
  const ready = [];
  const problems = [];
  const seen = new Set();
  const newTeams = new Map();
  const byRole = { employee: 0, manager: 0, hr_admin: 0 };

  for (const rec of records || []) {
    const name = cellText(rec.name);
    const email = cellText(rec.email).toLowerCase();
    const team = cellText(rec.team);
    const rawRole = cellText(rec.role);
    const role = normalizeRole(rawRole);
    const row = rec.row;

    let reason = null;
    if (!email) reason = 'missing_email';
    else if (email.length > 254 || !EMAIL_RE.test(email)) reason = 'invalid_email';
    else if (!role) reason = 'unknown_role';
    else if (!team && role !== 'hr_admin') reason = 'missing_team';
    else if (name.length > MAX_NAME) reason = 'name_too_long';
    else if (team.length > MAX_TEAM) reason = 'team_too_long';
    else if (seen.has(email)) reason = 'duplicate_in_file';

    if (reason) {
      problems.push({ row, email, reason, value: reason === 'unknown_role' ? rawRole : undefined });
      continue;
    }
    seen.add(email);
    byRole[role] += 1;
    if (team) {
      const k = teamKey(team);
      if (!known.has(k) && !newTeams.has(k)) newTeams.set(k, team);
    }
    ready.push({ row, name, email, team, role });
  }

  return {
    ready,
    problems,
    newTeams: Array.from(newTeams.values()),
    tooMany: ready.length > MAX_IMPORT_ROWS,
    counts: { total: ready.length + problems.length, ready: ready.length, problems: problems.length, byRole },
  };
}

// ── links ────────────────────────────────────────────────────

const trimSlash = (origin) => String(origin || '').replace(/\/+$/, '');

export function buildJoinLink(origin, code) {
  return `${trimSlash(origin)}/?code=${encodeURIComponent(String(code || '').trim().toUpperCase())}`;
}

// HR admins sign up in the HR portal; everyone else in the employee app.
export function buildInviteLink(origin, token, role) {
  const page = role === 'hr_admin' || role === 'company_admin' ? '/hr.html' : '/';
  return `${trimSlash(origin)}${page}?invite=${encodeURIComponent(token || '')}`;
}

const CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,31}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{8,128}$/;

export function readJoinParams(search) {
  const q = new URLSearchParams(search || '');
  const code = (q.get('code') || '').trim().toUpperCase();
  const invite = (q.get('invite') || '').trim();
  return {
    code: CODE_RE.test(code) ? code : '',
    invite: TOKEN_RE.test(invite) ? invite : '',
  };
}

// ── labels (EN / AR) ─────────────────────────────────────────

const pick = (pair, lang) => (lang === 'ar' ? pair[1] : pair[0]);

export const REASON_LABELS = {
  missing_email:     ['Email is missing', 'البريد الإلكتروني ناقص'],
  invalid_email:     ['Not a valid email', 'بريد إلكتروني غير صالح'],
  unknown_role:      ['Unknown role — use employee, manager or hr_admin', 'دور غير معروف — استخدم موظف أو مدير أو مسؤول الموارد البشرية'],
  missing_team:      ['Team is missing', 'الفريق ناقص'],
  name_too_long:     ['Name is longer than 120 characters', 'الاسم أطول من ١٢٠ حرفًا'],
  team_too_long:     ['Team name is longer than 80 characters', 'اسم الفريق أطول من ٨٠ حرفًا'],
  duplicate_in_file: ['Same email appears earlier in the file', 'نفس البريد موجود في صف سابق'],
  other_company:     ['Already belongs to another company', 'مرتبط بشركة أخرى'],
  account_deleted:   ['This account was deleted', 'هذا الحساب محذوف'],
  invalid_row:       ['Row could not be read', 'تعذّرت قراءة الصف'],
  try_again:         ['Changed while importing — import again', 'تغيّر أثناء الاستيراد — أعد الاستيراد'],
};

export function reasonLabel(reason, lang) {
  return REASON_LABELS[reason] ? pick(REASON_LABELS[reason], lang) : String(reason || '');
}

// HR admin and company admin are one role in the UI.
const ROLE_LABELS = {
  employee:       ['Employee', 'موظف'],
  manager:        ['Manager', 'مدير'],
  hr_admin:       ['HR admin', 'مسؤول الموارد البشرية'],
  company_admin:  ['HR admin', 'مسؤول الموارد البشرية'],
  wellness_admin: ['Wellness House admin', 'مسؤول Wellness House'],
};

export function roleLabel(role, lang) {
  return ROLE_LABELS[role] ? pick(ROLE_LABELS[role], lang) : String(role || '');
}

const STATUS_LABELS = {
  joined:  ['Joined', 'انضم'],
  pending: ['Pending', 'لم ينضم بعد'],
  expired: ['Expired', 'انتهت الدعوة'],
};

export function statusLabel(status, lang) {
  return STATUS_LABELS[status] ? pick(STATUS_LABELS[status], lang) : String(status || '');
}

// ── sheet contents ───────────────────────────────────────────

export function sheetHeaders(lang) {
  return lang === 'ar'
    ? ['الاسم', 'البريد الإلكتروني', 'الفريق', 'الدور']
    : ['name', 'email', 'team', 'role'];
}

// Roles go out as values the importer reads back (canonical in EN, the Arabic
// label in AR — both map back through normalizeRole).
function roleCell(role, lang) {
  return lang === 'ar' ? roleLabel(role, 'ar') : (role === 'company_admin' ? 'hr_admin' : role);
}

export function templateHelpRows(lang) {
  const ar = lang === 'ar';
  return [
    [ar ? 'العمود' : 'column', ar ? 'المطلوب' : 'what to put'],
    [sheetHeaders(lang)[0], ar ? 'اسم الموظف (اختياري، بالعربي أو الإنجليزي)' : 'Full name (optional, Arabic or English)'],
    [sheetHeaders(lang)[1], ar ? 'البريد الإلكتروني للعمل — مطلوب، مرة واحدة لكل شخص' : 'Work email — required, once per person'],
    [sheetHeaders(lang)[2], ar ? 'اسم الفريق — مطلوب إلا لمسؤول الموارد البشرية. الفرق الجديدة تُنشأ تلقائيًا' : 'Team name — required except for HR admins. New teams are created for you'],
    [sheetHeaders(lang)[3], ar ? 'موظف أو مدير أو مسؤول الموارد البشرية (فارغ = موظف)' : 'employee, manager or hr_admin (blank = employee)'],
    [],
    [ar ? 'مثال' : 'example'],
    sheetHeaders(lang),
    ar ? ['أميرة حسن', 'amira@company.com', 'المبيعات', 'موظف'] : ['Amira Hassan', 'amira@company.com', 'Sales', 'employee'],
    ar ? ['عمر سامي', 'omar@company.com', 'المبيعات', 'مدير'] : ['Omar Sami', 'omar@company.com', 'Sales', 'manager'],
    ar ? ['نادية كامل', 'nadia@company.com', '', 'مسؤول الموارد البشرية'] : ['Nadia Kamel', 'nadia@company.com', '', 'hr_admin'],
  ];
}

// invites: rows from list_people_invites().
export function inviteSheetRows(invites, { origin, lang } = {}) {
  const ar = lang === 'ar';
  const header = [...sheetHeaders(lang), ar ? 'رابط الدعوة' : 'link', ar ? 'الحالة' : 'status'];
  const body = (invites || []).map((i) => [
    i.name || '',
    i.email || '',
    i.team || '',
    roleCell(i.role, lang),
    i.token ? buildInviteLink(origin, i.token, i.role) : '',
    ar ? statusLabel(i.status, 'ar') : (i.status || ''),
  ]);
  return [header, ...body];
}

export function countByStatus(invites) {
  const out = { joined: 0, pending: 0, expired: 0 };
  for (const i of invites || []) if (out[i.status] != null) out[i.status] += 1;
  return out;
}

export function sheetFileName(prefix, companyName, date = new Date()) {
  const slug = String(companyName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${prefix}${slug ? `-${slug}` : ''}-${date.toISOString().slice(0, 10)}.xlsx`;
}
