# Equipment Kits Integration Guide

## Overview
Equipment Kits (Комплекты/Кофры) — система управления сборными комплектами оборудования с QR-сканированием для чек-листов мероприятий.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Equipment Kits                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐        │
│   │  UI Layer    │────▶│  Hook Layer  │────▶│  Supabase    │        │
│   │              │     │              │     │  Database    │        │
│   └──────────────┘     └──────────────┘     └──────────────┘        │
│          │                    │                    │                 │
│          ▼                    ▼                    ▼                 │
│   EquipmentKits.tsx    useChecklistsV2.ts    equipment_kits          │
│   Checklists.tsx                              kit_items              │
│                                               cable_inventory        │
│                                               checklists             │
│                                               checklist_items        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Kit Management (Управление комплектами)

```
cable_inventory ──┐
                  ├──▶ EquipmentKits.tsx ──▶ useChecklistsV2 ──▶ equipment_kits
CableCategory ────┤                              │
                                                 ▼
                                           kit_items
```

**Sources:**
| Component | Data Source | Tables | Description |
|-----------|-------------|--------|-------------|
| `EquipmentKits` | `inventory` prop | `cable_inventory` | List of available equipment |
| `EquipmentKits` | `categories` prop | `cable_categories` | Categories for grouping |
| `EquipmentKits` | `kits` prop | `equipment_kits` + `kit_items` | Existing kits |

**Actions:**
| Action | Hook Method | Tables Affected |
|--------|-------------|-----------------|
| Create Kit | `createKit(kit, itemIds)` | `equipment_kits`, `kit_items` |
| Update Kit | `updateKit(id, kit, itemIds)` | `equipment_kits`, `kit_items` |
| Delete Kit | `deleteKit(id)` | `equipment_kits`, `kit_items` |

### 2. Checklist Integration (Использование в чек-листах)

```
estimate ──▶ create_checklist_from_estimate_v2() ──▶ checklist
                                                        │
                                                        ▼
cable_inventory ──▶ inventory match by name ──▶ checklist_items
     │                                              (kit_id assigned)
     ▼
kit_items ──▶ kit association
```

**QR Scanning Flow (Unified):**
```
QR Scan (Any)
      │
      ├──▶ KIT-* prefix? ──▶ equipment_kits.qr_code MATCH
      │                         │
      │                         ▼
      │                    kit_items ──▶ cable_inventory.name
      │                         │
      │                         ▼
      │              checklist_items (match by kit_id OR name)
      │                         │
      │                         ▼
      │              Update all matched items:
      │                - scanMode='load' → loaded=true
      │                - scanMode='unload' → loaded=true, unloaded=true
      │                - simple mode → is_checked=true
      │
      └──▶ EQ-* or other ──▶ checklist_items.qr_code MATCH
                              │
                              ▼
                    Update single item (same logic as above)
```

**Key Feature:** Автоматическое распознавание типа QR-кода — комплект (KIT-*) или оборудование (EQ-*). Режим сканирования (погрузка/разгрузка) применяется ко всем найденным позициям.

### 3. Kit Issue Integration (Выдача комплектов)

Комплекты можно сканировать во вкладке **Учет оборудования** → **Выдача**:

```
QR Scan in CableManager
      │
      ├──▶ KIT-* prefix? ──▶ Find in kits[]
      │                         │
      │                         ▼
      │                    kit_items[] ──▶ inventory[]
      │                         │
      │                         ▼
      │              Add all to selectedItems
      │              (batch issue mode)
      │
      └──▶ EQ-* prefix? ──▶ Find in inventory[]
                              │
                              ▼
                     Add single to selectedItems
```

**UX Flow:**
1. Нажать кнопку **QR** (в режиме выдачи)
2. Отсканировать QR код комплекта (начинается с `KIT-`)
3. Все позиции из комплекта автоматически добавляются в выдачу
4. Сканер остается открытым для следующего сканирования

**Code Implementation:**
```typescript
// CableManager.tsx
const handleQRScan = (qrCode: string) => {
  // 1. Проверяем - это комплект?
  const kit = kits.find(k => k.qr_code === qrCode);
  if (kit) {
    handleKitScanForIssue(kit); // Добавляем все позиции
    return;
  }
  
  // 2. Обычное оборудование
  const item = inventory.find(i => i.qr_code === qrCode);
  // ... добавляем одну позицию
};
```

## Database Schema

### equipment_kits
```sql
CREATE TABLE equipment_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,           -- "Кофр звук #1"
  description TEXT,             -- Описание
  qr_code TEXT UNIQUE,          -- "KIT-A1B2C3"
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### kit_items
```sql
CREATE TABLE kit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID REFERENCES equipment_kits(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES cable_inventory(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### checklist_items (kit fields)
```sql
-- Дополнительные поля для интеграции с комплектами
ALTER TABLE checklist_items ADD COLUMN kit_id UUID;
ALTER TABLE checklist_items ADD COLUMN kit_name TEXT;
ALTER TABLE checklist_items ADD COLUMN loaded BOOLEAN DEFAULT FALSE;
ALTER TABLE checklist_items ADD COLUMN unloaded BOOLEAN DEFAULT FALSE;
```

## TypeScript Types

### EquipmentKit
```typescript
type EquipmentKit = {
  id: string;
  company_id?: string;
  name: string;              // "Кофр звук #1"
  qr_code?: string;          // "KIT-A1B2C3"
  description?: string;
  items?: KitItem[];         // Содержимое комплекта
  created_at?: string;
  updated_at?: string;
};
```

### KitItem
```typescript
type KitItem = {
  id?: string;
  kit_id?: string;
  inventory_id: string;      // Ссылка на cable_inventory
  inventory_name?: string;   // Join-поле
  quantity: number;          // Количество в комплекте
  created_at?: string;
};
```

### ChecklistItemV2 (with kit support)
```typescript
type ChecklistItemV2 = {
  id?: string;
  name: string;
  quantity: number;
  
  // Комплект/кофр
  kit_id?: string;           // Связь с equipment_kits
  kit_name?: string;         // Join с equipment_kits
  
  // Двойная проверка
  loaded: boolean;
  unloaded: boolean;
  is_checked: boolean;       // Legacy/simple mode
  
  // QR сканирование
  qr_code?: string;
  inventory_id?: string;
  
  // ... other fields
};
```

## Key Features

### 1. Quantity Management
- Комплекты поддерживают множественное количество одного inventory_id
- UI: +/- кнопки для изменения quantity
- Storage: Map<string, number> → массив с дубликатами → агрегация quantity

### 2. QR Code Generation
- Автогенерация: `KIT-${random(6)}`
- Download: PNG QR код для печати
- Scan: Идентификация комплекта по QR

### 3. Dual-Mode Checklists
**Simple Mode:**
- Single checkbox `is_checked`
- Kit scan marks: `is_checked: true`

**Double Mode:**
- Load checkbox (blue) + Unload checkbox (green)
- Kit scan marks: `loaded: true, unloaded: true`
- Visual: strikethrough when unloaded

### 4. Name Matching Algorithm
При создании чек-листа из сметы:
```typescript
// Нормализация имен для сопоставления
normalizeName("GLP JDC1 (copy MeanReal)") → "glp jdc1"
normalizeName("GLP JDC1 копия") → "glp jdc1"

// Матчинг с inventory → присвоение kit_id
```

## File Structure

```
src/
├── components/
│   └── EquipmentKits.tsx          # Управление комплектами
├── hooks/
│   └── useChecklistsV2.ts         # CRUD для kits
├── types/
│   └── checklist.ts               # TypeScript types
└── lib/
    └── utils.ts                   # normalizeName()

supabase/
├── supabase_checklists_integration.sql    # Основная схема
├── supabase_add_qr_codes.sql             # QR коды
└── supabase_enable_checklists_realtime.sql # Realtime
```

## Usage Examples

### Creating a Kit
```typescript
// В EquipmentKits.tsx
const handleSave = async () => {
  const itemIdsWithQuantity: string[] = [];
  selectedItems.forEach((quantity, inventoryId) => {
    for (let i = 0; i < quantity; i++) {
      itemIdsWithQuantity.push(inventoryId);
    }
  });
  
  await onCreateKit(
    { name: "Кофр свет #1", description: "Основной кофр" },
    itemIdsWithQuantity
  );
};
```

### Unified QR Scanning in Checklist
```typescript
// В Checklists.tsx - единый обработчик для всех QR кодов
const handleQRScan = async (qrCode: string) => {
  const searchCode = qrCode.toUpperCase();
  
  // 1. Проверяем - это комплект?
  const { data: kitData } = await supabase
    .from('equipment_kits')
    .select('id, name')
    .eq('qr_code', searchCode)
    .single();
  
  if (kitData) {
    // Обрабатываем как комплект
    await handleKitScan(kitData);
    return;
  }
  
  // 2. Ищем как оборудование
  const item = checklist.items?.find(i => 
    i.qr_code?.toUpperCase() === searchCode
  );
  
  if (item) {
    await handleEquipmentScan(item);
  }
};

// Обработка комплекта
const handleKitScan = async (kitData: { id: string; name: string }) => {
  // Загружаем содержимое комплекта
  const { data: kitItems } = await supabase
    .from('kit_items')
    .select('inventory_id, cable_inventory(name)')
    .eq('kit_id', kitData.id);
  
  // Отмечаем все позиции с учетом scanMode
  for (const item of checklist.items) {
    if (matchesKit(item, kitItems)) {
      const updates = scanMode === 'unload' 
        ? { loaded: true, unloaded: true }  // Разгрузка
        : { loaded: true };                  // Погрузка
      
      await updateChecklistItem(checklist.id, item.id, updates);
    }
  }
};
```

### Issuing Kit via QR Scan
```typescript
// В CableManager.tsx - режим выдачи
const handleKitScanForIssue = (kit: EquipmentKit) => {
  kit.items?.forEach(kitItem => {
    const inventoryItem = inventory.find(i => i.id === kitItem.inventory_id);
    if (!inventoryItem) return;
    
    // Добавляем в выдачу с учетом quantity
    setSelectedItems(prev => [...prev, {
      inventory_id: inventoryItem.id!,
      category_id: inventoryItem.category_id,
      name: inventoryItem.name,
      quantity: kitItem.quantity,
      available: inventoryItem.quantity,
      // ...
    }]);
  });
  
  toast.success(`Комплект «${kit.name}» добавлен`, {
    description: `Добавлено ${kit.items?.length} позиций`
  });
};
```

## Real-time Sync

```typescript
// В useChecklistsV2.ts
supabase.channel('equipment_kits_changes')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'equipment_kits' }, 
    fetchKits
  )
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'kit_items' }, 
    fetchKits
  )
  .subscribe()
```

## Security (RLS)

```sql
-- Policies для equipment_kits
CREATE POLICY "Users can view kits in their company"
  ON equipment_kits FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

-- Policies для kit_items
CREATE POLICY "Users can view kit items in their company"
  ON kit_items FOR SELECT
  USING (kit_id IN (
    SELECT id FROM equipment_kits WHERE company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  ));
```

## Migration Notes

При первом деплое необходимо выполнить:
1. `supabase_checklists_integration.sql` — основная схема
2. `supabase_add_qr_codes.sql` — QR коды для inventory
3. `supabase_enable_checklists_realtime.sql` — realtime подписки
