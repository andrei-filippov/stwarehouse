import { useState, useEffect } from 'react';
import { Building2, Save, Loader2, Mail, Phone, MapPin, FileText, SearchIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { useCompanyContext } from '../contexts/CompanyContext';
import { Spinner } from './ui/spinner';

const DADATA_API_KEY = import.meta.env.VITE_DADATA_API_KEY;

async function fetchCompanyByInn(inn: string): Promise<any> {
  const cleanInn = inn.replace(/\s/g, '');
  
  if (cleanInn.length !== 10 && cleanInn.length !== 12) {
    throw new Error('ИНН должен содержать 10 или 12 цифр');
  }

  if (!DADATA_API_KEY || DADATA_API_KEY === 'your_dadata_api_key_here') {
    throw new Error('API ключ Dadata не настроен');
  }

  try {
    const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${DADATA_API_KEY}`
      },
      body: JSON.stringify({ 
        query: cleanInn,
        branch_type: 'MAIN'
      })
    });

    if (response.status === 401) {
      throw new Error('Неверный API ключ');
    }

    if (!response.ok) {
      throw new Error(`Ошибка API: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.suggestions || data.suggestions.length === 0) {
      throw new Error('Организация с таким ИНН не найдена');
    }

    return data.suggestions[0].data;
  } catch (error: any) {
    if (error.message?.includes('Failed to fetch')) {
      throw new Error('Ошибка сети');
    }
    throw error;
  }
}

export function CompanySettings() {
  const { company, updateCompany, canManage } = useCompanyContext();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoadingInn, setIsLoadingInn] = useState(false);
  const [innError, setInnError] = useState<string | null>(null);

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        inn: company.inn || '',
        kpp: company.kpp || '',
        ogrn: company.ogrn || '',
        legal_address: company.legal_address || '',
        actual_address: company.actual_address || '',
        phone: company.phone || '',
        email: company.email || '',
        website: company.website || '',
        bank_name: company.bank_name || '',
        bank_bik: company.bank_bik || '',
        bank_account: company.bank_account || '',
        bank_corr_account: company.bank_corr_account || '',
      });
      setHasChanges(false);
      setInnError(null);
    }
  }, [company]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleInnChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '').slice(0, 12);
    handleChange('inn', cleanValue);
    setInnError(null);
  };

  const handleInnLookup = async () => {
    if (!formData.inn || formData.inn.length < 10) {
      setInnError('Введите корректный ИНН (10 или 12 цифр)');
      return;
    }

    setIsLoadingInn(true);
    setInnError(null);

    try {
      const companyData = await fetchCompanyByInn(formData.inn);
      
      setFormData(prev => ({
        ...prev,
        name: companyData.name?.full || companyData.name?.short || prev.name,
        kpp: companyData.kpp || prev.kpp,
        ogrn: companyData.ogrn || prev.ogrn,
        legal_address: companyData.address?.value || companyData.address?.unrestricted_value || prev.legal_address,
      }));
      setHasChanges(true);
      toast.success('Данные успешно заполнены');
    } catch (error: any) {
      setInnError(error.message || 'Ошибка при получении данных');
    } finally {
      setIsLoadingInn(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      toast.error('У вас нет прав на редактирование');
      return;
    }

    setSaving(true);
    const { error } = await updateCompany(formData);
    setSaving(false);

    if (error) {
      toast.error('Ошибка сохранения: ' + error);
    } else {
      toast.success('Данные компании обновлены');
      setHasChanges(false);
    }
  };

  if (!company) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Компания не выбрана</p>
        </CardContent>
      </Card>
    );
  }

  const dadataActive = DADATA_API_KEY && DADATA_API_KEY !== 'your_dadata_api_key_here' && DADATA_API_KEY.length > 10;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Настройки компании</h2>
            <p className="text-sm text-gray-500">Редактирование реквизитов и данных</p>
          </div>
        </div>
        {canManage && hasChanges && (
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            Основная информация
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Название компании *</Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                disabled={!canManage}
                placeholder="ООО Ромашка"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                disabled={!canManage}
              />
            </div>
            <div className="space-y-2">
              <Label>Телефон</Label>
              <Input
                value={formData.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                disabled={!canManage}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-500" />
            Юридические реквизиты
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>ИНН</Label>
                {dadataActive ? (
                  <span className="text-xs text-green-500 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    API активен
                  </span>
                ) : (
                  <span className="text-xs text-orange-500 flex items-center gap-1">
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                    API не настроен
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={formData.inn || ''}
                  onChange={(e) => handleInnChange(e.target.value)}
                  disabled={!canManage}
                  maxLength={12}
                  placeholder="1234567890"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleInnLookup}
                  disabled={isLoadingInn || (formData.inn || '').length < 10 || !dadataActive}
                  className="whitespace-nowrap"
                >
                  {isLoadingInn ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    <>
                      <SearchIcon className="w-4 h-4 mr-1 hidden sm:inline" />
                      <span>Заполнить</span>
                    </>
                  )}
                </Button>
              </div>
              {innError && (
                <p className="text-xs text-red-500">{innError}</p>
              )}
              <p className="text-xs text-gray-400">
                {!dadataActive
                  ? '⚠️ Добавьте VITE_DADATA_API_KEY в Environment Variables' 
                  : 'Введите ИНН и нажмите "Заполнить" для автозаполнения данных'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>КПП</Label>
              <Input
                value={formData.kpp || ''}
                onChange={(e) => handleChange('kpp', e.target.value)}
                disabled={!canManage}
                maxLength={9}
                placeholder="123456789"
              />
            </div>
            <div className="space-y-2">
              <Label>ОГРН</Label>
              <Input
                value={formData.ogrn || ''}
                onChange={(e) => handleChange('ogrn', e.target.value)}
                disabled={!canManage}
                maxLength={15}
                placeholder="1234567890123"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Юридический адрес</Label>
            <Input
              value={formData.legal_address || ''}
              onChange={(e) => handleChange('legal_address', e.target.value)}
              disabled={!canManage}
              placeholder="г. Москва, ул. Примерная, д. 1"
            />
          </div>
        </CardContent>
      </Card>

      {!canManage && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          У вас нет прав на редактирование данных компании.
        </div>
      )}
    </form>
  );
}
