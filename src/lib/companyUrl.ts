// Упрощённый подход для бесплатного хостинга
// Используем path (/c/company-slug) вместо поддоменов

export function getCompanyPath(slug: string): string {
  return `/c/${slug}`;
}

export function getSlugFromPath(): string | null {
  const path = window.location.pathname;
  const match = path.match(/^\/c\/([^\/]+)/);
  return match ? match[1] : null;
}

// Сохранение выбранной компании
export function saveSelectedCompany(slug: string) {
  localStorage.setItem('selected_company_slug', slug);
}

export function getSelectedCompany(): string | null {
  return localStorage.getItem('selected_company_slug');
}

export function clearSelectedCompany() {
  localStorage.removeItem('selected_company_slug');
}
