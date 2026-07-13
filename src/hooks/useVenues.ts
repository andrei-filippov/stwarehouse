import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import type { VenueDetails } from '../types/venues';

export function useVenues(companyId: string | undefined) {
  const [venues, setVenues] = useState<VenueDetails[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchVenues = useCallback(async (force = false) => {
    if (!companyId) return;

    const cacheKey = `venues_${companyId}`;
    if (!force) {
      const cached = getCached<VenueDetails[]>(cacheKey);
      if (cached) { setVenues(cached); return; }
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('venue_details')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      if (error) throw error;
      const result = data || [];
      setVenues(result);
      setCached(cacheKey, result);
    } catch (err: any) {
      toast.error('Ошибка загрузки площадок', { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const createVenue = useCallback(async (venue: Partial<VenueDetails>) => {
    if (!companyId) return { error: new Error('No company') };

    try {
      const { data, error } = await supabase
        .from('venue_details')
        .insert({ ...venue, company_id: companyId })
        .select()
        .single();

      if (error) throw error;
      toast.success('Площадка создана');
      await fetchVenues(true);
      return { data, error: null };
    } catch (err: any) {
      toast.error('Ошибка создания площадки', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchVenues]);

  const updateVenue = useCallback(async (id: string, updates: Partial<VenueDetails>) => {
    if (!companyId) return { error: new Error('No company') };

    try {
      const { data, error } = await supabase
        .from('venue_details')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

      if (error) throw error;
      toast.success('Площадка обновлена');
      await fetchVenues(true);
      return { data, error: null };
    } catch (err: any) {
      toast.error('Ошибка обновления площадки', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchVenues]);

  const deleteVenue = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company') };

    try {
      const { error } = await supabase
        .from('venue_details')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;
      toast.success('Площадка удалена');
      await fetchVenues(true);
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка удаления площадки', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchVenues]);

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  return { venues, loading, fetchVenues, createVenue, updateVenue, deleteVenue };
}
