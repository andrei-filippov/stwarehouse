import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import type { Estimate } from '../types';

export interface ProjectWithDetails {
  id: string;
  estimate_id: string;
  venue_id: string | null;
  guest_count: number | null;
  expected_attendance: number | null;
  tech_rider: string | null;
  stage_plan_url: string | null;
  // из estimates (JOIN)
  name: string;
  event_date: string;
  event_start_date: string | null;
  event_end_date: string | null;
  status: string;
  total: number;
  customer_name: string | null;
  // venue
  venue_name?: string;
  venue_city?: string;
  // computed
  staff_count: number;
  checklist_progress: { total: number; completed: number };
}

export function useProjects(companyId: string | undefined) {
  const [projects, setProjects] = useState<ProjectWithDetails[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchProjects = useCallback(async (force = false) => {
    if (!companyId) return;

    const cacheKey = `projects_${companyId}`;
    if (!force) {
      const cached = getCached<ProjectWithDetails[]>(cacheKey);
      if (cached) { setProjects(cached); return; }
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          estimate_id,
          venue_id,
          guest_count,
          expected_attendance,
          tech_rider,
          stage_plan_url,
          estimates:event_name,event_date,event_start_date,event_end_date,status,total,customer_name,
          venue_details:name,city
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') {
          console.warn('projects table not found');
          setProjects([]);
          return;
        }
        throw error;
      }

      const result = (data || []).map((p: any) => ({
        id: p.id,
        estimate_id: p.estimate_id,
        venue_id: p.venue_id,
        guest_count: p.guest_count,
        expected_attendance: p.expected_attendance,
        tech_rider: p.tech_rider,
        stage_plan_url: p.stage_plan_url,
        name: p.estimates?.event_name || 'Без названия',
        event_date: p.estimates?.event_date,
        event_start_date: p.estimates?.event_start_date,
        event_end_date: p.estimates?.event_end_date,
        status: p.estimates?.status || 'draft',
        total: p.estimates?.total || 0,
        customer_name: p.estimates?.customer_name,
        venue_name: p.venue_details?.name,
        venue_city: p.venue_details?.city,
        staff_count: 0, // TODO: join with project_staff
        checklist_progress: { total: 0, completed: 0 }, // TODO: join with checklists
      }));

      setProjects(result);
      setCached(cacheKey, result);
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      if (err.code !== '42P01') {
        toast.error('Ошибка загрузки проектов', { description: err.message });
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return { projects, loading, refresh: () => fetchProjects(true) };
}
