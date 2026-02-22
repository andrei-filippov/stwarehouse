# Исправление ошибок

## Ошибка "Invalid Refresh Token"

**Причина:** Сессия истекла или refresh token недействителен (возможно, база данных была сброшена).

**Решение:**
1. На экране авторизации появится кнопка "Очистить данные и попробовать снова"
2. Нажмите её — это очистит localStorage и перезагрузит страницу
3. Войдите заново с вашими credentials

Или вручную:
```javascript
// В консоли браузера (F12)
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('sb-')) localStorage.removeItem(key);
});
location.reload();
```

## Ошибка 404 "таблица не существует"

**Причина:** Таблицы в Supabase не созданы.

**Решение:**

1. Откройте Supabase Dashboard
2. Перейдите в SQL Editor (значок SQL слева)
3. Создайте New query
4. Скопируйте содержимое файла `supabase_schema.sql`
5. Нажмите Run

**Важно:** Выполните весь скрипт целиком — он создаст все необходимые таблицы:
- `profiles` — профили пользователей
- `categories` — категории оборудования
- `equipment` — оборудование
- `customers` — заказчики
- `estimates` — сметы
- `estimate_items` — позиции смет
- `templates` — шаблоны
- `template_items` — позиции шаблонов
- `staff` — персонал
- `goals` — задачи
- `checklist_rules` — правила чек-листов
- `checklist_rule_items` — позиции правил
- `checklists` — чек-листы
- `checklist_items` — позиции чек-листов

## Проверка созданных таблиц

В SQL Editor выполните:
```sql
SELECT table_name 
FROM information.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Должны быть все таблицы из списка выше.

## Проблема с RLS (доступ запрещен)

Если видите ошибку "new row violates row-level security policy":

1. Убедитесь что пользователь авторизован
2. Проверьте что RLS политики созданы (в конце `supabase_schema.sql`)
3. Временно отключите RLS для проверки:
   ```sql
   ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
   ```

## Не работает импорт Excel

Убедитесь что установлена библиотека xlsx:
```bash
npm install xlsx
```

## Ошибка подключения к Supabase

Проверьте файл `.env`:
```env
VITE_SUPABASE_URL=https://trivdyjfiyxsmrkihqet.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Если URL изменился (например, после переноса проекта), обновите его.
