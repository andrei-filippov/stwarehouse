# План: Вкладка "Проекты"

> Дата: 2026-07-03
> Статус: Черновик плана (не для реализации)
> Цель: Единый проектный дашборд, объединяющий сметы, чек-листы, персонал, площадки и график

---

## 1. Принципы

- **Смета = мастер, Проект = производная** — смета создаёт и обновляет проект
- **Проект = Смета** — один проект привязан к одной смете (`estimate_id` FK, unique)
- **Нет дублирования данных** — название, даты, статус, сумма берутся из `estimates` через JOIN
- **Справочник площадок** — отдельная таблица с детальной информацией
- **Персонал** — из существующего `staff` + возможность добавить фрилансеров (внешние записи)
- **График** — визуальный таймлайн (полоска по часам)
- **Финансы** — не входят в скоуп вкладки
- **Полный функционал** сразу, без MVP-этапа

---

## 2. Архитектура данных

### 2.1 Поток данных (однонаправленный)

```
┌─────────────┐     INSERT/UPDATE     ┌─────────────┐
│  estimates  │ ─────────────────────→ │   projects  │
│  (мастер)   │   (триггер или хук)    │   (slave)   │
└─────────────┘                        └─────────────┘
        │                                    │
        │ FK estimate_id                     │ FK venue_id
        ↓                                    ↓
   ┌─────────┐                          ┌─────────────┐
   │estimate_items│                     │ venue_details│
   └─────────┘                          └─────────────┘
        │
        │
   ┌─────────┐
   │checklists│ ←── project_id (для быстрого доступа)
   └─────────┘      estimate_id (сохраняется для обратной совместимости)
```

**Правило:** Смета пишет в проект. Проект не пишет в смету.

---

## 3. Схема данных (Supabase)

### 3.1 Таблица `projects` (только доп.данные, без дублей)

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  estimate_id uuid not null unique references estimates(id) on delete cascade,
  venue_id uuid references venue_details(id) on delete set null,
  
  -- ТОЛЬКО данные, которых нет в смете:
  -- (name, event_date, status, total — берутся из estimates через JOIN)
  
  -- гости и аудитория
  guest_count integer,
  expected_attendance integer, -- ожидаемое количество
  
  -- технические заметки
  tech_rider text, -- технический райдер (текст/описание)
  stage_plan_url text, -- ссылка на план сцены
  
  -- метаданные
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Индексы для производительности JOIN
create index idx_projects_estimate_id on projects(estimate_id);
create index idx_projects_company_id on projects(company_id);
create index idx_projects_venue_id on projects(venue_id);
```

**RLS:**
```sql
-- read: company_id = user's company
-- write: company_id = user's company AND (owner OR manager role)
```

### 3.2 Триггер автосоздания проекта из сметы

```sql
-- При создании сметы → автоматически создать project
CREATE OR REPLACE FUNCTION sync_project_from_estimate()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO projects (company_id, estimate_id, venue_id)
    VALUES (NEW.company_id, NEW.id, NULL)
    ON CONFLICT (estimate_id) DO NOTHING;
  END IF;
  
  -- projects не хранит name, event_date, status — JOIN с estimates даёт актуальные данные всегда
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER estimate_project_sync
AFTER INSERT ON estimates
FOR EACH ROW
EXECUTE FUNCTION sync_project_from_estimate();
```

### 3.3 Таблица `venue_details` (справочник площадок)

```sql
create table venue_details (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  
  -- основное
  name text not null,
  address text,
  city text,
  
  -- контакты
  contact_name text,
  contact_phone text,
  contact_email text,
  
  -- электричество
  has_380v boolean default false,
  power_capacity_kw integer, -- мощность в кВт
  power_notes text, -- "3 фазы по 63А, распределительные щиты на сцене и в FOH"
  
  -- вместимость
  guest_capacity integer,
  seating_capacity integer,
  standing_capacity integer,
  
  -- доступ и логистика
  load_in_info text, -- "заезд с 06:00, грузовой лифт 2т, ширина двери 2.1м"
  parking_info text,
  loading_dock boolean default false,
  elevator boolean default false,
  elevator_capacity_kg integer,
  
  -- сцена
  stage_width_m numeric(5,2),
  stage_depth_m numeric(5,2),
  stage_height_m numeric(5,2),
  has_foh boolean default false, -- есть ли FOH-позиция
  has_monitors boolean default false, -- мониторная позиция
  
  -- сеть и коммуникации
  has_wifi boolean default false,
  has_internet boolean default false,
  internet_notes text,
  
  -- прочее
  catering text, -- условия питания
  dressing_rooms integer, -- количество гримерок
  storage_space text, -- складские помещения
  
  -- заметки
  notes text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 3.4 Таблица `project_staff` (задействованный персонал)

```sql
create type project_role as enum (
  'montage',           -- монтаж
  'demontage',         -- демонтаж
  'sound_engineer',    -- звукорежиссёр (FOH)
  'monitor_engineer',  -- мониторный инженер
  'light_engineer',    -- светорежиссёр
  'video_engineer',    -- видеоинженер
  'system_engineer',   -- системный инженер (сети, коммутация)
  'stage_tech',        -- техник сцены (stagehand)
  'stage_manager',     -- директор сцены / stage manager
  'project_manager',   -- руководитель проекта
  'technical_director',-- технический директор
  'backline_tech',     -- техник backline
  'rf_tech',           -- RF-техник (микрофоны, радио)
  'cable_tech',        -- кабельщик
  'driver',            -- водитель / грузоперевозки
  'other'              -- другое (указать в custom_role)
);

create table project_staff (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  
  -- персонал: либо из staff, либо внешний
  staff_id uuid references staff(id) on delete set null, -- null = фрилансер/внешний
  
  -- данные фрилансера (если staff_id is null)
  external_name text,
  external_phone text,
  external_email text,
  external_notes text,
  
  -- роль на проекте
  role project_role not null,
  custom_role text, -- если role = 'other'
  
  -- смена
  shift_start timestamptz,
  shift_end timestamptz,
  
  -- статус
  confirmed boolean default false, -- подтверждён ли сотрудник
  
  -- заметки
  notes text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 3.5 Таблица `project_timeline` (график / таймлайн)

```sql
create type timeline_phase as enum (
  'load_in',      -- заезд / выгрузка
  'setup',        -- монтаж оборудования
  'soundcheck',   -- саундчек
  'rehearsal',    -- репетиция
  'show',         -- шоу / мероприятие
  'break',        -- перерыв
  'breakdown',    -- демонтаж
  'load_out',     -- выезд
  'custom'        -- произвольный этап
);

create table project_timeline (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  
  phase timeline_phase not null,
  custom_phase_name text, -- если phase = 'custom'
  
  start_time timestamptz not null,
  end_time timestamptz, -- null = неопределённая длительность
  
  description text,
  responsible_staff_id uuid references project_staff(id) on delete set null, -- кто ответственный
  
  -- визуальные настройки
  color text, -- hex цвет для таймлайна
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

## 4. API / Хуки (React)

### 4.1 `useProjects(companyId)` — JOIN с estimates

```typescript
interface UseProjectsReturn {
  projects: ProjectWithDetails[];
  loading: boolean;
  refresh: () => void;
}

interface ProjectWithDetails {
  // из projects
  id: string;
  estimate_id: string;
  venue_id: string | null;
  guest_count: number | null;
  expected_attendance: number | null;
  tech_rider: string | null;
  stage_plan_url: string | null;
  
  // из estimates (JOIN)
  name: string;           // estimates.event_name
  event_date: string;     // estimates.event_date
  event_start_date: string | null;
  event_end_date: string | null;
  status: EstimateStatus; // estimates.status
  total: number;         // estimates.total
  customer_name: string | null;
  
  // из venue_details (JOIN)
  venue?: VenueDetails;
  
  // computed
  staffCount: number;
  checklistProgress: { total: number; completed: number };
}

// Запрос:
// SELECT p.*, e.event_name as name, e.event_date, e.status, e.total, e.customer_name, v.*
// FROM projects p
// JOIN estimates e ON p.estimate_id = e.id
// LEFT JOIN venue_details v ON p.venue_id = v.id
// WHERE p.company_id = $1
```

### 4.2 `useVenueDetails(companyId)`

```typescript
interface UseVenueDetailsReturn {
  venues: VenueDetails[];
  loading: boolean;
  createVenue: (data: Partial<VenueDetails>) => Promise<{ data?: VenueDetails }>;
  updateVenue: (id: string, updates: Partial<VenueDetails>) => Promise<void>;
  deleteVenue: (id: string) => Promise<void>;
}
```

### 4.3 `useProjectStaff(projectId)`

```typescript
interface UseProjectStaffReturn {
  staff: ProjectStaffWithDetails[];
  loading: boolean;
  addStaff: (staffId: string | null, role: ProjectRole, externalData?: ExternalStaffData) => Promise<void>;
  removeStaff: (id: string) => Promise<void>;
  updateRole: (id: string, role: ProjectRole, customRole?: string) => Promise<void>;
  setShift: (id: string, start: Date, end: Date) => Promise<void>;
  confirmStaff: (id: string, confirmed: boolean) => Promise<void>;
}

interface ProjectStaffWithDetails extends ProjectStaff {
  staff?: Staff; // данные из справочника staff (если не фрилансер)
}
```

### 4.4 `useProjectTimeline(projectId)`

```typescript
interface UseProjectTimelineReturn {
  phases: TimelinePhaseWithOverlap[];
  loading: boolean;
  addPhase: (phase: TimelinePhase, start: Date, end?: Date, description?: string) => Promise<void>;
  updatePhase: (id: string, updates: Partial<TimelinePhase>) => Promise<void>;
  removePhase: (id: string) => Promise<void>;
  reorderPhases: (ids: string[]) => Promise<void>;
}

interface TimelinePhaseWithOverlap extends TimelinePhase {
  overlapsWith: string[]; // IDs фаз, которые пересекаются по времени
  durationMinutes: number;
}
```

---

## 5. UI / Компоненты

### 5.1 Структура вкладки

```
/ProjectsTab
├── ProjectsList.tsx          # Список проектов (группировка по месяцам, как сметы)
│   ├── ProjectCard.tsx       # Карточка проекта в списке
│   └── ProjectFilters.tsx    # Фильтры по статусу, дате, площадке
│
├── ProjectDetail.tsx         # Детальная карточка проекта
│   ├── ProjectHeader.tsx     # Название, даты, статус, кнопки (read-only из сметы)
│   ├── ProjectTabs.tsx       # Вкладки внутри проекта
│   │   ├── OverviewTab.tsx   # Общая сводка
│   ├── EquipmentSection.tsx  # Оборудование из сметы (read-only, JOIN с estimate_items)
│   ├── ChecklistsSection.tsx # Чек-листы проекта + прогресс
│   ├── StaffSection.tsx      # Персонал проекта
│   │   ├── StaffList.tsx     # Список с ролями и сменами
│   │   ├── AddStaffDialog.tsx # Добавить из staff / фрилансера
│   │   └── StaffRoleBadge.tsx # Бейдж роли (цветной)
│   ├── VenueSection.tsx      # Информация о площадке
│   │   ├── VenueCard.tsx     # Карточка площадки
│   │   └── VenueEditDialog.tsx # Редактирование / выбор площадки
│   └── TimelineSection.tsx   # График / таймлайн
│       ├── TimelineView.tsx  # Визуальная полоска
│       └── TimelineEdit.tsx  # Редактирование фаз
│
├── VenueManager.tsx          # Справочник площадок (отдельная страница/модалка)
│   ├── VenueList.tsx
│   ├── VenueForm.tsx
│   └── VenueDetail.tsx
│
└── ProjectContext.tsx        # Контекст для текущего проекта (если нужен)
```

### 5.2 Визуальный таймлайн (TimelineView)

```
┌────────────────────────────────────────────────────────────┐
│  Время →  06:00  08:00  10:00  12:00  14:00  16:00  18:00  │
├────────────────────────────────────────────────────────────┤
│  Заезд    [====]                                            │
│  Монтаж       [==========]                                  │
│  Саундчек              [====]                               │
│  Репетиция                  [========]                      │
│  Шоу                              [==========]            │
│  Демонтаж                                    [========]   │
│  Выезд                                               [==] │
└────────────────────────────────────────────────────────────┘
```

**Фичи:**
- Drag-and-drop для изменения времени
- Resize handles для длительности
- Цветовая кодировка по фазам
- Пересечения подсвечиваются предупреждением
- Клик → редактирование фазы

### 5.3 Секция персонала (StaffSection)

```
┌─────────────────────────────────────────┐
│  👥 Персонал проекта              [+ Добавить] │
├─────────────────────────────────────────┤
│  Звукорежиссёр (FOH)                    │
│  ├─ 🎵 Иванов А. (staff)  10:00–02:00  ✅ │
│  └─ 🎵 Петров С. (внешн.) 10:00–02:00  ⏳ │
│                                         │
│  Светорежиссёр                          │
│  ├─ 💡 Сидоров М. (staff) 12:00–00:00  ✅ │
│                                         │
│  Монтаж (3 чел.)                        │
│  ├─ 🔧 Кузнецов Д. (staff) 08:00–14:00  ✅ │
│  ├─ 🔧 Смирнов А. (фрил.)  08:00–14:00  ✅ │
│  └─ 🔧 + добавить                       │
│                                         │
│  Демонтаж (2 чел.)                      │
│  ├─ 🔧 Кузнецов Д. (staff) 22:00–02:00  ⏳ │
│  └─ 🔧 ...                              │
└─────────────────────────────────────────┘
```

**Роли с цветами:**
| Роль | Цвет |
|------|------|
| Звукорежиссёр | 🔵 Синий |
| Светорежиссёр | 🟡 Жёлтый |
| Системный инженер | 🟢 Зелёный |
| Монтаж/Демонтаж | 🔴 Красный |
| Менеджер | 🟣 Фиолетовый |
| Видео | 🟠 Оранжевый |

---

## 6. Интеграции с существующим функционалом

### 6.1 Сметы → Проекты (однонаправленно)

- При создании сметы → триггер БД автоматически создаёт `project` (или хук `createEstimate` делает INSERT)
- При открытии сметы → кнопка "Открыть проект" (если project существует)
- Статус, название, даты — всегда из `estimates`, проект их не дублирует
- Смета может существовать без project (если триггер не сработал — fallback в UI)

### 6.2 Чек-листы → Проекты

- Добавить `project_id` nullable в `checklists`
- Заполнить через миграцию: `project_id = (SELECT id FROM projects WHERE estimate_id = checklists.estimate_id)`
- Старый код продолжит работать по `estimate_id`
- Новый код использует `project_id` для быстрого доступа

### 6.3 Персонал → Проекты

- Существующий `staff` используется как источник
- `project_staff` — связующая таблица с ролями
- Возможность добавить фрилансера без записи в `staff`

### 6.4 Площадки

- Новый справочник `venue_details`
- Привязка к проекту через `venue_id`
- Автозаполнение из поля `venue` (текст) сметы при первом создании (опционально)

---

## 7. Edge Cases и ограничения

| Сценарий | Решение |
|----------|---------|
| Смета удалена | `ON DELETE CASCADE` на `projects.estimate_id` → проект удаляется автоматически |
| Сотрудник удалён из staff | `project_staff.staff_id` → `SET NULL`, имя сохраняется в `external_name` |
| Проект без площадки | `venue_id` nullable, показывать "Площадка не указана" |
| Пересечение смен у одного сотрудника | Валидация на уровне UI + предупреждение |
| Фрилансер без телефона | `external_phone` nullable, но показывать warning |
| Таймлайн выходит за даты проекта | Предупреждение, но разрешать (например, заезд накануне) |
| Два проекта в один день на одной площадке | Предупреждение в UI, но не блокировать |
| Старая смета без project | Lazy creation: при открытии ProjectDetail создавать project, если нет |
| JOIN производительность | Индексы на `projects.estimate_id`, `projects.company_id` |

---

## 8. Миграция данных

### 8.1 Существующие сметы → projects

```sql
-- Для каждой сметы создать project (batch migration)
INSERT INTO projects (company_id, estimate_id, venue_id)
SELECT company_id, id, NULL
FROM estimates
ON CONFLICT (estimate_id) DO NOTHING;
```

### 8.2 Существующие чек-листы → project_id

```sql
-- Добавить колонку
ALTER TABLE checklists ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

-- Заполнить
UPDATE checklists c
SET project_id = p.id
FROM projects p
WHERE c.estimate_id = p.estimate_id;
```

### 8.3 Уникальные venue → venue_details

```sql
-- Для каждого уникального venue создать venue_details
INSERT INTO venue_details (company_id, name)
SELECT DISTINCT company_id, venue
FROM estimates
WHERE venue IS NOT NULL AND venue != '';

-- Обновить projects.venue_id по совпадению имени
UPDATE projects p
SET venue_id = v.id
FROM venue_details v, estimates e
WHERE p.estimate_id = e.id
  AND p.company_id = v.company_id
  AND e.venue = v.name;
```

---

## 9. Realtime / Polling

| Таблица | Подписка | Почему |
|---------|----------|--------|
| `projects` | `useRealtimeWithFallback` | Данные меняются при создании сметы |
| `project_staff` | `useRealtimeWithFallback` | Совместное редактирование |
| `project_timeline` | `useRealtimeWithFallback` | Совместное редактирование |
| `venue_details` | **Нет** | Данные редко меняются, обновлять при открытии |
| `estimates` | Уже есть в `useEstimates` | Не дублировать |

**Важно:** `useProjects` подписывается только на `projects`. Данные сметы (`name`, `status`, `total`) приходят через JOIN — при изменении `estimates` подписка `useEstimates` обновит UI смет, а `useProjects` обновится при следующем `refresh` или через `projects` подписку (если нужно мгновенно — добавить `estimates` в `tables` `useRealtimeWithFallback` для `useProjects`).

---

## 10. Оценка трудозатрат (примерная)

| Этап | Время |
|------|-------|
| Схема БД + миграции + триггер | 2–3 часа |
| Хуки (useProjects, useVenueDetails, useProjectStaff, useProjectTimeline) | 4–6 часов |
| Компоненты списка проектов | 2–3 часа |
| Карточка проекта + секции | 4–6 часов |
| Секция персонала | 3–4 часа |
| Секция площадки + справочник | 3–4 часа |
| Визуальный таймлайн | 4–6 часов |
| Интеграция с существующими модулями (сметы, чек-листы) | 2–3 часа |
| Тестирование + багфикс | 3–4 часа |
| **Итого** | **~25–35 часов** |

---

## 11. Файлы для создания/изменения

### Новые файлы
```
src/
├── components/
│   ├── projects/
│   │   ├── ProjectsTab.tsx
│   │   ├── ProjectsList.tsx
│   │   ├── ProjectCard.tsx
│   │   ├── ProjectDetail.tsx
│   │   ├── ProjectHeader.tsx
│   │   ├── OverviewTab.tsx
│   │   ├── EquipmentSection.tsx
│   │   ├── ChecklistsSection.tsx
│   │   ├── StaffSection.tsx
│   │   │   ├── StaffList.tsx
│   │   │   ├── AddStaffDialog.tsx
│   │   │   └── StaffRoleBadge.tsx
│   │   ├── VenueSection.tsx
│   │   │   ├── VenueCard.tsx
│   │   │   └── VenueEditDialog.tsx
│   │   └── TimelineSection.tsx
│   │       ├── TimelineView.tsx
│   │       └── TimelineEdit.tsx
│   └── venues/
│       ├── VenueManager.tsx
│       ├── VenueList.tsx
│       ├── VenueForm.tsx
│       └── VenueDetail.tsx
├── hooks/
│   ├── useProjects.ts
│   ├── useVenueDetails.ts
│   ├── useProjectStaff.ts
│   └── useProjectTimeline.ts
├── types/
│   └── projects.ts
└── lib/
    └── projectUtils.ts
```

### Изменения в существующих
```
src/
├── App.tsx                    # добавить вкладку "Проекты"
├── components/
│   ├── Sidebar.tsx / BottomNav.tsx  # добавить иконку
│   └── EstimateManager.tsx    # кнопка "Открыть проект" (если project существует)
src/hooks/
└── useEstimates.ts            # опционально: createEstimate → await supabase.from('projects').insert(...)
supabase/
└── migrations/
    └── 20260703_projects.sql  # все таблицы, RLS, триггеры, миграции
```

---

## 12. Выгрузки из проекта (Export)

### 12.1 Список оборудования (без услуг)

**Фильтры:**
- Только оборудование (исключить услуги: доставка, монтаж, демонтаж, работа техника и т.д.)
- По категориям (звук, свет, сцена, кабель, видео)
- По комплектам (kit) — группировать или разворачивать

**Форматы выгрузки:**

| Формат | Назначение |
|--------|-----------|
| **PDF** | Печать для заезда / сдачи на склад |
| **Excel (.xlsx)** | Импорт в другие системы, учёт |
| **CSV** | Обмен данными |
| **Буфер обмена** | Быстрое копирование в мессенджер / email |

**Структура PDF/Excel:**
```
Проект: "Концерт в ДК Краза"
Дата: 08.07.2026
Площадка: ДК Краза

№   Категория      Наименование              Кол-во  Ед.изм.  QR-код      Комплект
1   Звук           d&b audiotechnik V-8      4       шт.      EQ-0012     Основной FOH
2   Звук           d&b audiotechnik V-SUB     2       шт.      EQ-0013     Основной FOH
3   Звук           Yamaha CL5                 1       шт.      EQ-0056     —
4   Свет           Martin MAC Aura XB         6       шт.      EQ-0201     Световой комплект
5   Кабель         Multicore 32 канала 50м    2       шт.      EQ-0301     —
...

Итого позиций: 23
Итого единиц: 47
```

**Настройки выгрузки:**
- [ ] Включить QR-коды (для сканирования)
- [ ] Группировать по категориям
- [ ] Группировать по комплектам (kits)
- [ ] Включить серийные номера (если есть в inventory_items)
- [ ] Включить примечания к позициям
- [ ] Включить вес/габариты (если есть в справочнике оборудования)

### 12.2 Список персонала

**Выбор данных для включения:**

| Поле | Описание | По умолчанию |
|------|----------|-------------|
| ФИО | Полное имя | ✅ |
| Должность / Роль | Звукорежиссёр, монтаж и т.д. | ✅ |
| Телефон | Контактный телефон | ✅ |
| Email | Электронная почта | ☐ |
| Смена | Время начала / окончания | ✅ |
| Статус | Подтверждён / не подтверждён | ☐ |
| Заметки | Примечания к назначению | ☐ |
| Тип | Штатный / фрилансер | ☐ |

**Форматы выгрузки:**

| Формат | Назначение |
|--------|-----------|
| **PDF** | Печать — раздать сотрудникам / повесить на площадке |
| **Excel (.xlsx)** | Импорт в табель, учёт рабочего времени |
| **CSV** | Обмен данными |
| **Буфер обмена** | Быстрое копирование |

**Структура PDF/Excel:**
```
Проект: "Концерт в ДК Краза"
Дата: 08.07.2026

Роль                  ФИО              Телефон        Смена            Статус
Звукорежиссёр (FOH)   Иванов А.В.      +7-999-123-45  10:00 – 02:00    ✅ Подтверждён
Светорежиссёр         Петров С.М.      +7-999-234-56  12:00 – 00:00    ✅ Подтверждён
Монтаж (2 чел.)       Кузнецов Д.Л.    +7-999-345-67  08:00 – 14:00    ✅ Подтверждён
                      Смирнов А.П.     +7-999-456-78  08:00 – 14:00    ⏳ Ожидает
Демонтаж (2 чел.)     Кузнецов Д.Л.    +7-999-345-67  22:00 – 02:00    ⏳ Ожидает
                      (вакансия)       —              —                ❌ Не назначен

Всего: 6 человек
Подтверждено: 4
Ожидает: 2
```

**Группировка в выгрузке:**
- По ролям (как в примере выше)
- По сменам (кто в первую, кто во вторую)
- Хронологически (по времени прибытия)

### 12.3 UI для выгрузки

```
┌─────────────────────────────────────────┐
│  📥 Выгрузка данных проекта             │
├─────────────────────────────────────────┤
│                                         │
│  📦 Оборудование                        │
│  ├─ [PDF]  [Excel]  [CSV]  [Копировать] │
│  ├─ ☑ Только оборудование (без услуг)   │
│  ├─ ☑ Группировать по категориям       │
│  ├─ ☑ Включить QR-коды                 │
│  └─ ☑ Включить комплекты               │
│                                         │
│  👥 Персонал                            │
│  ├─ [PDF]  [Excel]  [CSV]  [Копировать] │
│  ├─ ☑ ФИО                              │
│  ├─ ☑ Роль                             │
│  ├─ ☑ Телефон                          │
│  ├─ ☐ Email                            │
│  ├─ ☑ Смена                            │
│  ├─ ☐ Статус подтверждения             │
│  ├─ ☐ Заметки                          │
│  └─ ☐ Тип (штатный/фрилансер)          │
│                                         │
│  ┌─ Предпросмотр ─────────────────┐    │
│  │  (таблица для проверки)        │    │
│  └─────────────────────────────────┘    │
│                                         │
│              [Отмена]  [Выгрузить]      │
└─────────────────────────────────────────┘
```

### 12.4 Техническая реализация

**Библиотеки:**
- `jspdf` + `jspdf-autotable` — генерация PDF
- `xlsx` (SheetJS) — генерация Excel
- Нативный `Blob` + `URL.createObjectURL` — скачивание файлов

**Хук `useProjectExport(projectId)`:**

```typescript
interface UseProjectExportReturn {
  exportEquipment: (options: EquipmentExportOptions) => Promise<Blob>;
  exportStaff: (options: StaffExportOptions) => Promise<Blob>;
  copyToClipboard: (text: string) => Promise<void>;
  loading: boolean;
}

interface EquipmentExportOptions {
  format: 'pdf' | 'xlsx' | 'csv';
  includeServices: boolean; // false = только оборудование
  groupByCategory: boolean;
  groupByKit: boolean;
  includeQrCodes: boolean;
  includeSerialNumbers: boolean;
  includeNotes: boolean;
  includeWeight: boolean;
}

interface StaffExportOptions {
  format: 'pdf' | 'xlsx' | 'csv';
  fields: StaffExportField[];
  groupByRole: boolean;
  groupByShift: boolean;
}

type StaffExportField = 'name' | 'role' | 'phone' | 'email' | 'shift' | 'confirmed' | 'notes' | 'type';
```

**Файлы для создания:**
```
src/
├── components/
│   └── projects/
│       └── ExportDialog.tsx          # UI выбора формата и настроек
├── hooks/
│   └── useProjectExport.ts           # логика выгрузки
├── lib/
│   ├── export/
│   │   ├── pdfExport.ts              # генерация PDF
│   │   ├── excelExport.ts            # генерация Excel
│   │   ├── csvExport.ts              # генерация CSV
│   │   └── clipboardExport.ts        # копирование в буфер
│   └── exportUtils.ts                # форматирование данных
```

### 12.5 Интеграция в UI проекта

Кнопка выгрузки в `ProjectHeader`:
```tsx
<Button variant="outline" onClick={() => setExportOpen(true)}>
  <Download className="w-4 h-4 mr-2" />
  Выгрузить
</Button>
```

Или в каждой секции (Оборудование, Персонал) — отдельная кнопка для быстрой выгрузки конкретного списка.

---

## 13. Оценка рисков (что сломается)

### 🟢 Безопасно (минимальный риск)

| Компонент | Почему безопасно |
|-----------|-----------------|
| Новые таблицы БД | Изолированные, FK только на существующие. Не ломают старые запросы. |
| Новые хуки/компоненты | Новый код, не пересекается с существующим. |
| Справочник площадок | Отдельная сущность. Сметы продолжают работать с текстовым `venue`. |

### 🟡 Требует внимания (средний риск)

| Компонент | Риск | Митигация |
|-----------|------|-----------|
| Триггер `sync_project_from_estimate` | Если триггер упадёт — смета создаётся, проект нет. UI должен fallback'ить. | Lazy creation в `useProjects` + `ON CONFLICT DO NOTHING` |
| JOIN `projects` ↔ `estimates` | Производительность при 1000+ проектов | Индексы на `estimate_id`, `company_id` |
| Чек-листы: `project_id` nullable | Старый код по `estimate_id` работает, новый по `project_id` | Постепенная миграция, nullable FK |
| Старые сметы без project | `ProjectDetail` сломается, если project не создан | Lazy creation при открытии |

### 🔴 Опасно (высокий риск)

| Компонент | Риск | Как избежать |
|-----------|------|--------------|
| Изменение `estimates` таблицы | Все существующие запросы сломаются | **Не делать** — проект ссылается на смету, а не наоборот |
| Изменение `useEstimates` хук | Сломается создание смет, optimistic updates | **Не трогать** логику `createEstimate` (кроме опционального INSERT в projects) |
| Удаление `estimate_id` из чек-листов | Старые чек-листы потеряют связь | **Не удалять** — только добавить `project_id` nullable |

### Итоговая оценка

| | |
|---|---|
| **Вероятность поломки чего-то критичного** | **Очень низкая (~5%)** |
| **Главный риск** | Триггер не создаёт project → UI должен fallback'ить |
| **Ключ к безопасности** | Смета = единственный мастер. Проект = доп.данные + связи. Не трогать существующие таблицы. |

---

## 14. Открытые вопросы (для обсуждения)

1. Нужен ли **календарный вид** проектов (как в EventCalendar) или только список?
2. Нужна ли **печатная форма** проекта (PDF со всей информацией)?
3. Нужно ли **уведомление сотрудникам** о назначении на проект (email/push)?
4. Нужен ли **conflict detection** — предупреждение если сотрудник назначен на два проекта одновременно?
5. Нужна ли **копия проекта** (для повторяющихся мероприятий)?
6. Нужен ли **архив проектов** (отдельно от активных)?

---

*План обновлён. Реализация по запросу.*
