# Чеклист подготовки к переезду на российские сервера

## ✅ Этап 1: Безопасность (выполнить СЕЙЧАС)

### 1.1 Запустить SQL-скрипт исправления RLS
- [ ] **Создать бэкап базы данных** в Supabase Dashboard
- [ ] Открыть Supabase → SQL Editor → New Query
- [ ] Вставить содержимое `supabase_security_fix_complete.sql`
- [ ] Выполнить скрипт
- [ ] Проверить результат — все таблицы должны иметь `rls_enabled = true` и `policy_count >= 1`

### 1.2 Сменить скомпрометированные ключи
- [ ] **Unisender API Key**: зайти в unisender.ru → Настройки → API → Создать новый ключ
- [ ] **Yandex Disk OAuth**: зайти в oauth.yandex.ru → Отозвать старый токен → Получить новый
- [ ] Обновить `UNISENDER_API_KEY` в Supabase Edge Functions secrets
- [ ] Обновить токен в таблице `company_yandex_disk` (через приложение)

### 1.3 Очистить историю git (если ключи были в коде)
```bash
# Установить BFG Repo-Cleaner или git-filter-repo
# Пример с git-filter-repo:
git filter-repo --replace-text <(echo "614xwkfm4zwguq39mmzpksusgzx8qmbzwwahx7zy==>REDACTED")
# Или полностью удалить файл из истории:
# git filter-repo --path supabase/functions/send-invitation-email/index.ts
```

### 1.4 Проверить .env файлы
- [ ] Убедиться, что `.env` в `.gitignore`
- [ ] Убедиться, что `.env.example` не содержит реальных ключей
- [ ] Проверить, что `VITE_SUPABASE_ANON_KEY` не захардкожен в коде

---

## 🟡 Этап 2: Подготовка архитектуры (эта неделя)

### 2.1 Вынести конфиги в переменные окружения
- [ ] `src/lib/supabase.ts` — `storageKey` должен браться из `VITE_SUPABASE_PROJECT_REF`
- [ ] Убрать захардкоженный `sb-trivdyjfiyxsmrkihqet-auth-token`

### 2.2 Подготовить скрипт миграции данных
```bash
# Создать файл migrate.sh
#!/bin/bash
set -e

# 1. Дамп структуры (без auth)
pg_dump $OLD_DB_URL --schema-only --exclude-schema=auth --exclude-schema=storage > schema.sql

# 2. Дамп данных (без auth)
pg_dump $OLD_DB_URL --data-only --exclude-schema=auth --exclude-schema=storage > data.sql

# 3. Применить на новом сервере
psql $NEW_DB_URL < schema.sql
psql $NEW_DB_URL < data.sql

echo "Миграция завершена!"
```

### 2.3 Выбрать российского провайдера
| Провайдер | Рекомендация |
|-----------|-------------|
| **Yandex Cloud** | Лучшая интеграция, Managed PostgreSQL, Object Storage |
| **Selectel** | Дешевле, хорошая поддержка |
| **Timeweb Cloud** | Простой интерфейс, низкие цены |
| **Beget** | Хостинг + VPS, для небольших проектов |

**Рекомендуемый стек:**
- PostgreSQL: Yandex Cloud Managed PostgreSQL
- Auth: Keycloak (self-hosted) или Clerk
- Storage: Yandex Object Storage (S3-совместимый)
- Hosting: Yandex Cloud / Selectel

---

## 🟢 Этап 3: Миграция (день X)

### 3.1 Подготовка
- [ ] Уведомить пользователей о технических работах (2 часа окно)
- [ ] Включить maintenance mode в приложении
- [ ] Сделать финальный бэкап

### 3.2 Миграция данных
- [ ] Запустить `migrate.sh`
- [ ] Проверить целостность данных (количество записей)
- [ ] Проверить связи (FK constraints)

### 3.3 Настройка нового окружения
- [ ] Создать новый проект в выбранном облаке
- [ ] Настроить PostgreSQL (версия 15+)
- [ ] Настроить Keycloak / Auth сервис
- [ ] Настроить Object Storage для файлов
- [ ] Настроить Edge Functions (или замену)

### 3.4 Деплой приложения
- [ ] Обновить `VITE_SUPABASE_URL` → новый URL
- [ ] Обновить `VITE_SUPABASE_ANON_KEY` → новый ключ
- [ ] Задеплоить frontend на новый хостинг
- [ ] Настроить DNS / домен

### 3.5 Проверка
- [ ] Авторизация работает
- [ ] Данные отображаются корректно
- [ ] RLS политики работают (проверить изоляцию компаний)
- [ ] Файлы загружаются/скачиваются
- [ ] Email-уведомления работают

---

## 📋 Проверочный список после миграции

### Безопасность
- [ ] Все таблицы имеют RLS enabled
- [ ] Пользователь компании A не видит данные компании B
- [ ] Заблокированный пользователь (`status = 'suspended'`) не имеет доступа
- [ ] Токены и ключи не утекли в логи

### Функциональность
- [ ] Регистрация нового пользователя
- [ ] Создание компании
- [ ] Приглашение сотрудника
- [ ] CRUD операции со всеми сущностями
- [ ] Генерация PDF (счета, акты, договоры)
- [ ] Интеграция с Yandex Disk
- [ ] QR-сканирование

### Производительность
- [ ] Время загрузки главной страницы < 3 сек
- [ ] Поиск работает быстро
- [ ] Realtime обновления работают

---

## 🆘 Откат (если что-то пошло не так)

1. Переключить DNS обратно на старый сервер
2. Восстановить бэкап на старом сервере (если нужно)
3. Отключить maintenance mode
4. Проанализировать проблему и повторить

---

## 📞 Контакты для экстренной помощи

- **Yandex Cloud поддержка**: support@yandex.cloud
- **Selectel поддержка**: support@selectel.ru
- **Keycloak документация**: https://www.keycloak.org/documentation

---

*Последнее обновление: 2026-04-28*
*Подготовлено для проекта stwarehouse*
