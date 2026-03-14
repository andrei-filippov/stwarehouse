import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Equipment, Category } from '../types';
import { isOnline, addToSyncQueue, saveEquipmentLocal, getEquipmentLocal, deleteEquipmentLocal } from '../lib/offlineDB';

export function useEquipment(companyId: string | undefined) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEquipment = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);

    // Всегда загружаем локальное оборудование
    const localEquipment = await getEquipmentLocal(companyId);
    console.log('[fetchEquipment] Local equipment:', localEquipment.length);

    if (isOnline()) {
      // ОНЛАЙН: загружаем с сервера и мержим с локальными
      try {
        const { data, error } = await supabase
          .from('equipment')
          .select('*')
          .eq('company_id', companyId)
          .order('name');

        if (error) {
          throw error;
        }
        // Мержим: серверные + локальные которых нет на сервере
        const serverIds = new Set((data || []).map(e => e.id));
        const unsyncedLocal = localEquipment.filter(e => !serverIds.has(e.id));
        
        // Убираем дубликаты: если локальная запись похожа на серверную (по имени),
        // считаем что это дубль и пропускаем локальную версию
        const serverNames = new Set(
          (data || []).map(e => e.name?.toLowerCase().trim())
        );
        const uniqueLocal = unsyncedLocal.filter(local => {
          const name = local.name?.toLowerCase().trim();
          if (serverNames.has(name)) {
            console.log('[fetchEquipment] Filtering out duplicate local equipment:', local.id);
            return false;
          }
          return true;
        });
        
        console.log('[fetchEquipment] Server items:', (data || []).length, 'Unique local:', uniqueLocal.length);
        
        // Финальная защита: убираем дубликаты по ID
        const merged = [...uniqueLocal, ...(data || [])];
        const seenIds = new Set<string>();
        const deduplicated = merged.filter(e => {
          if (seenIds.has(e.id)) {
            console.log('[fetchEquipment] Removing duplicate by ID:', e.id);
            return false;
          }
          seenIds.add(e.id);
          return true;
        });
        
        setEquipment(deduplicated);
        
        // СОХРАНЯЕМ серверные данные в локальную базу для офлайн-доступа
        for (const item of (data || [])) {
          try {
            await saveEquipmentLocal(item, companyId);
          } catch (saveErr) {
            console.warn('[fetchEquipment] Failed to cache equipment:', item.id, saveErr);
          }
        }
      } catch (err) {
        // Ошибка сети - показываем только локальные
        console.log('Network error, showing local data:', err);
        setEquipment(localEquipment);
      }
    } else {
      // ОФФЛАЙН: показываем только локальное оборудование
      setEquipment(localEquipment);
    }

    setLoading(false);
  }, [companyId]);

  const fetchCategories = useCallback(async () => {
    if (!companyId) return;

    if (isOnline()) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at');

        if (error) throw error;
        setCategories(data || []);
      } catch (err) {
        // Ошибка сети - игнорируем, показываем что есть
        console.log('Network error loading categories:', err);
      }
    }
  }, [companyId]);

  const addEquipment = useCallback(async (item: Partial<Equipment>) => {
    if (!companyId) return { error: new Error('No company') };

    try {
      if (isOnline()) {
        try {
          // Онлайн — сохраняем на сервер
          const { error } = await supabase
            .from('equipment')
            .insert({ ...item, company_id: companyId });

          if (error) throw error;

          await fetchEquipment();
          toast.success('Оборудование добавлено');
          return { error: null };
        } catch (err) {
          // При ошибке сети (503) переходим в оффлайн-режим
          console.log('Network error, switching to offline mode:', err);
        }
      }
      
      // ОФФЛАЙН режим (или fallback при ошибке)
        // ОФФЛАЙН — сохраняем только локально
        const localId = `local_equip_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const newItem = { 
          ...item, 
          id: localId,
          company_id: companyId,
          created_at: new Date().toISOString()
        } as Equipment;

        await saveEquipmentLocal(newItem, companyId);
        await addToSyncQueue('equipment', 'create', { ...newItem, company_id: companyId });
        
        // Обновляем UI только локальными данными
        setEquipment(prev => [...prev, newItem]);
        
        toast.info('Сохранено офлайн', { 
          description: 'Будет синхронизировано при подключении' 
        });
        return { error: null, queued: true };
    } catch (err: any) {
      toast.error('Ошибка при добавлении оборудования', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchEquipment]);

  const updateEquipment = useCallback(async (id: string, updates: Partial<Equipment>) => {
    if (!companyId) return { error: new Error('No company') };

    const isLocalId = id.startsWith('local_');

    try {
      if (isOnline() && !isLocalId) {
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
        } catch (err) {
          console.log('Network error, switching to offline mode:', err);
        }
      }
      
      // Оффлайн или fallback
        // Оффлайн или локальное
        const updatedItem = { 
          ...equipment.find(e => e.id === id),
          ...updates,
          id,
          company_id: companyId
        };
        
        await saveEquipmentLocal(updatedItem, companyId);
        await addToSyncQueue('equipment', isLocalId ? 'create' : 'update', updatedItem);
        
        // Обновляем UI
        setEquipment(prev => prev.map(e => e.id === id ? updatedItem as Equipment : e));
        
        toast.info('Обновлено офлайн');
        return { error: null, queued: true };
    } catch (err: any) {
      toast.error('Ошибка при обновлении', { description: err.message });
      return { error: err };
    }
  }, [companyId, equipment, fetchEquipment]);

  const deleteEquipment = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company') };

    const isLocalId = id.startsWith('local_');

    try {
      if (isOnline() && !isLocalId) {
        try {
          const { error } = await supabase
            .from('equipment')
            .delete()
            .eq('id', id)
            .eq('company_id', companyId);

          if (error) throw error;
          
          // Успешно удалено на сервере
          setEquipment(prev => prev.filter(e => e.id !== id));
          toast.success('Оборудование удалено');
          return { error: null };
        } catch (err) {
          console.log('Network error, switching to offline mode:', err);
        }
      }
      
      // Оффлайн или fallback - удаляем локально
      await deleteEquipmentLocal(id);
      
      if (!isLocalId) {
        await addToSyncQueue('equipment', 'delete', { id });
      }
      
      // Обновляем UI
      setEquipment(prev => prev.filter(e => e.id !== id));
      
      toast.success('Оборудование удалено');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении', { description: err.message });
      return { error: err };
    }
  }, [companyId]);

  const addCategory = useCallback(async (name: string) => {
    if (!companyId) return { error: new Error('No company') };
    
    if (!isOnline()) {
      toast.error('Создание категорий недоступно офлайн');
      return { error: new Error('Offline') };
    }

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

  const updateCategory = useCallback(async (id: string, name: string) => {
    if (!companyId) return { error: new Error('No company') };
    
    if (!isOnline()) {
      toast.error('Обновление категорий недоступно офлайн');
      return { error: new Error('Offline') };
    }

    try {
      const { error } = await supabase
        .from('categories')
        .update({ name })
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchCategories();
      toast.success('Категория обновлена');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при обновлении категории', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchCategories]);

  const deleteCategory = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company') };
    
    if (!isOnline()) {
      toast.error('Удаление категорий недоступно офлайн');
      return { error: new Error('Offline') };
    }

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

  const reorderCategories = useCallback(async (_newOrder: string[]) => {
    if (!companyId) return { error: new Error('No company') };
    
    // Функция отключена - нет поля order_index в БД
    toast.info('Изменение порядка категорий временно недоступно');
    return { error: null };
  }, [companyId]);

  // Отслеживание сети
  useEffect(() => {
    const handleOnline = () => {
      toast.success('Подключение восстановлено');
      fetchEquipment();
      fetchCategories();
    };
    
    const handleOffline = () => {
      toast.warning('Нет подключения');
      fetchEquipment();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchEquipment, fetchCategories]);

  useEffect(() => {
    fetchEquipment();
    fetchCategories();
  }, [fetchEquipment, fetchCategories]);

  const bulkInsert = useCallback(async (items: Partial<Equipment>[]) => {
    if (!companyId) return { error: new Error('No company'), count: 0 };
    
    if (!isOnline()) {
      toast.error('Массовое добавление недоступно офлайн');
      return { error: new Error('Offline'), count: 0 };
    }

    try {
      const itemsWithCompany = items.map(item => ({
        ...item,
        company_id: companyId
      }));

      const { error } = await supabase
        .from('equipment')
        .insert(itemsWithCompany);

      if (error) throw error;

      await fetchEquipment();
      toast.success(`Добавлено ${items.length} позиций`);
      return { error: null, count: items.length };
    } catch (err: any) {
      toast.error('Ошибка при массовом добавлении', { description: err.message });
      return { error: err, count: 0 };
    }
  }, [companyId, fetchEquipment]);

  return {
    equipment,
    categories,
    loading,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    bulkInsert,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    refresh: fetchEquipment
  };
}
