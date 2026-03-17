-- Добавление поля status для смет (для аналитики прибыли)

-- Удаляем старый CHECK constraint если есть
ALTER TABLE estimates 
DROP CONSTRAINT IF EXISTS estimates_status_check;

-- Добавляем поле status в таблицу estimates (если ещё не добавлено)
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

-- Добавляем CHECK constraint с новым статусом 'approved'
ALTER TABLE estimates 
ADD CONSTRAINT estimates_status_check 
CHECK (status IN ('draft', 'pending', 'approved', 'completed', 'cancelled'));

-- Создаем индекс для быстрого фильтра по статусу
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);

-- Создаем индекс для фильтра по компании и статусу (для аналитики)
CREATE INDEX IF NOT EXISTS idx_estimates_company_status ON estimates(company_id, status);

-- Обновляем существующие записи - устанавливаем completed для старых смет
-- (предполагаем что старые сметы уже выполнены)
UPDATE estimates 
SET status = 'completed' 
WHERE status = 'draft' 
AND created_at < NOW() - INTERVAL '30 days';

-- Комментарий к полю
COMMENT ON COLUMN estimates.status IS 'Статус сметы: draft (черновик), pending (в работе), approved (согласована), completed (выполнена), cancelled (отменена)';
