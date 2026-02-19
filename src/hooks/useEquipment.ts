import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Equipment, Category } from '../types';

export function useEquipment(userId: string | undefined) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEquipment = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .order('name');
    
    if (!error && data) {
      setEquipment(data as Equipment[]);
    }
    setLoading(false);
  }, [userId]);

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (!error && data) {
      setCategories(data as Category[]);
    }
  }, []);

  useEffect(() => {
    fetchEquipment();
    fetchCategories();
  }, [fetchEquipment, fetchCategories]);

  const addEquipment = async (item: Omit<Equipment, 'id' | 'created_at' | 'updated_at'> & { user_id: string }) => {
    const { data, error } = await supabase
      .from('equipment')
      .insert([item])
      .select()
      .single();
    
    if (!error && data) {
      setEquipment(prev => [...prev, data as Equipment]);
    }
    return { error };
  };

  const updateEquipment = async (id: string, updates: Partial<Equipment>) => {
    const { error } = await supabase
      .from('equipment')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (!error) {
      setEquipment(prev => prev.map(item => 
        item.id === id ? { ...item, ...updates } : item
      ));
    }
    return { error };
  };

  const deleteEquipment = async (id: string) => {
    const { error } = await supabase
      .from('equipment')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setEquipment(prev => prev.filter(item => item.id !== id));
    }
    return { error };
  };

  const bulkInsert = async (items: (Omit<Equipment, 'id' | 'created_at' | 'updated_at'> & { user_id: string })[]) => {
    const { data, error } = await supabase
      .from('equipment')
      .insert(items)
      .select();
    
    if (!error && data) {
      setEquipment(prev => [...prev, ...(data as Equipment[])]);
    }
    return { error, count: data?.length || 0 };
  };

  const addCategory = async (name: string) => {
    const { data, error } = await supabase
      .from('categories')
      .insert([{ name }])
      .select()
      .single();
    
    if (!error && data) {
      setCategories(prev => [...prev, data as Category]);
    }
    return { error, data };
  };

  return {
    equipment,
    categories,
    loading,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    bulkInsert,
    addCategory,
    refresh: fetchEquipment
  };
}