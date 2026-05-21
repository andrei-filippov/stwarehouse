# Архитектура СкладОборуд (stwarehouse)

## Общая схема деплоя

```
GitHub (main branch)
    │
    ├──► GitHub Actions ──► Vercel (vercel.app)
    │                          • WebSocket / Realtime работает
    │                          • Прямое подключение к Supabase
    │
    └──► GitHub Actions ──► Yandex Object Storage (website.yandexcloud.net)
                               • WebSocket НЕ работает (Yandex API Gateway)
                               • Подключение к Supabase через Yandex API Gateway (proxy)
                               • Polling fallback для realtime обновлений
```

## Поток данных

### 1. Разработка → GitHub
- Код пушится в `main` ветку
- GitHub Actions запускает билд
- Артефакты деплоятся на **Vercel** и **Yandex Object Storage** параллельно

### 2. Vercel (основной домен для разработки)
- **URL**: `https://stwarehouse.vercel.app`
- **Supabase**: прямое подключение (`supabase.co`)
- **Realtime**: WebSocket работает нативно
- **Использование**: разработка, тестирование, fallback для админов

### 3. Yandex Object Storage (основной домен для пользователей)
- **URL**: `https://stwarehouse.website.yandexcloud.net`
- **Supabase**: через Yandex API Gateway proxy
- **Realtime**: WebSocket НЕ работает → используется polling
- **Использование**: основной доступ для пользователей (РФ, низкая latency)

## Прокси Yandex API Gateway

### Почему нужен прокси
Yandex Object Storage — это статический хостинг (S3). Нельзя:
- Настроить CORS для Supabase напрямую
- Использовать WebSocket (Supabase realtime требует persistent connection)

### Как работает прокси
```
[Браузер] → [Yandex API Gateway] → [Supabase]
                ↓
         Добавляет заголовки:
         - apikey (анонимный ключ)
         - Authorization (JWT токен)
         - Переписывает пути
```

### Ограничения прокси
| Функция | Vercel | Yandex |
|---------|--------|--------|
| WebSocket / Realtime | ✅ | ❌ |
| HTTP запросы | ✅ | ✅ |
| File upload (Storage) | ✅ | ✅ (через proxy) |
| Auth (login/logout) | ✅ | ✅ |

### Код определения режима
```typescript
// src/lib/supabase.ts
export const isProxyMode = () => {
  return window.location.hostname.includes('yandex');
};
```

## Realtime: WebSocket vs Polling

### Vercel (WebSocket)
```typescript
// Работает нативно
const channel = supabase.channel('table-changes')
  .on('postgres_changes', ..., callback)
  .subscribe();
```

### Yandex (Polling fallback)
```typescript
// WebSocket заблокирован → используем polling
// src/hooks/useRealtimeWithFallback.ts

// Логика polling:
// 1. Проверяем document.hidden (не опрашивать если вкладка неактивна)
// 2. Пропускаем ночные часы (23:00 - 08:00) для экономии трафика
// 3. Интервал: настраивается (30-60 секунд типично)
// 4. Ограничение concurrency: максимум 3 параллельных запроса
// 5. Initial delay: 2 секунды после mount чтобы избежать storm
```

### Где используется polling
| Hook | Интервал | Таблицы |
|------|----------|---------|
| `useEstimates` | 60s | estimates, estimate_items |
| `useExpenses` | 60s | expenses |
| `useIncomes` | 60s | incomes |
| `useCustomers` | 60s | customers |
| `useContracts` | 60s | contracts |
| `useChecklists` | 30s | checklists, checklist_items |
| `useChecklistsV2` | 30s / 60s | checklists, checklist_items / equipment_kits, kit_items |

### ⚠️ Важно: НЕ использовать ручные safeChannel подписки
Старый паттерн (НЕ работает на Yandex):
```typescript
// ❌ НЕПРАВИЛЬНО - на Yandex safeChannel возвращает noop
useEffect(() => {
  const channel = safeChannel('name')
    .on('postgres_changes', ..., callback)
    .subscribe();
  return () => supabase.removeChannel(channel);
}, []);
```

Новый паттерн (работает везде):
```typescript
// ✅ ПРАВИЛЬНО - polling на Yandex, WebSocket на Vercel
useRealtimeWithFallback({
  channelName: 'name',
  companyId,
  tables: [
    { table: 'table_name', filter: '...', onChange: () => fetchData(true) }
  ],
  pollingIntervalMs: 30000,
});
```

### Паттерн safeChannel
Все подписки должны использовать `safeChannel()`:
```typescript
import { safeChannel } from '../lib/supabase';

// На Vercel: возвращает реальный channel
// На Yandex: возвращает noop (пустышку)
const channel = safeChannel('my-channel');
```

## Supabase конфигурация

### Клиент (src/lib/supabase.ts)
```typescript
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { 
    persistSession: true, 
    autoRefreshToken: false,  // Важно: автообновление отключено (проблемы с proxy)
    storageKey: getStorageKey() // Уникальный ключ per-company
  },
  global: { fetch: customFetch },  // Кастомный fetch с лимитером
  realtime: isProxyMode() ? false : true,  // Отключаем realtime на Yandex
});
```

### Кастомный fetch (customFetch)
- Блокирует запросы если вкладка скрыта (`document.hidden`)
- Фиксит заголовки для Yandex proxy
- Ограничивает concurrency до 3 запросов на Yandex

## Оптимистичные обновления

### Где используются
- `useEstimates.ts` — создание/удаление смет
- `useExpenses.ts` — создание/удаление расходов
- `useIncomes.ts` — создание/удаление доходов
- `useCustomers.ts` — создание/удаление клиентов
- `useContracts.ts` — создание/удаление договоров
- `useChecklists.ts` — создание чек-листов, обновление items

### Паттерн
```typescript
// 1. Обновляем UI сразу
setState(prev => [newItem, ...prev]);

// 2. Отправляем на сервер (не await)
supabase.from('table').insert(data).then(() => {
  // 3. Фоновая синхронизация
  fetchData(true);
});
```

## Аудит-логи

### Что логируется
| Действие | Тип | Когда |
|----------|-----|-------|
| login | user | При входе в систему |
| logout | user | При выходе |
| view | estimate/contract/equipment | При открытии на редактирование |
| create | * | При создании записи |
| update | * | При обновлении |
| delete | * | При удалении |

### Важно: company_id
- Логи фильтруются по `company_id`
- Login/logout логируются с `company_id` текущей компании
- Без `company_id` логи не видны в интерфейсе

### RLS политики
```sql
-- Админы видят только логи своей компании
-- company_id IS NULL для системных логов (deprecated)
```

## Оффлайн-режим

### Когда включается
- `navigator.onLine === false`
- Ошибка сети при запросе
- Таймаут запроса

### Что кэшируется (IndexedDB)
| Сущность | Таблица | Функции |
|----------|---------|---------|
| Сметы | `estimates` | `saveEstimateLocal`, `getEstimatesLocal` |
| Оборудование | `equipment` | `saveEquipmentLocal`, `getEquipmentLocal` |
| Чек-листы | `checklists` | `saveChecklistLocal`, `getChecklistsLocal` |
| Заказчики | `customers` | `saveCustomerLocal`, `getCustomersLocal` |
| Категории кабелей | `cableCategories` | `saveCableCategoryLocal`, `getCableCategoriesLocal` |
| Инвентарь кабелей | `cableInventory` | `saveCableInventoryLocal`, `getCableInventoryLocal` |
| Движения кабелей | `cableMovements` | `saveCableMovementLocal`, `getCableMovementsLocal` |
| Ремонты | `equipmentRepairs` | `saveEquipmentRepairLocal`, `getEquipmentRepairsLocal` |
| Позиции инвентаря | `inventoryItems` | `saveInventoryItemLocal`, `getInventoryItemsLocal` |

### Паттерн fetch с offline fallback
```typescript
const fetchData = async (force = false) => {
  if (!companyId) return;
  
  // 1. Try memory cache first
  const cacheKey = `data_${companyId}`;
  if (!force) {
    const cached = getCached(cacheKey);
    if (cached) { setData(cached); return; }
  }
  
  // 2. Try server if online
  if (isOnline()) {
    try {
      const { data, error } = await supabase.from('table').select('*');
      if (!error) {
        setData(data || []);
        setCached(cacheKey, data || []);
        // Save to IndexedDB for offline
        data?.forEach(item => saveItemLocal(item, companyId, true));
        return;
      }
    } catch (e) {
      // Network error - fall through to offline
    }
  }
  
  // 3. Offline fallback - load from IndexedDB
  const localData = await getItemsLocal(companyId);
  setData(localData);
};
```

### Паттерн mutation с optimistic update
```typescript
const addItem = async (item) => {
  // 1. Optimistic update
  setData(prev => [item, ...prev]);
  
  // 2. Save locally
  await saveItemLocal(item, companyId, false);
  
  if (isOnline()) {
    // 3a. Online: save to server
    const { error } = await supabase.from('table').insert(item);
    if (!error) fetchData(true);
  } else {
    // 3b. Offline: add to sync queue
    await addToSyncQueue('table', 'create', item);
    toast.info('Сохранено офлайн');
  }
};
```

### Синхронизация
- `useOfflineSync.ts` — автоматическая синхронизация при возврате онлайн
- `addToSyncQueue()` — добавляет операцию в очередь
- Очередь хранится в IndexedDB (`syncQueue`)

## Поштучный учёт экземпляров (inventory_items)

### Архитектура
```
[cable_inventory] ──1:N──► [inventory_items]
     │                            │
     │                            ├── status: available | issued | repair | written_off
     │                            ├── qr_code: EQ-{groupQR}-{NN}
     │                            └── condition: excellent | good | fair | poor
     │
     └── track_items: BOOLEAN — включает поштучный учёт
```

### Потоки данных

**Создание экземпляров:**
```
[CableManager] → [create_inventory_items RPC] → [inventory_items INSERT]
                      ↓
               Автогенерация QR: EQ-{groupQR}-01, EQ-{groupQR}-02, ...
```

**Выдача экземпляра:**
```
[Чекбокс/QR] → [issueCable] → [cable_movements INSERT + item_id]
                                    ↓
                              [inventory_items UPDATE status='issued']
                                    ↓
                              [Триггер: пересчёт cable_inventory.quantity]
```

**Возврат экземпляра:**
```
[Возврат] → [cable_movements UPDATE is_returned=true]
                  ↓
            [inventory_items UPDATE status='available']
                  ↓
            [Триггер: пересчёт cable_inventory.quantity]
```

### Важные ограничения
- При `track_items=true` выдача через чекбоксы автоматически выбирает свободные экземпляры
- QR-сканер различает QR группы и QR экземпляра (по формату `EQ-XXXX-NN`)
- Комментарии к экземплярам (`item_comments`) загружаются без FK join на `profiles` — имена авторов подтягиваются отдельным запросом (FK ведёт на `auth.users`)

## Realtime и Polling

### Архитектура
```
[Vercel] ──► WebSocket (Realtime) ──► мгновенные обновления
[Yandex] ──► HTTP Polling ──► обновления с интервалом
```

### Интервалы поллинга (Yandex only)
| Данные | Интервал | Hook |
|--------|----------|------|
| Inventory, categories | 5 мин | `useCableInventory` |
| Movements, repairs | 2 мин | `useCableInventory` |
| Checklists | 2 мин | `useChecklistsV2` |
| Estimates | 2 мин | `useEstimates` |
| Customers, contracts, expenses, incomes | 5 мин | соответствующие hooks |
| Equipment kits | — | ❌ Нет поллинга — обновляется при открытии вкладки |

### Защита от лишнего трафика
- `document.hidden` — пауза когда вкладка неактивна
- Ночные часы (23:00–08:00) — поллинг отключен
- `isProxyMode()` — поллинг только на Yandex, на Vercel только WebSocket
- `useRealtimeWithFallback` — unified hook: WebSocket на Vercel, smart polling на Yandex

## Чек-листы: создание из сметы

### Поток создания
```
[Смета] → [createChecklist] → [Генерация items] → [Insert в БД] → [Optimistic update]
                                    ↓
                              [Правила checklist_rules]
                              [Инвентарь cable_inventory]
```

### Счётчики
- **В списке**: сумма quantity (с учётом количества)
- **В модалке**: сумма quantity
- **Прогресс**: количество отмеченных наименований (не quantity!)

### Режимы проверки
- **Простой** (`simple`): один чекбокс `is_checked`
- **Двойной** (`double`): `loaded` + `unloaded` с QR-сканированием

## Важные ограничения и gotchas

### Stale closure
- Всегда добавлять зависимости в `useCallback`
- Пример: `startEditing` зависит от `[companyId, estimates]`

### Proxy mode detection
- Проверять `isProxyMode()` перед созданием WebSocket
- `safeChannel()` обязателен для всех realtime подписок

### DB Replication lag
- После insert может пройти 1-2 секунды перед тем как select вернёт данные
- Использовать optimistic updates или задержку перед refresh

### GitHub Actions
- Может застревать в очереди (несколько runs)
- Ручная отмена: GitHub → Actions → Cancel run

## Файлы конфигурации

| Файл | Назначение |
|------|------------|
| `src/lib/supabase.ts` | Клиент Supabase, proxy detection, custom fetch |
| `src/hooks/useRealtimeWithFallback.ts` | WebSocket/polling универсальный hook |
| `yandex-proxy/api-gateway-spec.yaml` | Спецификация Yandex API Gateway |
| `.github/workflows/deploy.yml` | GitHub Actions CI/CD |
| `vercel.json` | Конфигурация Vercel |

## Проверка работоспособности после деплоя

1. **Vercel**: открыть `vercel.app` → проверить realtime (создать смету, должна появиться без F5)
2. **Yandex**: открыть `yandexcloud.net` → проверить polling (создать смету, появится через 60 сек или после F5)
3. **Аудит-логи**: открыть Админ → Логи → проверить login/view записи
4. **Чек-листы**: создать из сметы → проверить счётчик (должен быть > 0)
