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

## Поштучный учёт экземпляров (track_items)

### Описание
Позиции оборудования с включённым "поштучным учётом" (`track_items = true`) имеют отдельные экземпляры в таблице `inventory_items`. Каждый экземпляр имеет уникальный QR-код и статус (`available`, `issued`, `repair`, `written_off`).

### Известные проблемы и решения

#### 1. Экземпляры не отображаются в подкатегориях
**Причина:** В рекурсивном рендере подкатегорий не передавались пропсы для управления экземплярами.
**Решение:** В `CableManager.tsx` при рендере `category.children` через `CategoryItem` передаются все пропсы: `expandedInventory`, `onToggleInventoryItems`, `companyId`, `onRefresh`, `inventoryItems`.

#### 2. Кнопка "📦 Экз." пропадает при нулевом остатке
**Причина:** Условие `{item.track_items && onToggleInventoryItems && (...)}` скрывало кнопку если callback не был передан.
**Решение:** Условие изменено на `{item.track_items && (...)}` — кнопка показывается всегда при включённом поштучном учёте.

#### 3. Ошибка БД `PGRST200` при просмотре комментариев к экземпляру
**Причина:** Запросы делали join `profiles:author_id(name)`, но FK `item_comments.author_id` ведёт на `auth.users(id)`, а не на `profiles(id)`. Supabase PostgREST не находит связь.
**Решение:** Комментарии загружаются без join, а имена авторов подтягиваются отдельным запросом к `profiles` по `id`.

#### 4. Выдача через чекбоксы/сайт не обновляет статус экземпляров
**Причина:** При массовой выдаче через `CableManager` передавался только `inventory_id` и `quantity`, без `item_id`. Статусы экземпляров в `inventory_items` не менялись.
**Решение:** Для позиций с `track_items = true` выдача автоматически выбирает свободные экземпляры и создаёт отдельные записи `cable_movements` с заполненным `item_id` для каждого экземпляра. Аналогично для отправки в ремонт.

#### 5. QR-сканер — выдача группы не обновляет статус экземпляров
**Причина:** При сканировании QR-кода группы (не экземпляра) `handleQuickIssue` не заполнял `item_id`.
**Решение:** `handleQuickIssue` и `handleQuickRepair` в `QRScanPage.tsx` теперь проверяют `track_items` и для поштучного учёта работают с конкретными экземплярами.

### Корректные сценарии работы

| Сценарий | item_id заполняется | Статус обновляется |
|----------|---------------------|-------------------|
| Выдача через чекбоксы (сайт), `track_items=true` | ✅ Да | ✅ Да |
| Выдача через QR-сканер (экземпляр) | ✅ Да | ✅ Да |
| Выдача через QR-сканер (группа), `track_items=true` | ✅ Да | ✅ Да |
| Возврат через сайт/QR | ✅ Да | ✅ Да |
| Отправка в ремонт через сайт, `track_items=true` | ✅ Да | ✅ Да |
| Отправка в ремонт через QR-сканер, `track_items=true` | ✅ Да | ✅ Да |
| Возврат из ремонта | ✅ Да | ✅ Да |

### Таблицы
- `cable_inventory` — позиции оборудования (поле `track_items`)
- `inventory_items` — экземпляры (статусы: `available`, `issued`, `repair`, `written_off`)
- `cable_movements` — выдачи/возвраты (поле `item_id` для поштучного учёта)
- `equipment_repairs` — ремонты (поле `item_id` для поштучного учёта)
- `item_comments` — комментарии к экземплярам

---

## Оптимизация поллинга (2025-05-21)

### Проблема
При использовании на Yandex proxy (без WebSocket) поллинг создавал лишний трафик — до 5000+ запросов в день от одного пользователя.

### Решение

#### Интервалы поллинга на Yandex (только где нужно)

| Данные | Интервал | Примечание |
|--------|----------|------------|
| `cable_inventory`, `inventory_items`, `cable_categories` | **5 мин** | Основной инвентарь |
| `cable_movements`, `equipment_repairs` | **2 мин** | Движения и ремонты |
| `checklists`, `checklist_items` | **2 мин** | Чек-листы |
| `estimates` | **2 мин** | Сметы |
| `customers` | **5 мин** | Заказчики |
| `contracts` | **5 мин** | Договоры |
| `expenses` | **5 мин** | Расходы |
| `incomes` | **5 мин** | Доходы |
| `equipment_kits` | **—** | ❌ Поллинг убран. Обновляется только при открытии вкладки "Комплекты" или при мутациях |

#### Vercel (WebSocket работает)
- Поллинг **отключен** — используется realtime через `safeChannel()`
- Исключение: `InventoryItemsManager` — поллинг только на Yandex (`isProxyMode()`)

#### Защита от лишних запросов
- `document.hidden` — пауза когда вкладка неактивна
- Ночные часы (23:00–08:00) — поллинг отключен
- `minPollIntervalMs` — защита от "шторма" запросов
- `useRealtimeWithFallback` — unified hook для всех realtime/polling подписок

### Что изменено
1. `InventoryItemsManager.tsx` — поллинг только на Yandex (был всегда 60с)
2. `useChecklistsV2.ts` — kits без поллинга (`pollingIntervalMs: 0`)
3. `useRealtimeWithFallback.ts` — проверка `pollingIntervalMs > 0` перед запуском
