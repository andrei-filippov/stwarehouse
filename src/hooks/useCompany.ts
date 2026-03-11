import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getSubdomain } from '../lib/subdomain';
import { getSelectedCompany, saveSelectedCompany } from '../lib/companyUrl';
import type { Company, CompanyMember, CompanyRole } from '../types/company';

export function useCompany() {
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [myMember, setMyMember] = useState<CompanyMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загрузка компании пользователя
  const loadCompany = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Получаем текущего пользователя
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Проверяем поддомен или сохранённый выбор
      const subdomain = getSubdomain();
      const savedSlug = getSelectedCompany();
      const targetSlug = subdomain || savedSlug;
      
      if (targetSlug) {
        // Ищем компанию по slug
        const { data: companyBySlug, error: slugError } = await supabase
          .from('companies')
          .select('*')
          .eq('slug', targetSlug)
          .single();
        
        if (companyBySlug && !slugError) {
          // Проверяем, есть ли пользователь в этой компании
          const { data: memberData } = await supabase
            .from('company_members')
            .select('*')
            .eq('company_id', companyBySlug.id)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .single();
          
          if (memberData) {
            setCompany(companyBySlug);
            setMyMember(memberData);
            await loadMembers(companyBySlug.id);
            setLoading(false);
            return;
          }
        }
      }

      // Ищем активное членство пользователя (если нет поддомена или компания не найдена)
      const { data: memberData, error: memberError } = await supabase
        .from('company_members')
        .select(`
          *,
          company:company_id (*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('joined_at', { ascending: false })
        .limit(1)
        .single();

      if (memberError) {
        if (memberError.code === 'PGRST116') {
          // Нет активной компании
          setCompany(null);
          setMyMember(null);
          setLoading(false);
          return;
        }
        throw memberError;
      }

      setCompany(memberData.company);
      setMyMember(memberData);

      // Загружаем всех членов компании
      await loadMembers(memberData.company_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки компании');
    } finally {
      setLoading(false);
    }
  }, []);

  // Загрузка членов компании
  const loadMembers = useCallback(async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('company_members')
        .select('*')
        .eq('company_id', companyId)
        .order('joined_at', { ascending: false });

      if (error) throw error;

      // Загружаем данные пользователей отдельно через profiles
      const userIds = (data || []).map(m => m.user_id).filter(Boolean);
      let userData: Record<string, any> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);
        
        if (profiles) {
          profiles.forEach((p: any) => {
            userData[p.id] = p;
          });
        }
      }

      // Преобразуем данные
      const formattedMembers: CompanyMember[] = (data || []).map(m => ({
        ...m,
        user: userData[m.user_id] ? {
          id: m.user_id,
          email: userData[m.user_id].email,
          name: userData[m.user_id].name,
        } : undefined,
      }));

      setMembers(formattedMembers);
    } catch (err) {
      console.error('Error loading members:', err);
    }
  }, []);

  // Создание компании
  const createCompany = useCallback(async (companyData: Partial<Company>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Пользователь не авторизован');

      // Создаём компанию
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert(companyData)
        .select()
        .single();

      if (companyError) throw companyError;

      // Добавляем пользователя как владельца
      const { error: memberError } = await supabase
        .from('company_members')
        .insert({
          company_id: company.id,
          user_id: user.id,
          role: 'owner',
          status: 'active',
        });

      if (memberError) throw memberError;

      await loadCompany();
      return { data: company, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Ошибка создания компании' };
    }
  }, [loadCompany]);

  // Обновление компании
  const updateCompany = useCallback(async (updates: Partial<Company>) => {
    try {
      if (!company) throw new Error('Компания не выбрана');

      const { error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', company.id);

      if (error) throw error;

      await loadCompany();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Ошибка обновления компании' };
    }
  }, [company, loadCompany]);

  // Приглашение сотрудника
  const inviteMember = useCallback(async (email: string, role: CompanyRole, position?: string) => {
    try {
      if (!company) throw new Error('Компания не выбрана');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Пользователь не авторизован');

      // Ищем пользователя по email
      const { data: existingUser, error: userError } = await supabase
        .rpc('get_user_by_email', { email });

      if (userError && userError.code !== 'PGRST116') throw userError;

      // Создаём приглашение
      const { error: inviteError } = await supabase
        .from('company_members')
        .insert({
          company_id: company.id,
          user_id: existingUser?.id || null,
          role,
          position,
          invited_by: user.id,
          status: existingUser ? 'active' : 'pending',
        });

      if (inviteError) throw inviteError;

      await loadMembers(company.id);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Ошибка приглашения' };
    }
  }, [company, loadMembers]);

  // Удаление сотрудника
  const removeMember = useCallback(async (memberId: string) => {
    try {
      if (!company) throw new Error('Компания не выбрана');

      const { error } = await supabase
        .from('company_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      await loadMembers(company.id);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Ошибка удаления' };
    }
  }, [company, loadMembers]);

  // Обновление роли сотрудника
  const updateMemberRole = useCallback(async (memberId: string, role: CompanyRole) => {
    try {
      if (!company) throw new Error('Компания не выбрана');

      const { error } = await supabase
        .from('company_members')
        .update({ role })
        .eq('id', memberId);

      if (error) throw error;

      await loadMembers(company.id);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Ошибка обновления роли' };
    }
  }, [company, loadMembers]);

  // Переключение компании (если у пользователя несколько)
  const switchCompany = useCallback(async (companyId: string) => {
    // В будущем можно сохранять выбор в localStorage
    localStorage.setItem('selected_company_id', companyId);
    await loadCompany();
  }, [loadCompany]);

  // Вычисляемые свойства
  const myRole = myMember?.role || null;
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin' || myRole === 'owner';
  const canManage = isAdmin || isOwner;

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  // Подписка на изменения
  useEffect(() => {
    if (!company) return;

    const channel = supabase
      .channel('company-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'company_members', filter: `company_id=eq.${company.id}` },
        () => loadMembers(company.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company, loadMembers]);

  return {
    company,
    members,
    myMember,
    myRole,
    isOwner,
    isAdmin,
    canManage,
    loading,
    error,
    
    // Действия
    loadCompany,
    createCompany,
    updateCompany,
    inviteMember,
    removeMember,
    updateMemberRole,
    switchCompany,
  };
}
