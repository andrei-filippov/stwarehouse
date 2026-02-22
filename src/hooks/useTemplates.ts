import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Template, TemplateItem } from '../types';

export function useTemplates(userId: string | undefined) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('templates')
      .select(`
        *,
        items:template_items(*)
      `)
      .order('name');
    
    if (error) {
      toast.error('Ошибка при загрузке шаблонов', { description: error.message });
    } else if (data) {
      setTemplates(data as Template[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = async (template: Omit<Template, 'id' | 'created_at'>, items: Omit<TemplateItem, 'id' | 'template_id'>[]) => {
    const { data: templateData, error: templateError } = await supabase
      .from('templates')
      .insert([{ ...template, user_id: userId }])
      .select()
      .single();
    
    if (templateError || !templateData) {
      toast.error('Ошибка при создании шаблона', { description: templateError?.message });
      return { error: templateError };
    }

    if (items.length > 0) {
      const itemsWithTemplateId = items.map(item => ({
        template_id: templateData.id,
        category: item.category,
        equipment_name: item.equipment_name,
        default_quantity: item.default_quantity
      }));
      
      const { error: itemsError } = await supabase
        .from('template_items')
        .insert(itemsWithTemplateId);
      
      if (itemsError) {
        toast.error('Ошибка при добавлении позиций шаблона', { description: itemsError.message });
        return { error: itemsError };
      }
    }

    await fetchTemplates();
    toast.success('Шаблон создан', { description: template.name });
    return { error: null, data: templateData };
  };

  const updateTemplate = async (id: string, updates: Partial<Template>, items?: TemplateItem[]) => {
    const { error } = await supabase
      .from('templates')
      .update(updates)
      .eq('id', id);
    
    if (error) {
      toast.error('Ошибка при обновлении шаблона', { description: error.message });
      return { error };
    }

    if (items) {
      await supabase.from('template_items').delete().eq('template_id', id);
      
      if (items.length > 0) {
        const cleanItems = items.map(item => ({
          template_id: id,
          category: item.category,
          equipment_name: item.equipment_name,
          default_quantity: item.default_quantity
        }));
        await supabase.from('template_items').insert(cleanItems);
      }
    }

    await fetchTemplates();
    toast.success('Шаблон обновлен');
    return { error: null };
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Ошибка при удалении шаблона', { description: error.message });
    } else {
      setTemplates(prev => prev.filter(t => t.id !== id));
      toast.success('Шаблон удален');
    }
    return { error };
  };

  return {
    templates,
    loading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refresh: fetchTemplates
  };
}
