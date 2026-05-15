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

// Concurrency limiter for proxy mode to avoid ERR_INSUFFICIENT_RESOURCES
const MAX_CONCURRENT = 3;
let activeRequests = 0;
const requestQueue: Array<() => void> = [];

function enqueueRequest(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const execute = () => {
      activeRequests++;
      fetch(url, init).then(
        (res) => { activeRequests--; drainQueue(); resolve(res); },
        (err) => { activeRequests--; drainQueue(); reject(err); }
      );
    };
    
    if (activeRequests < MAX_CONCURRENT) {
      execute();
    } else {
      requestQueue.push(execute);
    }
  });
}

function drainQueue() {
  if (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT) {
    const next = requestQueue.shift();
    next?.();
  }
}

// Custom fetch to fix proxy issues:
// 1. Replace apikey header (JWT) with actual anon key
// 2. Remove accept-profile and content-profile headers (CORS issues with API Gateway)
// 3. Force return=minimal for DELETE to avoid 'column created_at does not exist' error
// 4. Concurrency limiter for proxy mode
const customFetch = (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  // Block ALL requests when tab is hidden to prevent background traffic
  if (typeof document !== 'undefined' && document.hidden) {
    return Promise.resolve(new Response(JSON.stringify({ error: 'Tab hidden' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const headers = new Headers(init?.headers);
  
  // Fix 1: apikey must be the anon key, not JWT token
  // Supabase JS client sometimes puts JWT in apikey header
  headers.set('apikey', supabaseKey);
  
  // Fix 2: Remove profile headers that cause CORS preflight failures
  // API Gateway doesn't allow these in Access-Control-Allow-Headers
  headers.delete('accept-profile');
  headers.delete('content-profile');
  
  // Fix 2a: Ensure Accept header is set for API Gateway
  if (!headers.has('accept')) {
    headers.set('accept', 'application/json');
  }
  
  // Fix 3: Force return=minimal for DELETE requests
  // Supabase tries to return deleted row with all columns, but some columns
  // (like created_at) may not exist, causing 400 error
  if (init?.method === 'DELETE') {
    headers.set('Prefer', 'return=minimal');
  }
  
  const doFetch = () => fetch(url, {
    ...init,
    headers,
  }).then(response => {
    // Log proxy errors for debugging
    if (!response.ok && isProxyMode()) {
      const urlStr = url.toString();
      console.warn(`[Supabase] ${response.status} ${response.statusText}: ${init?.method || 'GET'} ${urlStr.substring(0, 120)}`);
    }
    return response;
  });
  
  // Proxy mode: limit concurrent requests to avoid overwhelming Yandex Cloud Function
  if (isProxyMode()) {
    return enqueueRequest(url, { ...init, headers });
  }
  
  return doFetch();
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

// Уникальный storageKey для каждого домена (Vercel vs Yandex)
const getStorageKey = () => {
  if (typeof window === 'undefined') return 'sb-auth-token';
  const hostname = window.location.hostname;
  if (hostname.includes('yandexcloud.net')) {
    return 'sb-yandex-auth-token';
  }
  if (hostname.includes('vercel.app')) {
    return 'sb-vercel-auth-token';
  }
  return 'sb-local-auth-token';
};

// Очистка старого общего токена (миграция)
if (typeof window !== 'undefined') {
  const oldKey = 'sb-trivdyjfiyxsmrkihqet-auth-token';
  const newKey = getStorageKey();
  if (oldKey !== newKey) {
    // Удаляем старый токен чтобы избежать конфликтов между доменами
    localStorage.removeItem(oldKey);
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: false, // Disabled: we handle token refresh manually to avoid background requests
    detectSessionInUrl: true,
    storage: localStorage,
    storageKey: getStorageKey(),
  },
  global: {
    fetch: customFetch,
  },
  // Enable realtime everywhere - on Vercel it works natively
  // On Yandex proxy we use polling fallback in hooks
  realtime: true,
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
