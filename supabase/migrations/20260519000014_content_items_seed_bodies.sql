-- Article bodies were rendered from a hardcoded EN+AR string in
-- screens/content.jsx, so every article looked identical regardless of which
-- card was tapped. content_items already has body_en/body_ar columns; this
-- migration just backfills the seeded items so the player can render real
-- text. The two articles get full body copy; audio/video items get a short
-- description so the player has something to show as fallback if we ever
-- expose a transcript.

UPDATE public.content_items SET
  body_en = $$An evening wind-down isn't ritual for ritual's sake — it's a signal to your brain that the day is closing. The transition matters more than the bedtime itself.

**Dim the room.** Drop overhead lights an hour before sleep. Bright light suppresses melatonin and your body interprets it as midday.

**Move the phone.** Charge it outside the bedroom. Scrolling at bedtime keeps the prefrontal cortex active when it should be powering down.

**Do a 3-line journal.** Write down three things that went well, then close the notebook. The act of putting the day on paper is permission to stop replaying it.

**Pick a wind-down cue.** Tea. A short stretch. Two minutes of slow breathing. Same cue every night. Your nervous system needs the repetition more than the content.

The whole protocol takes 10 minutes. Most people see sleep onset drop by a third within a fortnight.$$,
  body_ar = $$روتين الاسترخاء المسائي ليس طقساً من أجل الطقس — إنه إشارة لدماغك بأن اليوم يقترب من نهايته. الانتقال أهم من موعد النوم نفسه.

**خفّت الإضاءة.** اخفض الأنوار العلوية قبل النوم بساعة. الضوء الساطع يثبّط الميلاتونين ويفسّره جسمك على أنه منتصف النهار.

**أبعد الهاتف.** اشحنه خارج غرفة النوم. التصفح قبل النوم يبقي القشرة الجبهية في حالة نشاط بينما يفترض أن تهدأ.

**اكتب يوميات من ثلاثة أسطر.** دوّن ثلاثة أشياء سارت على ما يرام، ثم أغلق الدفتر. وضع اليوم على ورق إذن لتوقف إعادة تشغيله ذهنياً.

**اختر إشارة استرخاء.** كوب شاي. تمدّد خفيف. دقيقتان من التنفس البطيء. الإشارة نفسها كل ليلة. جهازك العصبي يحتاج التكرار أكثر من المحتوى.

البروتوكول كله يستغرق ١٠ دقائق. أغلب الناس يلاحظون انخفاض زمن بدء النوم بمقدار الثلث خلال أسبوعين.$$
WHERE slug = 'wind-down';

UPDATE public.content_items SET
  body_en = $$Caffeine half-life is about 5 hours. That coffee at 4pm? Half of it is still circulating at 9pm. Even if you fall asleep fine, the deeper stages of sleep get fragmented.

**The rule of thumb:** stop caffeine 8 hours before you want to be asleep. If you're aiming for 11pm, that's a 3pm cutoff. If 10pm, 2pm.

**It's not just coffee.** Tea, dark chocolate, pre-workout, some sodas. Decaf still has 2–15mg per cup — fine for most people but worth knowing.

**The taper.** If you currently drink coffee right up to bedtime, don't cold-turkey it. Move the last cup 30 minutes earlier each day until you hit your cutoff. Withdrawal headaches usually peak at 24 hours and clear by day three.

**The trade-off.** Late-afternoon coffee feels productive but it's borrowing from tomorrow. Better sleep tonight beats one extra alert hour today, almost every time.$$,
  body_ar = $$عمر النصف للكافيين حوالي ٥ ساعات. قهوة الساعة ٤ عصراً؟ نصفها لا يزال في جسمك الساعة ٩ مساءً. حتى لو نمت بسهولة، مراحل النوم العميق تتفتت.

**القاعدة العامة:** أوقف الكافيين قبل ٨ ساعات من موعد النوم. إذا كان هدفك النوم الساعة ١١، فالحدّ هو ٣ عصراً. إذا كان ١٠، فالحدّ ٢ ظهراً.

**ليس القهوة فقط.** الشاي، الشوكولاتة الداكنة، مكمّلات ما قبل التمرين، بعض المشروبات الغازية. حتى منزوع الكافيين فيه ٢-١٥ ملغ لكل كوب — مقبول لأغلب الناس لكن يجب معرفته.

**التدرّج.** إذا كنت تشرب القهوة قبل النوم مباشرة، لا توقفها فجأة. حرّك آخر كوب نصف ساعة أبكر كل يوم حتى تصل إلى الحدّ المستهدف. صداع الانسحاب يبلغ ذروته عند ٢٤ ساعة ويختفي في اليوم الثالث.

**المقايضة.** قهوة العصر تبدو منتجة لكنها استدانة من الغد. نوم أفضل الليلة أفضل من ساعة يقظة إضافية اليوم، في كل مرة تقريباً.$$
WHERE slug = 'caffeine';

-- Short descriptive bodies for the audio/video items — surfaced as a
-- "what to expect" blurb when the article-style render isn't appropriate.
UPDATE public.content_items SET
  body_en = $$A 6-minute guided audio. You'll lie flat, close your eyes, and follow a slow body scan from forehead to feet. The voice tracks your exhale and pauses get longer as you go. Most listeners drift off before the last segment.$$,
  body_ar = $$جلسة صوتية موجَّهة من ٦ دقائق. ستستلقي مسطّحاً، تغمض عينيك، وتتبع مسحاً بطيئاً للجسم من الجبهة إلى القدمين. الصوت يتزامن مع زفيرك والوقفات تطول مع التقدم. أغلب المستمعين يغفون قبل المقطع الأخير.$$
WHERE slug = 'sleep-onset';

UPDATE public.content_items SET
  body_en = $$Box breathing: inhale 4 seconds, hold 4, exhale 4, hold 4. The audio guide cues each phase so you don't count. Two minutes is enough to drop heart rate and shift your nervous system out of fight-or-flight.$$,
  body_ar = $$التنفس المربع: شهيق ٤ ثوانٍ، حبس ٤، زفير ٤، حبس ٤. الدليل الصوتي يشير إلى كل مرحلة دون الحاجة للعدّ. دقيقتان كافيتان لخفض النبض ونقل جهازك العصبي خارج وضع الكرّ والفرّ.$$
WHERE slug = 'box-breath';

UPDATE public.content_items SET
  body_en = $$A 4-minute video showing seven gentle desk-side movements: neck rolls, shoulder openers, seated cat-cow, hip flexor releases, and a final calf stretch. Designed to be done in work clothes between meetings.$$,
  body_ar = $$فيديو من ٤ دقائق يعرض سبع حركات لطيفة بجانب المكتب: تدوير الرقبة، فتح الكتفين، حركة القط-البقرة جالساً، إطلاق ثنية الورك، وتمدّد أخير للساق. مصمّم ليُؤدّى بملابس العمل بين الاجتماعات.$$
WHERE slug = 'desk-mob';

UPDATE public.content_items SET
  body_en = $$Three minutes between back-to-back meetings. The first minute resets your breath. The second clears the previous meeting from your head. The third sets a single intention for the next one. Headphones recommended.$$,
  body_ar = $$ثلاث دقائق بين اجتماعَين متتاليَين. الدقيقة الأولى تعيد ضبط تنفسك. الثانية تنظّف رأسك من الاجتماع السابق. الثالثة تحدّد نيّة واحدة للاجتماع التالي. يُنصح بسماعات الأذن.$$
WHERE slug = 'reset';
