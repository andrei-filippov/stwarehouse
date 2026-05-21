# Инструкции для AI-агентов (Kimi Code CLI)

## ⚠️ Обязательно к прочтению перед работой

### Документация
- **ARCHITECTURE.md** — архитектура деплоя, потоки данных, ограничения
- **README.md** — общее описание проекта
- **LOGGER_GUIDE.md** — логирование
- **TROUBLESHOOTING.md** — типичные проблемы

### Перед каждым изменением
1. Прочитать соответствующий раздел ARCHITECTURE.md
2. Проверить, не ломается ли proxy-mode (Yandex)
3. Проверить, не ломается ли realtime (Vercel)
4. Убедиться что `safeChannel()` используется для новых подписок

### После каждого изменения
1. Обновить ARCHITECTURE.md если изменилась архитектура
2. Обновить TROUBLESHOOTING.md если фиксили баг
3. Обновить этот файл если изменились правила для агентов

## Критические правила

### 1. WebSocket / Realtime
- **ВСЕГДА** использовать `safeChannel()` вместо `supabase.channel()`
- **НИКОГДА** не создавать WebSocket напрямую на Yandex
- Проверять `isProxyMode()` перед realtime операциями

### 2. Supabase запросы
- **ВСЕГДА** фильтровать по `company_id` (или `.is('company_id', null)` для null)
- **НИКОГДА** не использовать `.eq('company_id', 'no-company')` — это ломает UUID
- Добавлять `company_id` во все новые таблицы

### 3. Optimistic updates
- Использовать для create/delete операций
- Не await `fetchData()` после mutation — запускать в фоне
- Сохранять локальный state при ошибке сети

### 4. Stale closure
- **ВСЕГДА** включать все используемые переменные в deps `useCallback`/`useEffect`
- Особенно важно для: `estimates`, `companyId`, `checklists`

### 5. Yandex proxy
- `isProxyMode()` определяет режим по hostname
- На Yandex: polling вместо WebSocket, ограничение concurrency
- На Yandex: `realtime: false` в конфиге Supabase

### 6. Поштучный учёт (inventory_items)
- При `track_items=true` выдача/ремонт **ВСЕГДА** работает с конкретными экземплярами (`item_id`)
- **НИКОГДА** не выдавать по `inventory_id` + `quantity` для `track_items=true` — это ломает учёт
- QR-сканер различает группу и экземпляр по формату QR (`EQ-XXXX` vs `EQ-XXXX-NN`)
- Комментарии к экземплярам (`item_comments`) — FK `author_id` ведёт на `auth.users`, не на `profiles`. Имена авторов подтягивать отдельным запросом

### 7. Polling и realtime
- **Vercel**: только WebSocket (`safeChannel()`), поллинг отключен
- **Yandex**: smart polling с интервалами (2–5 мин), ночью отключен
- Данные которые редко меняются (kits) — **без поллинга**, обновлять при открытии вкладки
- **ВСЕГДА** проверять `document.hidden` перед поллингом
- Использовать `useRealtimeWithFallback` — unified hook для всех подписок

## Чек-лист перед коммитом

- [ ] TypeScript компилируется (`npx tsc --noEmit`)
- [ ] Нет прямых `supabase.channel()` — только `safeChannel()`
- [ ] Все `useCallback` имеют правильные deps
- [ ] Новые таблицы имеют `company_id` и RLS
- [ ] ARCHITECTURE.md обновлён (если нужно)

## Контакты и доступы
- Supabase: `supabase.co` (URL в `.env`)
- Vercel: автодеплой из `main`
- Yandex: GitHub Actions → `deploy.yml`
- Proxy: Yandex API Gateway (спека в `yandex-proxy/`)
