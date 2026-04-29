-- ============================================
-- Миграция: добавить категорию 'taxes' (Налоги) в расходы
-- ============================================

-- 1. Удаляем старый CHECK constraint (если он есть)
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- 2. Добавляем новый CHECK constraint с категорией 'taxes'
ALTER TABLE expenses ADD CONSTRAINT expenses_category_check
  CHECK (category IN ('equipment', 'consumables', 'subrent', 'rent', 'transport', 'taxes', 'other'));
