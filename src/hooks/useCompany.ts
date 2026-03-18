import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getSubdomain, generateSlug } from '../lib/subdomain';
import { getSelectedCompany, saveSelectedCompany } from '../lib/companyUrl';
import type { Company, CompanyMember, CompanyRole } from '../types/company';
import { isOnline, getCompanyLocal, saveCompanyLocal, getUserLocal } from '../lib/offlineDB';
import { createLogger } from '../lib/logger';

const logger = createLogger('company');

export function useCompany() {
  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [myMember, setMyMember] = useState<CompanyMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);

  // Загрузка компании пользователя
  const loadCompany = useCallback(async () => {
    // Защита от повторных вызовов через ref
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    try {
      setLoading(true);
      setError(null);

      // Если оффлайн — загружаем из кэша
      if (!isOnline()) {
        const cachedCompany = await getCompanyLocal();
        const cachedUser = await getUserLocal();
        
        if (cachedCompany && cachedUser) {
          setCompany(cachedCompany);
          setMyMember({
            id: 'offline',
            user_id: cachedUser.id,
            company_id: cachedCompany.id,
            role: 'manager',
            status: 'active',
            joined_at: new Date().toISOString(),
          });
        }
        
        setLoading(false);
        isLoadingRef.current = false;
        return;
      }

      // Получаем текущего пользователя
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        logger.debug('No user found');
        setLoading(false);
        isLoadingRef.current = false;
        return;
      }
      
      logger.info('Loading company for user:', user.id);

      // Проверяем и принимаем приглашения (только если есть компания)
      try {
        const { data: inviteData, error: inviteError } = await supabase.rpc('accept_company_invitation');
        if (inviteError) {
        logger.debug('No pending invitations or error:', inviteError.message);
        } else if (inviteData?.found) {
        logger.info('Invitation accepted for company:', inviteData.company_id);
        }
      } catch (e) {
        logger.error('Invitation check error:', e);
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
            // Сохраняем для оффлайн
            saveCompanyLocal(companyBySlug);
            await loadMembers(companyBySlug.id);
            setLoading(false);
            return;
          }
        }
      }

      // Ищем активное членство пользователя (если нет поддомена или компания не найдена)
      const { data: memberData, error: memberError } = await supabase
        .from('company_members')
        .select('*, company:company_id(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (memberError) {
        logger.error('Member error:', memberError);
        if (memberError.code === 'PGRST116') {
          // Нет активной компании
        logger.info('No active company found for user');
          setCompany(null);
          setMyMember(null);
          setLoading(false);
          isLoadingRef.current = false;
          return;
        }
        throw memberError;
      }

      if (memberData && memberData.company) {
        logger.info('Found company:', memberData.company?.name);
        setCompany(memberData.company);
        setMyMember(memberData);
        // Сохраняем для оффлайн
        saveCompanyLocal(memberData.company);
        // Загружаем всех членов компании только если есть компания
        await loadMembers(memberData.company_id);
      } else {
        logger.info('No company membership found');
        setCompany(null);
        setMyMember(null);
        setLoading(false);
        isLoadingRef.current = false;
        return;
      }
    } catch (err) {
      logger.error('Error in loadCompany:', err);
      setError(err instanceof Error ? err.message : 'Ошибка загрузки компании');
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
      logger.info('loadCompany finished');
    }
  }, []);

  // Загрузка всех компаний пользователя
  const loadUserCompanies = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('company_members')
        .select(`
          company:company_id (*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (error) throw error;

      const userCompanies = (data || []).map((m: any) => m.company).filter(Boolean);
      setCompanies(userCompanies);
    } catch (err) {
      logger.error('Error loading user companies:', err);
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
      logger.error('Error loading members:', err);
    }
  }, []);

  // Создание компании через RPC (обходит RLS)
  const createCompany = useCallback(async (companyData: Partial<Company>) => {
    try {
      // Генерируем slug если не передан
      let slug = companyData.slug || generateSlug(companyData.name || '');
      
      const { data, error } = await supabase.rpc('create_company_with_owner', {
        p_name: companyData.name,
        p_slug: slug,
        p_email: companyData.email || '',
        p_plan: companyData.plan || 'free',
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      await loadCompany();
      return { data: { id: data.company_id, slug: data.slug, ...companyData }, error: null };
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

  // Приглашение сотрудника через RPC + email
  const inviteMember = useCallback(async (email: string, role: CompanyRole, position?: string) => {
    try {
      if (!company) throw new Error('Компания не выбрана');

      // Создаём приглашение в БД
      const { data, error } = await supabase.rpc('invite_company_member', {
        p_company_id: company.id,
        p_role: role,
        p_email: email,
        p_position: position || null,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Отправляем email через Edge Function
      try {
        // Получаем anon key для авторизации
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        await supabase.functions.invoke('send-invitation-email', {
          headers: {
            'x-api-key': supabaseKey,
          },
          body: {
            email,
            companyName: company.name,
            invitedBy: myMember?.user?.name || 'Администратор',
            role
          }
        });
        logger.info('Invitation email sent successfully');
      } catch (e) {
        logger.warn('Email sending failed (non-critical):', e);
      }

      await loadMembers(company.id);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Ошибка приглашения' };
    }
  }, [company, loadMembers, myMember]);

  // Удаление сотрудника через RPC
  const removeMember = useCallback(async (memberId: string) => {
    try {
      if (!company) throw new Error('Компания не выбрана');

      const { data, error } = await supabase.rpc('delete_company_member', {
        p_member_id: memberId
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await loadMembers(company.id);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Ошибка удаления' };
    }
  }, [company, loadMembers]);

  // Обновление роли сотрудника через RPC
  const updateMemberRole = useCallback(async (memberId: string, role: CompanyRole) => {
    logger.debug('updateMemberRole called:', { memberId, role, companyId: company?.id });
    try {
      if (!company) throw new Error('Компания не выбрана');

      const { data, error } = await supabase.rpc('update_company_member_role', {
        p_member_id: memberId,
        p_role: role
      });
      logger.debug('RPC result:', { data, error });

      if (error) {
        logger.error('RPC error:', error);
        throw error;
      }
      if (data?.error) {
        logger.error('RPC returned error:', data.error);
        throw new Error(data.error);
      }

      await loadMembers(company.id);
      return { error: null };
    } catch (err) {
      logger.error('updateMemberRole catch:', err);
      return { error: err instanceof Error ? err.message : 'Ошибка обновления роли' };
    }
  }, [company, loadMembers]);

  // Переключение компании (если у пользователя несколько)
  const switchCompany = useCallback(async (companyId: string) => {
    // Получаем slug компании перед переключением
    const { data: companyData } = await supabase
      .from('companies')
      .select('slug')
      .eq('id', companyId)
      .single();
    
    if (companyData?.slug) {
      saveSelectedCompany(companyData.slug);
    }
    
    await loadCompany();
  }, [loadCompany]);

  // Вычисляемые свойства
  const myRole = myMember?.role || null;
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin' || myRole === 'owner';
  const canManage = isAdmin || isOwner;

  // Загрузка при монтировании (только один раз)
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    loadCompany();
    loadUserCompanies();
  }, []);

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
    companies,
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
    loadUserCompanies,
    createCompany,
    updateCompany,
    inviteMember,
    removeMember,
    updateMemberRole,
    switchCompany,
  };
}
