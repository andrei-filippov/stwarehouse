import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Equipment, Category } from '../types';

export function useEquipment(userId: string | undefined) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEquipment = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('name');
      
      if (error) {
        if (error.code !== '42P01') {
          toast.error('Ошибка при загрузке оборудования', { description: error.message });
        }
      } else if (data) {
        setEquipment(data as Equipment[]);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) {
        if (error.code !== '42P01') {
          console.error('Error fetching categories:', error);
        }
      } else if (data) {
        setCategories(data as Category[]);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  }, []);

  useEffect(() => {
    fetchEquipment();
    fetchCategories();
  }, [fetchEquipment, fetchCategories]);

  const addEquipment = async (item: Omit<Equipment, 'id' | 'created_at' | 'updated_at'> & { user_id: string }) => {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .insert([item])
        .select()
        .single();
      
      if (error) {
        if (error.code === '42P01') {
          toast.error('Таблица оборудования не найдена', { 
            description: 'Пожалуйста, выполните SQL скрипт supabase_schema.sql' 
          });
        } else {
          toast.error('Ошибка при добавлении оборудования', { description: error.message });
        }
      } else if (data) {
        setEquipment(prev => [...prev, data as Equipment]);
        toast.success('Оборудование добавлено', { description: item.name });
      }
      return { error };
    } catch (err) {
      console.error('Unexpected error:', err);
      return { error: err };
    }
  };

  const updateEquipment = async (id: string, updates: Partial<Equipment>) => {
    try {
      const { error } = await supabase
        .from('equipment')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) {
        toast.error('Ошибка при обновлении оборудования', { description: error.message });
      } else {
        setEquipment(prev => prev.map(item => 
          item.id === id ? { ...item, ...updates } : item
        ));
        toast.success('Оборудование обновлено');
      }
      return { error };
    } catch (err) {
      console.error('Unexpected error:', err);
      return { error: err };
    }
  };

  const deleteEquipment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', id);
      
      if (error) {
        toast.error('Ошибка при удалении оборудования', { description: error.message });
      } else {
        setEquipment(prev => prev.filter(item => item.id !== id));
        toast.success('Оборудование удалено');
      }
      return { error };
    } catch (err) {
      console.error('Unexpected error:', err);
      return { error: err };
    }
  };

  const bulkInsert = async (items: (Omit<Equipment, 'id' | 'created_at' | 'updated_at'> & { user_id: string })[]) => {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .insert(items)
        .select();
      
      if (error) {
        toast.error('Ошибка при импорте оборудования', { description: error.message });
      } else if (data) {
        setEquipment(prev => [...prev, ...(data as Equipment[])]);
        toast.success('Оборудование импортировано', { description: `${data.length} позиций` });
      }
      return { error, count: data?.length || 0 };
    } catch (err) {
      console.error('Unexpected error:', err);
      return { error: err, count: 0 };
    }
  };

  const addCategory = async (name: string) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{ name }])
        .select()
        .single();
      
      if (error) {
        toast.error('Ошибка при добавлении категории', { description: error.message });
      } else if (data) {
        setCategories(prev => [...prev, data as Category]);
      }
      return { error, data };
    } catch (err) {
      console.error('Unexpected error:', err);
      return { error: err, data: null };
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);
      
      if (error) {
        toast.error('Ошибка при удалении категории', { description: error.message });
      } else {
        setCategories(prev => prev.filter(cat => cat.id !== id));
      }
      return { error };
    } catch (err) {
      console.error('Unexpected error:', err);
      return { error: err };
    }
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
    deleteCategory,
    refresh: fetchEquipment
  };
}
