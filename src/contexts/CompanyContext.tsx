import { createContext, useContext, ReactNode } from 'react';
import { useCompany } from '../hooks/useCompany';
import type { CompanyContextType } from '../types/company';

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

function shouldSkipAutoLoad(): boolean {
  try {
    // Если пользователь явно нажал "Создать компанию" — не загружаем существующую
    if (localStorage.getItem('show_create_company') === '1') return true;
    // Если в URL есть createCompany=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('createCompany') === '1') return true;
  } catch (e) {
    // localStorage недоступен
  }
  return false;
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const skipAutoLoad = shouldSkipAutoLoad();
  const company = useCompany({ skipAutoLoad });

  return (
    <CompanyContext.Provider value={company}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompanyContext() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompanyContext must be used within a CompanyProvider');
  }
  return context;
}
