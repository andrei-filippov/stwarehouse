import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '../types';
import { fetchUserPermissions, type UserPermissions } from '../lib/permissions';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Получаем текущую сессию
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Auth session error:', error);
        if (error.message?.includes('refresh_token') || error.message?.includes('Refresh Token')) {
          supabase.auth.signOut();
        }
      }
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Подписываемся на изменения авторизации
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully');
      }
      
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setUser(null);
        setProfile(null);
        setPermissions(null);
        setLoading(false);
        return;
      }

      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setPermissions(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Profile fetch error:', error);
      } else if (data) {
        setProfile(data as Profile);
        // Загружаем права пользователя
        const userPerms = await fetchUserPermissions(userId);
        setPermissions(userPerms);
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  // Функция для обновления прав (для админ-панели)
  const refreshPermissions = async () => {
    if (user?.id) {
      const userPerms = await fetchUserPermissions(user.id);
      setPermissions(userPerms);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } catch (err) {
      console.error('Sign in error:', err);
      return { error: err as Error };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: { name }
        }
      });
      
      if (!error && data.user) {
        // Создаем профиль
        await supabase.from('profiles').insert({
          id: data.user.id,
          name,
          role: 'manager'
        });
        // Права создадутся автоматически через триггер
      }
      
      return { error };
    } catch (err) {
      console.error('Sign up error:', err);
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
      console.error('Sign out error:', err);
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
    refreshPermissions,
  };
}
