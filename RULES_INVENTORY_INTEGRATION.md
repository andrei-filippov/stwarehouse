# Интеграция правил с реальным инвентарем

## Что изменилось

Раньше правила чек-листов хранили текстовые названия позиций:
```typescript
rule.items = [
  { name: "XLR 5м", quantity: 2, category: "cable", is_required: true }
]
```

Теперь правила ссылаются на реальные позиции из вкладки "Учет оборудования":
```typescript
rule.items = [
  { 
    inventory_id: "uuid-123", 
    quantity: 2, 
    is_required: true,
    inventory_name: "XLR 5м",
    inventory_qr_code: "EQ-A1B2C3"
  }
]
```

## Преимущества

1. **QR-коды в чек-листах** — при создании чек-листа из сметы, позиции из правил получают реальные QR-коды из инвентаря
2. **Актуальность данных** — если изменится название или QR в инвентаре, правило подтянет актуальные данные
3. **Комплекты (Kits)** — позиции из правил теперь знают о принадлежности к комплектам/кофрам
4. **Удобство создания правил** — выбор из searchable dropdown вместо ручного ввода

## Схема работы

```
Смета (Estimate)
    │
    ├── GLP JDC1 (x2)
    │       │
    │       ▼
    │   Правило: "Если GLP JDC1 → добавить кабели"
    │       │
    │       ▼
    │   ┌─────────────────────────────────────┐
    │   │ Выбор из cable_inventory:           │
    │   │ • XLR 5м (QR: EQ-001)              │
    │   │ • PowerCon 10м (QR: EQ-002)        │
    │   │ • Комплект "Кофр свет #1" (KIT-A1) │
    │   └─────────────────────────────────────┘
    │       │
    ▼       ▼
Чек-лист
    │
    ├── GLP JDC1 (из сметы)
    ├── XLR 5м ×2 (из правила, с QR: EQ-001)
    ├── PowerCon 10м ×2 (из правила, с QR: EQ-002)
    └── Кофр свет #1 ×2 (из правила, с QR: KIT-A1)
```

## Технические изменения

### 1. Типы (src/types/index.ts)

```typescript
// Было:
ChecklistRuleItem {
  name: string;
  category: string;
  quantity: number;
  is_required: boolean;
}

// Стало:
ChecklistRuleItem {
  inventory_id: string;      // Ссылка на cable_inventory
  quantity: number;
  is_required: boolean;
  inventory_name?: string;   // Кэш для отображения
  inventory_category?: string;
  inventory_qr_code?: string;
}
```

### 2. UI создания правил (Checklists.tsx)

- Убран ручной ввод названия позиции
- Добавлен searchable dropdown с выбором из `cable_inventory`
- Отображение QR-кодов и категорий при выборе
- Управление количеством каждой позиции

### 3. Создание чек-листа (useChecklists.ts)

При применении правил:
1. Берем `inventory_id` из `ruleItem`
2. Ищем в `inventoryByIdMap` (загружен из `cable_inventory`)
3. Создаем чек-лист item с реальными данными:
   - `name` — из инвентаря
   - `qr_code` — из инвентаря
   - `kit_id` / `kit_name` — если позиция в комплекте
   - `source_rule_id` — ссылка на правило

### 4. SQL миграция

Файл: `supabase_migration_rules_inventory.sql`

```sql
-- Новые колонки в checklist_rule_items
ALTER TABLE checklist_rule_items 
ADD COLUMN inventory_id UUID REFERENCES cable_inventory(id),
ADD COLUMN inventory_name TEXT,
ADD COLUMN inventory_qr_code TEXT;
```

## Обратная совместимость

Если позиция была удалена из инвентаря:
- Используем кэшированные `inventory_name` и `inventory_qr_code`
- Показываем предупреждение в логах
- Чек-лист создается с доступными данными

## Как использовать

1. Откройте вкладку "Чек-листы"
2. Перейдите в "Правила"
3. Нажмите "Новое правило"
4. Выберите условие (оборудование или категория из сметы)
5. В разделе "Добавить оборудование из склада" выберите реальные позиции
6. Укажите количество для каждой позиции
7. Сохраните правило
8. При создании чек-листа из сметы — позиции из правил автоматически подтянутся с QR-кодами
