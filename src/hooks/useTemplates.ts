import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Template, TemplateItem } from '../types';

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
    
    if (!error && data) {
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
      return { error: templateError };
    }

    if (items.length > 0) {
      const itemsWithTemplateId = items.map(item => ({
        ...item,
        template_id: templateData.id
      }));
      
      const { error: itemsError } = await supabase
        .from('template_items')
        .insert(itemsWithTemplateId);
      
      if (itemsError) {
        return { error: itemsError };
      }
    }

    await fetchTemplates();
    return { error: null, data: templateData };
  };

  const updateTemplate = async (id: string, updates: Partial<Template>, items?: TemplateItem[]) => {
    const { error } = await supabase
      .from('templates')
      .update(updates)
      .eq('id', id);
    
    if (error) return { error };

    if (items) {
      await supabase.from('template_items').delete().eq('template_id', id);
      
      if (items.length > 0) {
        await supabase.from('template_items').insert(
          items.map(item => ({ ...item, template_id: id }))
        );
      }
    }

    await fetchTemplates();
    return { error: null };
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setTemplates(prev => prev.filter(t => t.id !== id));
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