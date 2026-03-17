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

## CSP Заголовки (Content Security Policy)

В `vercel.json` настроены security headers:

```json
{
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co https://*.dadata.ru; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"
}
```

## XSS Защита

### DOMPurify

Все компоненты с HTML-редактированием используют санитизацию:

```typescript
import { sanitizeHtml } from '../lib/utils';

// Санитизация перед отображением
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />

// Санитизация при сохранении
const cleanContent = sanitizeHtml(editRef.current.innerHTML);
```

### Разрешенные теги

- Текст: `p`, `br`, `strong`, `b`, `em`, `i`, `u`, `s`, `strike`
- Заголовки: `h1-h6`
- Списки: `ul`, `ol`, `li`
- Таблицы: `table`, `thead`, `tbody`, `tr`, `td`, `th`
- Другое: `div`, `span`, `img`

### Запрещенные теги

`script`, `iframe`, `object`, `embed`, `form`, `input`

## Валидация данных

### Клиентская валидация

```typescript
import { validateEmail, validatePhone, validateName } from '../lib/validation';

const error = validateEmail(email);
if (error) {
  toast.error(error);
  return;
}
```

### Серверная валидация (RLS)

Все таблицы защищены Row Level Security:

```sql
CREATE POLICY "Users can view data for their company"
  ON customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = customers.company_id
      AND cm.user_id = auth.uid()
    )
  );
```

## Что было сделано

1. ✅ Supabase ключи перенесены в переменные окружения
2. ✅ Добавлена проверка наличия переменных окружения
3. ✅ `.env` добавлен в `.gitignore`
4. ✅ Создан `.env.example` шаблон
5. ✅ CSP заголовки настроены в `vercel.json`
6. ✅ DOMPurify для защиты от XSS
7. ✅ RLS политики для всех таблиц
8. ✅ Валидация входных данных
9. ✅ Security headers (HSTS, X-Frame-Options, etc)
