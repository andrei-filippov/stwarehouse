import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '../types';
import type { UserPermission } from '../lib/permissions';
import { isOnline, getUserLocal, getProfileLocal, saveUserLocal, saveProfileLocal } from '../lib/offlineDB';
import { createLogger } from '../lib/logger';

const logger = createLogger('auth');

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Если оффлайн — загружаем из локального кэша
    if (!isOnline()) {
      loadOfflineUser();
      return;
    }

    // Получаем текущую сессию
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        logger.error('Auth session error:', error);
        if (error.message?.includes('refresh_token') || error.message?.includes('Refresh Token')) {
          supabase.auth.signOut();
        }
      }
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        // Сохраняем для оффлайн
        saveUserLocal(session.user);
      } else {
        setLoading(false);
      }
    });

    // Подписываемся на изменения авторизации
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Пропускаем INITIAL_SESSION если уже есть пользователь (избегаем дублирования)
      if (event === 'INITIAL_SESSION' && user) {
        return;
      }
      
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Загрузка пользователя из оффлайн-кэша
  const loadOfflineUser = async () => {
    try {
      const cachedUser = await getUserLocal();
      const cachedProfile = await getProfileLocal();
      
      if (cachedUser) {
        setUser(cachedUser);
        if (cachedProfile) {
          setProfile(cachedProfile);
        }
      }
    } catch (e) {
      console.error('Error loading offline user:', e);
    } finally {
      setLoading(false);
    }
  };

  // Ref для отслеживания загрузки профиля
  const profileLoadingRef = { current: false };
  
  const fetchProfile = async (userId: string) => {
    // Предотвращаем параллельные запросы
    if (profileLoadingRef.current) return;
    profileLoadingRef.current = true;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        logger.error('Profile fetch error:', error);
      } else if (data) {
        setProfile(data as Profile);
        // Сохраняем для оффлайн
        saveProfileLocal(data);
        // Загружаем кастомные разрешения
        await fetchPermissions(userId);
      }
    } catch (err) {
      logger.error('Unexpected error fetching profile:', err);
    } finally {
      profileLoadingRef.current = false;
      setLoading(false);
    }
  };

  const fetchPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Permissions fetch error:', error);
      } else {
        logger.debug('Permissions loaded:', data);
        setPermissions(data as UserPermission[]);
      }
    } catch (err) {
      logger.error('Unexpected error fetching permissions:', err);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      logger.debug('Signing in with:', { email: email.trim(), passwordLength: password?.length });
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password 
      });
      
      if (error) {
        logger.error('Sign in error details:', error);
        // Provide user-friendly error messages
        let message = error.message;
        if (error.message.includes('Invalid login')) {
          message = 'Неверный email или пароль';
        } else if (error.message.includes('Email not confirmed')) {
          message = 'Email не подтверждён. Проверьте почту';
        }
        return { error: { ...error, message } };
      }
      
      logger.info('Sign in successful:', data.user?.id);
      return { error: null };
    } catch (err) {
      logger.error('Sign in unexpected error:', err);
      return { error: err as Error };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: { name } // Profile will be created by database trigger
        }
      });
      
      return { error };
    } catch (err) {
      logger.error('Sign up error:', err);
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setPermissions(null);
    } catch (err) {
      logger.error('Sign out error:', err);
    }
  };

  return {
    user,
    profile,
    permissions,
    loading,
    signIn,
    signUp,
    signOut,
  };
}
