# Edge Function: parse-rider

Анализирует технические райдеры артистов через **OpenRouter** (GigaChat API).

## Настройка OpenRouter

### 1. Регистрация
1. Перейдите на [openrouter.ai](https://openrouter.ai)
2. Зарегистрируйтесь (можно через Google/GitHub)
3. Пополните баланс (минимум $5) или используйте бесплатные токены

### 2. Получение API ключа
1. В Dashboard нажмите **"Keys"**
2. Создайте новый ключ
3. Скопируйте ключ (начинается с `sk-or-...`)

### 3. Деплой функции в Supabase

#### Через Dashboard:
1. Перейдите в [Supabase Dashboard](https://app.supabase.com)
2. Выберите проект
3. **Edge Functions** → **New Function**
4. Название: `parse-rider`
5. Вставьте код из `index.ts`
6. **Deploy**

#### Переменные окружения:
1. **Project Settings** → **Edge Functions**
2. Добавьте:
```
OPENROUTER_API_KEY=sk-or-...ваш_ключ...
```
3. (Опционально) Удалите старые `GIGACHAT_CLIENT_ID` и `GIGACHAT_CLIENT_SECRET`

## Модели и цены

| Модель | Цена за 1K токенов | Код в функции |
|--------|-------------------|---------------|
| GigaChat Lite | ~$0.01 | `gigachat/gigachat-lite` |
| GigaChat Pro | ~$0.02 | `gigachat/gigachat-pro` |

Измените `MODEL` в `index.ts` если нужна другая модель.

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

## Преимущества OpenRouter

- ✅ Нет проблем с SSL сертификатами
- ✅ Работает сразу
- ✅ Надёжная инфраструктура
- ✅ Поддержка множества моделей (GPT-4, Claude, GigaChat и др.)
- ✅ Детальная статистика использования
