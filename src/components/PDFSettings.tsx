import { useState } from 'react';
import { Save, Image, User, FileSignature, Stamp, Building2, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useCompanyContext } from '../contexts/CompanyContext';
import type { PDFSettings as PDFSettingsType } from '../types';

interface PDFSettingsProps {
  settings: PDFSettingsType;
  onSave: (settings: PDFSettingsType) => void;
}

export function PDFSettings({ settings, onSave }: PDFSettingsProps) {
  const { company } = useCompanyContext();
  const [formData, setFormData] = useState(settings);

  const handleImageUpload = (field: 'logo' | 'signature' | 'stamp', file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, [field]: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Настройки PDF</h2>
            <p className="text-sm text-gray-500">Реквизиты компании и подписи для документов</p>
          </div>
        </div>
      </div>

      {/* Company Requisites (read-only from admin) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            Реквизиты компании
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label className="text-muted-foreground">Название компании</Label>
              <div className="p-2 bg-muted rounded-md text-foreground">
                {company?.name || 'Не указано'}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">ИНН</Label>
              <div className="p-2 bg-muted rounded-md text-foreground">
                {company?.inn || 'Не указано'}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">КПП</Label>
              <div className="p-2 bg-muted rounded-md text-foreground">
                {company?.kpp || 'Не указано'}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">ОГРН</Label>
              <div className="p-2 bg-muted rounded-md text-foreground">
                {company?.ogrn || 'Не указано'}
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-muted-foreground">Юридический адрес</Label>
              <div className="p-2 bg-muted rounded-md text-foreground">
                {company?.legal_address || 'Не указано'}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Реквизиты редактируются в разделе <strong>Админ → Реквизиты</strong>
          </p>
        </CardContent>
      </Card>

      {/* PDF-specific settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Image className="w-5 h-5 text-purple-500" />
            Оформление документов
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              Логотип компании
            </Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleImageUpload('logo', e.target.files[0])}
            />
            {formData.logo && (
              <img src={formData.logo} alt="Logo" className="h-16 object-contain mt-2" />
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Должность подписанта
              </Label>
              <Input
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="Генеральный директор"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileSignature className="w-4 h-4" />
                ФИО подписанта
              </Label>
              <Input
                value={formData.personName}
                onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
                placeholder="Иванов И.И."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileSignature className="w-4 h-4" />
              Подпись (изображение)
            </Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleImageUpload('signature', e.target.files[0])}
            />
            {formData.signature && (
              <img src={formData.signature} alt="Signature" className="h-16 object-contain mt-2" />
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Stamp className="w-4 h-4" />
              Печать (изображение)
            </Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleImageUpload('stamp', e.target.files[0])}
            />
            {formData.stamp && (
              <img src={formData.stamp} alt="Stamp" className="h-16 object-contain mt-2" />
            )}
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => onSave(formData)} className="w-full gap-2">
        <Save className="w-4 h-4" />
        Сохранить настройки PDF
      </Button>
    </div>
  );
}

export default PDFSettings;
