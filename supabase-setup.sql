-- ============================================
-- Brand Fit Checker — Supabase Table Setup
-- Run this in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query)
-- ============================================

-- 1. Evaluations table
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  pitch_text TEXT NOT NULL,
  profile_text TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('Good Fit', 'Risky', 'Bad Fit')),
  reasoning TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Rules table (one row per session)
CREATE TABLE IF NOT EXISTS rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  rules_text TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable Row Level Security
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies — allow anon key full access
--    (safe for personal/local use; for production, scope by auth.uid())
CREATE POLICY "Allow insert evaluations" ON evaluations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow select evaluations" ON evaluations
  FOR SELECT USING (true);

CREATE POLICY "Allow insert rules" ON rules
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow select rules" ON rules
  FOR SELECT USING (true);

CREATE POLICY "Allow update rules" ON rules
  FOR UPDATE USING (true) WITH CHECK (true);

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_evaluations_session_created
  ON evaluations (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rules_session
  ON rules (session_id);
