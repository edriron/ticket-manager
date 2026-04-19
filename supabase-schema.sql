-- ============================================================
-- TrackIt — Supabase SQL Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ============================================================
-- MIGRATION: Email preferences (run if upgrading existing DB)
-- ============================================================
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_on_assigned   BOOLEAN NOT NULL DEFAULT TRUE;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_on_new_ticket  BOOLEAN NOT NULL DEFAULT TRUE;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_on_mention     BOOLEAN NOT NULL DEFAULT TRUE;
-- ============================================================

-- ============================================================
-- 1. PROFILES TABLE
-- Extends auth.users — auto-created via trigger on sign-up
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id               UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name     TEXT UNIQUE,          -- null until user completes onboarding
  avatar_url       TEXT,
  email            TEXT,
  email_on_assigned   BOOLEAN NOT NULL DEFAULT TRUE,
  email_on_new_ticket BOOLEAN NOT NULL DEFAULT TRUE,
  email_on_mention    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated users"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);


-- ============================================================
-- 2. TICKETS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tickets (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number       BIGSERIAL UNIQUE,
  title               TEXT NOT NULL,
  description         TEXT,
  type                TEXT NOT NULL CHECK (type IN ('bug', 'feature_request')),
  status              TEXT DEFAULT 'todo'
                         CHECK (status IN ('todo', 'in_progress', 'pending', 'in_testing', 'done')),
  priority            TEXT DEFAULT 'medium'
                         CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  requester_id        UUID REFERENCES profiles(id) NOT NULL,
  assignee_id         UUID REFERENCES profiles(id),
  environment_url     TEXT,
  steps_to_reproduce  TEXT,
  expected_behavior   TEXT,
  actual_behavior     TEXT,
  -- Keep this list in sync with lib/products.ts (PRODUCTS array)
  product             TEXT DEFAULT 'other'
                         CHECK (product IN ('vetra', 'gym_pocket', 'trackit', 'aqua', 'lumos', 'shyft', 'other')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tickets viewable by authenticated users"
  ON tickets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create tickets"
  ON tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Requester or assignee can update tickets"
  ON tickets FOR UPDATE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = assignee_id);


-- ============================================================
-- 3. TICKET ATTACHMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id   UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  filename    TEXT NOT NULL,
  url         TEXT NOT NULL,
  size        INTEGER,
  mime_type   TEXT,
  uploaded_by UUID REFERENCES profiles(id) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attachments viewable by authenticated users"
  ON ticket_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can upload attachments"
  ON ticket_attachments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Uploader can delete attachments"
  ON ticket_attachments FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by);


-- ============================================================
-- 4. TICKET COMMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_comments (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id  UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES profiles(id) NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments viewable by authenticated users"
  ON ticket_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can add comments"
  ON ticket_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON ticket_comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON ticket_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ============================================================
-- 5. ACTIVITY LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id  UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES profiles(id) NOT NULL,
  action     TEXT NOT NULL,          -- 'created', 'updated', etc.
  field      TEXT,                   -- which field changed
  old_value  TEXT,
  new_value  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Logs viewable by authenticated users"
  ON activity_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert logs"
  ON activity_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 6. AUTO-UPDATE updated_at TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON ticket_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 7. AUTO-CREATE PROFILE ON NEW USER SIGN-UP
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- 8. STORAGE BUCKET + POLICIES
-- Run these in Supabase Dashboard → SQL Editor as well
-- ============================================================

-- Create the storage bucket (public so getPublicUrl() works for image previews)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- If the bucket already exists as private, run this to make it public:
-- UPDATE storage.buckets SET public = true WHERE id = 'ticket-attachments';

-- Storage RLS policies — upload/delete still require auth
CREATE POLICY "Authenticated users can upload attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-attachments');

CREATE POLICY "Uploaders can delete their attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ticket-attachments');


-- ============================================================
-- 9. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  ticket_id  UUID REFERENCES tickets(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT,
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(user_id, read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);


-- ============================================================
-- 10. ALLOW ANY AUTHENTICATED USER TO UPDATE TICKETS
-- Run this to replace the existing restrictive UPDATE policy:
-- ============================================================

-- Drop the old policy first:
DROP POLICY IF EXISTS "Requester or assignee can update tickets" ON tickets;

-- New policy — any authenticated user can update any ticket:
CREATE POLICY "Authenticated users can update tickets"
  ON tickets FOR UPDATE TO authenticated
  USING (true);

-- Also allow any authenticated user to delete tickets
-- (previously only requester/assignee could delete — if you had a delete policy):
-- DROP POLICY IF EXISTS "Requester or assignee can delete tickets" ON tickets;
-- CREATE POLICY "Authenticated users can delete tickets"
--   ON tickets FOR DELETE TO authenticated
--   USING (true);


-- ============================================================
-- MIGRATION: Run these if upgrading an existing DB
-- ============================================================
-- ALTER TABLE tickets ADD COLUMN IF NOT EXISTS product TEXT DEFAULT 'other'
--   CHECK (product IN ('vetra', 'gym_pocket', 'trackit', 'aqua', 'other'));
--
-- ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- ============================================================
-- DONE! Next steps:
-- 1. In Supabase → Authentication → Providers → enable Google
-- 2. Add your Google OAuth credentials (Client ID + Secret)
-- 3. Set Redirect URL to: https://your-project.supabase.co/auth/v1/callback
-- 4. In Vercel / locally: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
-- 5. In Supabase → Authentication → URL Configuration → add your site URL
--    and redirect URL: https://your-app.vercel.app/auth/callback
-- ============================================================
