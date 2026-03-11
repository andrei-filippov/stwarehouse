import { useState, useEffect } from 'react';
import { Building2, Save, Loader2, Mail, Phone, MapPin, Banknote, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import type { Company } from '../types';

interface CompanySettingsProps {
  company: Company | null;
  onUpdate: (updates: Partial<Company>) => Promise<{ error?: string }>;
  canEdit: boolean;
}

export function CompanySettings({ company, onUpdate, canEdit }: CompanySettingsProps) {
  const [formData, setFormData] = useState<Partial<Company>>({});
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form data when company changes
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
    }
  }, [company]);

  const handleChange = (field: keyof Company, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error('У вас нет прав на редактирование');
      return;
    }

    setSaving(true);
    const { error } = await onUpdate(formData);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Настройки компании</h2>
            <p className="text-sm text-gray-500">Редактирование реквизитов и данных</p>
          </div>
        </div>
        {canEdit && hasChanges && (
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </Button>
        )}
      </div>

      {/* Main Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            Основная информация
          </CardTitle>
          <CardDescription>Название и контактные данные</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">
                Название компании <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                disabled={!canEdit}
                placeholder="ООО Ромашка"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                disabled={!canEdit}
                placeholder="info@company.ru"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                Телефон
              </Label>
              <Input
                id="phone"
                value={formData.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                disabled={!canEdit}
                placeholder="+7 (999) 123-45-67"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="website">Веб-сайт</Label>
              <Input
                id="website"
                value={formData.website || ''}
                onChange={(e) => handleChange('website', e.target.value)}
                disabled={!canEdit}
                placeholder="https://company.ru"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-500" />
            Юридические реквизиты
          </CardTitle>
          <CardDescription>ИНН, КПП, ОГРН и адреса</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="inn">ИНН</Label>
              <Input
                id="inn"
                value={formData.inn || ''}
                onChange={(e) => handleChange('inn', e.target.value)}
                disabled={!canEdit}
                placeholder="1234567890"
                maxLength={12}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kpp">КПП</Label>
              <Input
                id="kpp"
                value={formData.kpp || ''}
                onChange={(e) => handleChange('kpp', e.target.value)}
                disabled={!canEdit}
                placeholder="123456789"
                maxLength={9}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ogrn">ОГРН</Label>
              <Input
                id="ogrn"
                value={formData.ogrn || ''}
                onChange={(e) => handleChange('ogrn', e.target.value)}
                disabled={!canEdit}
                placeholder="1234567890123"
                maxLength={15}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="legal_address" className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Юридический адрес
            </Label>
            <Input
              id="legal_address"
              value={formData.legal_address || ''}
              onChange={(e) => handleChange('legal_address', e.target.value)}
              disabled={!canEdit}
              placeholder="123456, г. Москва, ул. Примерная, д. 1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="actual_address" className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Фактический адрес
            </Label>
            <Input
              id="actual_address"
              value={formData.actual_address || ''}
              onChange={(e) => handleChange('actual_address', e.target.value)}
              disabled={!canEdit}
              placeholder="123456, г. Москва, ул. Примерная, д. 1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Bank Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Banknote className="w-5 h-5 text-amber-500" />
            Банковские реквизиты
          </CardTitle>
          <CardDescription>Данные для выставления счетов</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bank_name">Название банка</Label>
              <Input
                id="bank_name"
                value={formData.bank_name || ''}
                onChange={(e) => handleChange('bank_name', e.target.value)}
                disabled={!canEdit}
                placeholder="ПАО Сбербанк"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank_bik">БИК</Label>
              <Input
                id="bank_bik"
                value={formData.bank_bik || ''}
                onChange={(e) => handleChange('bank_bik', e.target.value)}
                disabled={!canEdit}
                placeholder="044525225"
                maxLength={9}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank_corr_account">Корреспондентский счёт</Label>
              <Input
                id="bank_corr_account"
                value={formData.bank_corr_account || ''}
                onChange={(e) => handleChange('bank_corr_account', e.target.value)}
                disabled={!canEdit}
                placeholder="30101810400000000225"
                maxLength={20}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bank_account">Расчётный счёт</Label>
              <Input
                id="bank_account"
                value={formData.bank_account || ''}
                onChange={(e) => handleChange('bank_account', e.target.value)}
                disabled={!canEdit}
                placeholder="40702810100000001234"
                maxLength={20}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button (mobile) */}
      {canEdit && hasChanges && (
        <div className="flex justify-end md:hidden">
          <Button type="submit" disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить изменения
          </Button>
        </div>
      )}

      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          У вас нет прав на редактирование данных компании. Обратитесь к администратору.
        </div>
      )}
    </form>
  );
}
