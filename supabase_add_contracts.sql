-- ============================================
-- Таблицы для работы с договорами
-- ============================================
-- Инструкция: Выполните этот скрипт в Supabase Dashboard → SQL Editor
-- ============================================

-- Проверяем существование функции update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Таблица шаблонов договоров
CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'service' CHECK (type IN ('service', 'rent', 'supply', 'mixed')),
  content TEXT NOT NULL, -- HTML-шаблон с плейсхолдерами
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Добавляем уникальное ограничение для шаблона по умолчанию (только один default на тип)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_templates_default_type 
  ON contract_templates (type, is_default) 
  WHERE is_default = TRUE;

-- 2. Таблица договоров
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  template_id UUID REFERENCES contract_templates(id) ON DELETE SET NULL,
  
  -- Основные поля договора
  number TEXT NOT NULL, -- Номер договора (например "13-25У")
  date DATE NOT NULL, -- Дата подписания
  type TEXT NOT NULL DEFAULT 'service' CHECK (type IN ('service', 'rent', 'supply', 'mixed')),
  subject TEXT, -- Предмет договора
  
  -- Финансы
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_terms TEXT, -- Условия оплаты
  
  -- Мероприятие
  event_name TEXT,
  event_start_date DATE,
  event_end_date DATE,
  venue TEXT, -- Место проведения
  
  -- Исполнитель (наши реквизиты)
  executor_name TEXT, -- Наименование ИП/ООО
  executor_representative TEXT, -- Представитель
  executor_basis TEXT, -- Основание (Устав, доверенность)
  
  -- Статус
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed', 'in_progress', 'completed', 'cancelled')),
  
  -- Дополнительные условия
  additional_terms TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индекс для быстрого поиска по номеру договора
CREATE INDEX IF NOT EXISTS idx_contracts_number ON contracts (number);
CREATE INDEX IF NOT EXISTS idx_contracts_customer_id ON contracts (customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts (status);
CREATE INDEX IF NOT EXISTS idx_contracts_date ON contracts (date);

-- 3. Связующая таблица: договор ↔ смета (многие-ко-многим)
CREATE TABLE IF NOT EXISTS contract_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0, -- Порядок смет в договоре
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(contract_id, estimate_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_estimates_contract_id ON contract_estimates (contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_estimates_estimate_id ON contract_estimates (estimate_id);

-- ============================================
-- RLS (Row Level Security)
-- ============================================

ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_estimates ENABLE ROW LEVEL SECURITY;

-- Политики для contract_templates
DROP POLICY IF EXISTS "Authenticated users can view contract templates" ON contract_templates;
CREATE POLICY "Authenticated users can view contract templates" 
  ON contract_templates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own contract templates" ON contract_templates;
CREATE POLICY "Users can insert own contract templates" 
  ON contract_templates FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own contract templates" ON contract_templates;
CREATE POLICY "Users can update own contract templates" 
  ON contract_templates FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own contract templates" ON contract_templates;
CREATE POLICY "Users can delete own contract templates" 
  ON contract_templates FOR DELETE USING (auth.uid() = user_id);

-- Политики для contracts
DROP POLICY IF EXISTS "Users can view own contracts" ON contracts;
CREATE POLICY "Users can view own contracts" 
  ON contracts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own contracts" ON contracts;
CREATE POLICY "Users can insert own contracts" 
  ON contracts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own contracts" ON contracts;
CREATE POLICY "Users can update own contracts" 
  ON contracts FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own contracts" ON contracts;
CREATE POLICY "Users can delete own contracts" 
  ON contracts FOR DELETE USING (auth.uid() = user_id);

-- Политики для contract_estimates
DROP POLICY IF EXISTS "Users can view own contract estimates" ON contract_estimates;
CREATE POLICY "Users can view own contract estimates" 
  ON contract_estimates FOR SELECT 
  USING (EXISTS (SELECT 1 FROM contracts WHERE contracts.id = contract_estimates.contract_id AND contracts.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own contract estimates" ON contract_estimates;
CREATE POLICY "Users can insert own contract estimates" 
  ON contract_estimates FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM contracts WHERE contracts.id = contract_estimates.contract_id AND contracts.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own contract estimates" ON contract_estimates;
CREATE POLICY "Users can delete own contract estimates" 
  ON contract_estimates FOR DELETE 
  USING (EXISTS (SELECT 1 FROM contracts WHERE contracts.id = contract_estimates.contract_id AND contracts.user_id = auth.uid()));

-- ============================================
-- Триггеры для обновления updated_at
-- ============================================

DROP TRIGGER IF EXISTS update_contracts_updated_at ON contracts;
CREATE TRIGGER update_contracts_updated_at 
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contract_templates_updated_at ON contract_templates;
CREATE TRIGGER update_contract_templates_updated_at 
  BEFORE UPDATE ON contract_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Real-time подписки
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'contracts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE contracts;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'contract_templates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE contract_templates;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'contract_estimates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE contract_estimates;
  END IF;
END $$;

-- ============================================
-- Начальные данные: шаблон договора услуг
-- ============================================

-- Проверяем, есть ли уже шаблоны
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM contract_templates WHERE is_default = TRUE AND type = 'service') THEN
    INSERT INTO contract_templates (name, type, content, description, is_default) VALUES
    (
      'Договор возмездного оказания услуг (стандартный)',
      'service',
      '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.5; }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .underline { text-decoration: underline; }
    .contract-number { text-align: center; margin-bottom: 20px; }
    .parties { margin: 20px 0; text-align: justify; }
    .section { margin: 15px 0; }
    .section-title { font-weight: bold; text-transform: uppercase; margin: 10px 0; }
    .signatures { margin-top: 50px; display: flex; justify-content: space-between; }
    .signature-block { width: 45%; }
    table.spec { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10pt; }
    table.spec th, table.spec td { border: 1px solid #000; padding: 5px; text-align: left; }
    table.spec th { background-color: #f0f0f0; }
  </style>
</head>
<body>
  <div class="center bold" style="font-size: 14pt;">ДОГОВОР ВОЗМЕЗДНОГО ОКАЗАНИЯ УСЛУГ</div>
  <div class="contract-number">№ {{contract_number}} от {{contract_date}}</div>
  
  <div class="parties">
    {{executor_name}}, именуемое в дальнейшем «Исполнитель», в лице {{executor_representative}}, 
    действующего на основании {{executor_basis}}, с одной стороны, и 
    {{customer_name}}, именуемое в дальнейшем «Заказчик», в лице {{customer_representative}}, 
    действующего на основании {{customer_basis}}, с другой стороны, вместе именуемые «Стороны», 
    заключили настоящий договор о нижеследующем:
  </div>

  <div class="section">
    <div class="section-title">1. Предмет договора</div>
    <p>1.1. По настоящему Договору Исполнитель обязуется по заданию Заказчика оказать услуги 
    по техническому оснащению мероприятия «{{event_name}}», {{event_date}}, с этой целью:</p>
    <p>— обеспечить звуковым и световым оборудованием в необходимой комплектации;</p>
    <p>— произвести монтаж и демонтаж оборудования;</p>
    <p>— обеспечить работу технических специалистов для сопровождения мероприятия.</p>
    <p>1.2. Заказчик обязуется принять и оплатить услуги согласно спецификации (Приложение № 1), 
    являющейся неотъемлемой частью настоящего Договора.</p>
  </div>

  <div class="section">
    <div class="section-title">2. Цена договора и порядок расчетов</div>
    <p>2.1. Стоимость услуг составляет {{total_amount}} ({{total_amount_text}}) рублей, НДС не облагается.</p>
    <p>2.2. {{payment_terms}}</p>
  </div>

  <div class="section">
    <div class="section-title">3. Сроки оказания услуг</div>
    <p>3.1. Услуги оказываются: {{event_date}}.</p>
    <p>3.2. Место оказания услуг: {{event_venue}}.</p>
  </div>

  <div class="section">
    <div class="section-title">4. Ответственность сторон</div>
    <p>4.1. Стороны несут ответственность за нарушение условий настоящего Договора 
    в соответствии с законодательством РФ.</p>
    <p>4.2. Сторона, не исполнившая или ненадлежащим образом исполнившая обязательства, 
    обязана возместить другой стороне причиненные убытки.</p>
  </div>

  <div class="section">
    <div class="section-title">5. Заключительные положения</div>
    <p>5.1. Настоящий Договор вступает в силу с момента подписания и действует до полного 
    исполнения сторонами своих обязательств.</p>
    <p>5.2. Договор составлен в двух экземплярах, имеющих одинаковую юридическую силу.</p>
    <p>5.3. Изменения и дополнения к Договору действительны при условии их письменного 
    оформления и подписания обеими Сторонами.</p>
  </div>

  <div class="section">
    <div class="section-title">6. Адреса и реквизиты сторон</div>
    <div class="signatures">
      <div class="signature-block">
        <p class="bold">Исполнитель:</p>
        <p>{{executor_name}}</p>
        <p>{{executor_representative}}</p>
        <br><br>
        <p>_______________ / _______________</p>
      </div>
      <div class="signature-block">
        <p class="bold">Заказчик:</p>
        <p>{{customer_name}}</p>
        <p>{{customer_representative}}</p>
        <br><br>
        <p>_______________ / _______________</p>
      </div>
    </div>
  </div>

  <div style="page-break-before: always;">
    <div class="center bold" style="font-size: 14pt; margin-bottom: 20px;">
      Приложение № 1
    </div>
    <div class="center" style="margin-bottom: 20px;">
      к Договору возмездного оказания услуг<br>
      № {{contract_number}} от {{contract_date}}
    </div>
    <div class="center bold" style="font-size: 13pt; margin-bottom: 15px;">
      СПЕЦИФИКАЦИЯ
    </div>
    
    {{specification_table}}
    
    <div style="margin-top: 30px; font-weight: bold;">
      Итого: {{total_amount}} руб.
    </div>
    
    <div style="margin-top: 40px;">
      <p>Согласовано:</p>
      <div class="signatures" style="margin-top: 20px;">
        <div class="signature-block">
          <p>От Исполнителя:</p>
          <p>_______________ / _______________</p>
        </div>
        <div class="signature-block">
          <p>От Заказчика:</p>
          <p>_______________ / _______________</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>',
      'Стандартный шаблон договора на оказание услуг по техническому оснащению мероприятий',
      TRUE
    );
  END IF;
END $$;

-- ============================================
-- Проверка создания таблиц
-- ============================================
SELECT 'Таблицы созданы успешно!' as status;
