# Edge Function: parse-rider

Анализирует технические райдеры артистов через GigaChat API.

## Деплой

### Способ 1: Через Supabase Dashboard (рекомендуется)

1. Перейдите в [Supabase Dashboard](https://app.supabase.com)
2. Выберите ваш проект
3. Перейдите в **"Edge Functions"**
4. Нажмите **"New Function"**
5. Название: `parse-rider`
6. Вставьте код из `index.ts`
7. Нажмите **"Deploy"**

### Способ 2: Через Supabase CLI (если установлен)

```bash
supabase functions deploy parse-rider
```

## Настройка переменных окружения

В Supabase Dashboard:
1. **Project Settings** → **Edge Functions**
2. Добавьте переменные:

```
GIGACHAT_CLIENT_ID=ваш_client_id
GIGACHAT_CLIENT_SECRET=ваш_client_secret
```

## Использование

```typescript
const { data, error } = await supabase.functions.invoke('parse-rider', {
  body: { riderText: 'текст райдера...' }
});
```

## Ответ

```json
{
  "event_name": "Концерт Артиста",
  "venue": "Гранд Холл",
  "event_date": "2026-03-15",
  "items": [
    {
      "name": "Shure SM58",
      "quantity": 4,
      "category": "Звук",
      "description": "Вокальный микрофон"
    }
  ]
}
```
