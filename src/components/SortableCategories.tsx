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
      <div className="space-y-2">
        {items.map((item, idx) => {
          const originalIndex = itemIndices[idx];
          const maxQuantity = getItemMaxQuantity(item);
          const canIncrease = item.quantity < maxQuantity;
          return (
            <Card key={`${item.equipment_id || item.name}-${originalIndex}`} className="overflow-hidden">
              <div className="p-2.5 md:p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm md:text-base">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-gray-500 truncate" title={item.description}>
                        {item.description}
                      </p>
                    )}
                    <p className="text-xs md:text-sm text-gray-600 mt-0.5">
                      {item.price.toLocaleString('ru-RU')} ₽/{item.unit || 'шт'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(originalIndex)}
                    className="shrink-0 h-8 w-8 p-0 -mr-1 -mt-1"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>

                <div className="flex items-center gap-2 md:gap-4 mt-2 md:mt-3">
                  {/* Количество */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 md:h-7 md:w-7 p-0 text-xs md:text-sm"
                      onClick={() => onUpdateQuantity(originalIndex, item.quantity - 1)}
                    >
                      -
                    </Button>
                    <span className="w-10 text-center font-medium text-xs md:text-sm">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 md:h-7 md:w-7 p-0 text-xs md:text-sm"
                      onClick={() => onUpdateQuantity(originalIndex, item.quantity + 1)}
                      disabled={!canIncrease}
                      title={!canIncrease ? `Максимально доступно: ${maxQuantity}` : undefined}
                    >
                      +
                    </Button>
                  </div>

                  {/* Цена */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">Цена:</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.price}
                      onChange={(e) => onUpdatePrice(originalIndex, parseFloat(e.target.value) || 0)}
                      className="w-16 md:w-20 h-6 md:h-7 text-center border rounded text-xs md:text-sm"
                    />
                    <span className="text-xs text-gray-400">₽</span>
                  </div>

                  {/* Коэффициент */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">Кф:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.01"
                      value={item.coefficient || 1}
                      onChange={(e) => onUpdateCoefficient(originalIndex, parseFloat(e.target.value) || 1)}
                      className="w-12 md:w-14 h-6 md:h-7 text-center border rounded text-xs md:text-sm"
                    />
                  </div>

                  {/* Сумма */}
                  <div className="ml-auto text-right">
                    <span className="font-semibold text-xs md:text-sm">
                      {(item.price * item.quantity * (item.coefficient || 1)).toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Подытог по категории */}
      <div className="flex justify-end items-center py-2 px-2 md:px-3 bg-blue-50 rounded">
        <span className="text-xs md:text-sm text-gray-600 mr-2">Итого по категории:</span>
        <span className="font-semibold text-blue-700 text-sm md:text-base">
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
    setCategories(groupedItems.map(([category]) => category));
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

      const newCategories = arrayMove(categories, oldIndex, newIndex);
      setCategories(newCategories);

      // Переупорядочиваем groupedItems
      const newGroupedItems = newCategories.map(
        (cat) => groupedItems.find(([c]) => c === cat)!
      );
      onReorder(newGroupedItems);
    }
  };

  // Создаём мапу для быстрого доступа
  const groupedMap = new Map(groupedItems);

  // Вычисляем индексы для всех позиций на основе текущего порядка категорий
  const categoryItemIndices = useMemo(() => {
    const indices = new Map<string, number[]>();
    let currentIndex = 0;
    
    // Используем categories (актуальный порядок), а не groupedItems
    for (const category of categories) {
      const catItems = groupedMap.get(category) || [];
      const catIndices: number[] = [];
      
      for (let i = 0; i < catItems.length; i++) {
        // Находим реальный индекс в массиве items
        const item = catItems[i];
        const realIndex = items.findIndex((it, idx) => 
          idx >= currentIndex && 
          it.equipment_id === item.equipment_id && 
          it.name === item.name
        );
        catIndices.push(realIndex !== -1 ? realIndex : currentIndex + i);
      }
      
      indices.set(category, catIndices);
      currentIndex += catItems.length;
    }
    
    return indices;
  }, [categories, groupedMap, items]);

  // Функция для получения максимально доступного количества
  const getItemMaxQuantity = useCallback((item: EstimateItem): number => {
    const eqAvail = equipmentAvailability.find(
      ea => ea.equipment.id === item.equipment_id
    );
    if (!eqAvail) return Infinity;
    
    // Максимум = доступное на складе + уже добавленное в смету
    const alreadyInEstimate = item.quantity;
    return eqAvail.availableQuantity + alreadyInEstimate;
  }, [equipmentAvailability]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={categories} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {categories.map((category) => {
            const categoryItems = groupedMap.get(category) || [];
            const itemIndices = categoryItemIndices.get(category) || [];

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
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
