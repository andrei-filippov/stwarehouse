// Определение поддомена и компании

export function getSubdomain(): string | null {
  if (typeof window === 'undefined') return null;
  
  const hostname = window.location.hostname;
  
  // Локальная разработка
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }
  
  // Vercel preview deployments
  if (hostname.includes('vercel.app')) {
    // company-slug--project-name.vercel.app
    const match = hostname.match(/^([^-]+)--/);
    return match ? match[1] : null;
  }
  
  // Кастомный домен: company.stwarehouse.ru
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    // company.stwarehouse.ru → company
    return parts[0];
  }
  
  return null;
}

export function getCompanyUrl(subdomain: string): string {
  const hostname = window.location.hostname;
  
  if (hostname.includes('vercel.app')) {
    // company-slug--project-name.vercel.app
    const projectName = hostname.split('--')[1] || hostname;
    return `${subdomain}--${projectName}`;
  }
  
  // Кастомный домен
  const domain = hostname.split('.').slice(1).join('.');
  return `${subdomain}.${domain}`;
}

// Генерация slug из названия компании
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/g, '') // убираем спецсимволы
    .replace(/\s+/g, '-') // пробелы → дефисы
    .replace(/-+/g, '-') // множественные дефисы → один
    .substring(0, 30); // максимум 30 символов
}
