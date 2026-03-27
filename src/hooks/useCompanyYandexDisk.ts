import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface YandexDiskSettings {
  token: string;
  folder_path: string;
  connected_by?: string;
  connected_at?: string;
}

export function useCompanyYandexDisk(companyId: string | undefined) {
  const [settings, setSettings] = useState<YandexDiskSettings | null>(null);
  const [loading, setLoading] = useState(false);

  // Загрузка настроек из БД
  const fetchSettings = useCallback(async () => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('company_yandex_disk')
        .select('token, folder_path, connected_by, connected_at')
        .eq('company_id', companyId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Нет записи - это нормально
          setSettings(null);
        } else {
          console.error('Error fetching yandex disk settings:', error);
        }
      } else if (data) {
        setSettings(data);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Сохранение токена (только для владельцев/админов)
  const saveToken = useCallback(async (token: string, folderPath: string = '/stwarehouse') => {
    if (!companyId) return { error: new Error('No company') };

    try {
      const { error } = await supabase
        .from('company_yandex_disk')
        .upsert({
          company_id: companyId,
          token,
          folder_path: folderPath,
          connected_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'company_id'
        });

      if (error) throw error;

      await fetchSettings();
      toast.success('Яндекс Диск подключен');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка сохранения', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchSettings]);

  // Отключение Яндекс Диска
  const disconnect = useCallback(async () => {
    if (!companyId) return { error: new Error('No company') };

    try {
      const { error } = await supabase
        .from('company_yandex_disk')
        .delete()
        .eq('company_id', companyId);

      if (error) throw error;

      setSettings(null);
      toast.success('Яндекс Диск отключен');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка отключения', { description: err.message });
      return { error: err };
    }
  }, [companyId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    token: settings?.token || null,
    folderPath: settings?.folder_path || '/stwarehouse',
    isConnected: !!settings?.token,
    loading,
    saveToken,
    disconnect,
    refresh: fetchSettings
  };
}
