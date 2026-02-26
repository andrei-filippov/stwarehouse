import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Customer } from '../types';

export function useCustomers(userId: string | undefined) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      
      if (error) {
        // Не показываем toast для ошибки "таблица не существует" при загрузке
        if (error.code === '42P01') {
          console.error('Таблица customers не существует. Пожалуйста, выполните SQL скрипт.');
          setError('Таблица заказчиков не найдена. Обратитесь к администратору.');
        } else {
          toast.error('Ошибка при загрузке заказчиков', { description: error.message });
        }
      } else if (data) {
        setCustomers(data as Customer[]);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Неожиданная ошибка при загрузке');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCustomers();
    
    // Realtime подписка на изменения заказчиков
    const channel = supabase
      .channel('customers_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers'
        },
        (payload) => {
          console.log('Customers change received:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newCustomer = payload.new as Customer;
            setCustomers(prev => {
              // Проверяем, нет ли уже такого заказчика
              if (prev.find(c => c.id === newCustomer.id)) return prev;
              return [...prev, newCustomer].sort((a, b) => a.name.localeCompare(b.name));
            });
            toast.info('Новый заказчик добавлен другим пользователем');
          } else if (payload.eventType === 'UPDATE') {
            const updatedCustomer = payload.new as Customer;
            const oldCustomer = payload.old as Customer;
            setCustomers(prev => 
              prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c)
                  .sort((a, b) => a.name.localeCompare(b.name))
            );
            // Показываем уведомление только если изменение от другого пользователя
            if (updatedCustomer.user_id !== userId) {
              toast.info(`Заказчик "${updatedCustomer.name}" обновлён другим пользователем`);
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setCustomers(prev => prev.filter(c => c.id !== deletedId));
            toast.info('Заказчик удалён другим пользователем');
          }
        }
      )
      .subscribe((status) => {
        console.log('Customers realtime subscription status:', status);
        if (status === 'CHANNEL_ERROR') {
          toast.error('Ошибка подключения к real-time обновлениям заказчиков');
        }
      });
    
    return () => {
      console.log('Removing customers channel');
      supabase.removeChannel(channel);
    };
  }, [fetchCustomers, userId]);

  const addCustomer = async (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'> & { user_id: string }) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([customer])
        .select()
        .single();
      
      if (error) {
        if (error.code === '42P01') {
          toast.error('Таблица заказчиков не найдена', { 
            description: 'Пожалуйста, выполните SQL скрипт supabase_schema.sql' 
          });
        } else {
          toast.error('Ошибка при добавлении заказчика', { description: error.message });
        }
        return { error, data: null };
      } else if (data) {
        // Не добавляем в state здесь — real-time подписка сделает это
        toast.success('Заказчик добавлен', { description: customer.name });
        return { error: null, data };
      }
      return { error: null, data: null };
    } catch (err) {
      console.error('Unexpected error:', err);
      return { error: err, data: null };
    }
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) {
        toast.error('Ошибка при обновлении заказчика', { description: error.message });
      } else {
        setCustomers(prev => prev.map(c => 
          c.id === id ? { ...c, ...updates } : c
        ));
        toast.success('Заказчик обновлен');
      }
      return { error };
    } catch (err) {
      console.error('Unexpected error:', err);
      return { error: err };
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);
      
      if (error) {
        toast.error('Ошибка при удалении заказчика', { description: error.message });
      } else {
        setCustomers(prev => prev.filter(c => c.id !== id));
        toast.success('Заказчик удален');
      }
      return { error };
    } catch (err) {
      console.error('Unexpected error:', err);
      return { error: err };
    }
  };

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
