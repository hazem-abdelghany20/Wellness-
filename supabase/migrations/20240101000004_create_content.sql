-- Content library: audio, video, articles
CREATE TABLE public.content_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  kind            TEXT NOT NULL CHECK (kind IN ('audio', 'video', 'article')),
  title_en        TEXT NOT NULL,
  title_ar        TEXT,
  description_en  TEXT,
  description_ar  TEXT,
  body_en         TEXT,   -- article body markdown
  body_ar         TEXT,
  duration_mins   SMALLINT,
  category        TEXT NOT NULL DEFAULT 'general'
                  CHECK (category IN ('sleep','stress','energy','movement','mindfulness','nutrition','general')),
  tags            TEXT[] DEFAULT '{}',
  thumbnail_url   TEXT,
  asset_url       TEXT,   -- Storage path for audio/video
  featured        BOOLEAN NOT NULL DEFAULT false,
  published       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_category ON public.content_items(category);
CREATE INDEX idx_content_featured  ON public.content_items(featured) WHERE featured = true;

-- User content progress / bookmarks
CREATE TABLE public.content_progress (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES public.content_items(id),
  company_id  UUID NOT NULL REFERENCES public.companies(id),
  completed   BOOLEAN NOT NULL DEFAULT false,
  progress_s  INT NOT NULL DEFAULT 0,  -- seconds into audio/video
  bookmarked  BOOLEAN NOT NULL DEFAULT false,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  UNIQUE (user_id, item_id)
);

CREATE INDEX idx_progress_user ON public.content_progress(user_id);

-- RLS
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_progress ENABLE ROW LEVEL SECURITY;

-- Content is readable by all authenticated users
CREATE POLICY "content_authenticated_read" ON public.content_items
  FOR SELECT USING (auth.role() = 'authenticated' AND published = true);

CREATE POLICY "service_role_content" ON public.content_items
  USING (auth.role() = 'service_role');

-- Progress: own rows only
CREATE POLICY "progress_own_select" ON public.content_progress
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "progress_own_insert" ON public.content_progress
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "progress_own_update" ON public.content_progress
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "service_role_progress" ON public.content_progress
  USING (auth.role() = 'service_role');
