import { useState, useEffect } from 'react';
import { Building2, Save, Loader2, Mail, Phone, FileText, SearchIcon, Landmark, Plus, Trash2, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { useCompanyContext } from '../contexts/CompanyContext';
import { useCompanyBankAccounts } from '../hooks/useCompanyBankAccounts';
import { Spinner } from './ui/spinner';
import { Badge } from './ui/badge';
import type { Currency } from '../types';

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

const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: 'RUB', label: '₽ Российский рубль' },
  { value: 'USD', label: '$ Доллар США' },
  { value: 'EUR', label: '€ Евро' },
  { value: 'CNY', label: '¥ Китайский юань' },
];

export function CompanySettings() {
  const { company, updateCompany, canManage } = useCompanyContext();
  const { accounts, loading: accountsLoading, addAccount, updateAccount, deleteAccount, setDefaultAccount } = useCompanyBankAccounts(company?.id);
  
  const [activeTab, setActiveTab] = useState<'main' | 'bank'>('main');
  
  // Основные данные компании
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoadingInn, setIsLoadingInn] = useState(false);
  const [innError, setInnError] = useState<string | null>(null);

  // Новый банковский счет
  const [showNewAccountForm, setShowNewAccountForm] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    bank_name: '',
    bik: '',
    account: '',
    corr_account: '',
    currency: 'RUB' as Currency,
    is_default: false,
  });

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

  const handleAddAccount = async () => {
    if (!newAccount.name || !newAccount.bank_name || !newAccount.bik || !newAccount.account) {
      toast.error('Заполните обязательные поля');
      return;
    }
    
    const { error } = await addAccount(newAccount);
    if (!error) {
      setShowNewAccountForm(false);
      setNewAccount({
        name: '',
        bank_name: '',
        bik: '',
        account: '',
        corr_account: '',
        currency: 'RUB',
        is_default: false,
      });
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
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('main')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'main'
                ? 'border-blue-600 text-blue-600'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Основные данные
            </div>
          </button>
          <button
            onClick={() => setActiveTab('bank')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'bank'
                ? 'border-blue-600 text-blue-600'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4" />
              Банковские счета
              {accounts.length > 0 && (
                <Badge variant="secondary" className="ml-1">{accounts.length}</Badge>
              )}
            </div>
          </button>
        </div>
      </div>

      {activeTab === 'main' ? (
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
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-md">
                <Landmark className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Банковские счета</h2>
                <p className="text-sm text-gray-500">Управление расчетными счетами компании</p>
              </div>
            </div>
            {canManage && (
              <Button onClick={() => setShowNewAccountForm(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Добавить счет
              </Button>
            )}
          </div>

          {/* Список счетов */}
          {accountsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="w-8 h-8" />
            </div>
          ) : accounts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Landmark className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">Нет добавленных счетов</p>
                <p className="text-sm text-gray-400">Добавьте первый банковский счет для использования в документах</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {accounts.map((account) => (
                <Card key={account.id} className={account.is_default ? 'border-green-500 border-2' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{account.name}</h3>
                          {account.is_default && (
                            <Badge className="bg-green-100 text-green-700">
                              <Star className="w-3 h-3 mr-1 fill-current" />
                              По умолчанию
                            </Badge>
                          )}
                          <Badge variant="outline">{account.currency}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{account.bank_name}</p>
                        <div className="text-sm space-y-0.5">
                          <p><span className="text-muted-foreground">Р/с:</span> {account.account}</p>
                          <p><span className="text-muted-foreground">БИК:</span> {account.bik}</p>
                          {account.corr_account && (
                            <p><span className="text-muted-foreground">К/с:</span> {account.corr_account}</p>
                          )}
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex gap-2">
                          {!account.is_default && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDefaultAccount(account.id)}
                            >
                              <Star className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => deleteAccount(account.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Форма добавления нового счета */}
          {showNewAccountForm && (
            <Card className="border-dashed border-2">
              <CardHeader>
                <CardTitle className="text-base">Новый банковский счет</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Название счета *</Label>
                    <Input
                      value={newAccount.name}
                      onChange={(e) => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Основной счет Т-Банк"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Валюта</Label>
                    <select
                      className="w-full border rounded-md px-3 py-2 bg-card"
                      value={newAccount.currency}
                      onChange={(e) => setNewAccount(prev => ({ ...prev, currency: e.target.value as Currency }))}
                    >
                      {CURRENCY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Наименование банка *</Label>
                    <Input
                      value={newAccount.bank_name}
                      onChange={(e) => setNewAccount(prev => ({ ...prev, bank_name: e.target.value }))}
                      placeholder="АО ТБАНК"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>БИК *</Label>
                    <Input
                      value={newAccount.bik}
                      onChange={(e) => setNewAccount(prev => ({ ...prev, bik: e.target.value }))}
                      placeholder="044525974"
                      maxLength={9}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Расчетный счет *</Label>
                    <Input
                      value={newAccount.account}
                      onChange={(e) => setNewAccount(prev => ({ ...prev, account: e.target.value }))}
                      placeholder="40802810200005568272"
                      maxLength={20}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Корреспондентский счет</Label>
                    <Input
                      value={newAccount.corr_account}
                      onChange={(e) => setNewAccount(prev => ({ ...prev, corr_account: e.target.value }))}
                      placeholder="30101810145250000974"
                      maxLength={20}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_default"
                    checked={newAccount.is_default}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, is_default: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="is_default" className="cursor-pointer">
                    Использовать по умолчанию
                  </Label>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleAddAccount} className="gap-2">
                    <Save className="w-4 h-4" />
                    Сохранить счет
                  </Button>
                  <Button variant="outline" onClick={() => setShowNewAccountForm(false)}>
                    Отмена
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
