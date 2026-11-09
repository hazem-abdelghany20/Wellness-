// Walkthrough steps for each role. `screen` is the portal's own screen / nav id.
// Managers use the employee app, so they get the employee tour.

export const EMPLOYEE_TOUR = [
  // Steps with `needs: 'routine'` only show when HR has given the person a
  // daily routine (the Today tab exists); the employee app filters them.
  {
    screen: 'today',
    needs: 'routine',
    title_en: 'What to do now',
    title_ar: 'تعمل إيه دلوقتي',
    body_en: 'Today shows your routine in time order. The highlighted one is next, and the ring shows how much is done.',
    body_ar: 'النهارده بيعرض الروتين بتاعك بالترتيب حسب الوقت. اللي متعلّم عليه هو اللي عليه الدور، والدايرة بتوريك خلّصت قد إيه.',
  },
  {
    screen: 'today',
    needs: 'routine',
    title_en: 'Watch, then tick',
    title_ar: 'اتفرّج، وبعدين علّم',
    body_en: 'Tap a row to watch how and read the steps. Tap the circle when you have done it; tap again to undo. Each one adds 2 points.',
    body_ar: 'دوس على أي سطر علشان تتفرّج إزاي وتقرا الخطوات. دوس على الدايرة لما تخلّصه، ودوس تاني لو عايز تتراجع. كل واحد بيزوّدك نقطتين.',
  },
  {
    screen: 'challenges',
    title_en: "This week's challenge",
    title_ar: 'تحدّي الأسبوع',
    body_en: 'One small habit, Sunday to Thursday. Tap "Did it today" when you have done it. Do it on 4 of the 5 days and you earn a reward.',
    body_ar: 'عادة صغيرة واحدة من الأحد للخميس. دوس "عملتها النهارده" لما تعملها. اعملها ٤ أيام من ٥ وتاخد مكافأة.',
  },
  {
    screen: 'library',
    title_en: 'From your company and Wellness House',
    title_ar: 'من شركتك ومن Wellness House',
    body_en: 'Posts and quick facts from your HR team come first, then short reads from Wellness House. Every article you finish adds 5 points.',
    body_ar: 'البوستات والمعلومات السريعة من الـ HR بتاعك الأول، وبعدها قراءات قصيرة من Wellness House. كل مقال تخلّصه بيزوّدك ٥ نقط.',
  },
  {
    screen: 'score',
    title_en: 'Your score, and the board',
    title_ar: 'نقطك، واللوحة',
    body_en: 'Only you see your points. If your company turns on the board, it shows teams, and names only of people who chose to show theirs.',
    body_ar: 'محدش غيرك بيشوف نقطك. ولو شركتك شغّلت اللوحة، بتعرض الفرق، والأسامي بس للي اختاروا يظهروها.',
  },
  {
    screen: 'profile',
    title_en: 'Privacy, language and help',
    title_ar: 'الخصوصية واللغة والمساعدة',
    body_en: 'Choose if your name shows on the board or your progress goes to HR. Switch to Arabic, and replay this tour or open the guide here.',
    body_ar: 'اختار لو اسمك يظهر على اللوحة أو تقدّمك يوصل للـ HR. غيّر اللغة، وأعد الجولة دي أو افتح الدليل من هنا.',
  },
];

export const HR_TOUR = [
  {
    screen: 'dashboard',
    title_en: 'Participation, not health data',
    title_ar: 'مشاركة، مش بيانات صحية',
    body_en: 'These numbers show who took part and what was read. Nothing about anyone\'s sleep, stress or mood ever reaches this portal.',
    body_ar: 'الأرقام دي بتوضح مين شارك وإيه اللي اتقرا. ولا أي حاجة عن نوم أو ضغط أو مزاج حد بتوصل للبوابة دي.',
  },
  {
    screen: 'people',
    title_en: 'Bring your people in',
    title_ar: 'ضيف موظفينك',
    body_en: 'Import a sheet of employees with their teams. Then download the invite sheet: every person gets a personal link you can share any way you like.',
    body_ar: 'ارفع شيت بالموظفين وفرقهم. وبعدها نزّل شيت الدعوات: كل شخص له لينك خاص تبعته بالطريقة اللي تناسبك.',
  },
  {
    screen: 'settings',
    title_en: "Your company's join link",
    title_ar: 'لينك الانضمام لشركتك',
    body_en: 'Anyone with this link joins your company. Put it in an email or a group chat, or print the QR code for the office.',
    body_ar: 'أي حد معاه اللينك ده بينضم لشركتك. حطه في إيميل أو جروب، أو اطبع الـ QR وحطه في المكتب.',
  },
  {
    screen: 'challenges',
    title_en: "Pick this week's habit",
    title_ar: 'اختار عادة الأسبوع',
    body_en: "Choose from Wellness House's challenges, for everyone or one team. If you don't pick, a default runs so the app is never empty.",
    body_ar: 'اختار من تحديات Wellness House، للكل أو لفريق واحد. ولو ما اخترتش، فيه تحدّي افتراضي بيشتغل علشان التطبيق عمره ما يبقى فاضي.',
  },
  {
    screen: 'content',
    title_en: 'Push a read',
    title_ar: 'رشّح مقال',
    body_en: 'Pin an article for everyone, for example before a busy season or Ramadan.',
    body_ar: 'ثبّت مقال للكل، مثلاً قبل موسم شغل تقيل أو قبل رمضان.',
  },
  {
    screen: 'gifts',
    title_en: 'Rewards',
    title_ar: 'المكافآت',
    body_en: 'People who complete a week earn a reward from your budget. You approve and track every claim here.',
    body_ar: 'اللي بيكمّل أسبوع بياخد مكافأة من الميزانية بتاعتك. ومن هنا بتوافق وتتابع كل طلب.',
  },
  {
    screen: 'broadcasts',
    title_en: 'Announcements',
    title_ar: 'الإعلانات',
    body_en: 'Send short messages in English and Arabic to everyone or one team. They respect quiet hours.',
    body_ar: 'ابعت رسايل قصيرة بالعربي والإنجليزي للكل أو لفريق. وبتحترم ساعات الهدوء.',
  },
];

export const ADMIN_TOUR = [
  {
    screen: 'overview',
    title_en: 'Every company in one place',
    title_ar: 'كل الشركات في مكان واحد',
    body_en: 'Seats, plans and activity for every company on Wellness+.',
    body_ar: 'المقاعد والباقات والنشاط لكل الشركات على \u2066Wellness+\u2069.',
  },
  {
    screen: 'tenants',
    title_en: 'Add a company',
    title_ar: 'ضيف شركة',
    body_en: "Create the company, then invite its HR admin. You get a personal sign-up link to send them. No email is needed.",
    body_ar: 'اعمل الشركة، وبعدها اعزم مسؤول الـ HR بتاعها. هيطلعلك لينك تسجيل خاص تبعته له. مش محتاج إيميل.',
  },
  {
    screen: 'tenants',
    title_en: 'Import their people',
    title_ar: 'ارفع موظفينهم',
    body_en: "Open a company to import its employees for them and download the invite sheet with everyone's personal link.",
    body_ar: 'افتح الشركة علشان ترفع موظفينها بنفسك وتنزّل شيت الدعوات باللينك الخاص لكل واحد.',
  },
  {
    screen: 'challenges',
    title_en: 'Build a challenge',
    title_ar: 'اعمل تحدّي',
    body_en: 'Write the daily action, why it helps and a tip, and add a how-to: an uploaded video or a YouTube link. Every company\'s HR picks from these.',
    body_ar: 'اكتب الفعل اليومي وفايدته ونصيحة، وضيف شرح: فيديو ترفعه أو لينك YouTube. الـ HR في كل شركة بيختار من دول.',
  },
  {
    screen: 'content',
    title_en: 'Content library',
    title_ar: 'مكتبة المحتوى',
    body_en: 'Articles you publish here reach every company.',
    body_ar: 'المقالات اللي بتنشرها هنا بتوصل لكل الشركات.',
  },
  {
    screen: 'roles',
    title_en: 'Stay in control',
    title_ar: 'كل حاجة تحت إيدك',
    body_en: 'Who can do what, every Arabic string, feature switches, and a log of every change.',
    body_ar: 'مين يقدر يعمل إيه، وكل النصوص العربي، ومفاتيح الخصائص، وسجل بكل تغيير.',
  },
];
