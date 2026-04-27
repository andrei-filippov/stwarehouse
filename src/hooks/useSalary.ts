import { useState, useEffect, useCallback, useRef } from 'react';
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
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRecords = useCallback(async () => {
    console.log('[useSalary] fetchRecords called, companyId:', companyId);
    if (!companyId) {
      console.log('[useSalary] no companyId, skipping');
      return;
    }
    setLoading(true);
    
    // Пробуем загрузить с колонкой payments (для новых схем)
    let data: any[] | null = null;
    let error: any = null;
    
    try {
      const result = await supabase
        .from('salary_records')
        .select('id, company_id, staff_id, month, projects, payments, total_calculated, paid, payment_date, notes, created_at, updated_at')
        .eq('company_id', companyId)
        .order('month', { ascending: false });
      
      // Логируем ошибку для отладки
      if (result.error) {
        console.log('[useSalary] fetch error:', result.error.message, result.error.code, result.error.details);
      }
      
      // Проверяем разные варианты ошибки с колонкой payments
      const isPaymentsError = result.error && (
        result.error.message?.includes('payments') ||
        result.error.message?.includes('column') ||
        result.error.message?.includes('schema cache') ||
        result.error.code === 'PGRST204'
      );
      
      if (isPaymentsError) {
        // Fallback: колонка payments ещё не создана в БД
        console.log('[useSalary] Fallback: loading without payments column');
        const fallback = await supabase
          .from('salary_records')
          .select('id, company_id, staff_id, month, projects, total_calculated, paid, payment_date, notes, created_at, updated_at')
          .eq('company_id', companyId)
          .order('month', { ascending: false });
        data = fallback.data;
        error = fallback.error;
      } else {
        data = result.data;
        error = result.error;
      }
      
      // Если есть данные, но есть и ошибка — используем данные (частичный success)
      if (!data && result.data) {
        data = result.data;
        error = null;
      }
    } catch (e) {
      console.error('[useSalary] fetch exception:', e);
      error = e;
    }
    
    console.log('[useSalary] fetch result — error:', error?.message, 'data count:', data?.length, 'data:', data);
    if (error) {
      toast.error('Ошибка при загрузке зарплат', { description: error.message });
    } else if (!data) {
      console.log('[useSalary] data is null/undefined');
      setRecords([]);
    } else {
      // Миграция: если payments нет/null/пустой, но paid > 0 — создаём legacy-запись
      const migrated = (data || []).map((r: any) => {
        const hasPayments = r.payments && Array.isArray(r.payments) && r.payments.length > 0;
        if (!hasPayments && r.paid > 0) {
          // Фоново сохраняем payments в БД
          supabase
            .from('salary_records')
            .update({
              payments: [{
                id: `legacy_${r.id}`,
                amount: r.paid,
                date: r.payment_date || r.created_at || new Date().toISOString(),
                type: 'regular',
              }]
            })
            .eq('id', r.id)
            .then(() => {})
            .catch(() => {});
          
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
      // Проверяем существование записи (без payments — может не быть в схеме)
      const { data: existing } = await supabase
        .from('salary_records')
        .select('id, projects, paid, payment_date, notes')
        .eq('company_id', companyId)
        .eq('staff_id', record.staff_id)
        .eq('month', record.month)
        .maybeSingle();

      if (existing) {
        // Обновляем существующую — пробуем с payments, fallback без
        const updateData: any = {
          projects: record.projects || existing.projects,
          total_calculated: record.total_calculated || 0,
          paid: record.paid !== undefined ? record.paid : existing.paid,
          payment_date: record.payment_date || existing.payment_date,
          notes: record.notes || existing.notes
        };
        
        // Пробуем добавить payments, если есть
        if (record.payments) {
          updateData.payments = record.payments;
        }

        const { error } = await supabase
          .from('salary_records')
          .update(updateData)
          .eq('id', existing.id);

        if (error && error.message?.includes('payments')) {
          // Fallback: обновляем без payments
          delete updateData.payments;
          const { error: retryError } = await supabase
            .from('salary_records')
            .update(updateData)
            .eq('id', existing.id);
          if (retryError) throw retryError;
        } else if (error) {
          throw error;
        }
      } else {
        // Создаём новую — пробуем с payments, fallback без
        const insertData: any = {
          ...record,
          company_id: companyId
        };
        
        const { error } = await supabase
          .from('salary_records')
          .insert(insertData);

        if (error && error.message?.includes('payments')) {
          // Fallback: создаём без payments
          delete insertData.payments;
          const { error: retryError } = await supabase
            .from('salary_records')
            .insert(insertData);
          if (retryError) throw retryError;
        } else if (error) {
          throw error;
        }
      }

      // Не вызываем fetchRecords — realtime подписка сама обновит данные
      // Если realtime не сработал, данные обновятся при следующем открытии вкладки
      toast.success('Сохранено');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при сохранении', { description: err.message });
      return { error: err };
    }
  }, [companyId]);

  const deleteRecord = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('salary_records')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      toast.success('Запись удалена');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении', { description: err.message });
      return { error: err };
    }
  }, [companyId]);

  useEffect(() => {
    console.log('[useSalary] initial fetch effect, companyId:', companyId);
    fetchRecords();
  }, [fetchRecords]);

  // Debounced fetch для realtime подписки
  const debouncedFetchRecords = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      fetchRecords();
    }, 500);
  }, [fetchRecords]);

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('salary-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'salary_records', filter: `company_id=eq.${companyId}` },
        () => debouncedFetchRecords()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [debouncedFetchRecords, companyId]);

  return {
    records,
    loading,
    addOrUpdateRecord,
    deleteRecord,
    refresh: fetchRecords
  };
}
