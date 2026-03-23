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
import { createLogger } from '../lib/logger';

const logger = createLogger('checklists');

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
        
        // Отладка: проверяем что QR-коды загружаются
        data?.forEach((c: any) => {
          const itemsWithQr = c.items?.filter((i: any) => i.qr_code) || [];
          const itemsWithKit = c.items?.filter((i: any) => i.kit_id) || [];
          logger.info(`[fetchChecklists] Checklist ${c.event_name}: ${itemsWithQr.length}/${c.items?.length} items with QR, ${itemsWithKit.length} with kit_id`);
          // Debug: log items with loaded_quantity
          const itemsWithQty = c.items?.filter((i: any) => i.loaded_quantity > 0) || [];
          if (itemsWithQty.length > 0) {
            logger.info(`[fetchChecklists] Items with loaded_quantity:`, itemsWithQty.map((i: any) => ({ name: i.name, qty: i.loaded_quantity })));
          }
        });
        
        // Мержим: серверные + локальные которых нет на сервере
        const serverIds = new Set((data || []).map(c => c.id));
        const unsyncedLocal = localChecklists.filter(c => !serverIds.has(c.id));
        
        const merged = [...unsyncedLocal, ...(data || [])];
        logger.info(`[fetchChecklists] Setting checklists: ${merged.length} total (${data?.length || 0} server + ${unsyncedLocal.length} local)`);
        setChecklists(merged);
      } catch (err) {
        // Ошибка сети - показываем только локальные
        logger.warn('Network error, showing local data:', err);
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
      logger.debug('[fetchRules] Fetching rules for companyId:', companyId);
      
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
      
      logger.info('[fetchRules] Loaded rules:', rulesData?.length);
      
      // Затем загружаем items для каждого правила отдельно
      const rulesWithItems = await Promise.all((rulesData || []).map(async (rule) => {
        const { data: itemsData, error: itemsError } = await supabase
          .from('checklist_rule_items')
          .select('*')
          .eq('rule_id', rule.id);
        
        if (itemsError) {
          console.error('[fetchRules] Error loading items for rule', rule.id, ':', itemsError);
        }
        
        logger.debug('[fetchRules] Rule', rule.id, 'items:', itemsData?.length);
        return { ...rule, items: itemsData || [] };
      }));
      
      logger.info('[fetchRules] Rules with items:', rulesWithItems.length);
      logger.debug('[fetchRules] First rule items check:', rulesWithItems[0]?.name, 'has', rulesWithItems[0]?.items?.length, 'items');
      logger.debug('[fetchRules] All rules items:', rulesWithItems.map(r => `${r.name}: ${r.items?.length || 0}`).join(', '));
      setRules(rulesWithItems);
      
      // Кэшируем правила для офлайн-режима
      if (companyId) {
        await saveChecklistRulesCache(rulesWithItems, companyId);
      }
    } else {
      // ОФФЛАЙН: загружаем из кэша
      const cached = await getChecklistRulesCache(companyId);
      if (cached) {
        logger.info('[fetchRules] Loaded rules from cache:', cached.length);
        setRules(cached);
      }
    }
  }, [companyId]);

  const createRule = useCallback(async (rule: Partial<ChecklistRule>, items?: ChecklistRuleItem[]) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    if (!isOnline()) {
      toast.error('Создание правил недоступно офлайн');
      return { error: new Error('Offline') };
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Создаём правило
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

      // 2. Создаём items отдельно (из параметра items или из rule.items для обратной совместимости)
      const ruleItems = items || rule.items || [];
      logger.debug('[createRule] Rule items input:', ruleItems);
      logger.info('[createRule] Creating rule items:', ruleItems?.length, 'for rule:', ruleData?.id);
      
      if (ruleItems.length > 0 && ruleData) {
        // Новая структура: сохраняем ссылки на inventory + метаданные для отображения
        const itemsToInsert = ruleItems.map((item, idx) => ({
          rule_id: ruleData.id,
          inventory_id: item.inventory_id,
          quantity: item.quantity || 1,
          is_required: item.is_required ?? true,
          // Сохраняем метаданные для отображения (на случай если инвентарь изменится)
          inventory_name: item.inventory_name || `Item ${idx}`,
          inventory_category: item.inventory_category,
          inventory_qr_code: item.inventory_qr_code
        }));
        logger.debug('[createRule] Items to insert:', JSON.stringify(itemsToInsert));

        const { data: itemsData, error: itemsError } = await supabase
          .from('checklist_rule_items')
          .insert(itemsToInsert)
          .select();

        if (itemsError) {
          console.error('[createRule] Error creating rule items:', itemsError);
          toast.error('Ошибка при сохранении позиций правила', { description: itemsError.message });
        } else {
        logger.info('[createRule] Created items:', itemsData?.length);
        }
      } else {
        logger.debug('[createRule] No items to create - items empty or undefined');
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
      logger.info('[createChecklist] Starting, rules in state:', rules.length, 'companyId:', companyId);
      
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
          
          logger.info('[createChecklist] Loaded rules from server:', rulesToUse.length);
        } else {
          // Офлайн: пробуем загрузить из кэша
          const cached = await getChecklistRulesCache(companyId);
          if (cached) {
            rulesToUse = cached;
          }
        }
      } else {
        logger.info('[createChecklist] Using cached rules:', rulesToUse.length);
        logger.debug('[createChecklist] Rules with items:', rulesToUse.map(r => `${r.name}: ${r.items?.length || 0} items`).join(', '));
      }
      
      // Генерируем чек-лист
      const items: any[] = [...customItems];
      logger.debug('[createChecklist] Estimate items:', estimate.items?.length);
      logger.info('[createChecklist] Rules to apply:', rulesToUse.length);
      
      // Загружаем QR-коды из cable_inventory для сопоставления
      // Создаем Map: имя оборудования -> массив QR-кодов (для случая когда несколько единиц)
      let inventoryMap: Map<string, { qr_code?: string; kit_id?: string; kit_name?: string }[]> = new Map();
      // Map для поиска по ID (для правил с inventory_id)
      let inventoryByIdMap: Map<string, { name?: string; qr_code?: string; kit_id?: string; kit_name?: string; category_id?: string }> = new Map();
      
      if (isOnline()) {
        try {
          // Загружаем инвентарь с информацией о китах
          const { data: inventory, error: invError } = await supabase
            .from('cable_inventory')
            .select(`
              id,
              name, 
              qr_code,
              category_id,
              kit_items:kit_items(kit_id, equipment_kits(id, name))
            `)
            .eq('company_id', companyId);
          
          if (invError) {
            logger.warn('[createChecklist] Error loading inventory:', invError);
          } else {
            // Отладка: показываем сырые данные
            logger.debug('[createChecklist] Raw inventory data:', inventory?.map(i => ({ 
              name: i.name, 
              qr: i.qr_code, 
              kit_items: (i as any).kit_items 
            })));
            
            // Группируем данные по имени оборудования и по ID
            inventory?.forEach(i => {
              const key = i.name?.toLowerCase().trim();
              
              // Получаем kit_id и kit_name из связи (если есть)
              const kitData = (i as any).kit_items?.[0];
              
              // Заполняем Map по ID (для правил с inventory_id)
              inventoryByIdMap.set(i.id, {
                name: i.name,
                qr_code: i.qr_code,
                category_id: i.category_id,
                kit_id: kitData?.kit_id,
                kit_name: kitData?.equipment_kits?.name
              });
              
              // Заполняем Map по имени (для сопоставления с сметой)
              if (key) {
                logger.debug(`[createChecklist] Item ${i.name}: kitData=`, kitData);
                
                if (!inventoryMap.has(key)) {
                  inventoryMap.set(key, []);
                }
                inventoryMap.get(key)!.push({
                  qr_code: i.qr_code,
                  kit_id: kitData?.kit_id,
                  kit_name: kitData?.equipment_kits?.name
                });
              }
            });
            
            logger.info('[createChecklist] Loaded inventory items:', inventory?.length);
            logger.debug('[createChecklist] Inventory map with kits:', Array.from(inventoryMap.entries()).map(([k, v]) => `${k}: ${JSON.stringify(v)}`));
          }
        } catch (e) {
          logger.warn('[createChecklist] Failed to load inventory QR codes:', e);
        }
      }
      
      // Функция нормализации имени - убирает скобки, "copy" и лишние пробелы
      const normalizeName = (name: string): string => {
        return name
          .toLowerCase()
          .trim()
          // Убираем текст в круглых скобках (включая скобки)
          .replace(/\s*\([^)]*\)\s*/g, ' ')
          // Убираем текст в квадратных скобках
          .replace(/\s*\[[^\]]*\]\s*/g, ' ')
          // Убираем слова copy, копия и их вариации
          .replace(/\b(copy|копия|copy of)\b/gi, ' ')
          // Убираем лишние пробелы
          .replace(/\s+/g, ' ')
          .trim();
      };
      
      // Создаем нормализованную Map для поиска (с полной информацией)
      const normalizedInventoryMap: Map<string, { qr_code?: string; kit_id?: string; kit_name?: string }[]> = new Map();
      for (const [invName, data] of inventoryMap.entries()) {
        const normalized = normalizeName(invName);
        if (!normalizedInventoryMap.has(normalized)) {
          normalizedInventoryMap.set(normalized, []);
        }
        normalizedInventoryMap.get(normalized)!.push(...data);
      }
      
      logger.debug('[createChecklist] Normalized inventory names:', Array.from(normalizedInventoryMap.keys()));
      
      // Функция для поиска данных оборудования по имени
      // Возвращает массив для случая когда несколько единиц с таким именем
      const findInventoryData = (itemName: string): { qr_code?: string; kit_id?: string; kit_name?: string }[] => {
        const normalizedItemName = normalizeName(itemName);
        
        // Точное совпадение по нормализованному имени
        const data = normalizedInventoryMap.get(normalizedItemName);
        if (data && data.length > 0) {
          logger.debug(`[createChecklist] Exact match: "${itemName}" -> "${normalizedItemName}", found ${data.length} items`);
          return data;
        }
        
        logger.debug(`[createChecklist] No match for: "${itemName}" (normalized: "${normalizedItemName}")`);
        return [];
      };
      
      // Добавляем оборудование из сметы
      estimate.items?.forEach((item, index) => {
        const invDataList = findInventoryData(item.name);
        
        // Если в инвентаре есть записи с kit_id - используем их
        // Иначе берем первую запись без kit_id
        const invDataWithKit = invDataList.find(d => d.kit_id);
        const invData = invDataWithKit || invDataList[0];
        
        logger.debug(`[createChecklist] Item "${item.name}": normalized="${normalizeName(item.name)}", QR=${invData?.qr_code || 'none'}, Kit=${invData?.kit_name || 'none'}`);
        
        items.push({
          id: `local_item_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          name: item.name,
          quantity: item.quantity,
          category: item.category || 'equipment',
          is_required: true,
          is_checked: false,
          qr_code: invData?.qr_code || null,
          kit_id: invData?.kit_id || null,
          kit_name: invData?.kit_name || null
        });
        
        // Правила (только если они загружены)
        if (rulesToUse.length > 0) {
          const matchingRules = rulesToUse.filter(rule => {
            const match = rule.condition_type === 'category' 
              ? item.category === rule.condition_value
              : item.name.toLowerCase().includes(rule.condition_value.toLowerCase());
            logger.debug('[createChecklist] Checking rule:', rule.condition_type, rule.condition_value, 'against item:', item.name, item.category, 'match:', match);
            return match;
          });
          
          logger.debug('[createChecklist] Matching rules for', item.name, ':', matchingRules.length);
          
          matchingRules.forEach(rule => {
            // Берем items из правила и подтягиваем реальные данные из инвентаря
            logger.debug('[createChecklist] Rule:', rule.name, 'has items:', rule.items?.length);
            if (rule.items && rule.items.length > 0) {
              rule.items.forEach(ruleItem => {
                // Получаем реальные данные из инвентаря по inventory_id
                const invData = ruleItem.inventory_id ? inventoryByIdMap.get(ruleItem.inventory_id) : null;
                
                if (invData) {
                  // Есть данные в инвентаре - используем их (с QR-кодом, kit_id и т.д.)
                  items.push({
                    id: `local_item_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                    name: invData.name || ruleItem.inventory_name || 'Позиция',
                    quantity: ruleItem.quantity * item.quantity,
                    category: invData.category_id || 'equipment',
                    is_required: ruleItem.is_required,
                    is_checked: false,
                    qr_code: invData.qr_code || null,
                    kit_id: invData.kit_id || null,
                    kit_name: invData.kit_name || null,
                    source_rule_id: rule.id
                  });
                  logger.debug(`[createChecklist] Added item from inventory: ${invData.name}, QR: ${invData.qr_code}`);
                } else {
                  // Нет в инвентаре (удалена позиция) - используем сохраненные метаданные
                  items.push({
                    id: `local_item_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                    name: ruleItem.inventory_name || 'Позиция (не найдена в инвентаре)',
                    quantity: ruleItem.quantity * item.quantity,
                    category: 'equipment',
                    is_required: ruleItem.is_required,
                    is_checked: false,
                    qr_code: ruleItem.inventory_qr_code || null,
                    source_rule_id: rule.id
                  });
                  logger.warn(`[createChecklist] Inventory item ${ruleItem.inventory_id} not found, using cached name: ${ruleItem.inventory_name}`);
                }
              });
            }
          });
        }
      });
      
      logger.info('[createChecklist] Total items generated:', items.length);
      
      // Проверяем применились ли правила
      const equipmentCount = estimate.items?.length || 0;
      const totalItemsCount = items.length;
      const rulesItemsCount = totalItemsCount - equipmentCount - customItems.length;
      
      if (rulesToUse.length > 0 && rulesItemsCount === 0) {
        logger.warn('[createChecklist] Rules exist but none matched!');
        logger.debug('[createChecklist] Rules:', rulesToUse.map(r => `${r.condition_type}:${r.condition_value}`).join(', '));
        logger.debug('[createChecklist] Equipment in estimate:', estimate.items?.map(i => `${i.name}(${i.category})`).join(', '));
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
              is_checked: item.is_checked ?? false,
              qr_code: item.qr_code || null,
              kit_id: item.kit_id || null,
              kit_name: item.kit_name || null
            }));

            // Отладка: показываем что отправляем
            const itemsWithQr = itemsWithChecklistId.filter(i => i.qr_code);
            const itemsWithKit = itemsWithChecklistId.filter(i => i.kit_id);
            logger.info(`[createChecklist] Inserting ${itemsWithChecklistId.length} items, ${itemsWithQr.length} with QR codes, ${itemsWithKit.length} with kits`);
            logger.debug('[createChecklist] Items with QR:', itemsWithQr.map(i => ({ name: i.name, qr: i.qr_code })));
            logger.debug('[createChecklist] Items with kits:', itemsWithKit.map(i => ({ name: i.name, kit: i.kit_name })));

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
        logger.warn('Network error, switching to offline mode:', err);
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
        logger.warn('Network error, switching to offline mode:', err);
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

  // Real-time подписки для синхронизации между пользователями
  useEffect(() => {
    if (!companyId) return;

    // Подписка на изменения чек-листов
    const checklistsChannel = supabase
      .channel('checklists-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'checklists',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          logger.info('[Realtime] Checklist changed:', payload.eventType, payload.new?.id || payload.old?.id);
          fetchChecklists();
        }
      )
      .subscribe();

    // Подписка на изменения items чек-листов (статусы loaded/unloaded/is_checked)
    let lastUpdate = Date.now();
    const itemsChannel = supabase
      .channel('checklist-items-changes')
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'checklist_items'
        },
        (payload) => {
          const now = Date.now();
          // Показываем уведомление не чаще раз в 3 секунды
          if (now - lastUpdate > 3000) {
            lastUpdate = now;
            const newData = payload.new as any;
            if (newData?.loaded || newData?.unloaded || newData?.is_checked) {
              toast.info('Чек-лист обновлён', { 
                description: 'Другой пользователь отметил оборудование' 
              });
            }
          }
          logger.info('[Realtime] Checklist item changed:', payload.eventType, payload.new?.id || payload.old?.id);
          // При изменении item обновляем чек-листы
          fetchChecklists();
        }
      )
      .subscribe();

    // Подписка на изменения правил
    const rulesChannel = supabase
      .channel('checklist-rules-changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'checklist_rules',
          filter: `company_id=eq.${companyId}`
        },
        () => {
          logger.info('[Realtime] Rules changed, refreshing...');
          fetchRules();
        }
      )
      .subscribe();

    // Подписка на изменения items правил (когда добавляют/удаляют позиции из правила)
    const ruleItemsChannel = supabase
      .channel('checklist-rule-items-changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'checklist_rule_items'
        },
        (payload) => {
          logger.info('[Realtime] Rule item changed:', payload.eventType);
          // При изменении items правил перезагружаем правила
          fetchRules();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(checklistsChannel);
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(rulesChannel);
      supabase.removeChannel(ruleItemsChannel);
    };
  }, [companyId, fetchChecklists, fetchRules]);

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
