// Компонент-обёртка для Speed Insights с безопасной загрузкой
import type React from 'react';
import { useEffect, useState } from 'react';
import { logger } from '../lib/logger';

export function SpeedInsightsWrapper() {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    // Загружаем только в production и только если это Vercel
    const isVercel = window.location.hostname.includes('vercel.app') || 
                     import.meta.env.VITE_VERCEL_ENV === 'production';
    
    if (!isVercel) return;

    let mounted = true;
    
    import('@vercel/speed-insights/react')
      .then((module) => {
        if (mounted && module.SpeedInsights) {
          setComponent(() => module.SpeedInsights);
        }
      })
      .catch((err) => {
        logger.warn('Speed Insights not loaded:', err);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!Component) return null;
  
  return <Component />;
}
