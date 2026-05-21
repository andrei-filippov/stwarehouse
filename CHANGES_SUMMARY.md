# Сводка изменений - QR сканер и ремонты

## Исправленные проблемы

### 1. QR Сканер - Поиск оборудования
**Проблема:** Ошибка 400 при сканировании из-за фильтра `ilike` на UUID поле
**Решение:** Изменен поиск с `equipment_id ilike '%{qr}%'` на прямой поиск по `equipment_id` через точное совпадение

### 2. Счетчик сканирований - Двойное считывание
**Проблема:** Сканируемое количество удваивалось из-за оптимистичных обновлений
**Решение:** Используем `item.loaded_quantity` напрямую вместо `getItemStatus()` при расчете текущего количества

### 3. Возврат из ремонта
**Функционал:** Добавлена возможность возврата оборудования из ремонта на склад
**Триггеры:**
- QR сканер: диалог информации об оборудовании → "Вернуть на склад"
- CableManager: вкладка "Ремонт" → кнопка "Вернуть на склад"

**Статусы ремонта:**
- `in_repair` - В ремонте
- `repaired` - Отремонтировано
- `returned` - Возвращено на склад ✅ (новый)
- `written_off` - Списано

### 4. Вкладка "История" в CableManager
Добавлена новая вкладка с:
- Историей всех ремонтов (отправка и возврат)
- Историей всех выдач (с возвратами)
- Сортировкой по дате (новые сверху)
- Цветовой индикацией статусов

## SQL скрипты для применения

### 1. Обновление constraints equipment_repairs
Файл: `supabase_fix_repair_status_constraint.sql`
```sql
ALTER TABLE equipment_repairs 
DROP CONSTRAINT IF EXISTS equipment_repairs_status_check;

ALTER TABLE equipment_repairs 
ADD CONSTRAINT equipment_repairs_status_check 
CHECK (status IN ('in_repair', 'repaired', 'written_off', 'returned'));
```

## Формулы расчета количества

### QR Сканер (ChecklistDetail)
```typescript
// Выдано по чек-листу
const baseLoadedQty = item.loaded_quantity || 0;
const localLoaded = scanCounterRef.current[item.id]?.loaded || 0;
const currentLoadedQty = baseLoadedQty + localLoaded;
```

### QR Сканер (QRScanPage - Info Dialog)
```typescript
// Статистика оборудования
const manualIssued = movements?.reduce((sum, m) => sum + (m.quantity || 0), 0) || 0;
const checklistIssued = checklistItems?.reduce((sum, c) => sum + (c.loaded_quantity || 0), 0) || 0;
const issuedQty = manualIssued + checklistIssued;
const repairQty = repairs?.reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;
const reservedQty = filteredReservations.reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;
const availableQty = Math.max(0, item.quantity - issuedQty - repairQty - reservedQty);
```

## Логика ремонтов

1. **Отправка в ремонт:**
   - Создается запись в `equipment_repairs`
   - Количество на складе НЕ меняется
   - Счетчик "В ремонте" увеличивается

2. **Возврат из ремонта:**
   - Статус меняется на `returned`
   - Устанавливается `returned_date`
   - Количество на складе НЕ меняется (оно там и было)
   - Счетчик "В ремонте" уменьшается

3. **Списание:**
   - Статус меняется на `written_off`
   - Количество на складе НЕ меняется (требуется ручная корректировка)

## Файлы изменены

- `src/components/ChecklistDetail.tsx` - Исправлен счетчик сканирований
- `src/components/QRScanPage.tsx` - Исправлен поиск, добавлен возврат из ремонта
- `src/components/CableManager.tsx` - Добавлена вкладка "История", кнопка возврата
- `src/types/repair.ts` - Добавлен статус 'returned'
- `supabase_fix_repair_status_constraint.sql` - SQL для обновления БД

---

# Сводка изменений - 21.05.2026

## Исправленные проблемы

### 1. Ошибка "Invalid time value" при выдаче оборудования
**Проблема:** После подтверждения выдачи оборудования приложение падало с `RangeError: Invalid time value` в `CableManager`
**Причина:** `format()` из `date-fns` получал `Invalid Date` при пустом `movement.created_at` — `new Date('')` создаёт `Invalid Date`
**Решение:** Добавлена безопасная функция `safeFormatDate()` с проверкой `isNaN(d.getTime())` и `try/catch`. Заменены все 5 мест форматирования дат в `CableManager` (движения и ремонты)

**Файл:** `src/components/CableManager.tsx`

### 2. WebSocket-ошибки на Yandex при открытии экземпляров оборудования
**Проблема:** При открытии списка экземпляров оборудования (поштучный учёт) сыпались ошибки WebSocket на Yandex Cloud
**Причина:** `InventoryItemsManager` использовал прямой `supabase.channel()` вместо `safeChannel()`, нарушая правило AGENTS.md: "ВСЕГДА использовать safeChannel() вместо supabase.channel()"
**Решение:** Заменён `supabase.channel()` на `safeChannel()` — на Yandex возвращается `noopChannel`, на Vercel работает как обычно. Polling (60 сек) продолжает обновлять данные

**Файл:** `src/components/InventoryItemsManager.tsx`

### 3. Поштучный учёт сбрасывался при редактировании оборудования
**Проблема:** После создания оборудования с галочкой "Поштучный учёт" и последующего редактирования — флаг `track_items` сбрасывался
**Причина:** `handleEditInventory` в `CableManager` не передавал поле `track_items` в `onUpsertInventory()`
**Решение:** Добавлен `track_items: inventoryForm.track_items` в объект, передаваемый в `onUpsertInventory()`

**Файл:** `src/components/CableManager.tsx`

### 4. Индикатор поштучного учёта не виден в свёрнутой категории
**Проблема:** Кнопка "📦 Экз." (управление экземплярами) видна только в раскрытой категории — невозможно понять, включён ли поштучный учёт без раскрытия
**Решение:** Добавлен индикатор 📦 рядом с названием позиции в списке оборудования

**Файл:** `src/components/CableManager.tsx`
