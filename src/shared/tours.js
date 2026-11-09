// Walkthrough steps for each role. `screen` is the portal's own screen / nav id.
// Managers use the employee app, so they get the employee tour.

export const EMPLOYEE_TOUR = [
  {
    screen: 'challenges',
    title_en: "This week's challenge",
    title_ar: 'تحدّي الأسبوع',
    body_en: 'One small habit, Sunday to Thursday. Do it on 4 of the 5 days and you earn a reward.',
    body_ar: 'عادة صغيرة واحدة من الأحد للخميس. اعملها ٤ أيام من ٥ وتاخد مكافأة.',
  },
  {
    screen: 'challenges',
    title_en: 'One tap a day',
    title_ar: 'دوسة واحدة في اليوم',
    body_en: 'When you have done it, tap "Did it today". If the challenge has a "Watch how" video, it shows you exactly what to do.',
    body_ar: 'لما تعملها دوس "عملتها النهارده". ولو التحدي فيه فيديو "اتفرّج إزاي"، هيوريك تعملها بالظبط.',
  },
  {
    screen: 'challenges',
    title_en: 'Your team, together',
    title_ar: 'فريقك مع بعض',
    body_en: 'One shared bar for your team. There is no ranking and nobody is singled out.',
    body_ar: 'شريط واحد للفريق كله. مفيش ترتيب ومحدش بيتحط تحت المجهر.',
  },
  {
    screen: 'library',
    title_en: 'Short reads',
    title_ar: 'قراءات قصيرة',
    body_en: '3 to 6 minute articles from Wellness House. Every one you finish adds 5 points.',
    body_ar: 'مقالات من ٣ لـ ٦ دقايق من Wellness House. كل مقال تخلّصه بيزوّدك ٥ نقط.',
  },
  {
    screen: 'score',
    title_en: 'Your score is private',
    title_ar: 'نقطك ليك إنت بس',
    body_en: 'Only you see your points. If your team is small, you see the company average instead, so nobody can be identified.',
    body_ar: 'محدش غيرك بيشوف نقطك. ولو فريقك صغير بتشوف متوسط الشركة بدل الفريق، علشان محدش يتعرف.',
  },
  {
    screen: 'profile',
    title_en: 'Make it yours',
    title_ar: 'خليه على مزاجك',
    body_en: 'Switch to Arabic, change the look, and see your rewards here. You can replay this tour from this page any time.',
    body_ar: 'من هنا تغيّر اللغة والشكل وتشوف مكافآتك. وتقدر تعيد الجولة دي من الصفحة دي في أي وقت.',
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
