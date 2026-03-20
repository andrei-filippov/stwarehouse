import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { CableCategory, CableInventory, CableMovement, EquipmentRepair } from '../types';

export function useCableInventory(companyId: string | undefined) {
  const [categories, setCategories] = useState<CableCategory[]>([]);
  const [inventory, setInventory] = useState<CableInventory[]>([]);
  const [movements, setMovements] = useState<CableMovement[]>([]);
  const [repairs, setRepairs] = useState<EquipmentRepair[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    if (!companyId) return;
    
    const { data, error } = await supabase
      .from('cable_categories')
      .select('*')
      .eq('company_id', companyId)
      .order('sort_order');
    
    if (error) {
      toast.error('Ошибка при загрузке категорий', { description: error.message });
    } else {
      setCategories(data || []);
    }
  }, [companyId]);

  const fetchInventory = useCallback(async () => {
    if (!companyId) return;
    
    const { data, error } = await supabase
      .from('cable_inventory')
      .select('*')
      .eq('company_id', companyId);
    
    if (error) {
      toast.error('Ошибка при загрузке инвентаря', { description: error.message });
    } else {
      setInventory(data || []);
    }
  }, [companyId]);

  const fetchMovements = useCallback(async () => {
    if (!companyId) return;
    
    const { data, error } = await supabase
      .from('cable_movements')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast.error('Ошибка при загрузке движений', { description: error.message });
    } else {
      setMovements(data || []);
    }
  }, [companyId]);

  const addCategory = useCallback(async (category: Partial<CableCategory>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('cable_categories')
        .insert({ ...category, company_id: companyId });

      if (error) throw error;

      await fetchCategories();
      toast.success('Категория добавлена');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при добавлении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchCategories]);

  const updateCategory = useCallback(async (id: string, updates: Partial<CableCategory>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('cable_categories')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchCategories();
      toast.success('Категория обновлена');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при обновлении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchCategories]);

  const deleteCategory = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('cable_categories')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchCategories();
      toast.success('Категория удалена');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchCategories]);

  // Функция для изменения порядка категорий
  const reorderCategories = useCallback(async (categoryIds: string[]) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      // Обновляем sort_order для каждой категории отдельным запросом
      // (не используем upsert, чтобы не передавать обязательные поля name/color)
      for (let i = 0; i < categoryIds.length; i++) {
        const { error } = await supabase
          .from('cable_categories')
          .update({ sort_order: i })
          .eq('id', categoryIds[i])
          .eq('company_id', companyId);

        if (error) throw error;
      }

      // Обновляем локальное состояние без перезагрузки с сервера
      setCategories(prev => {
        // Обновляем sort_order и сортируем по нему
        const updatedCategories = prev.map(cat => {
          const newIndex = categoryIds.indexOf(cat.id);
          if (newIndex !== -1) {
            // Это корневая категория - обновляем sort_order
            return { ...cat, sort_order: newIndex };
          }
          // Дочерняя категория - оставляем как есть
          return cat;
        });
        // Сортируем по sort_order для правильного отображения
        return updatedCategories.sort((a, b) => a.sort_order - b.sort_order);
      });

      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при изменении порядка', { description: err.message });
      return { error: err };
    }
  }, [companyId]);

  const upsertInventory = useCallback(async (item: Partial<CableInventory>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('cable_inventory')
        .upsert({ ...item, company_id: companyId });

      if (error) throw error;

      await fetchInventory();
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  }, [companyId, fetchInventory]);

  const updateInventoryQty = useCallback(async (id: string, quantity: number) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('cable_inventory')
        .update({ quantity })
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchInventory();
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  }, [companyId, fetchInventory]);

  const deleteInventory = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('cable_inventory')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchInventory();
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  }, [companyId, fetchInventory]);

  const issueCable = useCallback(async (movement: Partial<CableMovement>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('cable_movements')
        .insert({ 
          ...movement, 
          company_id: companyId,
          type: 'issue',
          issued_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      await fetchMovements();
      await fetchInventory();
      toast.success('Выдано');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при выдаче', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchMovements, fetchInventory]);

  const returnCable = useCallback(async (movementId: string, returnedQty?: number) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      // Если количество не указано - получаем полное количество из движения
      let qty = returnedQty;
      if (qty === undefined) {
        const { data: movement } = await supabase
          .from('cable_movements')
          .select('quantity')
          .eq('id', movementId)
          .eq('company_id', companyId)
          .single();
        qty = movement?.quantity || 0;
      }
      
      const { error } = await supabase
        .from('cable_movements')
        .update({ 
          is_returned: true, 
          returned_quantity: qty,
          returned_at: new Date().toISOString()
        })
        .eq('id', movementId)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchMovements();
      await fetchInventory();
      toast.success('Возвращено');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при возврате', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchMovements, fetchInventory]);

  // ===== Функции для работы с ремонтом =====
  const fetchRepairs = useCallback(async () => {
    if (!companyId) return;
    
    const { data, error } = await supabase
      .from('equipment_repairs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast.error('Ошибка при загрузке ремонтов', { description: error.message });
    } else {
      setRepairs(data || []);
    }
  }, [companyId]);

  const sendToRepair = useCallback(async (repair: Partial<EquipmentRepair>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('equipment_repairs')
        .insert({ ...repair, company_id: companyId });

      if (error) throw error;

      await fetchRepairs();
      await fetchInventory();
      toast.success('Оборудование отправлено в ремонт');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при отправке в ремонт', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchRepairs, fetchInventory]);

  const updateRepairStatus = useCallback(async (repairId: string, status: EquipmentRepair['status'], returnedDate?: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const updates: any = { status };
      if (returnedDate) updates.returned_date = returnedDate;
      
      const { error } = await supabase
        .from('equipment_repairs')
        .update(updates)
        .eq('id', repairId)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchRepairs();
      toast.success('Статус ремонта обновлён');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при обновлении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchRepairs]);

  const deleteRepair = useCallback(async (repairId: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('equipment_repairs')
        .delete()
        .eq('id', repairId)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchRepairs();
      toast.success('Запись о ремонте удалена');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchRepairs]);

  // Импорт категорий и оборудования из вкладки "Оборудование"
  const importFromEquipment = useCallback(async () => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      // Вызываем RPC функцию для импорта (нужно создать в Supabase)
      const { data, error } = await supabase.rpc('import_equipment_to_cable', {
        p_company_id: companyId
      });

      if (error) {
        // Если функции нет, показываем инструкцию
        if (error.message.includes('function') || error.message.includes('rpc')) {
          toast.error('Функция импорта не настроена', {
            description: 'Выполните SQL скрипт supabase_copy_equipment_to_cable.sql в Supabase Dashboard'
          });
          return { error: new Error('RPC function not found') };
        }
        throw error;
      }

      await fetchCategories();
      await fetchInventory();
      
      const importedCategories = data?.categories || 0;
      const importedItems = data?.items || 0;
      
      toast.success('Импорт завершён', {
        description: `Категорий: ${importedCategories}, позиций: ${importedItems}`
      });
      
      return { error: null, data };
    } catch (err: any) {
      toast.error('Ошибка при импорте', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchCategories, fetchInventory]);

  useEffect(() => {
    fetchCategories();
    fetchInventory();
    fetchMovements();
    fetchRepairs();
  }, [fetchCategories, fetchInventory, fetchMovements, fetchRepairs]);

  // Рекурсивно получаем все ID категорий включая дочерние
  const getAllCategoryIds = useCallback((catId: string, cats: CableCategory[]): string[] => {
    const ids = [catId];
    const children = cats.filter(c => c.parent_id === catId);
    children.forEach(child => {
      ids.push(...getAllCategoryIds(child.id, cats));
    });
    return ids;
  }, []);

  // Статистика по категориям для CableManager
  const stats = useMemo(() => {
    const result: Record<string, { totalLength: number; totalQty: number; issuedQty: number; repairQty: number }> = {};
    
    // Инициализируем все категории
    categories.forEach(cat => {
      result[cat.id] = { totalLength: 0, totalQty: 0, issuedQty: 0, repairQty: 0 };
    });
    
    // Для каждой категории считаем статистику включая дочерние
    categories.forEach(cat => {
      const allIds = getAllCategoryIds(cat.id, categories);
      
      // Считаем инвентарь для всех категорий
      inventory.forEach(item => {
        if (allIds.includes(item.category_id)) {
          result[cat.id].totalLength += (item.length || 0) * item.quantity;
          result[cat.id].totalQty += item.quantity;
        }
      });
      
      // Считаем выданное для всех категорий
      movements
        .filter(m => m.is_returned !== true && allIds.includes(m.category_id))
        .forEach(m => {
          result[cat.id].issuedQty += m.quantity;
        });
      
      // Считаем в ремонте для всех категорий
      repairs
        .filter(r => r.status === 'in_repair' && allIds.includes(r.category_id))
        .forEach(r => {
          result[cat.id].repairQty += r.quantity;
        });
    });
    
    return result;
  }, [inventory, movements, repairs, categories, getAllCategoryIds]);

  return {
    categories,
    inventory,
    movements,
    repairs,
    stats,
    loading,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    upsertInventory,
    updateInventoryQty,
    deleteInventory,
    issueCable,
    returnCable,
    sendToRepair,
    updateRepairStatus,
    deleteRepair,
    importFromEquipment,
    refresh: () => {
      fetchCategories();
      fetchInventory();
      fetchMovements();
      fetchRepairs();
    }
  };
}
