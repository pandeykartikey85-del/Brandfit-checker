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
  verdict TEXT NOT NULL CHECK (verdict IN (
    'Good Fit', 'Risky', 'Bad Fit',
    'Strongly Consider', 'Consider', 'Request More Information', 'Negotiate', 'Low Priority', 'Reject'
  )),
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

-- 3. Payments table (tracked deals & payment status)
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  evaluation_id UUID,
  pitch_snippet TEXT NOT NULL,
  full_pitch TEXT,
  verdict TEXT NOT NULL,
  expected_payment_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'overdue', 'paid')),
  created_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Creator Profiles table (one rich profile per session)
CREATE TABLE IF NOT EXISTS creator_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  name TEXT,
  instagram_url TEXT,
  youtube_url TEXT,
  other_social_links TEXT,
  followers_count TEXT,
  average_views TEXT,
  average_reach TEXT,
  engagement_rate TEXT,
  audience_location TEXT,
  audience_age TEXT,
  audience_demographics TEXT,
  audience_interests TEXT,
  main_niche TEXT,
  secondary_niches TEXT,
  content_formats TEXT,
  platforms TEXT,
  content_style TEXT,
  typical_rates TEXT,
  min_acceptable_payment TEXT,
  preferred_collab_types TEXT,
  preferred_industries TEXT,
  unwanted_industries TEXT,
  dealbreakers TEXT,
  exclusivity_preferences TEXT,
  usage_rights_preferences TEXT,
  max_revisions TEXT,
  unpaid_collab_rules TEXT,
  raw_profile_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Brand Profiles table (one rich profile per session)
CREATE TABLE IF NOT EXISTS brand_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  brand_name TEXT,
  industry TEXT,
  product_service TEXT,
  brand_positioning TEXT,
  website TEXT,
  target_age TEXT,
  target_geography TEXT,
  target_demographics TEXT,
  target_interests TEXT,
  customer_profile TEXT,
  campaign_objective TEXT,
  campaign_description TEXT,
  preferred_niche TEXT,
  preferred_platform TEXT,
  follower_range TEXT,
  engagement_expectations TEXT,
  creator_geography TEXT,
  content_format TEXT,
  audience_profile TEXT,
  creator_style TEXT,
  campaign_budget TEXT,
  max_creator_budget TEXT,
  deliverables TEXT,
  timeline TEXT,
  usage_rights TEXT,
  exclusivity TEXT,
  raw_profile_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Usage Limits table (tracks daily AI calls per session_id)
CREATE TABLE IF NOT EXISTS usage_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT usage_limits_session_date_unique UNIQUE (session_id, date)
);

-- 7. Enable Row Level Security
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_limits ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies — allow anon key full access
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

CREATE POLICY "Allow all payments" ON payments
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all creator_profiles" ON creator_profiles
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all brand_profiles" ON brand_profiles
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all usage_limits" ON usage_limits
  FOR ALL USING (true) WITH CHECK (true);

-- 9. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_evaluations_session_created
  ON evaluations (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rules_session
  ON rules (session_id);

CREATE INDEX IF NOT EXISTS idx_payments_session_date
  ON payments (session_id, expected_payment_date ASC);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_session
  ON creator_profiles (session_id);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_session
  ON brand_profiles (session_id);

CREATE INDEX IF NOT EXISTS idx_usage_limits_session_date
  ON usage_limits (session_id, date);

