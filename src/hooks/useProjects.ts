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

export interface ProjectChecklist {
  id: string;
  name: string;
  total: number;
  completed: number;
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
  checklists: ProjectChecklist[];
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
      // 1. Загружаем проекты + сметы + площадки
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
          estimates:estimate_id (event_name,event_date,event_start_date,event_end_date,status,total,customer_name),
          venue_details:venue_id (name,city,address,contact_name,contact_phone)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

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
      const estimateIds = projectsData.map((p: any) => p.estimate_id).filter(Boolean);

      // 2. Параллельно загружаем staff, timeline, checklists
      const [staffRes, timelineRes, checklistsRes] = await Promise.all([
        supabase.from('project_staff').select('*').in('project_id', projectIds).eq('company_id', companyId),
        supabase.from('project_timeline').select('*').in('project_id', projectIds).eq('company_id', companyId).order('start_time', { ascending: true }),
        supabase.from('checklists').select('id,project_id,name,total,completed').in('project_id', projectIds).eq('company_id', companyId),
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

      const checklistsByProject: Record<string, ProjectChecklist[]> = {};
      (checklistsRes.data || []).forEach((c: any) => {
        if (!checklistsByProject[c.project_id]) checklistsByProject[c.project_id] = [];
        checklistsByProject[c.project_id].push({
          id: c.id,
          name: c.name,
          total: c.total || 0,
          completed: c.completed || 0,
        });
      });

      const result: ProjectWithDetails[] = (projectsData || []).map((p: any) => {
        const projectStaff = staffByProject[p.id] || [];
        const projectChecklists = checklistsByProject[p.id] || [];
        const totalChecklist = projectChecklists.reduce((sum, c) => sum + c.total, 0);
        const completedChecklist = projectChecklists.reduce((sum, c) => sum + c.completed, 0);

        return {
          id: p.id,
          estimate_id: p.estimate_id,
          venue_id: p.venue_id,
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
          venue_name: p.venue_details?.name,
          venue_city: p.venue_details?.city,
          venue_address: p.venue_details?.address,
          venue_contact_name: p.venue_details?.contact_name,
          venue_contact_phone: p.venue_details?.contact_phone,
          staff: projectStaff,
          staff_count: projectStaff.length,
          timeline: timelineByProject[p.id] || [],
          checklists: projectChecklists,
          checklist_progress: { total: totalChecklist, completed: completedChecklist },
        };
      });

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

      // Обновляем локальный стейт
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
    addTimeline,
    removeTimeline,
  };
}
