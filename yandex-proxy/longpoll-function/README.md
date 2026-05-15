# Long Polling Proxy for Supabase

Решение для получения realtime-обновлений через Yandex прокси без WebSocket.

## Как работает

Вместо постоянного поллинга каждые 5 секунд:
```
Клиент → HTTP запрос → Ждём 30 сек → Ответ (изменения или пусто) → Новый запрос
```

**Результат:** ~1-2 запроса в минуту вместо 12+

## Деплой

### 1. Создать Cloud Function в Yandex Cloud

```bash
# Установить Yandex CLI
yc init

# Создать функцию
yc serverless function create --name=supabase-longpoll

# Создать версию
yc serverless function version create \
  --function-name=supabase-longpoll \
  --runtime python311 \
  --entrypoint index.handler \
  --memory 128m \
  --execution-timeout 30s \
  --source-path ./ \
  --environment SUPABASE_URL=https://your-project.supabase.co,SUPABASE_ANON_KEY=your-key
```

### 2. Добавить в API Gateway

```yaml
paths:
  /api/longpoll:
    post:
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: <function-id>
        service_account_id: <service-account>
```

### 3. Обновить приложение

Вместо `usePolling` использовать `useLongPolling`:

```typescript
useLongPolling({
  tables: ['checklists', 'checklist_items'],
  companyId: companyId,
  onChange: (changedTables) => {
    fetchChecklists();
  }
});
```

## Преимущества

| Метрика | Поллинг (5с) | Long Polling |
|---------|-------------|--------------|
| Запросов/мин | 12 | 1-2 |
| Запросов/час | 720 | 60-120 |
| Задержка обновления | 5 сек | 1-30 сек |
| Нагрузка на БД | Высокая | Низкая |

## Ограничения

- Максимальное ожидание: 30 секунд (Yandex Cloud Functions ограничение)
- Нужен `updated_at` столбец в таблицах
- Не работает для таблиц без timestamp
