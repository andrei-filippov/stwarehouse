-- ============================================
-- Фикс: добавить notes в projects
-- Дата: 2026-07-13
-- ============================================

-- Добавляем колонку notes
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notes text;
