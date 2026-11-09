// HR's own articles and facts (save_content_item): form, validation, input.
import { clean, orNull, msg } from './text.js';

export const CONTENT_CATEGORIES = [
  { id: 'general', en: 'General', ar: 'عام' },
  { id: 'movement', en: 'Movement', ar: 'حركة' },
  { id: 'stress', en: 'Stress', ar: 'التوتر' },
  { id: 'sleep', en: 'Sleep', ar: 'النوم' },
  { id: 'energy', en: 'Energy', ar: 'الطاقة' },
  { id: 'mindfulness', en: 'Mindfulness', ar: 'الهدوء والتركيز' },
  { id: 'nutrition', en: 'Food', ar: 'الأكل' },
];
export const CONTENT_LIMITS = { title: 160, fact: 300, body: 30000, description: 300 };

export function categoryLabel(id, lang) {
  const c = CONTENT_CATEGORIES.find((x) => x.id === id) || CONTENT_CATEGORIES[0];
  return lang === 'ar' ? c.ar : c.en;
}

export function emptyContentForm(kind = 'article') {
  return {
    id: null, kind, title_en: '', title_ar: '', description_en: '', description_ar: '',
    body_en: '', body_ar: '', category: 'general',
  };
}

export function contentToForm(item) {
  if (!item) return emptyContentForm();
  return {
    id: item.id || null,
    kind: item.kind === 'fact' ? 'fact' : 'article',
    title_en: item.title_en || '', title_ar: item.title_ar || '',
    description_en: item.description_en || '', description_ar: item.description_ar || '',
    body_en: item.body_en || '', body_ar: item.body_ar || '',
    category: CONTENT_CATEGORIES.some((c) => c.id === item.category) ? item.category : 'general',
  };
}

// Reading time at ~200 words a minute, at least 1.
export function readingMinutes(...texts) {
  const words = texts.map((t) => clean(t).split(/\s+/).filter(Boolean).length);
  return Math.max(1, Math.round(Math.max(0, ...words) / 200));
}

export function validateContentForm(form) {
  const f = form || {};
  const e = {};
  if (!clean(f.title_en)) e.title_en = msg('Add the title in English.', 'اكتب العنوان بالإنجليزي.');
  else if (clean(f.title_en).length > CONTENT_LIMITS.title) e.title_en = msg('That title is too long.', 'العنوان طويل.');
  if (clean(f.title_ar).length > CONTENT_LIMITS.title) e.title_ar = msg('That title is too long.', 'العنوان طويل.');
  if (!clean(f.body_en) && !clean(f.body_ar)) {
    e.body_en = f.kind === 'fact' ? msg('Write the fact.', 'اكتب المعلومة.') : msg('Write the article.', 'اكتب المقال.');
  }
  const max = f.kind === 'fact' ? CONTENT_LIMITS.fact : CONTENT_LIMITS.body;
  for (const k of ['body_en', 'body_ar']) {
    if (clean(f[k]).length > max) {
      e[k] = f.kind === 'fact'
        ? msg(`Keep a fact under ${max} characters.`, `خلي المعلومة أقل من ${max} حرف.`)
        : msg('That text is too long.', 'النص ده طويل.');
    }
  }
  return e;
}

// Form → save_content_item input with the status to save.
export function buildContentInput(form, status) {
  const errors = validateContentForm(form);
  if (Object.keys(errors).length) {
    throw Object.assign(new Error('invalid_form'), { name: 'FormError', fieldErrors: errors });
  }
  const fact = form.kind === 'fact';
  const input = {
    kind: fact ? 'fact' : 'article',
    title_en: clean(form.title_en),
    title_ar: orNull(form.title_ar),
    description_en: fact ? null : orNull(form.description_en),
    description_ar: fact ? null : orNull(form.description_ar),
    body_en: orNull(form.body_en),
    body_ar: orNull(form.body_ar),
    category: form.category || 'general',
    duration_mins: fact ? 1 : readingMinutes(form.body_en, form.body_ar),
    status: status === 'published' ? 'published' : 'draft',
  };
  if (form.id) input.id = form.id;
  return input;
}
