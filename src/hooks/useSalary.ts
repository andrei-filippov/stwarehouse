import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

export type PaymentType = 'regular' | 'advance' | 'bonus';

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  regular: 'Зарплата',
  advance: 'Аванс',
  bonus: 'Бонус',
};

export function getPaymentTypeLabel(type: PaymentType): string {
  return PAYMENT_TYPE_LABELS[type] || type;
}

export interface SalaryProject {
  name: string;
  amount: number;
  date: string;
}

export interface SalaryPaymentEntry {
  id: string;
  amount: number;
  date: string;
  type: PaymentType;
  notes?: string;
}

export interface SalaryRecord {
  id: string;
  company_id?: string;
  staff_id: string;
  month: string; // YYYY-MM
  projects: SalaryProject[];
  payments: SalaryPaymentEntry[];
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
      // Миграция: если payments нет, но payment_date и paid есть — создаём одну запись
      const migrated = (data || []).map((r: any) => {
        if (!r.payments && r.paid > 0) {
          return {
            ...r,
            payments: [{
              id: `legacy_${r.id}`,
              amount: r.paid,
              date: r.payment_date || r.created_at || new Date().toISOString(),
              type: 'regular' as PaymentType,
            }],
          };
        }
        return { ...r, payments: r.payments || [] };
      });
      setRecords(migrated);
    }
    setLoading(false);
  }, [companyId]);

  const addOrUpdateRecord = useCallback(async (record: Partial<SalaryRecord>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      // Проверяем существование записи
      const { data: existing } = await supabase
        .from('salary_records')
        .select('id, projects, payments, paid, payment_date, notes')
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
            payments: record.payments || existing.payments,
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
            payments: record.payments || [],
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
