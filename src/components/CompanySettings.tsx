import { useState, useEffect } from 'react';
import { Building2, Save, Loader2, Mail, Phone, MapPin, Banknote, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { useCompanyContext } from '../contexts/CompanyContext';

export function CompanySettings() {
  const { company, updateCompany, canManage } = useCompanyContext();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

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

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
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
              <Label>ИНН</Label>
              <Input
                value={formData.inn || ''}
                onChange={(e) => handleChange('inn', e.target.value)}
                disabled={!canManage}
                maxLength={12}
              />
            </div>
            <div className="space-y-2">
              <Label>КПП</Label>
              <Input
                value={formData.kpp || ''}
                onChange={(e) => handleChange('kpp', e.target.value)}
                disabled={!canManage}
                maxLength={9}
              />
            </div>
            <div className="space-y-2">
              <Label>ОГРН</Label>
              <Input
                value={formData.ogrn || ''}
                onChange={(e) => handleChange('ogrn', e.target.value)}
                disabled={!canManage}
                maxLength={15}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Юридический адрес</Label>
            <Input
              value={formData.legal_address || ''}
              onChange={(e) => handleChange('legal_address', e.target.value)}
              disabled={!canManage}
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
