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
    body_en: 'These numbers show who took part, what was read and how today\'s routine is going. Nothing about anyone\'s sleep, stress or mood ever reaches this portal.',
    body_ar: 'الأرقام دي بتوضح مين شارك وإيه اللي اتقرا وروتين النهارده ماشي إزاي. ولا أي حاجة عن نوم أو ضغط أو مزاج حد بتوصل للبوابة دي.',
  },
  {
    screen: 'people',
    title_en: 'Bring your people in',
    title_ar: 'ضيف موظفينك',
    body_en: 'Import a sheet of employees with their teams, then download the invite sheet with everyone\'s personal link. Prefer one link for all? It\'s in Settings, with a QR code.',
    body_ar: 'ارفع شيت بالموظفين وفرقهم، وبعدها نزّل شيت الدعوات باللينك الخاص لكل واحد. عايز لينك واحد للكل؟ موجود في الإعدادات ومعاه QR.',
  },
  {
    screen: 'exercises',
    title_en: 'Your exercises',
    title_ar: 'تمارينك',
    body_en: 'Add each exercise once: its name, sets × reps and a demo (upload the coach\'s video or paste a YouTube link). Or use one from the Wellness House library.',
    body_ar: 'ضيف كل تمرين مرة واحدة: الاسم والعدد وفيديو الشرح (ارفع فيديو المدرب أو حط لينك يوتيوب). أو استخدم تمرين من مكتبة Wellness House.',
  },
  {
    screen: 'routines',
    title_en: 'Build the daily routine',
    title_ar: 'اعمل الروتين اليومي',
    body_en: 'Type the coach\'s table row by row (time, exercise, sets × reps, day) or import it from a sheet. Then press Assign: everyone or one team, from a start date.',
    body_ar: 'اكتب جدول المدرب صف صف (الوقت، التمرين، العدد، اليوم) أو استورده من شيت. وبعدين دوس وزّعه: للكل أو لفريق، من تاريخ بداية.',
  },
  {
    screen: 'report',
    title_en: 'See how it\'s going',
    title_ar: 'شوف ماشي إزاي',
    body_en: 'Today\'s ticks, day by day, by team, the most and least done exercises, and the hours people tick. Small teams are grouped so nobody is singled out. Export it to Excel.',
    body_ar: 'علامات النهارده، يوم بيوم، بالفريق، التمارين الأكتر والأقل، والساعات اللي الناس بتعلّم فيها. الفرق الصغيرة متجمّعة علشان محدش يتعرف. وتقدر تصدّره Excel.',
  },
  {
    screen: 'challenges',
    title_en: 'Your own challenges',
    title_ar: 'تحدياتك',
    body_en: 'Pick a Wellness House habit, or create your own, for example "Drink water" for two weeks. Choose its first week, for everyone or one team.',
    body_ar: 'اختار عادة من Wellness House، أو اعمل تحدي بتاعك، مثلاً «اشرب مية» لمدة أسبوعين. اختار أول أسبوع ليه، للكل أو لفريق.',
  },
  {
    screen: 'content',
    title_en: 'Your articles and theirs',
    title_ar: 'مقالاتك ومقالاتهم',
    body_en: 'Write short articles or one-line facts for your company. In the Wellness House tab you can hide or pin their articles for your company only.',
    body_ar: 'اكتب مقالات قصيرة أو معلومات في سطر لشركتك. ومن تبويب Wellness House تقدر تخفي أو تثبّت مقالاتهم لشركتك بس.',
  },
  {
    screen: 'settings',
    title_en: 'Recognition and time zone',
    title_ar: 'التقدير والمنطقة الزمنية',
    body_en: 'Choose who sees effort: off, teams only, or teams plus people who opt in. Set your time zone, and pause the weekly habit while a routine runs.',
    body_ar: 'اختار مين يشوف المجهود: مقفول، الفرق بس، أو الفرق واللي يوافقوا. وظبط المنطقة الزمنية، ووقّف عادة الأسبوع وقت ما الروتين شغال.',
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
    screen: 'exercises',
    title_en: 'Starter exercises',
    title_ar: 'تمارين جاهزة',
    body_en: 'Publish exercises with a demo video or YouTube link. Every company can put them in its routines or copy them with "Use this".',
    body_ar: 'انشر تمارين بفيديو شرح أو لينك YouTube. كل الشركات تقدر تحطها في الروتين أو تاخد نسخة منها بـ "استخدمه".',
  },
  {
    screen: 'routines',
    title_en: 'Starter routines',
    title_ar: 'روتين جاهز',
    body_en: 'Build ready-made routines from those exercises. HR copies one, changes what they need and assigns it to their people.',
    body_ar: 'اعمل روتين جاهز من التمارين دي. الـ HR بياخد نسخة، يغيّر اللي محتاجه، ويوزّعه على موظفينه.',
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
