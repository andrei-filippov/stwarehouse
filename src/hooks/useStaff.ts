import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Staff } from '../types';

export function useStaff(companyId: string | undefined) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStaff = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('full_name');
    
    if (error) {
      toast.error('Ошибка при загрузке персонала', { description: error.message });
    } else {
      setStaff(data || []);
    }
    setLoading(false);
  }, [companyId]);

  const addStaff = useCallback(async (member: Partial<Staff>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('staff')
        .insert({ ...member, company_id: companyId });

      if (error) throw error;

      await fetchStaff();
      toast.success('Сотрудник добавлен');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при добавлении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchStaff]);

  const updateStaff = useCallback(async (id: string, updates: Partial<Staff>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('staff')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchStaff();
      toast.success('Данные обновлены');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при обновлении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchStaff]);

  const deleteStaff = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('staff')
        .update({ is_active: false })
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchStaff();
      toast.success('Сотрудник удалён');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchStaff]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('staff-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'staff', filter: `company_id=eq.${companyId}` },
        () => fetchStaff()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStaff, companyId]);

  return {
    staff,
    loading,
    addStaff,
    updateStaff,
    deleteStaff,
    refresh: fetchStaff
  };
}
