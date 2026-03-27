-- Таблица для хранения настроек Яндекс Диска компании
CREATE TABLE IF NOT EXISTS company_yandex_disk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token TEXT NOT NULL, -- OAuth токен Яндекс Диска
  folder_path TEXT NOT NULL DEFAULT '/stwarehouse',
  connected_by UUID REFERENCES auth.users(id), -- Кто подключил токен
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_company_yandex_disk_company_id ON company_yandex_disk(company_id);

-- RLS
ALTER TABLE company_yandex_disk ENABLE ROW LEVEL SECURITY;

-- Политики безопасности
DROP POLICY IF EXISTS "Company members can view yandex disk settings" ON company_yandex_disk;
DROP POLICY IF EXISTS "Company owners can manage yandex disk" ON company_yandex_disk;

-- Чтение для всех членов компании
CREATE POLICY "Company members can view yandex disk settings"
  ON company_yandex_disk FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = company_yandex_disk.company_id 
    AND user_id = auth.uid() 
    AND status = 'active'
  ));

-- Управление только для владельцев и админов
CREATE POLICY "Company owners can manage yandex disk"
  ON company_yandex_disk FOR ALL
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = company_yandex_disk.company_id 
    AND user_id = auth.uid() 
    AND status = 'active'
    AND role IN ('owner', 'admin')
  ));

SELECT 'Таблица company_yandex_disk создана' as status;
