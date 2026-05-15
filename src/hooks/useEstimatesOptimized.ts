import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useSmartSync } from './useSmartSync';
import { useOptimisticMutation } from './useOptimisticMutation';
import type { Estimate } from '../types';

/**
 * Optimized estimates hook with:
 * - Optimistic mutations (instant UI updates)
 * - Smart sync for other users (adaptive polling)
 * - Proper caching
 */
export function useEstimatesOptimized(companyId: string | undefined) {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(false);
  const optimistic = useOptimisticMutation(setEstimates);

  // Fetch from server
  const fetchEstimates = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (!error && data) {
      setEstimates(data);
    }
    
    setLoading(false);
  }, [companyId]);

  // Smart sync for other users' changes
  useSmartSync({
    table: 'estimates',
    companyId,
    onChange: fetchEstimates,
    critical: true // Finances are critical
  });

  // Create with optimistic update
  const createEstimate = useCallback(async (data: Partial<Estimate>) => {
    if (!companyId) return { error: new Error('No company') };
    
    // 1. Optimistic add
    const tempId = `temp_${Date.now()}`;
    const optimisticEstimate = { 
      ...data, 
      id: tempId,
      company_id: companyId,
      created_at: new Date().toISOString(),
      status: 'draft'
    } as Estimate;
    
    optimistic.add(optimisticEstimate);
    
    // 2. Server request
    const { data: saved, error } = await supabase
      .from('estimates')
      .insert({ ...data, company_id: companyId })
      .select()
      .single();
    
    // 3. Replace temp with real data
    if (saved) {
      optimistic.update(tempId, saved);
    } else if (error) {
      // Rollback on error
      optimistic.remove(tempId);
    }
    
    return { data: saved, error };
  }, [companyId, optimistic]);

  // Update with optimistic update
  const updateEstimate = useCallback(async (id: string, updates: Partial<Estimate>) => {
    // 1. Optimistic update
    optimistic.update(id, updates);
    
    // 2. Server request
    const { data, error } = await supabase
      .from('estimates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    // 3. Sync with server response
    if (data) {
      optimistic.update(id, data);
    }
    
    return { data, error };
  }, [optimistic]);

  return {
    estimates,
    loading,
    fetchEstimates,
    createEstimate,
    updateEstimate
  };
}
