import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Checklist, ChecklistRule, Estimate, EstimateItem } from '../types';

export function useChecklists(userId: string | undefined, estimates: Estimate[]) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [rules, setRules] = useState<ChecklistRule[]>([]);
  const [loading, setLoading] = useState(false);

  // Загрузка правил
  const fetchRules = useCallback(async () => {
    if (!userId) return;
    
    const { data, error } = await supabase
      .from('checklist_rules')
      .select(`
        *,
        items:checklist_rule_items(*)
      `)
      .order('name');
    
    if (!error && data) {
      setRules(data as ChecklistRule[]);
    }
  }, [userId]);

  // Загрузка чек-листов
  const fetchChecklists = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('checklists')
      .select(`
        *,
        items:checklist_items(*)
      `)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setChecklists(data as Checklist[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchRules();
    fetchChecklists();
  }, [fetchRules, fetchChecklists]);

  // Создать правило
  const createRule = async (rule: Omit<ChecklistRule, 'id' | 'created_at'>, items: Omit<ChecklistRuleItem, 'id' | 'rule_id'>[]) => {
    const { data: ruleData, error: ruleError } = await supabase
      .from('checklist_rules')
      .insert([{ 
        name: rule.name,
        condition_type: rule.condition_type,
        condition_value: rule.condition_value,
        user_id: userId 
      }])
      .select()
      .single();
    
    if (ruleError || !ruleData) {
      console.error('Error creating rule:', ruleError);
      return { error: ruleError };
    }

    if (items.length > 0) {
      const itemsWithRuleId = items.map(item => ({
        rule_id: ruleData.id,
        name: item.name,
        quantity: item.quantity,
        category: item.category,
        is_required: item.is_required
      }));
      
      const { error: itemsError } = await supabase
        .from('checklist_rule_items')
        .insert(itemsWithRuleId);
      
      if (itemsError) {
        console.error('Error creating rule items:', itemsError);
        return { error: itemsError };
      }
    }

    await fetchRules();
    return { error: null, data: ruleData };
  };

  // Удалить правило
  const deleteRule = async (id: string) => {
    const { error } = await supabase
      .from('checklist_rules')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setRules(prev => prev.filter(r => r.id !== id));
    }
    return { error };
  };

  // Генерировать чек-лист на основе сметы и правил
  const generateChecklist = async (estimate: Estimate): Promise<ChecklistItem[]> => {
    const items: ChecklistItem[] = [];
    
    // 1. Добавляем оборудование из сметы (без цен)
    estimate.items?.forEach(estimateItem => {
      items.push({
        name: estimateItem.name,
        quantity: estimateItem.quantity,
        category: 'equipment',
        is_required: true,
        is_checked: false,
        source_rule_id: undefined
      });
    });
    
    // 2. Для каждого элемента сметы ищем подходящие правила и добавляем доп. оборудование
    estimate.items?.forEach(estimateItem => {
      const applicableRules = rules.filter(rule => {
        if (rule.condition_type === 'category') {
          return estimateItem.name.toLowerCase().includes(rule.condition_value.toLowerCase()) ||
                 (estimateItem.description && estimateItem.description.toLowerCase().includes(rule.condition_value.toLowerCase()));
        }
        return estimateItem.name.toLowerCase().includes(rule.condition_value.toLowerCase());
      });

      applicableRules.forEach(rule => {
        rule.items?.forEach(ruleItem => {
          // Проверяем, не добавили ли уже такой пункт
          const existingIndex = items.findIndex(i => 
            i.name.toLowerCase() === ruleItem.name.toLowerCase()
          );

          if (existingIndex >= 0) {
            // Увеличиваем количество
            items[existingIndex].quantity += ruleItem.quantity * estimateItem.quantity;
          } else {
            items.push({
              name: ruleItem.name,
              quantity: ruleItem.quantity * estimateItem.quantity,
              category: ruleItem.category,
              is_required: ruleItem.is_required,
              is_checked: false,
              source_rule_id: rule.id
            });
          }
        });
      });
    });

    return items;
  };

  // Создать чек-лист для сметы
  const createChecklist = async (estimate: Estimate, customItems?: ChecklistItem[], notes?: string) => {
    const generatedItems = await generateChecklist(estimate);
    const allItems = [...generatedItems, ...(customItems || [])];

    // Сначала создаем сам чек-лист
    const { data, error } = await supabase
      .from('checklists')
      .insert([{
        estimate_id: estimate.id,
        user_id: userId,
        event_name: estimate.event_name,
        event_date: estimate.event_date,
        notes
      }])
      .select()
      .single();

    if (error || !data) {
      console.error('Error creating checklist:', error);
      return { error };
    }

    // Создаем пункты чек-листа отдельно
    if (allItems.length > 0) {
      const itemsWithChecklistId = allItems.map(item => ({
        checklist_id: data.id,
        name: item.name,
        quantity: item.quantity,
        category: item.category || 'other',
        is_required: item.is_required !== false,
        is_checked: false,
        source_rule_id: item.source_rule_id || null,
        notes: item.notes || null
      }));

      const { error: itemsError } = await supabase.from('checklist_items').insert(itemsWithChecklistId);
      
      if (itemsError) {
        console.error('Error creating checklist items:', itemsError);
        // Удаляем чек-лист если не удалось добавить пункты
        await supabase.from('checklists').delete().eq('id', data.id);
        return { error: itemsError };
      }
    }

    await fetchChecklists();
    return { error: null, data };
  };

  // Обновить пункт чек-листа (отметить выполнено)
  const updateChecklistItem = async (checklistId: string, itemId: string, updates: Partial<ChecklistItem>) => {
    const { error } = await supabase
      .from('checklist_items')
      .update(updates)
      .eq('id', itemId);

    if (!error) {
      setChecklists(prev => prev.map(cl => {
        if (cl.id === checklistId) {
          return {
            ...cl,
            items: cl.items?.map(item => 
              item.id === itemId ? { ...item, ...updates } : item
            )
          };
        }
        return cl;
      }));
    }

    return { error };
  };

  // Удалить чек-лист
  const deleteChecklist = async (id: string) => {
    const { error } = await supabase
      .from('checklists')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setChecklists(prev => prev.filter(c => c.id !== id));
    }
    return { error };
  };

  return {
    checklists,
    rules,
    loading,
    createRule,
    deleteRule,
    createChecklist,
    updateChecklistItem,
    deleteChecklist,
    generateChecklist,
    refresh: fetchChecklists
  };
}
