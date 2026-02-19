import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Staff } from '../types';

export function useStaff(userId: string | undefined) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStaff = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('user_id', userId)
      .order('full_name');
    
    if (!error && data) {
      setStaff(data as Staff[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const addStaff = async (staffData: Omit<Staff, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('staff')
      .insert([{ ...staffData, user_id: userId }])
      .select()
      .single();
    
    if (!error && data) {
      setStaff(prev => [...prev, data as Staff]);
    }
    return { error, data };
  };

  const updateStaff = async (id: string, updates: Partial<Staff>) => {
    const { error } = await supabase
      .from('staff')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (!error) {
      setStaff(prev => prev.map(s => 
        s.id === id ? { ...s, ...updates } : s
      ));
    }
    return { error };
  };

  const deleteStaff = async (id: string) => {
    const { error } = await supabase
      .from('staff')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setStaff(prev => prev.filter(s => s.id !== id));
    }
    return { error };
  };

  return {
    staff,
    loading,
    addStaff,
    updateStaff,
    deleteStaff,
    refresh: fetchStaff
  };
}
