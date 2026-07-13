import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import type { VenueDetails } from '../../types/venues';

interface VenueFormProps {
  venue: VenueDetails | null;
  onSave: (venue: Partial<VenueDetails>) => void;
  onCancel: () => void;
}

export function VenueForm({ venue, onSave, onCancel }: VenueFormProps) {
  const [formData, setFormData] = useState<Partial<VenueDetails>>({
    name: venue?.name || '',
    address: venue?.address || '',
    city: venue?.city || '',
    contact_name: venue?.contact_name || '',
    contact_phone: venue?.contact_phone || '',
    contact_email: venue?.contact_email || '',
    has_380v: venue?.has_380v || false,
    power_capacity_kw: venue?.power_capacity_kw || undefined,
    power_notes: venue?.power_notes || '',
    cable_distance_m: venue?.cable_distance_m || undefined,
    cable_routing_type: venue?.cable_routing_type || undefined,
    guest_capacity: venue?.guest_capacity || undefined,
    stage_width_m: venue?.stage_width_m || undefined,
    stage_depth_m: venue?.stage_depth_m || undefined,
    stage_height_m: venue?.stage_height_m || undefined,
    has_foh: venue?.has_foh || false,
    has_monitors: venue?.has_monitors || false,
    dressing_rooms: venue?.dressing_rooms || undefined,
    light_rig_type: venue?.light_rig_type || undefined,
    light_rig_height_m: venue?.light_rig_height_m || undefined,
    has_builtin_sound: venue?.has_builtin_sound || false,
    sound_notes: venue?.sound_notes || '',
    has_wifi: venue?.has_wifi || false,
    notes: venue?.notes || '',
  });

  const handleChange = (field: keyof VenueDetails, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;
    onSave(formData);
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{venue ? 'Редактировать площадку' : 'Новая площадка'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Название *</Label>
            <Input value={formData.name} onChange={e => handleChange('name', e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Город</Label>
              <Input value={formData.city || ''} onChange={e => handleChange('city', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Адрес</Label>
              <Input value={formData.address || ''} onChange={e => handleChange('address', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Контакт</Label>
              <Input value={formData.contact_name || ''} onChange={e => handleChange('contact_name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Телефон</Label>
              <Input value={formData.contact_phone || ''} onChange={e => handleChange('contact_phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={formData.contact_email || ''} onChange={e => handleChange('contact_email', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Вместимость</Label>
              <Input type="number" value={formData.guest_capacity || ''} onChange={e => handleChange('guest_capacity', Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Гримерки</Label>
              <Input type="number" value={formData.dressing_rooms || ''} onChange={e => handleChange('dressing_rooms', Number(e.target.value))} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={formData.has_380v} onCheckedChange={v => handleChange('has_380v', v)} />
              <Label>380В</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formData.has_foh} onCheckedChange={v => handleChange('has_foh', v)} />
              <Label>FOH</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formData.has_monitors} onCheckedChange={v => handleChange('has_monitors', v)} />
              <Label>Monitors</Label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Мощность (кВт)</Label>
              <Input type="number" value={formData.power_capacity_kw || ''} onChange={e => handleChange('power_capacity_kw', Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>До щита (м)</Label>
              <Input type="number" step="0.1" value={formData.cable_distance_m || ''} onChange={e => handleChange('cable_distance_m', Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Ширина сцены (м)</Label>
              <Input type="number" step="0.01" value={formData.stage_width_m || ''} onChange={e => handleChange('stage_width_m', Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Глубина сцены (м)</Label>
              <Input type="number" step="0.01" value={formData.stage_depth_m || ''} onChange={e => handleChange('stage_depth_m', Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Высота сцены (м)</Label>
              <Input type="number" step="0.01" value={formData.stage_height_m || ''} onChange={e => handleChange('stage_height_m', Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Тип подвеса</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={formData.light_rig_type || ''}
              onChange={e => handleChange('light_rig_type', e.target.value || undefined)}
            >
              <option value="">Не выбрано</option>
              <option value="ферма">Ферма</option>
              <option value="штанкет">Штанкет</option>
              <option value="точечные анкера">Точечные анкера</option>
              <option value="стойки">Стойки</option>
              <option value="невозможно">Подвес невозможен</option>
              <option value="встроенный">Встроенный свет</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Высота подвеса (м)</Label>
            <Input type="number" step="0.01" value={formData.light_rig_height_m || ''} onChange={e => handleChange('light_rig_height_m', Number(e.target.value))} />
          </div>

          <div className="space-y-2">
            <Label>Заметки</Label>
            <Textarea value={formData.notes || ''} onChange={e => handleChange('notes', e.target.value)} rows={3} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>Отмена</Button>
            <Button type="submit">{venue ? 'Сохранить' : 'Создать'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
