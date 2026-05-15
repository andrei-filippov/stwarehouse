import { useCallback } from 'react';

/**
 * Hook for optimistic mutations — update UI immediately before server confirms.
 * This gives instant feedback to the user who made the change.
 */
export function useOptimisticMutation<T extends { id: string }>(
  setState: React.Dispatch<React.SetStateAction<T[]>>
) {
  
  const add = useCallback((item: T) => {
    setState(prev => [item, ...prev]);
  }, [setState]);

  const update = useCallback((id: string, updates: Partial<T>) => {
    setState(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, [setState]);

  const remove = useCallback((id: string) => {
    setState(prev => prev.filter(item => item.id !== id));
  }, [setState]);

  const replace = useCallback((items: T[]) => {
    setState(items);
  }, [setState]);

  return { add, update, remove, replace };
}

/**
 * Example usage in a component:
 * 
 * const [estimates, setEstimates] = useState<Estimate[]>([]);
 * const optimistic = useOptimisticMutation(setEstimates);
 * 
 * const createEstimate = async (data) => {
 *   // 1. Optimistic add with temp ID
 *   const tempId = 'temp_' + Date.now();
 *   optimistic.add({ ...data, id: tempId, status: 'draft' });
 *   
 *   // 2. Server request
 *   const { data: saved } = await supabase.from('estimates').insert(data).select().single();
 *   
 *   // 3. Replace temp with real data
 *   if (saved) {
 *     optimistic.update(tempId, saved);
 *   }
 * };
 */
