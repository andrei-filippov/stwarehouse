-- Изменяем company_members для поддержки приглашений

-- 1. Делаем user_id nullable (для приглашений)
ALTER TABLE company_members ALTER COLUMN user_id DROP NOT NULL;

-- 2. Добавляем email для приглашений (если ещё нет)
ALTER TABLE company_members ADD COLUMN IF NOT EXISTS email text;

-- 3. Обновляем constraint чтобы email был обязателен при null user_id
-- Сначала удаляем старый если есть
ALTER TABLE company_members DROP CONSTRAINT IF EXISTS company_members_email_or_user_id;

-- 4. Добавляем constraint: либо user_id, либо email должен быть заполнен
ALTER TABLE company_members ADD CONSTRAINT company_members_email_or_user_id 
  CHECK (user_id IS NOT NULL OR email IS NOT NULL);

-- 5. Добавляем уникальный индекс на email + company_id для предотвращения дублей приглашений
DROP INDEX IF EXISTS idx_company_members_email_company;
CREATE UNIQUE INDEX idx_company_members_email_company 
  ON company_members(email, company_id) 
  WHERE user_id IS NULL;

COMMIT;
