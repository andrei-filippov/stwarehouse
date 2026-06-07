import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { CableCategory, CableInventory, CableMovement, EquipmentRepair } from '../../types';
import type { Locale } from 'date-fns';

export function safeFormatDate(date: string | Date | null | undefined, fmt: string, options?: { locale?: Locale }): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  try {
    return format(d, fmt, options);
  } catch {
    return '—';
  }
}

export function getCategoryStatsWithChildren(
  cat: CableCategory & { children?: CableCategory[] },
  inventory: CableInventory[],
  movements: CableMovement[],
  repairs: EquipmentRepair[]
) {
  const allIds = getAllCategoryIds(cat);
  const catInventory = inventory.filter(i => allIds.includes(i.category_id));

  const totalLength = catInventory.reduce((sum, i) => sum + ((i.length || 0) * i.quantity), 0);
  const totalQty = catInventory.reduce((sum, i) => sum + i.quantity, 0);
  const hasCables = catInventory.some(i => i.length && i.length > 0);
  const hasEquipment = catInventory.some(i => !i.length);

  const issuedQty = movements
    .filter(m => !m.is_returned && allIds.includes(m.category_id))
    .reduce((sum, m) => sum + m.quantity, 0);

  const repairQty = repairs
    .filter(r => r.status === 'in_repair' && allIds.includes(r.category_id))
    .reduce((sum, r) => sum + r.quantity, 0);

  return { totalLength, totalQty, issuedQty, repairQty, hasCables, hasEquipment };
}

export function getAllCategoryIds(cat: CableCategory & { children?: CableCategory[] }): string[] {
  const ids = [cat.id];
  if (cat.children) {
    cat.children.forEach(child => {
      ids.push(...getAllCategoryIds(child));
    });
  }
  return ids;
}
