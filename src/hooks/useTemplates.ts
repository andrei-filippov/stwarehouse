import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Template, TemplateItem } from '../types';

export function useTemplates(companyId: string | undefined) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('templates')
      .select(`
        *,
        items:template_items(*)
      `)
      .eq('company_id', companyId)
      .order('name');
    
    if (error) {
      toast.error('Ошибка при загрузке шаблонов', { description: error.message });
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  }, [companyId]);

  const createTemplate = useCallback(async (
    template: Partial<Template>, 
    items: { category: string; equipment_name: string; default_quantity: number }[]
  ) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { data: newTemplate, error: templateError } = await supabase
        .from('templates')
        .insert({ ...template, company_id: companyId })
        .select()
        .single();

      if (templateError) throw templateError;

      if (items.length > 0) {
        const itemsWithTemplateId = items.map((item, index) => {
          // Удаляем id, чтобы PostgreSQL сгенерировал новый UUID
          const { id, ...itemWithoutId } = item;
          return {
            ...itemWithoutId,
            template_id: newTemplate.id,
            company_id: companyId,
            order_index: index
          };
        });

        const { error: itemsError } = await supabase
          .from('template_items')
          .insert(itemsWithTemplateId);

        if (itemsError) throw itemsError;
      }

      await fetchTemplates();
      toast.success('Шаблон создан');
      return { data: newTemplate, error: null };
    } catch (err: any) {
      toast.error('Ошибка при создании шаблона', { description: err.message });
      return { data: null, error: err };
    }
  }, [companyId, fetchTemplates]);

  const updateTemplate = useCallback(async (
    id: string, 
    updates: Partial<Template>, 
    items?: { category: string; equipment_name: string; default_quantity: number }[]
  ) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error: templateError } = await supabase
        .from('templates')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId);

      if (templateError) throw templateError;

      if (items) {
        await supabase
          .from('template_items')
          .delete()
          .eq('template_id', id);

        if (items.length > 0) {
          const itemsWithTemplateId = items.map((item, index) => {
            // Удаляем id, чтобы PostgreSQL сгенерировал новый UUID
            const { id: itemId, ...itemWithoutId } = item;
            return {
              ...itemWithoutId,
              template_id: id,
              company_id: companyId,
              order_index: index
            };
          });

          const { error: itemsError } = await supabase
            .from('template_items')
            .insert(itemsWithTemplateId);

          if (itemsError) throw itemsError;
        }
      }

      await fetchTemplates();
      toast.success('Шаблон обновлён');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при обновлении шаблона', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchTemplates]);

  const deleteTemplate = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchTemplates();
      toast.success('Шаблон удалён');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении шаблона', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchTemplates]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('templates-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'templates', filter: `company_id=eq.${companyId}` },
        () => fetchTemplates()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTemplates, companyId]);

  return {
    templates,
    loading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refresh: fetchTemplates
  };
}
