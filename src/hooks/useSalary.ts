import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

export interface SalaryProject {
  name: string;
  amount: number;
  date: string;
}

export interface SalaryRecord {
  id: string;
  company_id?: string;
  staff_id: string;
  month: string; // YYYY-MM
  projects: SalaryProject[];
  total_calculated: number;
  paid: number;
  payment_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export function useSalary(companyId: string | undefined) {
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRecords = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('salary_records')
      .select('*')
      .eq('company_id', companyId)
      .order('month', { ascending: false });
    
    if (error) {
      toast.error('Ошибка при загрузке зарплат', { description: error.message });
    } else {
      setRecords(data || []);
    }
    setLoading(false);
  }, [companyId]);

  const addOrUpdateRecord = useCallback(async (record: Partial<SalaryRecord>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      // Проверяем существование записи
      const { data: existing } = await supabase
        .from('salary_records')
        .select('id, projects, paid, payment_date, notes')
        .eq('company_id', companyId)
        .eq('staff_id', record.staff_id)
        .eq('month', record.month)
        .maybeSingle();

      if (existing) {
        // Обновляем существующую
        const { error } = await supabase
          .from('salary_records')
          .update({
            projects: record.projects || existing.projects,
            total_calculated: record.total_calculated || 0,
            paid: record.paid !== undefined ? record.paid : existing.paid,
            payment_date: record.payment_date || existing.payment_date,
            notes: record.notes || existing.notes
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Создаём новую
        const { error } = await supabase
          .from('salary_records')
          .insert({
            ...record,
            company_id: companyId
          });

        if (error) throw error;
      }

      await fetchRecords();
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при сохранении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchRecords]);

  const deleteRecord = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('salary_records')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchRecords();
      toast.success('Запись удалена');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchRecords]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('salary-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'salary_records', filter: `company_id=eq.${companyId}` },
        () => fetchRecords()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRecords, companyId]);

  return {
    records,
    loading,
    addOrUpdateRecord,
    deleteRecord,
    refresh: fetchRecords
  };
}
