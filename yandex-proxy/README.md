# Yandex Cloud Proxy для Supabase

Этот прокси позволяет работать с Supabase из России без VPN, проксируя запросы через Yandex Cloud (который не блокируется).

## Архитектура

```
Фронтенд (Yandex Object Storage) → API Gateway (Yandex) → Cloud Function (Yandex) → Supabase (AWS)
```

## Компоненты

1. **Cloud Function** (`proxy-supabase/index.py`) — Python-функция, которая проксирует HTTP запросы к Supabase REST API
2. **API Gateway** (`api-gateway-spec.yaml`) — Yandex API Gateway, который принимает запросы и направляет их в Cloud Function

## Ручная настройка в Yandex Cloud Console

### Шаг 1: Создать Cloud Function

1. Откройте [Yandex Cloud Console](https://console.cloud.yandex.ru/)
2. Перейдите в **Cloud Functions**
3. Нажмите **Создать функцию**
4. Название: `proxy-supabase`
5. Создайте версию функции:
   - Среда выполнения: `python311` (или `python312`)
   - Точка входа: `index.handler`
   - Загрузите файлы `index.py` и `requirements.txt` из папки `proxy-supabase/`
   - Переменные окружения:
     - `SUPABASE_URL` = `https://trivdyjfiyxsmrkihqet.supabase.co`
     - `SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIs...` (JWT anon key, НЕ publishable key)
   - Таймаут: 30 секунд
   - Память: 128 МБ
   - Сервисный аккаунт: выберите или создайте новый

### Шаг 2: Создать API Gateway

1. Перейдите в **API Gateway**
2. Нажмите **Создать API-шлюз**
3. Название: `supabase-proxy`
4. Спецификация: скопируйте содержимое `api-gateway-spec.yaml`
5. Замените переменные:
   - `${PROXY_FUNCTION_ID}` — ID функции `proxy-supabase` (можно посмотреть в URL функции)
   - `${SERVICE_ACCOUNT_ID}` — ID сервисного аккаунта
6. Нажмите **Создать**

### Шаг 3: Получить URL прокси

После создания API Gateway, в его карточке будет **Служебный домен** вида:
```
https://d5d3f1abcdefg.cloud-apigw.yandexcloud.net
```

Это и есть URL вашего прокси.

### Шаг 4: Обновить фронтенд

В `.env` и GitHub Secrets замените:
```
# Было:
VITE_SUPABASE_URL=https://trivdyjfiyxsmrkihqet.supabase.co

# Стало:
VITE_SUPABASE_URL=https://d5d3f1abcdefg.cloud-apigw.yandexcloud.net/proxy
```

**Важно:** добавьте `/proxy` в конец URL!

## Как это работает

1. Фронтенд делает запрос к `https://d5d3f1abcdefg.cloud-apigw.yandexcloud.net/proxy/companies?select=*`
2. API Gateway перенаправляет запрос в Cloud Function
3. Cloud Function добавляет `apikey` и `Authorization` заголовки
4. Cloud Function делает запрос к `https://trivdyjfiyxsmrkihqet.supabase.co/rest/v1/companies?select=*`
5. Ответ возвращается обратно через цепочку

## Безопасность

- Прокси не хранит данные — только пересылает
- JWT токен пользователя передаётся через заголовок `Authorization`
- Анонимный ключ Supabase хранится в переменных окружения функции
- CORS настроен только для разрешённых доменов

## Стоимость

- Cloud Functions: бесплатно до 1 млн вызовов/мес
- API Gateway: бесплатно до 1 млн запросов/мес
- Для небольшого приложения — практически бесплатно

## Деплой через Yandex CLI (опционально)

```bash
# Установить Yandex CLI: https://cloud.yandex.ru/docs/cli/quickstart

# Авторизоваться
yc init

# Создать функцию
yc serverless function create --name=proxy-supabase

# Создать версию
yc serverless function version create \
  --function-name=proxy-supabase \
  --runtime python311 \
  --entrypoint index.handler \
  --memory 128m \
  --execution-timeout 30s \
  --source-path ./proxy-supabase \
  --environment SUPABASE_URL=https://trivdyjfiyxsmrkihqet.supabase.co,SUPABASE_ANON_KEY=your_anon_key

# Создать API Gateway
yc serverless api-gateway create \
  --name=supabase-proxy \
  --spec=api-gateway-spec.yaml
```
