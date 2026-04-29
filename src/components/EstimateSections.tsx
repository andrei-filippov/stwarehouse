import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  MapPin,
  LayoutGrid,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { EstimateItem, EstimateSection } from '../types';

interface EstimateSectionsProps {
  sections: EstimateSection[];
  items: EstimateItem[];
  activeSectionId: string | null;
  onActiveSectionChange: (id: string | null) => void;
  onAddSection: (name: string) => void;
  onRemoveSection: (id: string) => void;
  onUpdateItem: (itemId: string, updates: Partial<EstimateItem>) => void;
  onRemoveItem: (itemId: string) => void;
  categoryOrder: string[];
  collapsedCategories: Set<string>;
  onToggleCategory: (category: string) => void;
  isDragging: boolean;
  draggedCategory: string | null;
  dropTarget: string | null;
  onDragStart: (category: string) => void;
  onDragOver: (e: React.DragEvent, category: string) => void;
  onDrop: (e: React.DragEvent, category: string) => void;
  onDragEnd: () => void;
  onTouchStart: (e: React.TouchEvent, category: string) => void;
  onTouchMove: (e: React.TouchEvent, category: string) => void;
  onTouchEnd: () => void;
  getUsedQuantity: (equipmentId: string) => number;
  getBookedQuantity: (equipmentId: string) => number;
  equipment: any[];
  total: number;
}

export function EstimateSections({
  sections,
  items,
  activeSectionId,
  onActiveSectionChange,
  onAddSection,
  onRemoveSection,
  onUpdateItem,
  onRemoveItem,
  categoryOrder,
  collapsedCategories,
  onToggleCategory,
  isDragging,
  draggedCategory,
  dropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  getUsedQuantity,
  getBookedQuantity,
  equipment,
  total,
}: EstimateSectionsProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAddSection(newName.trim());
    setNewName('');
    setShowAddDialog(false);
  };

  // Группировка позиций по категориям
  const groupByCategory = (sectionItems: EstimateItem[]) => {
    const grouped = sectionItems.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, EstimateItem[]>);

    const orderedCategories = categoryOrder.filter(cat => grouped[cat]);
    const remainingCategories = Object.keys(grouped).filter(cat => !categoryOrder.includes(cat));
    return [...orderedCategories, ...remainingCategories].map(category => ({
      category,
      items: grouped[category],
    }));
  };

  // Рендер позиции
  const renderItem = (item: EstimateItem, idx: number) => {
    const itemTotal = item.price * item.quantity * (item.coefficient || 1);
    return (
      <div key={item.id} className="flex items-start gap-2 p-2 bg-muted rounded">
        <span className="text-xs text-muted-foreground/70 w-5 shrink-0 mt-1">{idx + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{item.name}</p>
          <Input
            placeholder="Описание (необязательно)"
            value={item.description || ''}
            onChange={(e) => onUpdateItem(item.id!, { description: e.target.value })}
            className="h-6 mt-1 text-xs bg-card/50 border-0 focus:bg-card focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-1">
          <div className="flex items-center bg-card rounded-lg border">
            <button
              onClick={() => onUpdateItem(item.id!, { quantity: Math.max(0, item.quantity - 1) })}
              className="w-7 h-8 flex items-center justify-center text-muted-foreground hover:bg-muted rounded-l-lg transition-colors"
            >
              −
            </button>
            <input
              type="text"
              value={item.quantity}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                const num = val === '' ? 0 : parseInt(val);
                onUpdateItem(item.id!, { quantity: num });
              }}
              className="w-10 h-8 text-center bg-transparent text-sm font-medium text-foreground outline-none"
            />
            <button
              onClick={() => {
                if (item.equipment_id) {
                  const usedQty = getUsedQuantity(item.equipment_id);
                  const bookedQty = getBookedQuantity(item.equipment_id);
                  const equipmentItem = equipment.find((e: any) => e.id === item.equipment_id);
                  const totalAvailable = equipmentItem ? equipmentItem.quantity : Infinity;
                  const currentQty = item.quantity;
                  const otherUsed = usedQty - currentQty;
                  const totalBooked = otherUsed + bookedQty;
                  const available = totalAvailable - totalBooked;
                  if (available > 0) {
                    onUpdateItem(item.id!, { quantity: currentQty + 1 });
                  }
                } else {
                  onUpdateItem(item.id!, { quantity: item.quantity + 1 });
                }
              }}
              className="w-7 h-8 flex items-center justify-center text-muted-foreground hover:bg-muted rounded-r-lg transition-colors"
            >
              +
            </button>
          </div>
          <span className="text-xs text-muted-foreground w-8 text-center">{item.unit || 'шт'}</span>
          <Input
            type="text"
            value={item.price}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.]/g, '');
              onUpdateItem(item.id!, { price: parseFloat(val) || 0 });
            }}
            className="w-16 h-8 text-xs text-right bg-card/50 border-0 focus:bg-card focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-xs font-medium w-16 text-right">
            {itemTotal.toLocaleString('ru-RU')}₽
          </span>
          <button
            onClick={() => onRemoveItem(item.id!)}
            className="w-7 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // Рендер категории внутри секции
  const renderCategory = (category: string, categoryItems: EstimateItem[]) => {
    const catTotal = categoryItems.reduce((sum, item) => sum + (item.price * item.quantity * (item.coefficient || 1)), 0);
    return (
      <Card key={category} className={cn(
        "transition-all",
        isDragging && draggedCategory === category && "shadow-lg scale-[1.01] ring-2 ring-blue-400 z-10",
        isDragging && dropTarget === category && "ring-2 ring-blue-300"
      )}>
        <CardHeader
          className={cn(
            "p-2.5 cursor-move touch-manipulation transition-all",
            isDragging && draggedCategory === category ? "bg-primary/20" : "bg-muted/50",
            isDragging && dropTarget === category && "bg-primary/10"
          )}
          data-category={category}
          draggable
          onDragStart={() => onDragStart(category)}
          onDragOver={(e) => onDragOver(e, category)}
          onDrop={(e) => onDrop(e, category)}
          onDragEnd={onDragEnd}
          onTouchStart={(e) => onTouchStart(e, category)}
          onTouchMove={(e) => onTouchMove(e, category)}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground/70 shrink-0" />
              <span className="truncate">{category}</span>
              <Badge variant="secondary" className="shrink-0 text-xs">{categoryItems.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {catTotal.toLocaleString('ru-RU')}₽
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleCategory(category)}
                className="shrink-0 h-7 w-7 p-0"
              >
                {collapsedCategories.has(category) ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        {!collapsedCategories.has(category) && (
          <CardContent className="p-0">
            <div className="space-y-2 p-2">
              {categoryItems.map((item, idx) => renderItem(item, idx))}
            </div>
            <div className="px-3 py-2 bg-muted/30 border-t flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Итого по категории:</span>
              <span className="text-sm font-semibold">{catTotal.toLocaleString('ru-RU')}₽</span>
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  // Рендер секции
  const renderSection = (section: EstimateSection) => {
    const sectionItems = items.filter(item => item.section_id === section.id);
    const grouped = groupByCategory(sectionItems);
    const sectionTotal = sectionItems.reduce((sum, item) => sum + (item.price * item.quantity * (item.coefficient || 1)), 0);
    const isActive = activeSectionId === section.id;
    const isCollapsed = collapsedSections.has(section.id);

    return (
      <div
        key={section.id}
        className={cn(
          "border-2 rounded-lg transition-all",
          isActive
            ? "border-blue-400 bg-blue-50/30 dark:bg-blue-900/10"
            : "border-transparent bg-card"
        )}
      >
        {/* Заголовок секции */}
        <div
          className={cn(
            "flex items-center justify-between p-3 cursor-pointer rounded-lg transition-colors",
            isActive ? "bg-blue-100/50 dark:bg-blue-900/20" : "bg-muted/50 hover:bg-muted"
          )}
          onClick={() => onActiveSectionChange(isActive ? null : section.id)}
        >
          <div className="flex items-center gap-2">
            <MapPin className={cn("w-4 h-4", isActive ? "text-blue-500" : "text-muted-foreground")} />
            <span className={cn("font-medium", isActive && "text-blue-700 dark:text-blue-300")}>
              {section.name}
            </span>
            <Badge variant="secondary" className="text-xs">{sectionItems.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">
              {sectionTotal.toLocaleString('ru-RU')}₽
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                toggleSection(section.id);
              }}
              className="h-7 w-7 p-0"
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveSection(section.id);
              }}
              className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Содержимое секции */}
        {!isCollapsed && (
          <div className="p-2 space-y-2">
            {grouped.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Кликните на секцию, затем добавьте оборудование слева
              </p>
            ) : (
              grouped.map(({ category, items: catItems }) => renderCategory(category, catItems))
            )}
          </div>
        )}
      </div>
    );
  };

  // Позиции без секции
  const noSectionItems = items.filter(item => !item.section_id);
  const noSectionGrouped = groupByCategory(noSectionItems);
  const noSectionTotal = noSectionItems.reduce((sum, item) => sum + (item.price * item.quantity * (item.coefficient || 1)), 0);

  return (
    <div className="space-y-3">
      {/* Заголовок и кнопка добавления */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Секции</span>
        </div>
        {showAddDialog ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              placeholder="Название секции"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="h-7 text-xs w-40"
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={handleAdd}>
              <Plus className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setShowAddDialog(false); setNewName(''); }}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="w-3 h-3" />
            Секция
          </Button>
        )}
      </div>

      {/* Активная секция — подсказка */}
      {activeSectionId && (
        <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
          ✅ Активна: {sections.find(s => s.id === activeSectionId)?.name} — оборудование добавляется сюда
        </div>
      )}

      {/* Секции */}
      {sections.map(renderSection)}

      {/* Позиции без секции (обратная совместимость) — без заголовка, просто список */}
      {noSectionItems.length > 0 && (
        <div className="space-y-2">
          {noSectionGrouped.map(({ category, items: catItems }) => renderCategory(category, catItems))}
        </div>
      )}

      {/* Общий итог */}
      <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/10">
        <span className="font-semibold">ИТОГО:</span>
        <span className="text-lg font-bold">{total.toLocaleString('ru-RU')}₽</span>
      </div>
    </div>
  );
}


