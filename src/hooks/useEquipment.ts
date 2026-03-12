import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Equipment, Category } from '../types';
import { isOnline, addToSyncQueue, saveEquipmentLocal, getEquipmentLocal, clearEquipmentLocal } from '../lib/offlineDB';

export function useEquipment(companyId: string | undefined) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEquipment = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    
    // Если онлайн — загружаем с сервера и кэшируем
    if (isOnline()) {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('company_id', companyId)
        .order('name');
      
      if (error) {
        toast.error('Ошибка при загрузке оборудования', { description: error.message });
        // Пробуем загрузить из кэша при ошибке
        const cached = await getEquipmentLocal(companyId);
        if (cached.length > 0) {
          setEquipment(cached);
          toast.info('Загружены данные из кэша');
        }
      } else {
        setEquipment(data || []);
        // Обновляем кэш
        await clearEquipmentLocal(companyId);
        for (const item of (data || [])) {
          await saveEquipmentLocal(item, companyId);
        }
      }
    } else {
      // Оффлайн — загружаем из кэша
      const cached = await getEquipmentLocal(companyId);
      setEquipment(cached);
    }
    
    setLoading(false);
  }, [companyId]);

  const fetchCategories = useCallback(async () => {
    if (!companyId) return;
    
    // Сначала пробуем загрузить категории текущей компании
    let { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    
    // Если категорий нет, загружаем общие категории (без company_id)
    if (!error && (!data || data.length === 0)) {
      const { data: commonData, error: commonError } = await supabase
        .from('categories')
        .select('*')
        .is('company_id', null)
        .order('name');
      
      if (!commonError && commonData && commonData.length > 0) {
        data = commonData;
      }
    }
    
    // Если всё ещё нет категорий, получаем уникальные из оборудования
    if (!error && (!data || data.length === 0)) {
      const { data: equipmentCategories, error: eqError } = await supabase
        .from('equipment')
        .select('category')
        .eq('company_id', companyId)
        .not('category', 'is', null);
      
      if (!eqError && equipmentCategories) {
        // Получаем уникальные категории
        const uniqueCategories = [...new Set(equipmentCategories.map(e => e.category))]
          .filter(Boolean)
          .sort()
          .map(name => ({ id: name, name }));
        data = uniqueCategories;
      }
    }
    
    if (error) {
      toast.error('Ошибка при загрузке категорий', { description: error.message });
    } else {
      setCategories(data || []);
    }
  }, [companyId]);

  const addEquipment = useCallback(async (item: Partial<Equipment>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    const newItem: Equipment = {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...item as Equipment,
      company_id: companyId,
      created_at: new Date().toISOString(),
    };
    
    // Если онлайн — сохраняем на сервер
    if (isOnline()) {
      try {
        const { error } = await supabase
          .from('equipment')
          .insert({ ...item, company_id: companyId });

        if (error) throw error;

        await fetchEquipment();
        toast.success('Оборудование добавлено');
        return { error: null, data: newItem };
      } catch (err: any) {
        toast.error('Ошибка при добавлении', { description: err.message });
        return { error: err };
      }
    } else {
      // Оффлайн — сохраняем локально и в очередь
      await saveEquipmentLocal(newItem, companyId);
      await addToSyncQueue('equipment', 'create', { ...newItem, company_id: companyId });
      
      // Обновляем UI
      setEquipment(prev => [...prev, newItem]);
      
      toast.success('Оборудование сохранено (офлайн)', {
        description: 'Будет синхронизировано при подключении'
      });
      return { error: null, data: newItem, queued: true };
    }
  }, [companyId, fetchEquipment]);

  const updateEquipment = useCallback(async (id: string, updates: Partial<Equipment>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('equipment')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchEquipment();
      toast.success('Оборудование обновлено');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при обновлении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchEquipment]);

  const deleteEquipment = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchEquipment();
      toast.success('Оборудование удалено');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchEquipment]);

  const bulkInsert = useCallback(async (items: Partial<Equipment>[]) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const itemsWithCompany = items.map(item => {
        // Удаляем id, чтобы PostgreSQL сгенерировал новый UUID
        const { id, ...itemWithoutId } = item;
        return { ...itemWithoutId, company_id: companyId };
      });
      const { error } = await supabase
        .from('equipment')
        .insert(itemsWithCompany);

      if (error) throw error;

      await fetchEquipment();
      toast.success(`Добавлено ${items.length} позиций`);
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при импорте', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchEquipment]);

  const addCategory = useCallback(async (name: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('categories')
        .insert({ name, company_id: companyId });

      if (error) throw error;

      await fetchCategories();
      toast.success('Категория добавлена');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при добавлении категории', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchCategories]);

  const deleteCategory = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchCategories();
      toast.success('Категория удалена');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении категории', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchCategories]);

  useEffect(() => {
    fetchEquipment();
    fetchCategories();
  }, [fetchEquipment, fetchCategories]);

  // Real-time подписки
  useEffect(() => {
    if (!companyId) return;

    const equipmentChannel = supabase
      .channel('equipment-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'equipment', filter: `company_id=eq.${companyId}` },
        () => fetchEquipment()
      )
      .subscribe();

    const categoriesChannel = supabase
      .channel('categories-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'categories', filter: `company_id=eq.${companyId}` },
        () => fetchCategories()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(equipmentChannel);
      supabase.removeChannel(categoriesChannel);
    };
  }, [fetchEquipment, fetchCategories, companyId]);

  return {
    equipment,
    categories,
    loading,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    bulkInsert,
    addCategory,
    deleteCategory,
    refresh: fetchEquipment
  };
}
