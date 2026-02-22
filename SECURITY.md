# Безопасность проекта

## Важные меры безопасности

### 1. Переменные окружения

Supabase ключи вынесены в `.env` файл:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

⚠️ **Никогда не коммитьте `.env` файл в репозиторий!**

### 2. Файл .env.example

Создан шаблон `.env.example` для других разработчиков:

```
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Gitignore

Файл `.env` уже добавлен в `.gitignore`:

```
# Environment variables
.env
.env.local
.env.*.local
```

### 4. Проверка репозитория

Убедитесь, что репозиторий **не публичный**, или смените ключи Supabase:

1. Перейдите в Dashboard Supabase → Project Settings → API
2. Нажмите "Generate new API key" для anon key
3. Обновите ключ в `.env` файле

### 5. Проверка истории git

Если ключи ранее были в коде, удалите их из истории:

```bash
# Проверить историю на наличие ключей
git log --all --full-history -- .env

# Если ключи были в коде, используйте BFG Repo-Cleaner
# или создайте новый репозиторий
```

## Что было сделано

1. ✅ Supabase ключи перенесены в переменные окружения
2. ✅ Добавлена проверка наличия переменных окружения
3. ✅ `.env` добавлен в `.gitignore`
4. ✅ Создан `.env.example` шаблон
