# Настройка на Vercel

## Переменные окружения для GigaChat (AI райдеры)

### 1. Добавьте переменные в Vercel Dashboard

1. Перейдите на [vercel.com/dashboard](https://vercel.com/dashboard)
2. Выберите ваш проект
3. Нажмите **"Settings"** → **"Environment Variables"**
4. Добавьте:
   ```
   Name: VITE_GIGACHAT_CLIENT_ID
   Value: ваш_client_id_от_gigachat
   ```
   ```
   Name: VITE_GIGACHAT_CLIENT_SECRET
   Value: ваш_client_secret_от_gigachat
   ```
5. Нажмите **Save**

### 2. Обязательно сделайте Redeploy

- В Vercel Dashboard → вкладка **"Deployments"**
- Найдите последний деплой
- Нажмите **"⋮"** → **"Redeploy"**

### 3. Проверьте в консоли браузера

Откройте DevTools (F12) → Console. Должно быть сообщение:
```
[App Debug] {profileRole: 'admin', userRole: 'admin', ...}
[EstimateManager Debug] {userRole: 'admin', isAdmin: true, ...}
```

Если `gigachatClientId: undefined` — переменная не подтянулась.

---

## Проблема: API Dadata не работает на Vercel

### Решение:

#### 1. Добавьте переменную окружения в Vercel Dashboard

1. Перейдите на [vercel.com/dashboard](https://vercel.com/dashboard)
2. Выберите ваш проект
3. Нажмите **"Settings"** → **"Environment Variables"**
4. Добавьте:
   ```
   Name: VITE_DADATA_API_KEY
   Value: 9c715a546912a9eaf2119fcb44b18b7452fe03a6
   ```
5. Нажмите **Save**

#### 2. Обязательно сделайте Redeploy

После добавления переменной окружения нужно пересобрать проект:

**Способ 1:**
- В Vercel Dashboard → вкладка **"Deployments"**
- Найдите последний деплой
- Нажмите иконку **"⋮"** (три точки) → **"Redeploy"**

**Способ 2 (через git):**
```bash
git commit --allow-empty -m "trigger redeploy"
git push
```

#### 3. Проверьте в консоли браузера

Откройте DevTools (F12) → Console. Должно быть сообщение:
```
Dadata API Key check: {exists: true, length: 40, ...}
```

Если `exists: false` — переменная не подтянулась.

## ⚠️ Важно:

1. **Переменная должна начинаться с VITE_**
   - ✅ `VITE_DADATA_API_KEY` — работает
   - ❌ `DADATA_API_KEY` — не работает (Vite не видит)

2. **После изменения переменных обязателен redeploy**
   - Просто сохранить недостаточно
   - Нужна новая сборка

3. **CORS**
   - Dadata разрешает запросы с любых доменов
   - Если ошибка CORS — проверьте, не блокирует ли браузер

## Отладка

Если не работает:

1. Откройте DevTools → Console
2. Найдите сообщение "Dadata API Key check"
3. Если ключ не найден — проверьте настройки Vercel
