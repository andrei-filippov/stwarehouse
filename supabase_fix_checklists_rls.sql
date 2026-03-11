-- ============================================
-- Исправление RLS для checklists
-- ============================================

-- Удаляем ВСЕ старые политики
DROP POLICY IF EXISTS "Users can delete own checklists" ON checklists;
DROP POLICY IF EXISTS "Users can delete their own checklists" ON checklists;
DROP POLICY IF EXISTS "Users can insert own checklists" ON checklists;
DROP POLICY IF EXISTS "Users can insert their own checklists" ON checklists;
DROP POLICY IF EXISTS "Users can update own checklists" ON checklists;
DROP POLICY IF EXISTS "Users can update their own checklists" ON checklists;
DROP POLICY IF EXISTS "Users can view own checklists" ON checklists;
DROP POLICY IF EXISTS "Users can view their own checklists" ON checklists;
DROP POLICY IF EXISTS "checklists_delete" ON checklists;
DROP POLICY IF EXISTS "checklists_insert" ON checklists;
DROP POLICY IF EXISTS "checklists_select" ON checklists;
DROP POLICY IF EXISTS "checklists_update" ON checklists;

-- Оставляем только новые политики на основе company_id
-- (они уже созданы в supabase_fix_all_rls_policies.sql)

-- Проверяем результат
SELECT policyname, cmd, qual::text
FROM pg_policies
WHERE tablename = 'checklists';
