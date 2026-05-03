# Деплой фронтенда в Yandex Object Storage + Vercel (двойной деплой)

## Архитектура

```
Git push → GitHub Actions
              │
              ├──→ [Vercel] — продакшен (основной)
              │
              └──→ [Yandex Object Storage] — зеркало / fallback
```

- **Vercel** — основной хостинг, авто-деплой из Git
- **Yandex Object Storage** — зеркало для пользователей из РФ (быстрее) + fallback

---

## 1. Настройка Yandex Object Storage

### 1.1 Создать бакет

```
Yandex Cloud Console → Object Storage → Создать бакет
```

| Параметр | Значение |
|----------|----------|
| **Имя** | `stwarehouse` |
| **Класс хранилища** | Standard |
| **Доступ** | Публичный |
| **Хостинг статического сайта** | Включить |
| **Главная страница** | `index.html` |
| **Страница ошибок** | `index.html` (для SPA routing!) |

### 1.2 Создать сервисный аккаунт и ключи

```
Yandex Cloud → Сервисные аккаунты → Создать
→ Имя: stwarehouse-deploy
→ Роль: storage.editor
→ Создать ключ доступа (Access Key ID + Secret Access Key)
```

**Сохраните ключи — они показываются только один раз!**

### 1.3 Настроить CORS (если нужно)

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": [
      "https://stwarehouse.website.yandexcloud.net",
      "https://your-domain.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

---

## 2. Настройка Vercel (для GitHub Actions)

### 2.1 Получить токен

1. Перейдите на https://vercel.com/account/tokens
2. Создайте новый токен: `GitHub Actions Deploy`
3. Скопируйте токен

### 2.2 Получить ORG_ID и PROJECT_ID

```bash
# В папке проекта
npx vercel link
# Следуйте инструкциям

# После линка:
cat .vercel/project.json
# {"orgId":"...","projectId":"..."}
```

---

## 3. Настройка GitHub Secrets

Перейдите в репозиторий → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### Обязательные secrets:

| Secret | Описание | Где взять |
|--------|----------|-----------|
| `VITE_SUPABASE_URL` | URL Supabase проекта | Supabase Dashboard → API |
| `VITE_SUPABASE_ANON_KEY` | Анонимный ключ Supabase | Supabase Dashboard → API |
| `VITE_DADATA_API_KEY` | Ключ Dadata | https://dadata.ru |
| `VITE_YANDEX_CLIENT_ID` | Client ID для Яндекс Диска | https://oauth.yandex.ru |
| `YANDEX_ACCESS_KEY_ID` | Access Key для Object Storage | Yandex Cloud → Сервисный аккаунт |
| `YANDEX_SECRET_ACCESS_KEY` | Secret Key для Object Storage | Yandex Cloud → Сервисный аккаунт |
| `VERCEL_TOKEN` | Токен Vercel | https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | ID организации Vercel | `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | ID проекта Vercel | `.vercel/project.json` |

---

## 4. Локальный деплой в Yandex (ручной)

### 4.1 Установить AWS CLI

```bash
pip install awscli
```

### 4.2 Настроить профиль

```bash
aws configure --profile yandex
# AWS Access Key ID:     <your_yandex_access_key>
# AWS Secret Access Key: <your_yandex_secret_key>
# Default region:        ru-central1
# Default output:        json
```

### 4.3 Запустить деплой

```bash
# Если dist уже собран
./deploy-yandex.sh

# Или с предварительной сборкой
./deploy-yandex.sh --build
```

---

## 5. Как это работает

### При push в `main`:

1. **GitHub Actions** запускает workflow
2. **Сборка** — один раз для обоих деплоев
3. **Параллельный деплой**:
   - Vercel — через CLI (`vercel deploy --prod`)
   - Yandex — через AWS CLI (`aws s3 sync`)

### Кеширование:

| Файл | Кеш | Причина |
|------|-----|---------|
| `assets/*` (JS/CSS) | 1 год | Хеш в имени файла |
| `index.html` | 0 | Точка входа SPA |
| `sw.js` | 0 | Service Worker |
| `manifest.json` | 0 | PWA манифест |

---

## 6. Fallback стратегия

Если Yandex Object Storage недоступен:

```
Пользователь → Yandex (основной)
              ↓ (не работает)
         Vercel (fallback)
```

**Как переключить пользователей:**
- DNS CNAME → на другой домен
- Или просто дать ссылку на Vercel

---

## 7. Полезные команды

```bash
# Проверить содержимое бакета
aws s3 --profile yandex --endpoint-url=https://storage.yandexcloud.net \
  ls s3://stwarehouse --recursive

# Удалить все файлы из бакета (осторожно!)
aws s3 --profile yandex --endpoint-url=https://storage.yandexcloud.net \
  rm s3://stwarehouse --recursive

# Получить публичный URL файла
aws s3 --profile yandex --endpoint-url=https://storage.yandexcloud.net \
  presign s3://stwarehouse/index.html
```

---

## 8. Устранение неполадок

### Ошибка: `Access Denied`
- Проверьте права сервисного аккаунта (нужна роль `storage.editor`)
- Проверьте что бакет публичный

### Ошибка: `NoSuchBucket`
- Проверьте имя бакета (должно быть `stwarehouse`)

### Ошибка: `Could not connect to the endpoint URL`
- Проверьте endpoint: `https://storage.yandexcloud.net`

### SPA routing не работает
- В настройках бакета включите хостинг
- Укажите страницу ошибок: `index.html`

---

## 9. Ссылки

- [Yandex Object Storage — Документация](https://cloud.yandex.ru/docs/storage/)
- [Настройка статического сайта](https://cloud.yandex.ru/docs/storage/operations/hosting/setup)
- [AWS CLI — Документация](https://docs.aws.amazon.com/cli/)
- [Vercel CLI — Документация](https://vercel.com/docs/cli)
