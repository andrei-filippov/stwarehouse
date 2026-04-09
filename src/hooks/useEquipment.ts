import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Equipment, Category } from '../types';
import { isOnline, addToSyncQueue, saveEquipmentLocal, getEquipmentLocal, deleteEquipmentLocal } from '../lib/offlineDB';
import { createLogger } from '../lib/logger';

const logger = createLogger('equipment');

export function useEquipment(companyId: string | undefined) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEquipment = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);

    // Всегда загружаем локальное оборудование
    const localEquipment = await getEquipmentLocal(companyId);
    logger.debug('[fetchEquipment] Local equipment:', localEquipment.length);

    if (isOnline()) {
      // ОНЛАЙН: загружаем с сервера и мержим с локальными
      try {
        const { data, error } = await supabase
          .from('equipment')
          .select('*')
          .eq('company_id', companyId)
          .order('name')
          .limit(2000); // Защита от перегрузки

        if (error) {
          throw error;
        }
        // Мержим: серверные + локальные НОВЫЕ (с local_* ID) которых нет на сервере
        const serverIds = new Set((data || []).map(e => e.id));
        
        // Разделяем локальные записи:
        // 1. Новые созданные офлайн (local_*) - показываем если нет на сервере
        // 2. Скопированные с сервера (обычные ID) - удаляем из локальной базы если нет на сервере
        const newLocal = localEquipment.filter(e => {
          const isNewOffline = e.id?.startsWith('local_');
          const existsOnServer = serverIds.has(e.id);
          
          if (isNewOffline && !existsOnServer) {
            return true; // Новая офлайн запись - показываем
          }
          
          if (!isNewOffline && !existsOnServer) {
            // Запись была удалена на сервере - удаляем из локальной базы
            logger.debug('[fetchEquipment] Removing locally cached equipment deleted on server:', e.id);
            deleteEquipmentLocal(e.id).catch(err => logger.error('Error deleting local equipment:', err));
            return false;
          }
          
          return false; // Уже есть на сервере
        });
        
        // Убираем дубликаты: если локальная запись похожа на серверную (по имени),
        // считаем что это дубль и удаляем из локальной базы
        const serverNames = new Set(
          (data || []).map(e => e.name?.toLowerCase().trim())
        );
        const uniqueLocal = newLocal.filter(local => {
          const name = local.name?.toLowerCase().trim();
          if (serverNames.has(name)) {
            logger.debug('[fetchEquipment] Removing duplicate local equipment:', local.id);
            deleteEquipmentLocal(local.id).catch(err => logger.error('Error deleting local equipment:', err));
            return false;
          }
          return true;
        });
        
        logger.info('[fetchEquipment] Server items:', (data || []).length, 'Unique local:', uniqueLocal.length);
        
        // Финальная защита: убираем дубликаты по ID
        const merged = [...uniqueLocal, ...(data || [])];
        const seenIds = new Set<string>();
        const deduplicated = merged.filter(e => {
          if (seenIds.has(e.id)) {
            logger.debug('[fetchEquipment] Removing duplicate by ID:', e.id);
            return false;
          }
          seenIds.add(e.id);
          return true;
        });
        
        setEquipment(deduplicated);
      } catch (err) {
        // Ошибка сети - показываем только локальные
        logger.warn('Network error, showing local data:', err);
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
        logger.warn('Network error loading categories:', err);
      }
    }
  }, [companyId]);

  const addEquipment = useCallback(async (
    item: Partial<Equipment>, 
    options?: { 
      saveTo?: 'estimates' | 'inventory' | 'both'  // Куда сохранять: сметы, склад, или оба
    }
  ) => {
    if (!companyId) return { error: new Error('No company') };
    
    const saveTo = options?.saveTo || 'estimates'; // По умолчанию только в сметы

    try {
      if (isOnline()) {
        try {
          // Онлайн — сохраняем согласно выбору
          
          // 1. Всегда создаём в equipment (для смет)
          if (saveTo === 'estimates' || saveTo === 'both') {
            const { data: equipData, error: equipError } = await supabase
              .from('equipment')
              .insert({ ...item, company_id: companyId })
              .select()
              .single();

            if (equipError) throw equipError;

            // Если нужно сохранить и на склад
            if (saveTo === 'both') {
              // Находим или создаём категорию в cable_categories
              let categoryId = null;
              if (item.category) {
                const { data: catData } = await supabase
                  .from('cable_categories')
                  .select('id')
                  .eq('name', item.category)
                  .eq('company_id', companyId)
                  .single();
                categoryId = catData?.id;
                
                // Если категория не найдена - создаём
                if (!categoryId) {
                  const { data: newCat, error: catError } = await supabase
                    .from('cable_categories')
                    .insert({
                      company_id: companyId,
                      name: item.category,
                      color: '#3b82f6'
                    })
                    .select()
                    .single();
                  if (!catError && newCat) {
                    categoryId = newCat.id;
                  }
                }
              }

              // Если нет категории - используем дефолтную или не создаём
              if (!categoryId) {
                logger.warn('No category for cable_inventory, skipping');
              } else {
                // Создаём запись в cable_inventory
                const { data: invData, error: invError } = await supabase
                  .from('cable_inventory')
                  .insert({
                    company_id: companyId,
                    category_id: categoryId,
                    name: item.name,
                    length: 0,  // Обязательное поле для кабелей
                    quantity: item.quantity || 0,
                    min_quantity: 0,
                    price: item.price,
                    unit: item.unit || 'шт',
                    equipment_id: equipData.id
                  })
                  .select()
                  .single();

                if (invError) {
                  logger.error('Failed to create cable_inventory:', invError);
                  toast.error('Ошибка добавления на склад', { 
                    description: invError.message || 'Проверьте консоль для деталей'
                  });
                } else {
                  // Обновляем equipment ссылкой на inventory
                  await supabase
                    .from('equipment')
                    .update({ inventory_id: invData.id })
                    .eq('id', equipData.id);
                }
              }

            await fetchEquipment();
            
            const msg = saveTo === 'both' 
              ? 'Оборудование добавлено в сметы и на склад'
              : 'Оборудование добавлено в сметы';
            toast.success(msg);
            return { error: null, data: equipData };
          }
          
          // Только на склад (без смет)
          if (saveTo === 'inventory') {
            // Находим или создаём категорию в cable_categories
            let categoryId = null;
            if (item.category) {
              const { data: catData } = await supabase
                .from('cable_categories')
                .select('id')
                .eq('name', item.category)
                .eq('company_id', companyId)
                .single();
              categoryId = catData?.id;
              
              // Если категория не найдена - создаём
              if (!categoryId) {
                const { data: newCat, error: catError } = await supabase
                  .from('cable_categories')
                  .insert({
                    company_id: companyId,
                    name: item.category,
                    color: '#3b82f6'
                  })
                  .select()
                  .single();
                if (!catError && newCat) {
                  categoryId = newCat.id;
                }
              }
            }

            // Без категории не создаём
            if (!categoryId) {
              return { error: new Error('Категория обязательна для создания оборудования на складе') };
            }

            const { data: invData, error: invError } = await supabase
              .from('cable_inventory')
              .insert({
                company_id: companyId,
                category_id: categoryId,
                name: item.name,
                length: 0,
                quantity: item.quantity || 0,
                min_quantity: 0,
                price: item.price,
                unit: item.unit || 'шт'
              })
              .select()
              .single();

            if (invError) throw invError;
            
            toast.success('Оборудование добавлено на склад');
            return { error: null, data: invData };
          }
        } catch (err) {
          logger.warn('Network error, switching to offline mode:', err);
        }
      }  // <-- закрытие if (isOnline())
      
      // ОФФЛАЙН режим (сохраняем только в equipment)
      const localId = `local_equip_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const newItem = { 
        ...item, 
        id: localId,
        company_id: companyId,
        created_at: new Date().toISOString()
      } as Equipment;

      await saveEquipmentLocal(newItem, companyId);
      await addToSyncQueue('equipment', 'create', { ...newItem, company_id: companyId });
      
      setEquipment(prev => [...prev, newItem]);
      
      toast.info('Сохранено офлайн', { 
        description: 'Будет синхронизировано при подключении' 
      });
      return { error: null, queued: true, data: newItem };
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
          logger.warn('Network error, switching to offline mode:', err);
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
          logger.warn('Network error, switching to offline mode:', err);
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
