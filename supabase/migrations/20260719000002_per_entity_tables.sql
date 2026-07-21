-- Migrate from generic user_sync_data (JSONB) to per-entity typed tables.
-- This provides schema enforcement, FK relationships, indexing, and simpler RLS.

-- ──────────────────────────────────────────────
-- 1. Per-entity tables
-- ──────────────────────────────────────────────

CREATE TABLE habits (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  standard REAL NOT NULL,
  target REAL,
  unit TEXT NOT NULL DEFAULT '',
  schedule JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  depends_on JSONB,
  identity_id TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE entries (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  value REAL NOT NULL,
  standard_met BOOLEAN NOT NULL DEFAULT false,
  target_met BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (habit_id, date)
);

CREATE TABLE notes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE identities (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  goals TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reset_time TEXT NOT NULL DEFAULT '00:00',
  theme_mode TEXT NOT NULL DEFAULT 'system',
  oled BOOLEAN NOT NULL DEFAULT false,
  accent_color TEXT NOT NULL DEFAULT '',
  main_color TEXT NOT NULL DEFAULT '',
  launch_screen TEXT NOT NULL DEFAULT '/today',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 2. RLS per table (simple, no recursion)
-- ──────────────────────────────────────────────

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own habits"
  ON habits FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own entries"
  ON entries FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own notes"
  ON notes FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own identities"
  ON identities FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own settings"
  ON user_settings FOR ALL USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- 3. Migrate existing data from user_sync_data
-- ──────────────────────────────────────────────

-- Helper: extract a text[] array from a JSONB array
CREATE OR REPLACE FUNCTION jsonb_to_text_array(j JSONB)
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(ARRAY(SELECT jsonb_array_elements_text(j)), '{}'::TEXT[])
$$;

INSERT INTO habits (id, user_id, title, description, type, standard, target, unit,
                    schedule, metadata, depends_on, identity_id, tags, status,
                    created_at, updated_at)
SELECT
  (data->>'id')::UUID,
  user_id,
  data->>'title',
  data->>'description',
  data->>'type',
  (data->>'standard')::REAL,
  (data->>'target')::REAL,
  COALESCE(data->>'unit', ''),
  COALESCE(data->'schedule', '{}'::JSONB),
  COALESCE(data->'metadata', '{}'::JSONB),
  data->'dependsOn',
  data->>'identityId',
  jsonb_to_text_array(data->'tags'),
  COALESCE(data->>'status', 'active'),
  COALESCE((data->>'createdAt')::TIMESTAMPTZ, now()),
  COALESCE((data->>'updatedAt')::TIMESTAMPTZ, now())
FROM user_sync_data
WHERE collection = 'habits'
ON CONFLICT (id) DO NOTHING;

INSERT INTO entries (id, user_id, habit_id, date, value, standard_met, target_met, notes, updated_at)
SELECT DISTINCT ON ((usd.data->>'habitId')::UUID, (usd.data->>'date')::DATE)
  (usd.data->>'id')::UUID,
  usd.user_id,
  (usd.data->>'habitId')::UUID,
  (usd.data->>'date')::DATE,
  (usd.data->>'value')::REAL,
  COALESCE((usd.data->>'standardMet')::BOOLEAN, false),
  COALESCE((usd.data->>'targetMet')::BOOLEAN, false),
  usd.data->>'notes',
  COALESCE((usd.data->>'updatedAt')::TIMESTAMPTZ, now())
FROM user_sync_data usd
WHERE usd.collection = 'entries'
  AND EXISTS (
    SELECT 1 FROM user_sync_data h
    WHERE h.collection = 'habits'
      AND (h.data->>'id')::UUID = (usd.data->>'habitId')::UUID
      AND h.user_id = usd.user_id
  )
ORDER BY (usd.data->>'habitId')::UUID, (usd.data->>'date')::DATE, (usd.data->>'updatedAt')::TIMESTAMPTZ DESC;

INSERT INTO notes (id, user_id, habit_id, date, content, created_at)
SELECT
  (usd.data->>'id')::UUID,
  usd.user_id,
  (usd.data->>'habitId')::UUID,
  (usd.data->>'date')::DATE,
  usd.data->>'content',
  COALESCE((usd.data->>'createdAt')::TIMESTAMPTZ, now())
FROM user_sync_data usd
WHERE usd.collection = 'notes'
  AND EXISTS (
    SELECT 1 FROM user_sync_data h
    WHERE h.collection = 'habits'
      AND (h.data->>'id')::UUID = (usd.data->>'habitId')::UUID
      AND h.user_id = usd.user_id
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO identities (id, user_id, name, description, goals, created_at)
SELECT
  (data->>'id')::UUID,
  user_id,
  data->>'name',
  data->>'description',
  jsonb_to_text_array(data->'goals'),
  COALESCE((data->>'createdAt')::TIMESTAMPTZ, now())
FROM user_sync_data
WHERE collection = 'identities'
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_settings (user_id, reset_time, theme_mode, oled, accent_color, main_color, launch_screen)
SELECT
  user_id,
  COALESCE(data->>'resetTime', '00:00'),
  COALESCE(data->>'themeMode', 'system'),
  COALESCE((data->>'oled')::BOOLEAN, false),
  COALESCE(data->>'accentColor', ''),
  COALESCE(data->>'mainColor', ''),
  COALESCE(data->>'launchScreen', '/today')
FROM user_sync_data
WHERE collection = 'settings' AND record_id = 'app_settings'
ON CONFLICT (user_id) DO NOTHING;

DROP FUNCTION jsonb_to_text_array;
