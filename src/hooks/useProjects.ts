import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';

export interface ProjectStaff {
  id: string;
  staff_id: string | null;
  external_name: string | null;
  external_phone: string | null;
  role: string;
  custom_role: string | null;
  shift_start: string | null;
  shift_end: string | null;
  confirmed: boolean;
  notes: string | null;
}

export interface ProjectTimeline {
  id: string;
  phase: string;
  custom_phase_name: string | null;
  start_time: string;
  end_time: string | null;
  description: string | null;
  color: string | null;
}

export interface ProjectEquipment {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  description: string;
}

export interface ProjectWithDetails {
  id: string;
  estimate_id: string;
  venue_id: string | null;
  guest_count: number | null;
  expected_attendance: number | null;
  tech_rider: string | null;
  stage_plan_url: string | null;
  notes: string | null;
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
  venue_address?: string;
  venue_contact_name?: string;
  venue_contact_phone?: string;
  // computed
  staff: ProjectStaff[];
  staff_count: number;
  timeline: ProjectTimeline[];
  equipment: ProjectEquipment[];
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
      // Загружаем проекты + сметы + площадки + estimate_items (через estimates JOIN)
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          estimate_id,
          venue_id,
          guest_count,
          expected_attendance,
          tech_rider,
          stage_plan_url,
          notes,
          estimates:estimate_id (
            event_name,
            event_date,
            event_start_date,
            event_end_date,
            status,
            total,
            customer_name,
            venue,
            items:estimate_items(*)
          ),
          venue_details:venue_id (name,city,address,contact_name,contact_phone)
        `)
        .eq('company_id', companyId);

      if (projectsError) {
        if (projectsError.code === '42P01') {
          console.warn('projects table not found');
          setProjects([]);
          return;
        }
        throw projectsError;
      }

      if (!projectsData || projectsData.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      const projectIds = projectsData.map((p: any) => p.id);

      // Загружаем все venue_details для lookup по имени (если venue_id не задан, но venue есть в смете)
      const { data: venuesData } = await supabase
        .from('venue_details')
        .select('id,name,city,address,contact_name,contact_phone')
        .eq('company_id', companyId);

      const venueByName: Record<string, { id: string; city?: string; address?: string; contact_name?: string; contact_phone?: string }> = {};
      (venuesData || []).forEach((v: any) => {
        venueByName[v.name] = v;
      });

      // Параллельно загружаем staff, timeline
      const [staffRes, timelineRes] = await Promise.all([
        supabase.from('project_staff').select('*').in('project_id', projectIds).eq('company_id', companyId),
        supabase.from('project_timeline').select('*').in('project_id', projectIds).eq('company_id', companyId).order('start_time', { ascending: true }),
      ]);

      const staffByProject: Record<string, ProjectStaff[]> = {};
      (staffRes.data || []).forEach((s: any) => {
        if (!staffByProject[s.project_id]) staffByProject[s.project_id] = [];
        staffByProject[s.project_id].push({
          id: s.id,
          staff_id: s.staff_id,
          external_name: s.external_name,
          external_phone: s.external_phone,
          role: s.role,
          custom_role: s.custom_role,
          shift_start: s.shift_start,
          shift_end: s.shift_end,
          confirmed: s.confirmed,
          notes: s.notes,
        });
      });

      const timelineByProject: Record<string, ProjectTimeline[]> = {};
      (timelineRes.data || []).forEach((t: any) => {
        if (!timelineByProject[t.project_id]) timelineByProject[t.project_id] = [];
        timelineByProject[t.project_id].push({
          id: t.id,
          phase: t.phase,
          custom_phase_name: t.custom_phase_name,
          start_time: t.start_time,
          end_time: t.end_time,
          description: t.description,
          color: t.color,
        });
      });

      const result: ProjectWithDetails[] = (projectsData || []).map((p: any) => {
        const items = p.estimates?.items || [];
        const equipment: ProjectEquipment[] = items.map((e: any) => ({
          id: e.id,
          name: e.name,
          category: e.category || 'Без категории',
          quantity: e.quantity || 1,
          unit: e.unit || 'шт.',
          description: e.description || '',
        }));

        // Определяем площадку: сначала venue_id, потом поиск по имени из сметы
        const venueFromEstimate = p.estimates?.venue;
        const matchedVenue = venueFromEstimate ? venueByName[venueFromEstimate] : null;
        const venueDetails = p.venue_details || matchedVenue;

        return {
          id: p.id,
          estimate_id: p.estimate_id,
          venue_id: p.venue_id || matchedVenue?.id || null,
          guest_count: p.guest_count,
          expected_attendance: p.expected_attendance,
          tech_rider: p.tech_rider,
          stage_plan_url: p.stage_plan_url,
          notes: p.notes,
          name: p.estimates?.event_name || 'Без названия',
          event_date: p.estimates?.event_date,
          event_start_date: p.estimates?.event_start_date,
          event_end_date: p.estimates?.event_end_date,
          status: p.estimates?.status || 'draft',
          total: p.estimates?.total || 0,
          customer_name: p.estimates?.customer_name,
          venue_name: venueDetails?.name || venueFromEstimate,
          venue_city: venueDetails?.city,
          venue_address: venueDetails?.address,
          venue_contact_name: venueDetails?.contact_name,
          venue_contact_phone: venueDetails?.contact_phone,
          staff: staffByProject[p.id] || [],
          staff_count: (staffByProject[p.id] || []).length,
          timeline: timelineByProject[p.id] || [],
          equipment,
        };
      });

      // Убираем дубли по name + event_date (оставляем первый)
      const seenKeys = new Set<string>();
      const uniqueProjects = result.filter(p => {
        const key = `${p.name}_${p.event_date}`;
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      });

      console.log('[useProjects] Total projects:', result.length, 'Unique:', uniqueProjects.length);

      setProjects(uniqueProjects);
      setCached(cacheKey, uniqueProjects);
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

  const updateProject = useCallback(async (id: string, updates: Partial<ProjectWithDetails>) => {
    if (!companyId) return { error: 'No company' };
    try {
      const dbUpdates: any = {};
      if (updates.venue_id !== undefined) dbUpdates.venue_id = updates.venue_id;
      if (updates.guest_count !== undefined) dbUpdates.guest_count = updates.guest_count;
      if (updates.expected_attendance !== undefined) dbUpdates.expected_attendance = updates.expected_attendance;
      if (updates.tech_rider !== undefined) dbUpdates.tech_rider = updates.tech_rider;
      if (updates.stage_plan_url !== undefined) dbUpdates.stage_plan_url = updates.stage_plan_url;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

      const { error } = await supabase.from('projects').update(dbUpdates).eq('id', id).eq('company_id', companyId);
      if (error) throw error;

      setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка обновления проекта', { description: err.message });
      return { error: err };
    }
  }, [companyId]);

  const addStaff = useCallback(async (projectId: string, staff: Omit<ProjectStaff, 'id'>) => {
    if (!companyId) return { error: 'No company', data: null };
    try {
      const { data, error } = await supabase.from('project_staff').insert({
        company_id: companyId,
        project_id: projectId,
        ...staff,
      }).select().single();
      if (error) throw error;
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        const newStaff = [...p.staff, { ...staff, id: data.id }];
        return { ...p, staff: newStaff, staff_count: newStaff.length };
      }));
      return { error: null, data };
    } catch (err: any) {
      toast.error('Ошибка добавления персонала', { description: err.message });
      return { error: err, data: null };
    }
  }, [companyId]);

  const removeStaff = useCallback(async (projectId: string, staffId: string) => {
    if (!companyId) return { error: 'No company' };
    try {
      const { error } = await supabase.from('project_staff').delete().eq('id', staffId).eq('company_id', companyId);
      if (error) throw error;
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        const newStaff = p.staff.filter(s => s.id !== staffId);
        return { ...p, staff: newStaff, staff_count: newStaff.length };
      }));
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка удаления персонала', { description: err.message });
      return { error: err };
    }
  }, [companyId]);

  const updateStaff = useCallback(async (projectId: string, staffId: string, updates: Partial<ProjectStaff>) => {
    if (!companyId) return { error: 'No company' };
    try {
      const { error } = await supabase.from('project_staff').update(updates).eq('id', staffId).eq('company_id', companyId);
      if (error) throw error;
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        const newStaff = p.staff.map(s => s.id === staffId ? { ...s, ...updates } : s);
        return { ...p, staff: newStaff };
      }));
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка обновления персонала', { description: err.message });
      return { error: err };
    }
  }, [companyId]);

  const addTimeline = useCallback(async (projectId: string, timeline: Omit<ProjectTimeline, 'id'>) => {
    if (!companyId) return { error: 'No company', data: null };
    try {
      const { data, error } = await supabase.from('project_timeline').insert({
        company_id: companyId,
        project_id: projectId,
        ...timeline,
      }).select().single();
      if (error) throw error;
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return { ...p, timeline: [...p.timeline, { ...timeline, id: data.id }] };
      }));
      return { error: null, data };
    } catch (err: any) {
      toast.error('Ошибка добавления этапа', { description: err.message });
      return { error: err, data: null };
    }
  }, [companyId]);

  const removeTimeline = useCallback(async (projectId: string, timelineId: string) => {
    if (!companyId) return { error: 'No company' };
    try {
      const { error } = await supabase.from('project_timeline').delete().eq('id', timelineId).eq('company_id', companyId);
      if (error) throw error;
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return { ...p, timeline: p.timeline.filter(t => t.id !== timelineId) };
      }));
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка удаления этапа', { description: err.message });
      return { error: err };
    }
  }, [companyId]);

  return {
    projects,
    loading,
    refresh: () => fetchProjects(true),
    updateProject,
    addStaff,
    removeStaff,
    updateStaff,
    addTimeline,
    removeTimeline,
  };
}
