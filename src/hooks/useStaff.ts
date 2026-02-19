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
      .select('id, full_name, position, phone, email, birth_date, passport_series, passport_number, passport_issued_by, passport_issue_date, notes, is_active, created_at, updated_at')
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
    // Фильтруем только заполненные поля
    const cleanData: any = {
      full_name: staffData.full_name,
      position: staffData.position,
      user_id: userId
    };
    
    // Добавляем опциональные поля только если они есть
    if (staffData.phone) cleanData.phone = staffData.phone;
    if (staffData.email) cleanData.email = staffData.email;
    if (staffData.birth_date) cleanData.birth_date = staffData.birth_date;
    if (staffData.passport_series) cleanData.passport_series = staffData.passport_series;
    if (staffData.passport_number) cleanData.passport_number = staffData.passport_number;
    if (staffData.passport_issued_by) cleanData.passport_issued_by = staffData.passport_issued_by;
    if (staffData.passport_issue_date) cleanData.passport_issue_date = staffData.passport_issue_date;
    if (staffData.notes) cleanData.notes = staffData.notes;
    if (staffData.is_active !== undefined) cleanData.is_active = staffData.is_active;
    
    const { data, error } = await supabase
      .from('staff')
      .insert([cleanData])
      .select()
      .single();
    
    if (!error && data) {
      setStaff(prev => [...prev, data as Staff]);
    } else {
      console.error('Error adding staff:', error);
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
