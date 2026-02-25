import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import type { EstimateItem, Equipment } from '../types';

interface EquipmentAvailability {
  equipment: Equipment;
  totalQuantity: number;
  occupiedQuantity: number;
  availableQuantity: number;
  isFullyBooked: boolean;
}

interface SortableCategoryItemProps {
  category: string;
  items: EstimateItem[];
  itemIndices: number[]; // Индексы каждой позиции в общем массиве items
  onRemove: (index: number) => void;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onUpdateCoefficient: (index: number, coefficient: number) => void;
  onUpdatePrice: (index: number, price: number) => void;
  getCategoryTotal: (items: EstimateItem[]) => number;
  getItemMaxQuantity: (item: EstimateItem) => number;
}

function SortableCategoryItem({
  category,
  items,
  itemIndices,
  onRemove,
  onUpdateQuantity,
  onUpdateCoefficient,
  onUpdatePrice,
  getCategoryTotal,
  getItemMaxQuantity,
}: SortableCategoryItemProps) {
  // Проверка консистентности данных
  if (items.length !== itemIndices.length) {
    console.error('SortableCategoryItem: items and itemIndices length mismatch', {
      category,
      itemsLength: items.length,
      indicesLength: itemIndices.length
    });
  }
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-2">
      {/* Заголовок категории с drag handle */}
      <div className="flex items-center justify-between bg-gray-100 p-2 rounded">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="p-1 hover:bg-gray-200 rounded cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-4 h-4 text-gray-500" />
          </button>
          <h3 className="font-semibold text-gray-700">{category}</h3>
        </div>
        <span className="text-sm text-gray-500">{items.length} поз.</span>
      </div>

      {/* Позиции категории */}
      <div className="space-y-1">
        {(items || []).map((item, idx) => {
          const originalIndex = itemIndices[idx];
          // Защита: если индекс не найден или -1, не рендерим или используем запасной вариант
          if (originalIndex === undefined || originalIndex === -1) {
            console.warn('SortableCategories: invalid originalIndex for item', item);
            return null;
          }
          const maxQuantity = getItemMaxQuantity(item);
          const canIncrease = item.quantity < maxQuantity;
          const itemTotal = item.price * item.quantity * (item.coefficient || 1);
          return (
            <Card key={`${item.equipment_id || item.name}-${originalIndex}`} className="overflow-hidden">
              <div className="p-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{item.price.toLocaleString('ru-RU')} ₽/{item.unit || 'шт'}</span>
                      {item.description && (
                        <span className="truncate" title={item.description}>• {item.description}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(originalIndex)}
                    className="shrink-0 h-6 w-6 p-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-2 mt-1">
                  {/* Количество */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-5 w-5 p-0 text-xs"
                      onClick={() => onUpdateQuantity(originalIndex, item.quantity - 1)}
                    >
                      −
                    </Button>
                    <input
                      type="number"
                      min="1"
                      max={maxQuantity}
                      value={item.quantity}
                      onChange={(e) => {
                        const newQty = parseInt(e.target.value) || 0;
                        onUpdateQuantity(originalIndex, newQty);
                      }}
                      onBlur={(e) => {
                        const newQty = parseInt(e.target.value) || 0;
                        const clampedQty = Math.max(1, Math.min(maxQuantity, newQty));
                        if (newQty !== clampedQty) {
                          onUpdateQuantity(originalIndex, clampedQty);
                        }
                      }}
                      className="w-10 h-5 text-center border rounded text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      title={`Макс: ${maxQuantity}`}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-5 w-5 p-0 text-xs"
                      onClick={() => onUpdateQuantity(originalIndex, item.quantity + 1)}
                      disabled={!canIncrease}
                      title={!canIncrease ? `Макс: ${maxQuantity}` : undefined}
                    >
                      +
                    </Button>
                  </div>

                  {/* Цена, Кф, Сумма */}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.price}
                      onChange={(e) => onUpdatePrice(originalIndex, parseFloat(e.target.value) || 0)}
                      className="w-14 h-5 text-center border rounded text-xs"
                      title="Цена"
                    />
                    <span className="text-xs text-gray-400">×</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.01"
                      value={item.coefficient || 1}
                      onChange={(e) => onUpdateCoefficient(originalIndex, parseFloat(e.target.value) || 1)}
                      className="w-10 h-5 text-center border rounded text-xs"
                      title="Коэфф."
                    />
                    <span className="text-xs text-gray-400">=</span>
                    <span className="font-semibold text-sm text-blue-600">
                      {itemTotal.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Подытог по категории */}
      <div className="flex justify-end items-center py-1 px-2 bg-blue-50 rounded text-xs">
        <span className="text-gray-600 mr-2">Итого:</span>
        <span className="font-semibold text-blue-700">
          {getCategoryTotal(items).toLocaleString('ru-RU')} ₽
        </span>
      </div>
    </div>
  );
}

interface SortableCategoriesProps {
  groupedItems: [string, EstimateItem[]][];
  items: EstimateItem[];
  equipmentAvailability: EquipmentAvailability[];
  onReorder: (newOrder: [string, EstimateItem[]][]) => void;
  onRemoveItem: (index: number) => void;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onUpdateCoefficient: (index: number, coefficient: number) => void;
  onUpdatePrice: (index: number, price: number) => void;
  getCategoryTotal: (items: EstimateItem[]) => number;
}

export function SortableCategories({
  groupedItems,
  items,
  equipmentAvailability,
  onReorder,
  onRemoveItem,
  onUpdateQuantity,
  onUpdateCoefficient,
  onUpdatePrice,
  getCategoryTotal,
}: SortableCategoriesProps) {
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    setCategories((groupedItems || []).map(([category]) => category));
  }, [groupedItems]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.indexOf(active.id as string);
      const newIndex = categories.indexOf(over.id as string);

      if (oldIndex === -1 || newIndex === -1) return;

      const newCategories = arrayMove(categories, oldIndex, newIndex);
      setCategories(newCategories);

      // Переупорядочиваем groupedItems
      const newGroupedItems = newCategories.map((cat) => {
        const found = groupedItems.find(([c]) => c === cat);
        if (!found) {
          console.error('Category not found in groupedItems:', cat);
          return [cat, []] as [string, EstimateItem[]];
        }
        return found;
      });
      onReorder(newGroupedItems);
    }
  };



  // Вычисляем индексы для всех позиций
  // Создаём мапу category -> array of original indices
  const categoryItemIndices = useMemo(() => {
    const indices = new Map<string, number[]>();
    
    // Проходим по всем items и группируем по категории
    // Важно: сохраняем порядок items как в оригинальном массиве
    (items || []).forEach((item, originalIndex) => {
      const category = item.category || 'Без категории';
      if (!indices.has(category)) {
        indices.set(category, []);
      }
      indices.get(category)!.push(originalIndex);
    });
    
    return indices;
  }, [items]);

  // Функция для получения максимально доступного количества
  const getItemMaxQuantity = useCallback((item: EstimateItem): number => {
    const eqAvail = (equipmentAvailability || []).find(
      ea => ea.equipment.id === item.equipment_id
    );
    if (!eqAvail) return Infinity;
    
    // Максимум = доступное на складе + уже в смете, но не больше чем есть всего на складе
    const maxAllowed = eqAvail.availableQuantity + item.quantity;
    return Math.min(maxAllowed, eqAvail.totalQuantity);
  }, [equipmentAvailability]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={categories} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {categories.map((category) => {
            const itemIndices = categoryItemIndices.get(category) || [];
            // Получаем items по индексам из оригинального массива
            const categoryItems = itemIndices.map(idx => (items || [])[idx]).filter(Boolean);

            return (
              <SortableCategoryItem
                key={category}
                category={category}
                items={categoryItems}
                itemIndices={itemIndices}
                onRemove={onRemoveItem}
                onUpdateQuantity={onUpdateQuantity}
                onUpdateCoefficient={onUpdateCoefficient}
                onUpdatePrice={onUpdatePrice}
                getCategoryTotal={getCategoryTotal}
                getItemMaxQuantity={getItemMaxQuantity}
              />
            );
          })}.
        </div>
      </SortableContext>
    </DndContext>
  );
}
