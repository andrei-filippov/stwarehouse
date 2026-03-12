import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Checklist, ChecklistRule, Estimate, ChecklistItem } from '../types';
import {
  isOnline,
  saveChecklistLocal,
  getChecklistsLocal,
  deleteChecklistLocal,
  addToSyncQueue
} from '../lib/offlineDB';

export function useChecklists(companyId: string | undefined, estimates: Estimate[]) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [rules, setRules] = useState<ChecklistRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!isOnline());

  const fetchChecklists = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    
    if (isOnline()) {
      // ОНЛАЙН: загружаем только с сервера
      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      
      if (error) {
        toast.error('Ошибка при загрузке чек-листов', { description: error.message });
        setChecklists([]);
      } else {
        setChecklists(data || []);
      }
    } else {
      // ОФФЛАЙН: показываем только локальные чек-листы
      const localChecklists = await getChecklistsLocal(companyId);
      setChecklists(localChecklists);
    }
    
    setLoading(false);
  }, [companyId]);

  const fetchRules = useCallback(async () => {
    if (!companyId) return;
    
    if (isOnline()) {
      const { data, error } = await supabase
        .from('checklist_rules')
        .select(`
          *,
          items:checklist_rule_items(*)
        `)
        .eq('company_id', companyId);
      
      if (error) {
        toast.error('Ошибка при загрузке правил', { description: error.message });
      } else {
        setRules(data || []);
      }
    }
    // Правила не кэшируем оффлайн
  }, [companyId]);

  const createRule = useCallback(async (rule: Partial<ChecklistRule>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    if (!isOnline()) {
      toast.error('Создание правил недоступно офлайн');
      return { error: new Error('Offline') };
    }
    
    try {
      const { error } = await supabase
        .from('checklist_rules')
        .insert({ ...rule, company_id: companyId });

      if (error) throw error;

      await fetchRules();
      toast.success('Правило создано');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при создании правила', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchRules]);

  const deleteRule = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    if (!isOnline()) {
      toast.error('Удаление правил недоступно офлайн');
      return { error: new Error('Offline') };
    }
    
    try {
      const { error } = await supabase
        .from('checklist_rules')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchRules();
      toast.success('Правило удалено');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchRules]);

  const createChecklist = useCallback(async (
    estimate: Estimate, 
    customItems: ChecklistItem[] = [], 
    notes?: string
  ) => {
    if (!companyId) return { error: new Error('No company selected') };
    if (!estimate) return { error: new Error('Смета не найдена') };

    try {
      // Генерируем локальный ID
      const localId = `local_checklist_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Генерируем чек-лист
      const items: any[] = [...customItems];
      
      // Добавляем оборудование из сметы
      estimate.items?.forEach(item => {
        items.push({
          id: `local_item_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          name: item.name,
          quantity: item.quantity,
          category: item.category || 'equipment',
          is_required: true,
          is_checked: false
        });
        
        // Правила (только если они загружены)
        if (rules.length > 0) {
          const matchingRules = rules.filter(rule => 
            rule.condition_type === 'category' 
              ? item.category === rule.condition_value
              : item.name.includes(rule.condition_value)
          );
          
          matchingRules.forEach(rule => {
            rule.items?.forEach(ruleItem => {
              items.push({
                id: `local_item_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                name: ruleItem.name,
                quantity: ruleItem.quantity * item.quantity,
                category: ruleItem.category,
                is_required: ruleItem.is_required,
                is_checked: false
              });
            });
          });
        }
      });

      const checklistData = {
        id: localId,
        estimate_id: estimate.id,
        company_id: companyId,
        event_name: estimate.event_name,
        event_date: estimate.event_date || null,
        items: items,
        notes: notes || null,
        category_order: estimate.category_order || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_complete: false
      };
      
      if (isOnline()) {
        // Онлайн - сохраняем на сервер
        const { data, error } = await supabase
          .from('checklists')
          .insert({
            estimate_id: estimate.id,
            company_id: companyId,
            event_name: estimate.event_name,
            event_date: estimate.event_date || null,
            items: items,
            notes: notes || null,
            category_order: estimate.category_order || null
          })
          .select();

        if (error) throw error;

        await fetchChecklists();
        toast.success('Чек-лист создан');
        return { error: null, data: data?.[0] };
      } else {
        // ОФФЛАЙН - сохраняем только локально
        await saveChecklistLocal(checklistData, companyId);
        await addToSyncQueue('checklists', 'create', checklistData);
        
        // Обновляем UI только локальными данными
        setChecklists(prev => [checklistData as Checklist, ...prev]);
        
        toast.info('Чек-лист сохранён офлайн', {
          description: 'Будет синхронизирован при подключении'
        });
        return { error: null, data: checklistData, queued: true };
      }
    } catch (err: any) {
      toast.error('Ошибка при создании чек-листа', { description: err.message });
      return { error: err };
    }
  }, [companyId, estimates, rules, fetchChecklists]);

  const updateChecklistItem = useCallback(async (checklistId: string, itemId: string, updates: any) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    const isLocalId = checklistId.startsWith('local_');
    
    if (isOnline() && !isLocalId) {
      try {
        const { error } = await supabase
          .from('checklist_items')
          .update(updates)
          .eq('id', itemId)
          .eq('checklist_id', checklistId);

        if (error) throw error;

        await fetchChecklists();
        return { error: null };
      } catch (err: any) {
        return { error: err };
      }
    } else {
      // Оффлайн - обновляем локально
      const localChecklists = await getChecklistsLocal(companyId);
      const checklist = localChecklists.find(c => c.id === checklistId);
      
      if (checklist && checklist.items) {
        const updatedItems = checklist.items.map((item: any) =>
          item.id === itemId ? { ...item, ...updates } : item
        );
        
        const updatedChecklist = {
          ...checklist,
          items: updatedItems,
          updated_at: new Date().toISOString()
        };
        
        await saveChecklistLocal(updatedChecklist, companyId);
        await addToSyncQueue('checklists', isLocalId ? 'create' : 'update', updatedChecklist);
        
        // Обновляем UI
        setChecklists(prev => prev.map(c => c.id === checklistId ? updatedChecklist as Checklist : c));
      }
      
      return { error: null, queued: true };
    }
  }, [companyId, fetchChecklists]);

  const deleteChecklist = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const isLocalId = id.startsWith('local_');
      
      if (isOnline() && !isLocalId) {
        const { error } = await supabase
          .from('checklists')
          .delete()
          .eq('id', id)
          .eq('company_id', companyId);

        if (error) throw error;
      } else {
        // Оффлайн или локальный чек-лист
        await deleteChecklistLocal(id);
        
        if (!isLocalId) {
          await addToSyncQueue('checklists', 'delete', { id });
        }
      }
      
      // Обновляем UI
      setChecklists(prev => prev.filter(c => c.id !== id));
      
      toast.success('Чек-лист удалён');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении', { description: err.message });
      return { error: err };
    }
  }, [companyId]);

  // Отслеживание статуса сети
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Подключение восстановлено');
      // Переключаемся на серверные данные
      fetchChecklists();
      fetchRules();
    };
    
    const handleOffline = () => {
      setIsOffline(true);
      toast.warning('Нет подключения');
      // Переключаемся на локальные данные
      fetchChecklists();
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchChecklists, fetchRules]);

  useEffect(() => {
    fetchChecklists();
    fetchRules();
  }, [fetchChecklists, fetchRules]);

  return {
    checklists,
    rules,
    loading,
    isOffline,
    createRule,
    deleteRule,
    createChecklist,
    updateChecklistItem,
    deleteChecklist,
    refresh: fetchChecklists
  };
}
