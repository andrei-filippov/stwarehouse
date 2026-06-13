-- Migration: create targets table for financial goals
-- Created: 2026-05-13

CREATE TABLE IF NOT EXISTS targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  target_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  current_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  allocation_percent DECIMAL(5,2) NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  is_private BOOLEAN DEFAULT FALSE,
  target_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_targets_company ON targets(company_id);
CREATE INDEX IF NOT EXISTS idx_targets_status ON targets(status);

-- RLS
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view targets in their company" ON targets
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert targets in their company" ON targets
  FOR INSERT WITH CHECK (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update targets in their company" ON targets
  FOR UPDATE USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete targets in their company" ON targets
  FOR DELETE USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

-- Private targets: only creator can see
CREATE POLICY "Users can view own private targets" ON targets
  FOR SELECT USING (is_private = FALSE OR user_id = auth.uid());
