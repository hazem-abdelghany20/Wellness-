// Friendly error messages for backend failures the user might see in a toast
// or inline status line. Strips PostgREST internals (table names, policy
// names, SQLSTATE codes) and maps known patterns to human copy.

export interface FriendlyError {
  message: string;
  // The original error string, retained so the dev console / Sentry still
  // carries the full context even though the UI shows the friendly text.
  raw: string;
}

export function friendlyError(err: unknown): FriendlyError {
  const raw = err instanceof Error
    ? (err.message || err.toString())
    : typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message)
        : JSON.stringify(err);

  // Sprint 2 library / routine codes (before the generic permission rule:
  // public_item_read_only also carries SQLSTATE 42501).
  if (/public_item_read_only/i.test(raw)) {
    return { message: 'That item is in the Wellness House library. Use a copy to change it.', raw };
  }
  if (/item_not_due_today/i.test(raw)) {
    return { message: 'That item isn’t on today’s list any more. Pull to refresh.', raw };
  }
  if (/\btoo_large\b|exceeded the maximum allowed size|Payload too large/i.test(raw)) {
    return { message: 'That file is over 50 MB. Export it at 720p or paste a YouTube link.', raw };
  }
  if (/\bbad_type\b|invalid_mime_type|mime type .* is not supported/i.test(raw)) {
    return { message: 'Use an MP4 or MOV video, or a PNG or JPEG picture.', raw };
  }
  if (/starts_in_the_past/i.test(raw)) {
    return { message: 'Pick today or a later date.', raw };
  }
  if (/already_assigned/i.test(raw)) {
    return { message: 'Those people already have this routine for those dates.', raw };
  }

  // Sprint 3: teams, broadcasts, push (before the generic rules below:
  // protected_role carries 42501, team_name_taken 23505).
  if (/protected_role/i.test(raw)) {
    return { message: 'HR and admin accounts can’t be changed here.', raw };
  }
  if (/team_name_taken/i.test(raw)) {
    return { message: 'There’s already a team with that name.', raw };
  }
  if (/team_not_empty/i.test(raw)) {
    return { message: 'This team still has people in it. Move them to “No team” first.', raw };
  }
  if (/team_in_use/i.test(raw)) {
    return { message: 'Something still runs for this team (a routine, challenge or message). End it first.', raw };
  }
  if (/person_has_no_team/i.test(raw)) {
    return { message: 'Put this person in a team first.', raw };
  }
  if (/broadcast_already_sent|broadcast_not_editable/i.test(raw)) {
    return { message: 'That message has already gone out.', raw };
  }
  if (/bad_audio_type/i.test(raw)) {
    return { message: 'Use an MP3 or M4A audio file.', raw };
  }
  if (/push_denied/i.test(raw)) {
    return { message: 'Notifications are blocked for this app. Allow them in your browser settings.', raw };
  }
  if (/push_unsupported/i.test(raw)) {
    const reason = err && typeof err === 'object' ? (err as { reason?: string }).reason : undefined;
    return reason === 'ios_needs_install'
      ? { message: 'Add Wellness+ to your Home Screen first, then turn reminders on there.', raw }
      : { message: 'This browser can’t show reminders. Try Chrome, or the app on your Home Screen.', raw };
  }
  if (/push_no_key|push_no_service_worker/i.test(raw)) {
    return { message: 'Reminders aren’t available in this version yet.', raw };
  }

  // RLS denial (raised either by PostgREST policy enforcement or RAISE EXCEPTION ERRCODE=42501).
  if (/row-level security policy/i.test(raw) || /42501/.test(raw) || /not_authorized/i.test(raw)) {
    return { message: "You don't have permission to do that.", raw };
  }

  if (/not_in_company/i.test(raw)) {
    return { message: 'Your account isn’t linked to a workspace yet.', raw };
  }

  if (/Edge Function returned a non-2xx/i.test(raw) || /FunctionsHttpError/i.test(raw)) {
    return { message: 'Something went wrong on the server. Please try again.', raw };
  }

  if (/duplicate key|conflict/i.test(raw)) {
    return { message: 'That already exists — try a different value.', raw };
  }

  if (/foreign key constraint/i.test(raw)) {
    return { message: 'That referenced item doesn’t exist yet — schedule it first, then try again.', raw };
  }

  if (/template_archived/i.test(raw)) {
    return { message: 'That challenge was archived. Pick another one.', raw };
  }

  if (/Failed to fetch|NetworkError|ECONNREFUSED/i.test(raw)) {
    return { message: 'Network problem — check your connection and try again.', raw };
  }

  // Default: trim PostgREST detail prefixes like `column "x" does not exist`.
  const cleaned = raw
    .replace(/^.*?: /, '')
    .replace(/\((?:SQLSTATE )?\d+\)/g, '')
    .trim();

  return { message: cleaned || 'Something went wrong.', raw };
}

// Bilingual variant used by HR/admin views.
export function friendlyErrorI18n(err: unknown, lang: 'en' | 'ar'): string {
  const { message } = friendlyError(err);
  if (lang !== 'ar') return message;
  const map: Record<string, string> = {
    "You don't have permission to do that.": 'ليست لديك صلاحية لتنفيذ هذا.',
    'Your account isn’t linked to a workspace yet.': 'حسابك غير مرتبط بمساحة عمل بعد.',
    'Something went wrong on the server. Please try again.': 'حدث خطأ في الخادم. حاول مرة أخرى.',
    'That already exists — try a different value.': 'موجود مسبقًا — جرّب قيمة مختلفة.',
    'That referenced item doesn’t exist yet — schedule it first, then try again.': 'العنصر المرتبط غير موجود بعد — قم بجدولته أولاً ثم حاول مرة أخرى.',
    'Network problem — check your connection and try again.': 'مشكلة في الشبكة — تحقق من الاتصال.',
    'That challenge was archived. Pick another one.': 'تمت أرشفة هذا التحدي. اختر تحديًا آخر.',
    'That item is in the Wellness House library. Use a copy to change it.': 'هذا العنصر من مكتبة Wellness House. استخدم نسخة منه لتعديله.',
    'That item isn’t on today’s list any more. Pull to refresh.': 'العنصر ده مبقاش في قائمة النهارده. حدّث الصفحة.',
    'That file is over 50 MB. Export it at 720p or paste a YouTube link.': 'الملف أكبر من ٥٠ ميجا. صدّره بجودة 720p أو حط لينك يوتيوب.',
    'Use an MP4 or MOV video, or a PNG or JPEG picture.': 'استخدم فيديو MP4 أو MOV، أو صورة PNG أو JPEG.',
    'Pick today or a later date.': 'اختر النهارده أو تاريخ بعده.',
    'Those people already have this routine for those dates.': 'الناس دول عندهم الروتين ده بالفعل في التواريخ دي.',
    'HR and admin accounts can’t be changed here.': 'حسابات الموارد البشرية والمسؤولين مينفعش تتغير من هنا.',
    'There’s already a team with that name.': 'فيه فريق بنفس الاسم ده.',
    'This team still has people in it. Move them to “No team” first.': 'الفريق ده لسه فيه ناس. انقلهم لـ«بدون فريق» الأول.',
    'Something still runs for this team (a routine, challenge or message). End it first.': 'فيه حاجة لسه شغالة للفريق ده (روتين أو تحدي أو رسالة). وقّفها الأول.',
    'Put this person in a team first.': 'حط الشخص ده في فريق الأول.',
    'That message has already gone out.': 'الرسالة دي اتبعتت خلاص.',
    'Use an MP3 or M4A audio file.': 'استخدم ملف صوت MP3 أو M4A.',
    'Notifications are blocked for this app. Allow them in your browser settings.': 'الإشعارات مقفولة للتطبيق ده. افتحها من إعدادات المتصفح.',
    'Add Wellness+ to your Home Screen first, then turn reminders on there.': 'ضيف Wellness+ للشاشة الرئيسية الأول، وبعدين شغّل التذكيرات من هناك.',
    'This browser can’t show reminders. Try Chrome, or the app on your Home Screen.': 'المتصفح ده مبيعرضش تذكيرات. جرّب Chrome أو التطبيق من الشاشة الرئيسية.',
    'Reminders aren’t available in this version yet.': 'التذكيرات مش متاحة في النسخة دي لسه.',
    'Something went wrong.': 'حدث خطأ ما.',
  };
  return map[message] || message;
}
