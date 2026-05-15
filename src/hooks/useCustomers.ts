import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useRealtimeWithFallback } from './useRealtimeWithFallback';
import { getCached, setCached } from '../lib/queryCache';
import type { Customer } from '../types';
import { isOnline, addToSyncQueue, saveCustomerLocal, getCustomersLocal, deleteCustomerLocal } from '../lib/offlineDB';

export function useCustomers(companyId: string | undefined) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async (force = false) => {
    if (!companyId) return;

    const cacheKey = `fetchCustomers_${companyId}`;
    if (!force) {
      const cached = getCached<any[]>(cacheKey);
      if (cached) { setCustomers(cached); return; }
    }
    setLoading(true);
    setError(null);
    
    // Всегда загружаем локальных заказчиков
    const localCustomers = await getCustomersLocal(companyId);
    
    if (isOnline()) {
      try {
        const { data, error: fetchError } = await supabase
          .from('customers')
          .select('*')
          .eq('company_id', companyId)
          .order('name')
          .limit(1000);
        
        if (fetchError) throw fetchError;
        
        // Сохраняем серверные данные в локальное хранилище для офлайн-доступа
        for (const customer of (data || [])) {
          await saveCustomerLocal(customer, companyId, true);
        }
        
        // Мержим: серверные + локальные новые (с local_* ID)
        const serverIds = new Set((data || []).map(c => c.id));
        const newLocal = localCustomers.filter(c => {
          const isNewOffline = c.id?.startsWith('local_');
          const existsOnServer = serverIds.has(c.id);
          if (isNewOffline && !existsOnServer) return true;
          if (!isNewOffline && !existsOnServer) {
            deleteCustomerLocal(c.id).catch(console.error);
            return false;
          }
          return false;
        });
        
        // Убираем дубликаты по имени
        const serverNames = new Set((data || []).map(c => c.name?.toLowerCase().trim()));
        const uniqueLocal = newLocal.filter(local => {
          const name = local.name?.toLowerCase().trim();
          if (serverNames.has(name)) {
            deleteCustomerLocal(local.id).catch(console.error);
            return false;
          }
          return true;
        });
        
        const merged = [...uniqueLocal, ...(data || [])];
        const seenIds = new Set<string>();
        const deduplicated = merged.filter(c => {
          if (seenIds.has(c.id)) return false;
          seenIds.add(c.id);
          return true;
        });
        
        setCustomers(deduplicated);
        setCached(cacheKey, deduplicated);
      } catch (err) {
        // Ошибка сети - показываем локальные
        setCustomers(localCustomers);
      }
    } else {
      // ОФФЛАЙН: показываем только локальных заказчиков
      setCustomers(localCustomers);
    }
    setLoading(false);
  }, [companyId]);

  const addCustomer = useCallback(async (customer: Partial<Customer>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    // Валидация
    if (!customer.name || customer.name.trim().length < 2) {
      return { error: new Error('Имя клиента должно содержать минимум 2 символа') };
    }
    if (customer.name && customer.name.length > 200) {
      return { error: new Error('Имя клиента слишком длинное (макс. 200 символов)') };
    }
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      return { error: new Error('Некорректный email') };
    }
    if (customer.phone && customer.phone.length > 50) {
      return { error: new Error('Номер телефона слишком длинный') };
    }
    
    // Санитизация
    const sanitizedCustomer = {
      ...customer,
      name: customer.name?.trim(),
      email: customer.email?.trim().toLowerCase(),
      phone: customer.phone?.trim(),
      address: customer.address?.trim(),
      notes: customer.notes?.trim()
    };
    
    try {
      if (isOnline()) {
        // Optimistic update
        const tempId = `temp_${Date.now()}`;
        const optimisticCustomer = { ...sanitizedCustomer, id: tempId, company_id: companyId, created_at: new Date().toISOString() } as Customer;
        setCustomers(prev => [...prev, optimisticCustomer]);
        
        const { data, error: insertError } = await supabase
          .from('customers')
          .insert({ ...sanitizedCustomer, company_id: companyId })
          .select()
          .single();

        if (insertError) {
          setCustomers(prev => prev.filter(c => c.id !== tempId));
          throw insertError;
        }
        setCustomers(prev => prev.map(c => c.id === tempId ? data : c));
        toast.success('Клиент добавлен');
        return { data, error: null };
      }
      
      // ОФФЛАЙН режим
      const localId = `local_customer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const newCustomer = { 
        ...sanitizedCustomer, 
        id: localId,
        company_id: companyId,
        created_at: new Date().toISOString()
      } as Customer;
      
      await saveCustomerLocal(newCustomer, companyId);
      await addToSyncQueue('customers', 'create', newCustomer);
      setCustomers(prev => [...prev, newCustomer]);
      
      toast.info('Клиент сохранён офлайн', { description: 'Будет синхронизирован при подключении' });
      return { data: newCustomer, error: null, queued: true };
    } catch (err: any) {
      toast.error('Ошибка при добавлении клиента', { description: err.message });
      return { data: null, error: err };
    }
  }, [companyId, fetchCustomers]);

  const updateCustomer = useCallback(async (id: string, updates: Partial<Customer>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    // Optimistic update
    const prevCustomer = customers.find(c => c.id === id);
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    
    try {
      const { error: updateError } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId);

      if (updateError) {
        if (prevCustomer) setCustomers(prev => prev.map(c => c.id === id ? prevCustomer : c));
        throw updateError;
      }

      toast.success('Клиент обновлён');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при обновлении клиента', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchCustomers]);

  const deleteCustomer = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    const isLocalId = id.startsWith('local_');
    
    try {
      if (isOnline() && !isLocalId) {
        // Optimistic delete
        const prevCustomers = customers;
        setCustomers(prev => prev.filter(c => c.id !== id));
        
        const { error: deleteError } = await supabase
          .from('customers')
          .delete()
          .eq('id', id)
          .eq('company_id', companyId);

        if (deleteError) {
          setCustomers(prevCustomers);
          throw deleteError;
        }
        
        await deleteCustomerLocal(id);
        toast.success('Клиент удалён');
        return { error: null };
      }
      
      // ОФФЛАЙН или локальный ID
      await deleteCustomerLocal(id);
      if (!isLocalId) {
        await addToSyncQueue('customers', 'delete', { id });
      }
      setCustomers(prev => prev.filter(c => c.id !== id));
      toast.success('Клиент удалён');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении клиента', { description: err.message });
      return { error: err };
    }
  }, [companyId]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Real-time подписки
  useRealtimeWithFallback({
    channelName: 'customers-changes',
    companyId,
    tables: [
      { table: 'customers', filter: `company_id=eq.${companyId}`, onChange: () => fetchCustomers() },
    ],
    pollingIntervalMs: 60000,
  });

  return {
    customers,
    loading,
    error,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    refresh: fetchCustomers
  };
}
