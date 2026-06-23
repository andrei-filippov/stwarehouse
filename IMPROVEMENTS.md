# Что можно доделать/улучшить

## ✅ Сделано:
- [x] Система ролей (RBAC) - admin, manager, warehouse, accountant
- [x] Ограничение доступа к вкладкам
- [x] Админ-панель для управления ролями
- [x] PDF-экспорт смет через jsPDF (корректная работа на iOS Safari — открытие в новой вкладке вместо window.print())
- [x] Объединение ячеек в Excel-экспорте для итоговых строк (по категории, по секции, общий итог)

## 🎯 Высокий приоритет:

### 1. **История изменений (Audit Log)**
Кто и когда изменил смету, оборудование и т.д.
```typescript
// Таблица activity_logs
- user_id
- action: 'created' | 'updated' | 'deleted'
- entity_type: 'estimate' | 'equipment' | 'customer'
- entity_id
- old_data: jsonb
- new_data: jsonb
- created_at
```

### 2. **Статусы смет**
- Черновик → Отправлено → Подтверждено → Оплачено → Выполнено
- История статусов с датами
- Уведомления при смене статуса

### 3. **Поиск по всему приложению**
Глобальный поиск: Ctrl+K или иконка в шапке
- Поиск по сметам, оборудованию, заказчикам
- Быстрые переходы

### 4. **Комментарии и заметки**
- Комментарии к сметам
- Внутренние заметки (видны только сотрудникам)
- @упоминания пользователей

### 5. **Уведомления**
- Toast-уведомления реального времени (Supabase Realtime)
- Email-уведомления (SendGrid/Resend)
- Уведомления о приближающихся событиях

## 🚀 Средний приоритет:

### 6. **Транзакционное сохранение смет и шаблонов**
Сейчас обновление сметы/шаблона делается в 2-3 отдельных запроса (UPDATE + DELETE items + INSERT items). При сетевых сбоях между ними данные могут остаться в неконсистентном состоянии (например, смета обновлена, а позиции потерялись).

**Рекомендация:** обернуть в Supabase RPC:
```sql
-- Пример для обновления сметы
CREATE OR REPLACE FUNCTION update_estimate_with_items(
  p_estimate_id UUID,
  p_estimate_data JSONB,
  p_items JSONB[]
) RETURNS void AS $$
BEGIN
  UPDATE estimates SET ... WHERE id = p_estimate_id;
  DELETE FROM estimate_items WHERE estimate_id = p_estimate_id;
  INSERT INTO estimate_items SELECT * FROM jsonb_to_recordset(p_items);
END;
$$ LANGUAGE plpgsql;
```

### 7. **Dark Mode**
```css
.dark {
  --background: #0f172a;
  --foreground: #f8fafc;
  // ...
}
```

### 8. **Optimistic updates для шаблонов**
Сейчас `useTemplates` ждёт ответа сервера после `create`/`update`/`delete`, что создаёт ощутимую задержку в UI.

**Рекомендация:** использовать `useOptimisticMutation` (как в `useEstimates`):
```typescript
const optimistic = useOptimisticMutation(setTemplates);

const createTemplate = useCallback(async (...) => {
  const tempId = `temp_${Date.now()}`;
  optimistic.add({ ...template, id: tempId });
  
  const { data, error } = await supabase.from('templates').insert(...);
  
  if (data) optimistic.update(tempId, data);
  else optimistic.remove(tempId);
}, [optimistic]);
```

### 9. **Drag & Drop**
- Загрузка файлов (договоры, фото оборудования)
- Перетаскивание в календаре
- Сортировка списков

### 10. **QR-коды и штрих-коды**
- Печать QR-кодов для оборудования
- Сканирование → быстрый переход к карточке
- Инвентаризация через телефон

### 11. **Интеграции**
- Telegram-бот для уведомлений
- Google Calendar sync
- Экспорт в 1С
- WhatsApp Business API

### 12. **Печать документов**
- Договоры аренды
- Акты приема-передачи
- Товарные чеки
- Накладные

## 📱 Низкий приоритет:

### 13. **PWA (Progressive Web App)**
- Установка на телефон
- Офлайн-режим
- Push-уведомления

### 14. **Мультиязычность**
- Русский ✅
- English
- Deutsch

### 15. **Аналитика v2.0**
- Графики выручки по месяцам
- Самое популярное оборудование
- Загрузка персонала
- Прогнозирование

### 16. **API для интеграций**
- REST API
- API ключи для клиентов
- Webhooks

### 17. **Резервное копирование**
- Автоэкспорт в Google Drive
- Ежедневные бэкапы
- Восстановление данных

## 🔧 Технические улучшения:

### 18. **Тестирование**
- Unit-тесты (Vitest)
- E2E-тесты (Playwright)
- Тестирование API

### 19. **Performance**
- Виртуализация длинных списков
- Lazy loading компонентов
- Кэширование запросов (React Query)

### 20. **Безопасность**
- 2FA (двухфакторная аутентификация)
- Логирование входов
- Блокировка после N неудачных попыток

### 21. **Документация**
- API docs (Swagger)
- User guide
- Видео-туториалы

### 20. **Масштабирование**
- Мультиарендность (tenants)
- White-label решение
- Сustom domains

---

## Что выбрать следующим?

**Если нужно быстро:**
→ Статусы смет (#2) + История изменений (#1)

**Если для удобства:**
→ Глобальный поиск (#3) + Комментарии (#4)

**Если для мобильности:**
→ PWA (#11) + QR-коды (#8)

**Если для бизнеса:**
→ Печать документов (#10) + Интеграции (#9)

Хотите реализовать что-то конкретное? 😉
