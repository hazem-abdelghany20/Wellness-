-- AR-script display name. Optional — when present, the employee portal
-- uses it for greetings/profile in AR mode so users don't see a Latin
-- name in an otherwise Arabic UI.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name_ar TEXT;

-- Seed AR names for the 6 Wellhouse demo employees so AR mode looks right
-- out of the box (and the AR parity sweep has something to verify against).
UPDATE public.profiles SET display_name_ar = 'أميرة حسن'
  WHERE display_name = 'Amira Hassan';
UPDATE public.profiles SET display_name_ar = 'يوسف نجيب'
  WHERE display_name = 'Yusuf Naguib';
UPDATE public.profiles SET display_name_ar = 'لينا فاروق'
  WHERE display_name = 'Lina Farouk';
UPDATE public.profiles SET display_name_ar = 'عمر سامي'
  WHERE display_name = 'Omar Sami';
UPDATE public.profiles SET display_name_ar = 'نادية كامل'
  WHERE display_name = 'Nadia Kamel';
UPDATE public.profiles SET display_name_ar = 'سارة أنور'
  WHERE display_name = 'Sara Anwar';
