-- Полная схема базы данных Supabase для СкладОборуд
-- Безопасная версия - можно запускать повторно

-- ============================================
-- 1. Таблица профилей пользователей
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('admin', 'manager', 'warehouse', 'accountant')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. Таблица категорий оборудования
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. Таблица оборудования
-- ============================================
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'шт',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. Таблица заказчиков
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'company' CHECK (type IN ('company', 'ip', 'individual')),
  inn TEXT,
  kpp TEXT,
  ogrn TEXT,
  legal_address TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  bank_name TEXT,
  bank_bik TEXT,
  bank_account TEXT,
  bank_corr_account TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. Таблица смет
-- ============================================
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  venue TEXT,
  event_date DATE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  creator_name TEXT,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. Таблица позиций смет
-- ============================================
CREATE TABLE IF NOT EXISTS estimate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'шт',
  coefficient DECIMAL(5, 2) NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. Таблица шаблонов
-- ============================================
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 8. Таблица позиций шаблонов
-- ============================================
CREATE TABLE IF NOT EXISTS template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  equipment_name TEXT NOT NULL,
  default_quantity INTEGER NOT NULL DEFAULT 1
);

-- ============================================
-- 9. Таблица персонала
-- ============================================
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  birth_date DATE,
  passport_series TEXT,
  passport_number TEXT,
  passport_issued_by TEXT,
  passport_issue_date DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 10. Таблица задач (goals)
-- ============================================
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'other',
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date DATE,
  assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 11. Таблица правил чек-листов
-- ============================================
CREATE TABLE IF NOT EXISTS checklist_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  condition_type TEXT NOT NULL DEFAULT 'category' CHECK (condition_type IN ('category', 'equipment')),
  condition_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 12. Таблица позиций правил чек-листов
-- ============================================
CREATE TABLE IF NOT EXISTS checklist_rule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES checklist_rules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL DEFAULT 'other',
  is_required BOOLEAN NOT NULL DEFAULT true
);

-- ============================================
-- 13. Таблица чек-листов
-- ============================================
CREATE TABLE IF NOT EXISTS checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 14. Таблица позиций чек-листов
-- ============================================
CREATE TABLE IF NOT EXISTS checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL DEFAULT 'other',
  is_required BOOLEAN NOT NULL DEFAULT true,
  is_checked BOOLEAN NOT NULL DEFAULT false,
  source_rule_id UUID REFERENCES checklist_rules(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- RLS (Row Level Security) политики
-- ============================================

-- Включить RLS для всех таблиц
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_rule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

-- Политики для profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Политики для categories (доступно всем авторизованным)
DROP POLICY IF EXISTS "Authenticated users can view categories" ON categories;
CREATE POLICY "Authenticated users can view categories" ON categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert categories" ON categories;
CREATE POLICY "Authenticated users can insert categories" ON categories FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON categories;
CREATE POLICY "Authenticated users can delete categories" ON categories FOR DELETE TO authenticated USING (true);

-- Политики для equipment
DROP POLICY IF EXISTS "Users can view own equipment" ON equipment;
CREATE POLICY "Users can view own equipment" ON equipment FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own equipment" ON equipment;
CREATE POLICY "Users can insert own equipment" ON equipment FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own equipment" ON equipment;
CREATE POLICY "Users can update own equipment" ON equipment FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own equipment" ON equipment;
CREATE POLICY "Users can delete own equipment" ON equipment FOR DELETE USING (auth.uid() = user_id);

-- Политики для customers
DROP POLICY IF EXISTS "Users can view own customers" ON customers;
CREATE POLICY "Users can view own customers" ON customers FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own customers" ON customers;
CREATE POLICY "Users can insert own customers" ON customers FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own customers" ON customers;
CREATE POLICY "Users can update own customers" ON customers FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own customers" ON customers;
CREATE POLICY "Users can delete own customers" ON customers FOR DELETE USING (auth.uid() = user_id);

-- Политики для estimates
DROP POLICY IF EXISTS "Users can view own estimates" ON estimates;
CREATE POLICY "Users can view own estimates" ON estimates FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own estimates" ON estimates;
CREATE POLICY "Users can insert own estimates" ON estimates FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own estimates" ON estimates;
CREATE POLICY "Users can update own estimates" ON estimates FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own estimates" ON estimates;
CREATE POLICY "Users can delete own estimates" ON estimates FOR DELETE USING (auth.uid() = user_id);

-- Политики для estimate_items
DROP POLICY IF EXISTS "Users can view own estimate items" ON estimate_items;
CREATE POLICY "Users can view own estimate items" ON estimate_items FOR SELECT 
  USING (EXISTS (SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id AND estimates.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert own estimate items" ON estimate_items;
CREATE POLICY "Users can insert own estimate items" ON estimate_items FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id AND estimates.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete own estimate items" ON estimate_items;
CREATE POLICY "Users can delete own estimate items" ON estimate_items FOR DELETE 
  USING (EXISTS (SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id AND estimates.user_id = auth.uid()));

-- Политики для templates
DROP POLICY IF EXISTS "Users can view own templates" ON templates;
CREATE POLICY "Users can view own templates" ON templates FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own templates" ON templates;
CREATE POLICY "Users can insert own templates" ON templates FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own templates" ON templates;
CREATE POLICY "Users can update own templates" ON templates FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own templates" ON templates;
CREATE POLICY "Users can delete own templates" ON templates FOR DELETE USING (auth.uid() = user_id);

-- Политики для template_items
DROP POLICY IF EXISTS "Users can view own template items" ON template_items;
CREATE POLICY "Users can view own template items" ON template_items FOR SELECT 
  USING (EXISTS (SELECT 1 FROM templates WHERE templates.id = template_items.template_id AND templates.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert own template items" ON template_items;
CREATE POLICY "Users can insert own template items" ON template_items FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM templates WHERE templates.id = template_items.template_id AND templates.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete own template items" ON template_items;
CREATE POLICY "Users can delete own template items" ON template_items FOR DELETE 
  USING (EXISTS (SELECT 1 FROM templates WHERE templates.id = template_items.template_id AND templates.user_id = auth.uid()));

-- Политики для staff
DROP POLICY IF EXISTS "Users can view own staff" ON staff;
CREATE POLICY "Users can view own staff" ON staff FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own staff" ON staff;
CREATE POLICY "Users can insert own staff" ON staff FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own staff" ON staff;
CREATE POLICY "Users can update own staff" ON staff FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own staff" ON staff;
CREATE POLICY "Users can delete own staff" ON staff FOR DELETE USING (auth.uid() = user_id);

-- Политики для goals
DROP POLICY IF EXISTS "Users can view own goals" ON goals;
CREATE POLICY "Users can view own goals" ON goals FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own goals" ON goals;
CREATE POLICY "Users can insert own goals" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own goals" ON goals;
CREATE POLICY "Users can update own goals" ON goals FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own goals" ON goals;
CREATE POLICY "Users can delete own goals" ON goals FOR DELETE USING (auth.uid() = user_id);

-- Политики для checklist_rules
DROP POLICY IF EXISTS "Users can view own checklist rules" ON checklist_rules;
CREATE POLICY "Users can view own checklist rules" ON checklist_rules FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own checklist rules" ON checklist_rules;
CREATE POLICY "Users can insert own checklist rules" ON checklist_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own checklist rules" ON checklist_rules;
CREATE POLICY "Users can update own checklist rules" ON checklist_rules FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own checklist rules" ON checklist_rules;
CREATE POLICY "Users can delete own checklist rules" ON checklist_rules FOR DELETE USING (auth.uid() = user_id);

-- Политики для checklist_rule_items
DROP POLICY IF EXISTS "Users can view own checklist rule items" ON checklist_rule_items;
CREATE POLICY "Users can view own checklist rule items" ON checklist_rule_items FOR SELECT 
  USING (EXISTS (SELECT 1 FROM checklist_rules WHERE checklist_rules.id = checklist_rule_items.rule_id AND checklist_rules.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert own checklist rule items" ON checklist_rule_items;
CREATE POLICY "Users can insert own checklist rule items" ON checklist_rule_items FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM checklist_rules WHERE checklist_rules.id = checklist_rule_items.rule_id AND checklist_rules.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete own checklist rule items" ON checklist_rule_items;
CREATE POLICY "Users can delete own checklist rule items" ON checklist_rule_items FOR DELETE 
  USING (EXISTS (SELECT 1 FROM checklist_rules WHERE checklist_rules.id = checklist_rule_items.rule_id AND checklist_rules.user_id = auth.uid()));

-- Политики для checklists
DROP POLICY IF EXISTS "Users can view own checklists" ON checklists;
CREATE POLICY "Users can view own checklists" ON checklists FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own checklists" ON checklists;
CREATE POLICY "Users can insert own checklists" ON checklists FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own checklists" ON checklists;
CREATE POLICY "Users can update own checklists" ON checklists FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own checklists" ON checklists;
CREATE POLICY "Users can delete own checklists" ON checklists FOR DELETE USING (auth.uid() = user_id);

-- Политики для checklist_items
DROP POLICY IF EXISTS "Users can view own checklist items" ON checklist_items;
CREATE POLICY "Users can view own checklist items" ON checklist_items FOR SELECT 
  USING (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert own checklist items" ON checklist_items;
CREATE POLICY "Users can insert own checklist items" ON checklist_items FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update own checklist items" ON checklist_items;
CREATE POLICY "Users can update own checklist items" ON checklist_items FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete own checklist items" ON checklist_items;
CREATE POLICY "Users can delete own checklist items" ON checklist_items FOR DELETE 
  USING (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));

-- ============================================
-- Функция для автоматического обновления updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для обновления updated_at (с удалением если существуют)
DROP TRIGGER IF EXISTS update_equipment_updated_at ON equipment;
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_estimates_updated_at ON estimates;
CREATE TRIGGER update_estimates_updated_at BEFORE UPDATE ON estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_staff_updated_at ON staff;
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_goals_updated_at ON goals;
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_checklists_updated_at ON checklists;
CREATE TRIGGER update_checklists_updated_at BEFORE UPDATE ON checklists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Начальные данные
-- ============================================
INSERT INTO categories (name) VALUES
  ('Звук'),
  ('Свет'),
  ('Видео'),
  ('Сцена'),
  ('Кабели'),
  ('Аксессуары')
ON CONFLICT (name) DO NOTHING;
- -    ^ �  �  �  Q!   �    � � !   Q  � Q  Q �!S �  � !
 !9 !&    W! �     W U � !
 �  U  � !  �  �  �  ! 
 - -    _ U �   U � ! � !    �  � X Q !S    �  �   � !!  � ! !
   T U  T! � !  !9  �     T �  �  � T Q   T �  �  � U X!S   W U � !
 �  U  � !  �  � ! 
  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   u s e r _ p e r m i s s i o n s   (  
     i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) ,  
     u s e r _ i d   U U I D   N O T   N U L L   R E F E R E N C E S   a u t h . u s e r s ( i d )   O N   D E L E T E   C A S C A D E ,  
     a l l o w e d _ t a b s   T E X T [ ]   N O T   N U L L   D E F A U L T   ' { } ' ,  
     c a n _ e d i t   B O O L E A N   N O T   N U L L   D E F A U L T   t r u e ,  
     c a n _ d e l e t e   B O O L E A N   N O T   N U L L   D E F A U L T   t r u e ,  
     c a n _ e x p o r t   B O O L E A N   N O T   N U L L   D E F A U L T   t r u e ,  
     c r e a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   D E F A U L T   N O W ( ) ,  
     u p d a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   D E F A U L T   N O W ( ) ,  
     U N I Q U E ( u s e r _ i d )  
 ) ;  
  
 - -   R L S    � � !  u s e r _ p e r m i s s i o n s  
 A L T E R   T A B L E   u s e r _ p e r m i s s i o n s   E N A B L E   R O W   L E V E L   S E C U R I T Y ;  
  
 - -    R � X Q     Q � Q!    ! �    W! �   �  
 C R E A T E   P O L I C Y   " A d m i n   c a n   v i e w   a l l   p e r m i s s i o n s "   O N   u s e r _ p e r m i s s i o n s    
     F O R   S E L E C T   T O   a u t h e n t i c a t e d    
     U S I N G   ( E X I S T S   ( S E L E C T   1   F R O M   p r o f i l e s   W H E R E   p r o f i l e s . i d   =   a u t h . u i d ( )   A N D   p r o f i l e s . r o l e   =   ' a d m i n ' ) ) ;  
  
 - -    _ U � !
 �  U  � !  �  � !
    Q � Q!   !  U Q   W! �   �  
 C R E A T E   P O L I C Y   " U s e r s   c a n   v i e w   o w n   p e r m i s s i o n s "   O N   u s e r _ p e r m i s s i o n s    
     F O R   S E L E C T   T O   a u t h e n t i c a t e d    
     U S I N G   ( a u t h . u i d ( )   =   u s e r _ i d ) ;  
  
 - -    ^ U � !
 T U   �  � X Q    X U �  � !    X �  !! !
   W! �   �  
 C R E A T E   P O L I C Y   " A d m i n   c a n   i n s e r t   p e r m i s s i o n s "   O N   u s e r _ p e r m i s s i o n s    
     F O R   I N S E R T   T O   a u t h e n t i c a t e d    
     W I T H   C H E C K   ( E X I S T S   ( S E L E C T   1   F R O M   p r o f i l e s   W H E R E   p r o f i l e s . i d   =   a u t h . u i d ( )   A N D   p r o f i l e s . r o l e   =   ' a d m i n ' ) ) ;  
  
 C R E A T E   P O L I C Y   " A d m i n   c a n   u p d a t e   p e r m i s s i o n s "   O N   u s e r _ p e r m i s s i o n s    
     F O R   U P D A T E   T O   a u t h e n t i c a t e d    
     U S I N G   ( E X I S T S   ( S E L E C T   1   F R O M   p r o f i l e s   W H E R E   p r o f i l e s . i d   =   a u t h . u i d ( )   A N D   p r o f i l e s . r o l e   =   ' a d m i n ' ) ) ;  
  
 C R E A T E   P O L I C Y   " A d m i n   c a n   d e l e t e   p e r m i s s i o n s "   O N   u s e r _ p e r m i s s i o n s    
     F O R   D E L E T E   T O   a u t h e n t i c a t e d    
     U S I N G   ( E X I S T S   ( S E L E C T   1   F R O M   p r o f i l e s   W H E R E   p r o f i l e s . i d   =   a u t h . u i d ( )   A N D   p r o f i l e s . r o l e   =   ' a d m i n ' ) ) ;  
  
 - -    ^! Q V V � !   � � !  u p d a t e d _ a t  
 D R O P   T R I G G E R   I F   E X I S T S   u p d a t e _ u s e r _ p e r m i s s i o n s _ u p d a t e d _ a t   O N   u s e r _ p e r m i s s i o n s ;  
 C R E A T E   T R I G G E R   u p d a t e _ u s e r _ p e r m i s s i o n s _ u p d a t e d _ a t    
     B E F O R E   U P D A T E   O N   u s e r _ p e r m i s s i o n s    
     F O R   E A C H   R O W    
     E X E C U T E   F U N C T I O N   u p d a t e _ u p d a t e d _ a t _ c o l u m n ( ) ;  
  
 - -    � !S  T!   Q!   � � !   �  !  U X � !  Q!!  � ! T U V U  ! U �  � �   Q!   W! �     W! Q  ! �  V Q!! ! � !   Q Q 
 C R E A T E   O R   R E P L A C E   F U N C T I O N   c r e a t e _ d e f a u l t _ u s e r _ p e r m i s s i o n s ( )  
 R E T U R N S   T R I G G E R   A S   $ $  
 B E G I N  
     - -     U �  � � !  X   W! �   �    W U  !S X U � !!  �   Q!    �    U!  U  �   ! U �  Q 
     I N S E R T   I N T O   u s e r _ p e r m i s s i o n s   ( u s e r _ i d ,   a l l o w e d _ t a b s ,   c a n _ e d i t ,   c a n _ d e l e t e ,   c a n _ e x p o r t )  
     V A L U E S   (  
         N E W . i d ,  
         C A S E    
             W H E N   N E W . r o l e   =   ' a d m i n '   T H E N   A R R A Y [ ' e q u i p m e n t ' ,   ' e s t i m a t e s ' ,   ' t e m p l a t e s ' ,   ' c a l e n d a r ' ,   ' c h e c k l i s t s ' ,   ' s t a f f ' ,   ' g o a l s ' ,   ' a n a l y t i c s ' ,   ' c u s t o m e r s ' ,   ' s e t t i n g s ' ,   ' a d m i n ' ]  
             W H E N   N E W . r o l e   =   ' m a n a g e r '   T H E N   A R R A Y [ ' e q u i p m e n t ' ,   ' e s t i m a t e s ' ,   ' t e m p l a t e s ' ,   ' c a l e n d a r ' ,   ' c h e c k l i s t s ' ,   ' g o a l s ' ,   ' a n a l y t i c s ' ,   ' c u s t o m e r s ' ]  
             W H E N   N E W . r o l e   =   ' w a r e h o u s e '   T H E N   A R R A Y [ ' e q u i p m e n t ' ,   ' c h e c k l i s t s ' ,   ' c a l e n d a r ' ]  
             W H E N   N E W . r o l e   =   ' a c c o u n t a n t '   T H E N   A R R A Y [ ' e s t i m a t e s ' ,   ' a n a l y t i c s ' ,   ' c u s t o m e r s ' ,   ' c a l e n d a r ' ]  
             E L S E   A R R A Y [ ' e q u i p m e n t ' ,   ' c a l e n d a r ' ]  
         E N D ,  
         N E W . r o l e   I N   ( ' a d m i n ' ,   ' m a n a g e r ' ,   ' w a r e h o u s e ' ) ,  
         N E W . r o l e   I N   ( ' a d m i n ' ,   ' m a n a g e r ' ) ,  
         N E W . r o l e   I N   ( ' a d m i n ' ,   ' m a n a g e r ' ,   ' a c c o u n t a n t ' )  
     )  
     O N   C O N F L I C T   ( u s e r _ i d )   D O   U P D A T E   S E T  
         a l l o w e d _ t a b s   =   E X C L U D E D . a l l o w e d _ t a b s ,  
         c a n _ e d i t   =   E X C L U D E D . c a n _ e d i t ,  
         c a n _ d e l e t e   =   E X C L U D E D . c a n _ d e l e t e ,  
         c a n _ e x p o r t   =   E X C L U D E D . c a n _ e x p o r t ,  
         u p d a t e d _ a t   =   N O W ( ) ;  
      
     R E T U R N   N E W ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l ;  
  
 - -    ^! Q V V � !   � � !   �  !  U! U �  � �   Q!   W! �     W! Q  ! U �  � �   Q Q   W! U!  Q � ! 
 D R O P   T R I G G E R   I F   E X I S T S   a u t o _ c r e a t e _ p e r m i s s i o n s   O N   p r o f i l e s ;  
 C R E A T E   T R I G G E R   a u t o _ c r e a t e _ p e r m i s s i o n s  
     A F T E R   I N S E R T   O R   U P D A T E   O F   r o l e   O N   p r o f i l e s  
     F O R   E A C H   R O W  
     E X E C U T E   F U N C T I O N   c r e a t e _ d e f a u l t _ u s e r _ p e r m i s s i o n s ( ) ;  
  
 - -     U �  � � !  X   W! �   �    � � !  !!S!0  � !!  !S!!0  Q!&    W U � !
 �  U  � !  �  �  �  ! 
 I N S E R T   I N T O   u s e r _ p e r m i s s i o n s   ( u s e r _ i d ,   a l l o w e d _ t a b s ,   c a n _ e d i t ,   c a n _ d e l e t e ,   c a n _ e x p o r t )  
 S E L E C T    
     p . i d ,  
     C A S E    
         W H E N   p . r o l e   =   ' a d m i n '   T H E N   A R R A Y [ ' e q u i p m e n t ' ,   ' e s t i m a t e s ' ,   ' t e m p l a t e s ' ,   ' c a l e n d a r ' ,   ' c h e c k l i s t s ' ,   ' s t a f f ' ,   ' g o a l s ' ,   ' a n a l y t i c s ' ,   ' c u s t o m e r s ' ,   ' s e t t i n g s ' ,   ' a d m i n ' ]  
         W H E N   p . r o l e   =   ' m a n a g e r '   T H E N   A R R A Y [ ' e q u i p m e n t ' ,   ' e s t i m a t e s ' ,   ' t e m p l a t e s ' ,   ' c a l e n d a r ' ,   ' c h e c k l i s t s ' ,   ' g o a l s ' ,   ' a n a l y t i c s ' ,   ' c u s t o m e r s ' ]  
         W H E N   p . r o l e   =   ' w a r e h o u s e '   T H E N   A R R A Y [ ' e q u i p m e n t ' ,   ' c h e c k l i s t s ' ,   ' c a l e n d a r ' ]  
         W H E N   p . r o l e   =   ' a c c o u n t a n t '   T H E N   A R R A Y [ ' e s t i m a t e s ' ,   ' a n a l y t i c s ' ,   ' c u s t o m e r s ' ,   ' c a l e n d a r ' ]  
         E L S E   A R R A Y [ ' e q u i p m e n t ' ,   ' c a l e n d a r ' ]  
     E N D ,  
     p . r o l e   I N   ( ' a d m i n ' ,   ' m a n a g e r ' ,   ' w a r e h o u s e ' ) ,  
     p . r o l e   I N   ( ' a d m i n ' ,   ' m a n a g e r ' ) ,  
     p . r o l e   I N   ( ' a d m i n ' ,   ' m a n a g e r ' ,   ' a c c o u n t a n t ' )  
 F R O M   p r o f i l e s   p  
 L E F T   J O I N   u s e r _ p e r m i s s i o n s   u p   O N   p . i d   =   u p . u s e r _ i d  
 W H E R E   u p . i d   I S   N U L L  
 O N   C O N F L I C T   ( u s e r _ i d )   D O   N O T H I N G ;  
 