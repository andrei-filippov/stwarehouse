# Гибкая система прав доступа

## Что реализовано

Теперь администратор может **индивидуально** настраивать доступ для каждого пользователя:
- Выбор конкретных вкладок
- Разрешение на редактирование
- Разрешение на удаление  
- Разрешение на экспорт

## Настройка

### 1. Выполните SQL скрипт

В Supabase SQL Editor выполните:
```sql
-- Таблица прав пользователей
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allowed_tabs TEXT[] NOT NULL DEFAULT '{}',
  can_edit BOOLEAN NOT NULL DEFAULT true,
  can_delete BOOLEAN NOT NULL DEFAULT true,
  can_export BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Остальное из файла supabase_user_permissions.sql
```

Или просто выполните обновлённый `supabase_schema_safe.sql`

### 2. Как назначить права

1. Войдите как **admin**
2. Перейдите во вкладку **"Админ"**
3. Выберите пользователя
4. Нажмите **"Настроить"**
5. Выберите нужные вкладки (чекбоксы)
6. Настройте доп. права (переключатели)
7. Нажмите **"Сохранить"**

### 3. Шаблоны (быстрое применение)

Для быстрой настройки используйте шаблоны:
- **Администратор** — полный доступ
- **Менеджер** — сметы, заказчики, аналитика
- **Кладовщик** — только оборудование и чек-листы
- **Бухгалтер** — финансы без редактирования

## Структура прав

```typescript
interface UserPermissions {
  user_id: string;
  allowed_tabs: string[];  // ['equipment', 'estimates', 'customers']
  can_edit: boolean;       // можно ли редактировать
  can_delete: boolean;     // можно ли удалять
  can_export: boolean;     // можно ли экспортировать
}
```

## Автоматическое создание прав

При создании нового пользователя права создаются автоматически на основе его роли:
```sql
-- Триггер срабатывает при INSERT/UPDATE в profiles
-- Создаёт запись в user_permissions с дефолтными правами
```

## Примеры сценариев

### Сценарий 1: Менеджер только для смет
- Вкладки: сметы, заказчики, календарь
- Редактирование: да
- Удаление: нет
- Экспорт: да

### Сценарий 2: Техник на выезде
- Вкладки: чек-листы, календарь
- Редактирование: да (только чек-листы)
- Удаление: нет
- Экспорт: нет

### Сценарий 3: Бухгалтер (только просмотр)
- Вкладки: сметы, аналитика, заказчики
- Редактирование: нет
- Удаление: нет
- Экспорт: да

## Миграция существующих пользователей

Права для существующих пользователей создадутся автоматически при выполнении SQL:
```sql
-- Автоматическое создание прав для всех существующих профилей
INSERT INTO user_permissions (user_id, allowed_tabs, can_edit, can_delete, can_export)
SELECT 
  p.id,
  CASE 
    WHEN p.role = 'admin' THEN ARRAY['equipment', 'estimates', ..., 'admin']
    WHEN p.role = 'manager' THEN ARRAY['equipment', 'estimates', ...]
    -- ...
  END,
  p.role IN ('admin', 'manager', 'warehouse'),
  p.role IN ('admin', 'manager'),
  p.role IN ('admin', 'manager', 'accountant')
FROM profiles p
LEFT JOIN user_permissions up ON p.id = up.user_id
WHERE up.id IS NULL
ON CONFLICT (user_id) DO NOTHING;
```

## Безопасность

- Только **admin** может видеть и менять права
- Пользователь видит только свои права (read-only)
- RLS политики защищают таблицу `user_permissions`

## Отладка

Если права не применяются:
1. Проверьте консоль браузера (F12)
2. Убедитесь что таблица `user_permissions` создана
3. Проверьте RLS политики
4. Перезагрузите страницу после изменения прав
