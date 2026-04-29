-- Добавление section_id в estimate_items для поддержки секций (локаций) в сметах
-- Выполните этот SQL в SQL Editor Supabase Dashboard

-- 1. Добавляем колонку section_id
ALTER TABLE estimate_items 
ADD COLUMN IF NOT EXISTS section_id TEXT;

-- 2. Добавляем индекс для быстрой фильтрации по секциям
CREATE INDEX IF NOT EXISTS idx_estimate_items_section_id 
ON estimate_items(section_id);

-- 3. Обновляем RLS политики (если нужно) — политики estimate_items уже проверяют через estimates
-- section_id не требует отдельных политик, так как доступ регулируется через estimate_id
