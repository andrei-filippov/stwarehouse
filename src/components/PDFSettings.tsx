import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import type { PDFSettings as PDFSettingsType } from '../types';

interface PDFSettingsProps {
  settings: PDFSettingsType;
  onSave: (settings: PDFSettingsType) => void;
}

export function PDFSettings({ settings, onSave }: PDFSettingsProps) {
  const [formData, setFormData] = useState(settings);

  const handleImageUpload = (field: 'logo' | 'signature' | 'stamp', file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, [field]: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Настройки PDF</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Логотип компании</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleImageUpload('logo', e.target.files[0])}
          />
          {formData.logo && (
            <img src={formData.logo} alt="Logo" className="h-16 object-contain" />
          )}
        </div>

        <div className="space-y-2">
          <Label>Название компании</Label>
          <Input
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Реквизиты компании</Label>
          <Input
            value={formData.companyDetails}
            onChange={(e) => setFormData({ ...formData, companyDetails: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Должность подписанта</Label>
          <Input
            value={formData.position}
            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>ФИО подписанта</Label>
          <Input
            value={formData.personName}
            onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Подпись</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleImageUpload('signature', e.target.files[0])}
          />
          {formData.signature && (
            <img src={formData.signature} alt="Signature" className="h-16 object-contain" />
          )}
        </div>

        <div className="space-y-2">
          <Label>Печать</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleImageUpload('stamp', e.target.files[0])}
          />
          {formData.stamp && (
            <img src={formData.stamp} alt="Stamp" className="h-16 object-contain" />
          )}
        </div>

        <Button onClick={() => onSave(formData)} className="w-full">
          Сохранить настройки
        </Button>
      </CardContent>
    </Card>
  );
}