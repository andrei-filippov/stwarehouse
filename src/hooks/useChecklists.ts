import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Checklist, ChecklistRule, Estimate } from '../types';

export function useChecklists(companyId: string | undefined, estimates: Estimate[]) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [rules, setRules] = useState<ChecklistRule[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchChecklists = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('checklists')
      .select(`
        *,
        items:checklist_items(*)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast.error('Ошибка при загрузке чек-листов', { description: error.message });
    } else {
      setChecklists(data || []);
    }
    setLoading(false);
  }, [companyId]);

  const fetchRules = useCallback(async () => {
    if (!companyId) return;
    
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
  }, [companyId]);

  const createRule = useCallback(async (rule: Partial<ChecklistRule>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
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
      // Генерируем чек-лист на основе правил
      const items: any[] = [...customItems];
      
      estimate.items?.forEach(item => {
        const matchingRules = rules.filter(rule => 
          rule.condition_type === 'category' 
            ? item.category === rule.condition_value
            : item.name.includes(rule.condition_value)
        );
        
        matchingRules.forEach(rule => {
          rule.items?.forEach(ruleItem => {
            items.push({
              name: ruleItem.name,
              quantity: ruleItem.quantity * item.quantity,
              category: ruleItem.category,
              is_required: ruleItem.is_required,
              is_checked: false
            });
          });
        });
      });

      const { error } = await supabase
        .from('checklists')
        .insert({
          estimate_id: estimate.id,
          company_id: companyId,
          event_name: estimate.event_name,
          event_date: estimate.event_date,
          items: items,
          notes: notes || null
        });

      if (error) throw error;

      await fetchChecklists();
      toast.success('Чек-лист создан');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при создании чек-листа', { description: err.message });
      return { error: err };
    }
  }, [companyId, estimates, rules, fetchChecklists]);

  const updateChecklistItem = useCallback(async (checklistId: string, itemId: string, updates: any) => {
    if (!companyId) return { error: new Error('No company selected') };
    
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
  }, [companyId, fetchChecklists]);

  const deleteChecklist = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('checklists')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchChecklists();
      toast.success('Чек-лист удалён');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchChecklists]);

  useEffect(() => {
    fetchChecklists();
    fetchRules();
  }, [fetchChecklists, fetchRules]);

  return {
    checklists,
    rules,
    loading,
    createRule,
    deleteRule,
    createChecklist,
    updateChecklistItem,
    deleteChecklist,
    refresh: fetchChecklists
  };
}
