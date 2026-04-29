// Хелперы для экспорта смет с секциями
import type { EstimateItem, EstimateSection } from '../types';

export interface GroupedData {
  section?: EstimateSection;
  categories: {
    category: string;
    items: EstimateItem[];
  }[];
  total: number;
  isNoSection?: boolean; // true для позиций без секции
}

export function groupItemsBySections(
  items: EstimateItem[],
  sections: EstimateSection[],
  categoryOrder: string[]
): GroupedData[] {
  const result: GroupedData[] = [];

  // Сначала секции
  sections.forEach(section => {
    const sectionItems = items.filter(item => item.section_id === section.id);
    const grouped = groupByCategory(sectionItems, categoryOrder);
    const total = sectionItems.reduce((sum, item) => sum + (item.price * item.quantity * (item.coefficient || 1)), 0);
    result.push({ section, categories: grouped, total });
  });

  // Потом без секции (без заголовка, просто список)
  const noSectionItems = items.filter(item => !item.section_id);
  if (noSectionItems.length > 0) {
    const grouped = groupByCategory(noSectionItems, categoryOrder);
    const total = noSectionItems.reduce((sum, item) => sum + (item.price * item.quantity * (item.coefficient || 1)), 0);
    result.push({ categories: grouped, total, isNoSection: true });
  }

  return result;
}

function groupByCategory(items: EstimateItem[], categoryOrder: string[]) {
  const grouped = items.reduce((acc, item) => {
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
}
