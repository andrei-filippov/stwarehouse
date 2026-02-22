import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Checklist, ChecklistRule, Estimate, EstimateItem, ChecklistItem, ChecklistRuleItem } from '../types';

export function useChecklists(userId: string | undefined, estimates: Estimate[]) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [rules, setRules] = useState<ChecklistRule[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRules = useCallback(async () => {
    if (!userId) return;
    
    const { data, error } = await supabase
      .from('checklist_rules')
      .select(`
        *,
        items:checklist_rule_items(*)
      `)
      .order('name');
    
    if (error) {
      toast.error('Ошибка при загрузке правил', { description: error.message });
    } else if (data) {
      setRules(data as ChecklistRule[]);
    }
  }, [userId]);

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
    
    if (error) {
      toast.error('Ошибка при загрузке чек-листов', { description: error.message });
    } else if (data) {
      setChecklists(data as Checklist[]);
    }
    setLoading(false);
  }, [userId]);

  // Загружаем правила только при изменении userId (один раз при входе)
  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Загружаем чек-листы отдельно, независимо от estimates
  useEffect(() => {
    fetchChecklists();
  }, [fetchChecklists]);

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
      toast.error('Ошибка при создании правила', { description: ruleError?.message });
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
        toast.error('Ошибка при добавлении пунктов правила', { description: itemsError.message });
        return { error: itemsError };
      }
    }

    await fetchRules();
    toast.success('Правило создано', { description: rule.name });
    return { error: null, data: ruleData };
  };

  const deleteRule = async (id: string) => {
    const { error } = await supabase
      .from('checklist_rules')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Ошибка при удалении правила', { description: error.message });
    } else {
      setRules(prev => prev.filter(r => r.id !== id));
      toast.success('Правило удалено');
    }
    return { error };
  };

  const generateChecklist = async (estimate: Estimate): Promise<ChecklistItem[]> => {
    const items: ChecklistItem[] = [];
    
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
          const existingIndex = items.findIndex(i => 
            i.name.toLowerCase() === ruleItem.name.toLowerCase()
          );

          if (existingIndex >= 0) {
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

  const createChecklist = async (estimate: Estimate, customItems?: ChecklistItem[], notes?: string) => {
    try {
      const generatedItems = await generateChecklist(estimate);
      const allItems = [...generatedItems, ...(customItems || [])];

      const checklistData: any = {
        estimate_id: estimate.id,
        user_id: userId,
        event_name: estimate.event_name || 'Без названия',
        notes: notes || null
      };
      
      if (estimate.event_date) {
        checklistData.event_date = estimate.event_date;
      }

      const { data, error } = await supabase
        .from('checklists')
        .insert([checklistData])
        .select()
        .single();

      if (error || !data) {
        toast.error('Ошибка при создании чек-листа', { description: error?.message });
        return { error };
      }

      if (allItems.length > 0) {
        const itemsWithChecklistId = allItems.map(item => ({
          checklist_id: data.id,
          name: item.name,
          quantity: item.quantity || 1,
          category: item.category || 'other',
          is_required: item.is_required !== false,
          is_checked: false,
          source_rule_id: item.source_rule_id || null,
          notes: item.notes || null
        }));

        const { error: itemsError } = await supabase.from('checklist_items').insert(itemsWithChecklistId);
        
        if (itemsError) {
          await supabase.from('checklists').delete().eq('id', data.id);
          toast.error('Ошибка при добавлении пунктов чек-листа', { description: itemsError.message });
          return { error: itemsError };
        }
      }

      await fetchChecklists();
      toast.success('Чек-лист создан', { description: checklistData.event_name });
      return { error: null, data };
    } catch (err) {
      toast.error('Ошибка при создании чек-листа');
      return { error: err };
    }
  };

  const updateChecklistItem = async (checklistId: string, itemId: string, updates: Partial<ChecklistItem>) => {
    const { error } = await supabase
      .from('checklist_items')
      .update(updates)
      .eq('id', itemId);

    if (error) {
      toast.error('Ошибка при обновлении пункта', { description: error.message });
    } else {
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

  const deleteChecklist = async (id: string) => {
    const { error } = await supabase
      .from('checklists')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Ошибка при удалении чек-листа', { description: error.message });
    } else {
      setChecklists(prev => prev.filter(c => c.id !== id));
      toast.success('Чек-лист удален');
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
