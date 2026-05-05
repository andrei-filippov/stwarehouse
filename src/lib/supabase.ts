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

// Detect if we're using proxy (no WebSocket support)
export const isProxyMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  return supabaseUrl.includes('apigw.yandexcloud.net') || window.location.hostname.includes('yandexcloud.net');
};

// Custom fetch to fix proxy issues:
// 1. Replace apikey header (JWT) with actual anon key
// 2. Remove accept-profile and content-profile headers (CORS issues with API Gateway)
// 3. Force return=minimal for DELETE to avoid 'column created_at does not exist' error
const customFetch = (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const headers = new Headers(init?.headers);
  
  // Fix 1: apikey must be the anon key, not JWT token
  // Supabase JS client sometimes puts JWT in apikey header
  headers.set('apikey', supabaseKey);
  
  // Fix 2: Remove profile headers that cause CORS preflight failures
  // API Gateway doesn't allow these in Access-Control-Allow-Headers
  headers.delete('accept-profile');
  headers.delete('content-profile');
  
  // Fix 3: Force return=minimal for DELETE requests
  // Supabase tries to return deleted row with all columns, but some columns
  // (like created_at) may not exist, causing 400 error
  if (init?.method === 'DELETE') {
    headers.set('Prefer', 'return=minimal');
  }
  
  return fetch(url, {
    ...init,
    headers,
  });
};

// Suppress WebSocket connection errors in proxy mode
if (isProxyMode()) {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const msg = args[0]?.toString?.() || '';
    if (msg.includes('WebSocket') || msg.includes('wss://') || msg.includes('realtime')) {
      return; // Silently ignore WebSocket errors
    }
    originalConsoleError.apply(console, args);
  };
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage,
    storageKey: 'sb-trivdyjfiyxsmrkihqet-auth-token',
  },
  global: {
    fetch: customFetch,
  },
  // Disable realtime when using proxy (API Gateway doesn't support WebSocket)
  realtime: isProxyMode() ? false : undefined,
});

// Safe channel wrapper: returns a no-op channel in proxy mode to prevent WebSocket errors
const noopChannel = {
  on: () => noopChannel,
  subscribe: (callback?: (status: string) => void) => {
    callback?.('CLOSED');
    return noopChannel;
  },
} as any;

export const safeChannel = (name: string) => {
  if (isProxyMode()) {
    return noopChannel;
  }
  return supabase.channel(name);
};

export const getEstimates = async () => {
	const { data, error } = await supabase
		.from('estimates')
		.select('*')
		.order('created_at', { ascending: false });
	return { data, error };
};
