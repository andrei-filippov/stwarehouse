# Чек-лист мультиарендности (Multitenancy)

## ✅ Готово

### База данных
- [x] Таблица `companies` создана
- [x] Таблица `company_members` создана
- [x] Колонка `company_id` добавлена во все таблицы
- [x] Миграция `supabase_migration_multitenant.sql` создана

### Код (Frontend)
- [x] `useCompany.ts` - управление компанией
- [x] `CompanyContext.tsx` - контекст компании
- [x] Все хуки используют `companyId`:
  - [x] `useEquipment.ts`
  - [x] `useEstimates.ts`
  - [x] `useStaff.ts`
  - [x] `useCustomers.ts`
  - [x] `useContracts.ts`
  - [x] `useInvoices.ts`
  - [x] `useActs.ts`
  - [x] `useTemplates.ts`
  - [x] `useExpenses.ts`
  - [x] `useGoals.ts`
  - [x] `useChecklists.ts`
  - [x] `useCableInventory.ts`

### RLS Политики (частично)
- [x] `staff` - обновлены для работы с `company_id`

## ❌ Нужно доделать

### 1. RLS Политики для всех таблиц
Нужно обновить политики для всех таблиц, чтобы использовать `company_id` вместо `user_id`:

- [ ] `equipment`
- [ ] `categories`
- [ ] `estimates`
- [ ] `estimate_items`
- [ ] `templates`
- [ ] `template_items`
- [ ] `customers`
- [ ] `contracts`
- [ ] `contract_estimates`
- [ ] `contract_templates`
- [ ] `invoices`
- [ ] `acts`
- [ ] `act_items`
- [ ] `expenses`
- [ ] `goals`
- [ ] `checklist_rules`
- [ ] `checklists`
- [ ] `cable_categories`
- [ ] `cable_inventory`

### 2. Управление компаниями (UI)
- [ ] Страница создания компании
- [ ] Страница приглашения пользователей в компанию
- [ ] Страница управления ролями
- [ ] Переключатель компаний в интерфейсе

### 3. Поддомены (опционально)
- [ ] Настройка DNS для поддоменов
- [ ] Конфигурация Vercel/хостинга для поддоменов
- [ ] Автоматическое определение компании по поддомену

### 4. Триггеры и функции
- [ ] Обновить триггеры `audit_logs` для работы с `company_id`
- [ ] Проверить функцию `migrate_user_to_company`

### 5. Тестирование
- [ ] Создание новой компании
- [ ] Приглашение пользователя в компанию
- [ ] Переключение между компаниями
- [ ] Проверка изоляции данных

## SQL скрипты для выполнения

### Обновление RLS политик (пример для equipment)
```sql
-- Удалить старые политики
DROP POLICY IF EXISTS "Users can view own equipment" ON equipment;
DROP POLICY IF EXISTS "Users can insert own equipment" ON equipment;
DROP POLICY IF EXISTS "Users can update own equipment" ON equipment;
DROP POLICY IF EXISTS "Users can delete own equipment" ON equipment;

-- Создать новые политики на основе company_id
CREATE POLICY "equipment_select_company" ON equipment
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = equipment.company_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

CREATE POLICY "equipment_insert_company" ON equipment
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = equipment.company_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

CREATE POLICY "equipment_update_company" ON equipment
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = equipment.company_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

CREATE POLICY "equipment_delete_company" ON equipment
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = equipment.company_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );
```

## Рекомендации

1. **Сначала обновите все RLS политики** - это критично для безопасности
2. **Затем добавьте UI для управления компаниями**
3. **Поддомены можно настроить позже** - это опциональная функция

## Текущий статус

**Готовность: ~70%**

Основная функциональность работает для одной компании. Для полноценной мультиарендности нужно:
1. Обновить все RLS политики (критично)
2. Добавить UI для управления компаниями
