-- ============================================
-- Обновление таблицы contract_templates для поддержки загрузки файлов
-- ============================================

-- Добавляем поля для хранения информации о файле
ALTER TABLE contract_templates 
ADD COLUMN IF NOT EXISTS file_path TEXT, -- Путь к файлу в Storage
ADD COLUMN IF NOT EXISTS file_name TEXT, -- Оригинальное имя файла
ADD COLUMN IF NOT EXISTS file_type TEXT, -- MIME тип (application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document)
ADD COLUMN IF NOT EXISTS file_size BIGINT, -- Размер файла в байтах
ADD COLUMN IF NOT EXISTS is_file_template BOOLEAN NOT NULL DEFAULT FALSE; -- Флаг: true = загруженный файл, false = текстовый шаблон

-- Создаем storage bucket для шаблонов договоров (если еще не создан)
-- Выполните это в Storage секции Supabase Dashboard или через API
-- Имя bucket: contract-templates
-- Public: false (файлы доступны только авторизованным пользователям)

-- Обновляем RLS политики для contract_templates
DROP POLICY IF EXISTS "Authenticated users can view contract templates" ON contract_templates;
CREATE POLICY "Authenticated users can view contract templates"
  ON contract_templates FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own contract templates" ON contract_templates;
CREATE POLICY "Users can insert their own contract templates"
  ON contract_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own contract templates" ON contract_templates;
CREATE POLICY "Users can update their own contract templates"
  ON contract_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own contract templates" ON contract_templates;
CREATE POLICY "Users can delete their own contract templates"
  ON contract_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- Инструкция по созданию Storage Bucket
-- ============================================
-- 1. Откройте Supabase Dashboard → Storage
-- 2. Нажмите "New bucket"
-- 3. Название: contract-templates
-- 4. Public bucket: NO (оставьте выключенным)
-- 5. Создайте bucket
-- 6. Перейдите в Policies и добавьте:
--    - SELECT: authenticated users can view files
--    - INSERT: authenticated users can upload files
--    - DELETE: authenticated users can delete their files
