import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Checklist, ChecklistRule, Estimate, ChecklistItem } from '../types';
import {
  isOnline,
  saveChecklistLocal,
  getChecklistsLocal,
  deleteChecklistLocal,
  addToSyncQueue,
  saveChecklistRulesCache,
  getChecklistRulesCache
} from '../lib/offlineDB';

export function useChecklists(companyId: string | undefined, estimates: Estimate[]) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [rules, setRules] = useState<ChecklistRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!isOnline());

  const fetchChecklists = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    
    // Всегда загружаем локальные чек-листы
    const localChecklists = await getChecklistsLocal(companyId);
    
    if (isOnline()) {
      // ОНЛАЙН: загружаем с сервера и мержим с локальными
      try {
        const { data, error } = await supabase
          .from('checklists')
          .select(`
            *,
            items:checklist_items(*)
          `)
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });
        
        if (error) {
          throw error;
        }
        // Мержим: серверные + локальные которых нет на сервере
        const serverIds = new Set((data || []).map(c => c.id));
        const unsyncedLocal = localChecklists.filter(c => !serverIds.has(c.id));
        
        setChecklists([...unsyncedLocal, ...(data || [])]);
      } catch (err) {
        // Ошибка сети - показываем только локальные
        console.log('Network error, showing local data:', err);
        setChecklists(localChecklists);
      }
    } else {
      // ОФФЛАЙН: показываем только локальные чек-листы
      setChecklists(localChecklists);
    }
    
    setLoading(false);
  }, [companyId]);

  const fetchRules = useCallback(async () => {
    if (!companyId) return;
    
    if (isOnline()) {
      console.log('[fetchRules] Fetching rules for companyId:', companyId);
      
      // Сначала загружаем правила
      const { data: rulesData, error: rulesError } = await supabase
        .from('checklist_rules')
        .select('*')
        .eq('company_id', companyId);
      
      if (rulesError) {
        console.error('[fetchRules] Error loading rules:', rulesError);
        toast.error('Ошибка при загрузке правил', { description: rulesError.message });
        return;
      }
      
      console.log('[fetchRules] Loaded rules:', rulesData?.length);
      
      // Затем загружаем items для каждого правила отдельно
      const rulesWithItems = await Promise.all((rulesData || []).map(async (rule) => {
        const { data: itemsData, error: itemsError } = await supabase
          .from('checklist_rule_items')
          .select('*')
          .eq('rule_id', rule.id);
        
        if (itemsError) {
          console.error('[fetchRules] Error loading items for rule', rule.id, ':', itemsError);
        }
        
        console.log('[fetchRules] Rule', rule.id, 'items:', itemsData?.length);
        return { ...rule, items: itemsData || [] };
      }));
      
      console.log('[fetchRules] Rules with items:', rulesWithItems.length);
      console.log('[fetchRules] First rule items check:', rulesWithItems[0]?.name, 'has', rulesWithItems[0]?.items?.length, 'items');
      console.log('[fetchRules] All rules items:', rulesWithItems.map(r => `${r.name}: ${r.items?.length || 0}`).join(', '));
      setRules(rulesWithItems);
      
      // Кэшируем правила для офлайн-режима
      if (companyId) {
        await saveChecklistRulesCache(rulesWithItems, companyId);
      }
    } else {
      // ОФФЛАЙН: загружаем из кэша
      const cached = await getChecklistRulesCache(companyId);
      if (cached) {
        console.log('[fetchRules] Loaded rules from cache:', cached.length);
        setRules(cached);
      }
    }
  }, [companyId]);

  const createRule = useCallback(async (rule: Partial<ChecklistRule>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    if (!isOnline()) {
      toast.error('Создание правил недоступно офлайн');
      return { error: new Error('Offline') };
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Создаём правило (без items)
      const { data: ruleData, error: ruleError } = await supabase
        .from('checklist_rules')
        .insert({ 
          name: rule.name,
          condition_type: rule.condition_type,
          condition_value: rule.condition_value,
          company_id: companyId,
          user_id: user.id
        })
        .select()
        .single();

      if (ruleError) throw ruleError;

      // 2. Создаём items отдельно
      console.log('[createRule] Rule items input:', rule.items);
      console.log('[createRule] Creating rule items:', rule.items?.length, 'for rule:', ruleData?.id);
      if (rule.items && rule.items.length > 0 && ruleData) {
        const itemsToInsert = rule.items.map((item, idx) => ({
          rule_id: ruleData.id,
          name: item.name || `Item ${idx}`,
          quantity: item.quantity || 1,
          category: item.category || 'other',
          is_required: item.is_required ?? true
        }));
        console.log('[createRule] Items to insert:', JSON.stringify(itemsToInsert));

        const { data: itemsData, error: itemsError } = await supabase
          .from('checklist_rule_items')
          .insert(itemsToInsert)
          .select();

        if (itemsError) {
          console.error('[createRule] Error creating rule items:', itemsError);
          toast.error('Ошибка при сохранении позиций правила', { description: itemsError.message });
        } else {
          console.log('[createRule] Created items:', itemsData?.length, JSON.stringify(itemsData));
        }
      } else {
        console.log('[createRule] No items to create - items empty or undefined');
      }

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
      console.log('[createChecklist] Starting, rules in state:', rules.length, 'companyId:', companyId);
      
      // Генерируем локальный ID
      const localId = `local_checklist_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Если правила не загружены, загружаем их
      let rulesToUse = rules;
      if (rulesToUse.length === 0) {
        if (isOnline()) {
          // Онлайн: загружаем с сервера
          const { data: rulesData } = await supabase
            .from('checklist_rules')
            .select('*')
            .eq('company_id', companyId);
          
          // Загружаем items для каждого правила
          rulesToUse = await Promise.all((rulesData || []).map(async (rule) => {
            const { data: itemsData } = await supabase
              .from('checklist_rule_items')
              .select('*')
              .eq('rule_id', rule.id);
            return { ...rule, items: itemsData || [] };
          }));
          
          console.log('[createChecklist] Loaded rules from server:', rulesToUse.length);
        } else {
          // Офлайн: пробуем загрузить из кэша
          const cached = await getChecklistRulesCache(companyId);
          if (cached) {
            rulesToUse = cached;
          }
        }
      } else {
        console.log('[createChecklist] Using cached rules:', rulesToUse.length);
        console.log('[createChecklist] Rules with items:', rulesToUse.map(r => `${r.name}: ${r.items?.length || 0} items`).join(', '));
      }
      
      // Генерируем чек-лист
      const items: any[] = [...customItems];
      console.log('[createChecklist] Estimate items:', estimate.items?.length);
      console.log('[createChecklist] Rules to apply:', rulesToUse.length);
      
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
        if (rulesToUse.length > 0) {
          const matchingRules = rulesToUse.filter(rule => {
            const match = rule.condition_type === 'category' 
              ? item.category === rule.condition_value
              : item.name.toLowerCase().includes(rule.condition_value.toLowerCase());
            console.log('[createChecklist] Checking rule:', rule.condition_type, rule.condition_value, 'against item:', item.name, item.category, 'match:', match);
            return match;
          });
          
          console.log('[createChecklist] Matching rules for', item.name, ':', matchingRules.length);
          
          matchingRules.forEach(rule => {
            // Берем items напрямую из правила
            console.log('[createChecklist] Rule:', rule.name, 'has items:', rule.items?.length);
            if (rule.items && rule.items.length > 0) {
              rule.items.forEach(ruleItem => {
                items.push({
                  id: `local_item_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                  name: ruleItem.name,
                  quantity: ruleItem.quantity * item.quantity,
                  category: ruleItem.category,
                  is_required: ruleItem.is_required,
                  is_checked: false
                });
              });
            }
          });
        }
      });
      
      console.log('[createChecklist] Total items generated:', items.length);
      
      // Проверяем применились ли правила
      const equipmentCount = estimate.items?.length || 0;
      const totalItemsCount = items.length;
      const rulesItemsCount = totalItemsCount - equipmentCount - customItems.length;
      
      if (rulesToUse.length > 0 && rulesItemsCount === 0) {
        console.warn('[createChecklist] Rules exist but none matched! Rules:', rulesToUse.map(r => `${r.condition_type}:${r.condition_value}`).join(', '));
        console.warn('[createChecklist] Equipment in estimate:', estimate.items?.map(i => `${i.name}(${i.category})`).join(', '));
        toast.info('Правила не применились', {
          description: 'Созданы правила для другого оборудования. Проверьте названия в правилах или используйте тип "Категория"'
        });
      }
      
      // Получаем текущего пользователя (для офлайн-режима нужно сохранить user_id)
      const { data: { user } } = await supabase.auth.getUser();
      
      const checklistData = {
        id: localId,
        estimate_id: estimate.id,
        company_id: companyId,
        user_id: user?.id,
        event_name: estimate.event_name,
        event_date: estimate.event_date || null,
        items: items,
        notes: notes || null,
        category_order: estimate.category_order || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      if (isOnline()) {
        try {
          // Получаем текущего пользователя
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Not authenticated');
          
          // 1. Создаём чек-лист
          const { data: checklistData, error: checklistError } = await supabase
            .from('checklists')
            .insert({
              estimate_id: estimate.id,
              company_id: companyId,
              user_id: user.id,
              event_name: estimate.event_name,
              event_date: estimate.event_date || null,
              notes: notes || null,
              category_order: estimate.category_order || null
            })
            .select()
            .single();

          if (checklistError) throw checklistError;

          // 2. Создаём items отдельно
          if (items.length > 0 && checklistData) {
            const itemsWithChecklistId = items.map(item => ({
              checklist_id: checklistData.id,
              name: item.name,
              quantity: item.quantity,
              category: item.category,
              is_required: item.is_required ?? true,
              is_checked: item.is_checked ?? false
            }));

            const { error: itemsError } = await supabase
              .from('checklist_items')
              .insert(itemsWithChecklistId);

            if (itemsError) {
              console.error('Error creating checklist items:', itemsError);
            }
          }

          await fetchChecklists();
          toast.success('Чек-лист создан');
          return { error: null, data: checklistData };
        } catch (err) {
          console.log('Network error, switching to offline mode:', err);
        }
      }
      
      // ОФФЛАЙН режим (или fallback)
      await saveChecklistLocal(checklistData, companyId);
      await addToSyncQueue('checklists', 'create', checklistData);
      
      // Обновляем UI только локальными данными
      setChecklists(prev => [checklistData as Checklist, ...prev]);
      
      toast.info('Чек-лист сохранён офлайн', {
        description: 'Будет синхронизирован при подключении'
      });
      return { error: null, data: checklistData, queued: true };
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
        try {
          const { error } = await supabase
            .from('checklists')
            .delete()
            .eq('id', id)
            .eq('company_id', companyId);

          if (error) throw error;
          
          // Успешно удалено на сервере
          setChecklists(prev => prev.filter(c => c.id !== id));
          toast.success('Чек-лист удалён');
          return { error: null };
        } catch (err) {
          console.log('Network error, switching to offline mode:', err);
        }
      }
      
      // Оффлайн или fallback
      await deleteChecklistLocal(id);
      
      if (!isLocalId) {
        await addToSyncQueue('checklists', 'delete', { id });
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
