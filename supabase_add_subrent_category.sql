-- ============================================
-- Миграция: заменить категорию 'salary' на 'subrent' в расходах
-- ============================================

-- 1. Удаляем старый CHECK constraint (если он есть)
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- 2. Добавляем новый CHECK constraint с категорией 'subrent' вместо 'salary'
ALTER TABLE expenses ADD CONSTRAINT expenses_category_check
  CHECK (category IN ('equipment', 'consumables', 'subrent', 'rent', 'transport', 'other'));

-- 3. Обновляем существующие записи со старой категорией 'salary' -> 'other'
-- (чтобы не сломать вставку при наличии старых данных)
UPDATE expenses SET category = 'other', description = description || ' (бывш. зарплата)' WHERE category = 'salary';
