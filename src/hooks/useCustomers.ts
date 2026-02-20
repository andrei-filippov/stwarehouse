import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Customer } from '../types';

export function useCustomers(userId: string | undefined) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCustomers = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name');
    
    if (!error && data) {
      setCustomers(data as Customer[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const addCustomer = async (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'> & { user_id: string }) => {
    const { data, error } = await supabase
      .from('customers')
      .insert([customer])
      .select()
      .single();
    
    if (!error && data) {
      setCustomers(prev => [...prev, data as Customer]);
    }
    return { error, data };
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    const { error } = await supabase
      .from('customers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (!error) {
      setCustomers(prev => prev.map(c => 
        c.id === id ? { ...c, ...updates } : c
      ));
    }
    return { error };
  };

  const deleteCustomer = async (id: string) => {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setCustomers(prev => prev.filter(c => c.id !== id));
    }
    return { error };
  };

  return {
    customers,
    loading,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    refresh: fetchCustomers
  };
}
