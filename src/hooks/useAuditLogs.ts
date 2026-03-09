import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type AuditAction = 'create' | 'update' | 'delete' | 'view' | 'login' | 'logout';
export type EntityType = 'estimate' | 'estimate_item' | 'equipment' | 'customer' | 'staff' | 'contract' | 'user' | 'template';

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  action: AuditAction;
  entity_type: EntityType;
  entity_id: string | null;
  entity_name: string | null;
  old_data: any;
  new_data: any;
  created_at: string;
}

export interface AuditLogFilters {
  userId?: string;
  action?: AuditAction;
  entityType?: EntityType;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

const ACTION_LABELS: Record<AuditAction, string> = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
  view: 'Просмотр',
  login: 'Вход',
  logout: 'Выход',
};

const ENTITY_LABELS: Record<EntityType, string> = {
  estimate: 'Смета',
  estimate_item: 'Позиция сметы',
  equipment: 'Оборудование',
  customer: 'Заказчик',
  staff: 'Сотрудник',
  contract: 'Договор',
  user: 'Пользователь',
  template: 'Шаблон',
};

export function getActionLabel(action: AuditAction): string {
  return ACTION_LABELS[action] || action;
}

export function getEntityLabel(entityType: EntityType): string {
  return ENTITY_LABELS[entityType] || entityType;
}

export function useAuditLogs(filters?: AuditLogFilters, limit: number = 100) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' });

      // Применяем фильтры
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.action) {
        query = query.eq('action', filters.action);
      }
      if (filters?.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }
      if (filters?.search) {
        query = query.or(`user_name.ilike.%${filters.search}%,entity_name.ilike.%${filters.search}%`);
      }

      // Сортировка по дате (новые сначала)
      query = query.order('created_at', { ascending: false });

      // Лимит
      query = query.limit(limit);

      const { data, error: supabaseError, count } = await query;

      if (supabaseError) throw supabaseError;

      setLogs(data as AuditLog[] || []);
      setTotalCount(count || 0);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, limit]);

  useEffect(() => {
    fetchLogs();

    // Подписка на новые логи
    const subscription = supabase
      .channel('audit_logs_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, (payload) => {
        setLogs((prev) => [payload.new as AuditLog, ...prev].slice(0, limit));
        setTotalCount((prev) => prev + 1);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchLogs, limit]);

  return {
    logs,
    loading,
    error,
    totalCount,
    refetch: fetchLogs,
  };
}

// Функция для ручной записи лога (если нужна на клиенте)
export async function logAction(
  action: AuditAction,
  entityType: EntityType,
  entityId?: string,
  entityName?: string,
  oldData?: any,
  newData?: any
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.rpc('create_audit_log', {
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId || null,
      p_entity_name: entityName || null,
      p_old_data: oldData || null,
      p_new_data: newData || null,
    });

    if (error) throw error;

    return { error: null };
  } catch (err) {
    console.error('Error creating audit log:', err);
    return { error: err as Error };
  }
}
