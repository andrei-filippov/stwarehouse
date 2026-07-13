-- ============================================
-- Миграция: Вкладки "Площадки" и "Проекты"
-- Дата: 2026-07-07
-- ============================================

-- ============================================
-- 1. Таблица venue_details (справочник площадок)
-- ============================================

CREATE TABLE IF NOT EXISTS venue_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Основное
  name text NOT NULL,
  address text,
  city text,
  
  -- Контакты
  contact_name text,
  contact_phone text,
  contact_email text,
  
  -- Электричество
  has_380v boolean DEFAULT false,
  power_capacity_kw integer,
  power_notes text,
  
  -- Кабельная трасса
  cable_distance_m numeric(5,1),
  cable_routing_type text CHECK (cable_routing_type IN ('открытая', 'закрытая', 'временная', 'неизвестно')),
  cable_path_description text,
  cable_interference text,
  cable_mounting text,
  
  -- Вместимость
  guest_capacity integer,
  seating_capacity integer,
  standing_capacity integer,
  
  -- Логистика / заезд
  load_in_info text,
  loading_dock boolean DEFAULT false,
  elevator boolean DEFAULT false,
  elevator_capacity_kg integer,
  door_width_m numeric(3,1),
  parking_info text,
  truck_access boolean DEFAULT false,
  
  -- Сцена
  stage_width_m numeric(5,2),
  stage_depth_m numeric(5,2),
  stage_height_m numeric(5,2),
  has_foh boolean DEFAULT false,
  has_monitors boolean DEFAULT false,
  dressing_rooms integer,
  
  -- Свет / подвес
  light_rig_type text CHECK (light_rig_type IN ('ферма', 'штанкет', 'точечные анкера', 'стойки', 'невозможно', 'встроенный')),
  light_rig_height_m numeric(5,2),
  light_rig_capacity_kg_m numeric(5,1),
  light_rig_description text,
  light_rig_anchors text,
  light_rig_access text,
  light_rig_photos text[],
  
  -- Звук / акустика
  has_builtin_sound boolean DEFAULT false,
  builtin_sound_description text,
  builtin_sound_console text,
  sound_notes text,
  
  -- Видео / экраны
  has_builtin_video boolean DEFAULT false,
  builtin_video_description text,
  
  -- Инфраструктура
  has_wifi boolean DEFAULT false,
  has_internet boolean DEFAULT false,
  internet_notes text,
  catering text,
  storage_space text,
  
  -- Фото / документы
  photos text[],
  stage_plan_url text,
  tech_rider_url text,
  
  -- Заметки
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_venue_details_company_id ON venue_details(company_id);
CREATE INDEX IF NOT EXISTS idx_venue_details_city ON venue_details(city);

-- ============================================
-- 2. Таблица projects (производная от estimates)
-- ============================================

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  estimate_id uuid NOT NULL UNIQUE REFERENCES estimates(id) ON DELETE CASCADE,
  venue_id uuid REFERENCES venue_details(id) ON DELETE SET NULL,
  
  -- Только данные, которых нет в смете
  guest_count integer,
  expected_attendance integer,
  tech_rider text,
  stage_plan_url text,
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_projects_estimate_id ON projects(estimate_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_venue_id ON projects(venue_id);

-- ============================================
-- 3. Таблица project_staff (задействованный персонал)
-- ============================================

CREATE TYPE project_role AS ENUM (
  'montage',
  'demontage',
  'sound_engineer',
  'monitor_engineer',
  'light_engineer',
  'video_engineer',
  'system_engineer',
  'stage_tech',
  'stage_manager',
  'project_manager',
  'technical_director',
  'backline_tech',
  'rf_tech',
  'cable_tech',
  'driver',
  'other'
);

CREATE TABLE IF NOT EXISTS project_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Персонал: либо из staff, либо внешний
  staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  
  -- Данные фрилансера (если staff_id is null)
  external_name text,
  external_phone text,
  external_email text,
  external_notes text,
  
  -- Роль на проекте
  role project_role NOT NULL,
  custom_role text,
  
  -- Смена
  shift_start timestamptz,
  shift_end timestamptz,
  
  -- Статус
  confirmed boolean DEFAULT false,
  
  -- Заметки
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_staff_project_id ON project_staff(project_id);
CREATE INDEX IF NOT EXISTS idx_project_staff_company_id ON project_staff(company_id);
CREATE INDEX IF NOT EXISTS idx_project_staff_staff_id ON project_staff(staff_id);

-- ============================================
-- 4. Таблица project_timeline (график / таймлайн)
-- ============================================

CREATE TYPE timeline_phase AS ENUM (
  'load_in',
  'setup',
  'soundcheck',
  'rehearsal',
  'show',
  'break',
  'breakdown',
  'load_out',
  'custom'
);

CREATE TABLE IF NOT EXISTS project_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  phase timeline_phase NOT NULL,
  custom_phase_name text,
  
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  
  description text,
  responsible_staff_id uuid REFERENCES project_staff(id) ON DELETE SET NULL,
  
  color text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_timeline_project_id ON project_timeline(project_id);
CREATE INDEX IF NOT EXISTS idx_project_timeline_company_id ON project_timeline(company_id);

-- ============================================
-- 5. Триггер автосоздания проекта из сметы
-- ============================================

CREATE OR REPLACE FUNCTION sync_project_from_estimate()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO projects (company_id, estimate_id, venue_id)
    VALUES (NEW.company_id, NEW.id, NULL)
    ON CONFLICT (estimate_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS estimate_project_sync ON estimates;
CREATE TRIGGER estimate_project_sync
AFTER INSERT ON estimates
FOR EACH ROW
EXECUTE FUNCTION sync_project_from_estimate();

-- ============================================
-- 6. RLS политики
-- ============================================

-- venue_details
ALTER TABLE venue_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue_details_select" ON venue_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = venue_details.company_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "venue_details_insert" ON venue_details
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = venue_details.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND status = 'active'
    )
  );

CREATE POLICY "venue_details_update" ON venue_details
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = venue_details.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND status = 'active'
    )
  );

CREATE POLICY "venue_details_delete" ON venue_details
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = venue_details.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
    )
  );

-- projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = projects.company_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "projects_insert" ON projects
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = projects.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND status = 'active'
    )
  );

CREATE POLICY "projects_update" ON projects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = projects.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND status = 'active'
    )
  );

CREATE POLICY "projects_delete" ON projects
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = projects.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
    )
  );

-- project_staff
ALTER TABLE project_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_staff_select" ON project_staff
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = project_staff.company_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "project_staff_insert" ON project_staff
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = project_staff.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND status = 'active'
    )
  );

CREATE POLICY "project_staff_update" ON project_staff
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = project_staff.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND status = 'active'
    )
  );

CREATE POLICY "project_staff_delete" ON project_staff
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = project_staff.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND status = 'active'
    )
  );

-- project_timeline
ALTER TABLE project_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_timeline_select" ON project_timeline
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = project_timeline.company_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "project_timeline_insert" ON project_timeline
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = project_timeline.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND status = 'active'
    )
  );

CREATE POLICY "project_timeline_update" ON project_timeline
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = project_timeline.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND status = 'active'
    )
  );

CREATE POLICY "project_timeline_delete" ON project_timeline
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = project_timeline.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND status = 'active'
    )
  );

-- ============================================
-- 7. Миграция существующих смет в проекты
-- ============================================

INSERT INTO projects (company_id, estimate_id, venue_id)
SELECT company_id, id, NULL
FROM estimates
ON CONFLICT (estimate_id) DO NOTHING;

-- ============================================
-- 8. Обновление чек-листов (добавить project_id)
-- ============================================

ALTER TABLE checklists ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

UPDATE checklists c
SET project_id = p.id
FROM projects p
WHERE c.estimate_id = p.estimate_id;

CREATE INDEX IF NOT EXISTS idx_checklists_project_id ON checklists(project_id);
