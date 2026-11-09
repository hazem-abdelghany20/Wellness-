// EN / AR copy for the error codes the sprint 2 SQL raises (see the header
// of src/lib/supabase-routines.ts). Codes errors.ts doesn't know yet are
// mapped here first; everything else falls through to friendlyErrorI18n().
import { friendlyErrorI18n } from '../../lib/errors';
import { msg } from './text.js';

const SETTING_LABELS = {
  recognition: msg('Recognition', 'التقدير'),
  weekly_habit_enabled: msg('Weekly habit', 'عادة الأسبوع'),
  hr_people_view: msg('Show names', 'إظهار الأسماء'),
  quiet_hours: msg('Quiet hours', 'ساعات الهدوء'),
  timezone: msg('Time zone', 'المنطقة الزمنية'),
  min_cohort: msg('Minimum group size', 'أقل عدد للمجموعة'),
};

const CODES = {
  name_required: msg('Add the name in English.', 'اكتب الاسم بالإنجليزي.'),
  title_required: msg('Add the name in English.', 'اكتب الاسم بالإنجليزي.'),
  title_too_long: msg('That name is too long.', 'الاسم ده طويل.'),
  body_required: msg('Write the text first.', 'اكتب النص الأول.'),
  body_too_long: msg('That text is too long.', 'النص ده طويل.'),
  fact_too_long: msg('Keep a fact under 300 characters.', 'خلي المعلومة أقل من ٣٠٠ حرف.'),
  action_required: msg('Write the daily action in English.', 'اكتب الفعل اليومي بالإنجليزي.'),
  bad_body_area: msg('Pick body areas from the list.', 'اختار منطقة الجسم من القائمة.'),
  bad_youtube_id: msg('That is not a YouTube video link.', 'ده مش لينك فيديو يوتيوب.'),
  bad_media_type: msg('Use a video, a picture or a YouTube link.', 'استخدم فيديو أو صورة أو لينك يوتيوب.'),
  bad_media_mime: msg('Use an MP4 or MOV video, or a PNG or JPEG picture.', 'استخدم فيديو MP4 أو MOV، أو صورة PNG أو JPEG.'),
  bad_media_bucket: msg('That file can’t be used here. Upload it again.', 'الملف ده مينفعش هنا. ارفعه تاني.'),
  media_path_required: msg('Upload the file again.', 'ارفع الملف تاني.'),
  media_path_outside_company: msg('That file belongs to another company. Upload it again.', 'الملف ده تبع شركة تانية. ارفعه تاني.'),
  bad_media_path: msg('Upload the file again.', 'ارفع الملف تاني.'),
  weekday_not_workday: msg('A row is set to a day that isn’t a workday.', 'فيه صف على يوم مش من أيام الشغل.'),
  item_title_required: msg('Every row needs an exercise or a step.', 'كل صف محتاج تمرين أو خطوة.'),
  too_many_items: msg('A routine can have up to 100 rows.', 'الروتين ممكن يكون فيه لحد ١٠٠ صف.'),
  bad_workdays: msg('Pick at least one workday.', 'اختار يوم شغل واحد على الأقل.'),
  bad_day_titles: msg('Keep each day focus under 60 characters.', 'خلي عنوان كل يوم أقل من ٦٠ حرف.'),
  bad_dates: msg('The end date must be on or after the start date.', 'تاريخ النهاية لازم يكون بعد البداية أو نفس اليوم.'),
  routine_not_published: msg('This routine is archived. Restore it first.', 'الروتين ده متأرشف. رجّعه الأول.'),
  routine_not_found: msg('That routine no longer exists.', 'الروتين ده مبقاش موجود.'),
  routine_not_in_company: msg('Use a copy of this routine first.', 'استخدم نسخة من الروتين ده الأول.'),
  exercise_not_found: msg('One of the exercises no longer exists. Pick another.', 'فيه تمرين مبقاش موجود. اختار غيره.'),
  exercise_not_in_company: msg('One of the exercises belongs to another company.', 'فيه تمرين تبع شركة تانية.'),
  item_not_found: msg('A row was removed meanwhile. Reload and try again.', 'فيه صف اتشال. حدّث الصفحة وجرّب تاني.'),
  team_not_found: msg('That team no longer exists.', 'الفريق ده مبقاش موجود.'),
  end_in_the_past: msg('Pick today or a later date.', 'اختار النهارده أو تاريخ بعده.'),
  assignment_not_found: msg('That assignment no longer exists.', 'التوزيع ده مبقاش موجود.'),
  bad_weeks: msg('Pick 1 to 4 weeks.', 'اختار من ١ لـ ٤ أسابيع.'),
  bad_success_days: msg('Days to win must fit inside the challenge.', 'أيام الفوز لازم تكون جوه مدة التحدي.'),
  template_not_found: msg('That challenge no longer exists.', 'التحدي ده مبقاش موجود.'),
  hide_public_items_only: msg('Only Wellness House items can be hidden. Archive your own instead.', 'تقدر تخفي عناصر Wellness House بس. أرشف عناصرك بدل كده.'),
  content_not_found: msg('That item no longer exists.', 'العنصر ده مبقاش موجود.'),
  bad_category: msg('Pick a category from the list.', 'اختار تصنيف من القائمة.'),
  bad_kind: msg('Pick article or fact.', 'اختار مقال أو معلومة.'),
  week_must_start_on_sunday: msg('A challenge week starts on a Sunday.', 'أسبوع التحدي بيبدأ يوم الأحد.'),
  week_in_the_past: msg('That week is already over. Pick a later one.', 'الأسبوع ده خلص. اختار أسبوع بعده.'),
  only_upcoming_can_be_cancelled: msg('Only a challenge that hasn’t started can be cancelled.', 'تقدر تلغي التحدي اللي لسه مابدأش بس.'),
  bad_period: msg('Pick a period from the list.', 'اختار فترة من القائمة.'),
  bad_scope: msg('Pick a library from the list.', 'اختار مكتبة من القائمة.'),
};

function rawOf(e) {
  if (!e) return '';
  if (typeof e === 'string') return e;
  return String(e.message || e.code || '');
}

// The code in an error ('name_required', 'invalid_setting', …) or ''.
export function errorCode(e) {
  const raw = rawOf(e);
  const m = raw.match(/\b(invalid_setting|unknown_setting|[a-z]+(?:_[a-z]+)+)\b/);
  return m ? m[1] : '';
}

// Message in the UI language for any library / routine / settings error.
export function libraryError(e, lang) {
  const raw = rawOf(e);
  const pick = (m) => (lang === 'ar' ? m.ar : m.en);
  if (/\binvalid_setting\b|\bunknown_setting\b/.test(raw)) {
    const label = SETTING_LABELS[String(e?.details || '').trim()];
    return label
      ? pick(msg(`That value isn’t allowed for “${label.en}”.`, `القيمة دي مش مسموحة في «${label.ar}».`))
      : pick(msg('That setting isn’t allowed.', 'الإعداد ده مش مسموح.'));
  }
  // public_item_read_only, starts_in_the_past, already_assigned, too_large,
  // bad_type: errors.ts already has copy for them.
  for (const [code, m] of Object.entries(CODES)) {
    if (new RegExp(`\\b${code}\\b`).test(raw)) return pick(m);
  }
  return friendlyErrorI18n(e, lang);
}

export const KNOWN_ERROR_CODES = Object.keys(CODES);
