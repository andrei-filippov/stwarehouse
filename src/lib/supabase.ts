import { createClient } from '@supabase/supabase-js';

// Определяем URL Supabase в зависимости от окружения
function getSupabaseUrl(): string {
  // 1. Если явно задан в env — используем его
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!envUrl) {
    throw new Error('Missing VITE_SUPABASE_URL environment variable');
  }
  
  // 2. Если URL уже указывает на прокси (cloud-apigw.yandexcloud.net) — используем как есть
  if (envUrl.includes('cloud-apigw.yandexcloud.net')) {
    return envUrl;
  }
  
  // 3. Runtime определение: если мы на Yandex Object Storage — используем прокси
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Yandex Object Storage — используем прокси (чтобы обойти блокировку Supabase в РФ)
    if (hostname.includes('yandexcloud.net')) {
      // Заменяем прямой URL Supabase на прокси
      // Прокси URL должен быть задан в VITE_SUPABASE_PROXY_URL
      const proxyUrl = import.meta.env.VITE_SUPABASE_PROXY_URL;
      if (proxyUrl) {
        return proxyUrl;
      }
      // Если прокси не настроен — логируем предупреждение но используем прямой URL
      console.warn('[Supabase] Running on Yandex Object Storage but VITE_SUPABASE_PROXY_URL is not set. Supabase may be blocked in Russia without VPN.');
    }
    
    // Vercel / localhost — используем прямой URL (VPN не нужен)
  }
  
  return envUrl;
}

const supabaseUrl = getSupabaseUrl();
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage,
    storageKey: 'sb-trivdyjfiyxsmrkihqet-auth-token',
  },
});

export const getEstimates = async () => {
	const { data, error } = await supabase
		.from('estimates')
		.select('*')
		.order('created_at', { ascending: false });
	return { data, error };
};
