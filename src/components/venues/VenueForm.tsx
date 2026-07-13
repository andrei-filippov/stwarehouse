import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
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
    cable_path_description: venue?.cable_path_description || '',
    guest_capacity: venue?.guest_capacity || undefined,
    seating_capacity: venue?.seating_capacity || undefined,
    standing_capacity: venue?.standing_capacity || undefined,
    load_in_info: venue?.load_in_info || '',
    loading_dock: venue?.loading_dock || false,
    elevator: venue?.elevator || false,
    elevator_capacity_kg: venue?.elevator_capacity_kg || undefined,
    door_width_m: venue?.door_width_m || undefined,
    parking_info: venue?.parking_info || '',
    truck_access: venue?.truck_access || false,
    stage_width_m: venue?.stage_width_m || undefined,
    stage_depth_m: venue?.stage_depth_m || undefined,
    stage_height_m: venue?.stage_height_m || undefined,
    has_foh: venue?.has_foh || false,
    has_monitors: venue?.has_monitors || false,
    dressing_rooms: venue?.dressing_rooms || undefined,
    light_rig_type: venue?.light_rig_type || undefined,
    light_rig_height_m: venue?.light_rig_height_m || undefined,
    light_rig_capacity_kg_m: venue?.light_rig_capacity_kg_m || undefined,
    light_rig_description: venue?.light_rig_description || '',
    light_rig_anchors: venue?.light_rig_anchors || '',
    light_rig_access: venue?.light_rig_access || '',
    has_builtin_sound: venue?.has_builtin_sound || false,
    builtin_sound_description: venue?.builtin_sound_description || '',
    builtin_sound_console: venue?.builtin_sound_console || '',
    sound_notes: venue?.sound_notes || '',
    has_builtin_video: venue?.has_builtin_video || false,
    builtin_video_description: venue?.builtin_video_description || '',
    has_wifi: venue?.has_wifi || false,
    has_internet: venue?.has_internet || false,
    internet_notes: venue?.internet_notes || '',
    catering: venue?.catering || '',
    storage_space: venue?.storage_space || '',
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{venue ? 'Редактировать площадку' : 'Новая площадка'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="main">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="main">Основное</TabsTrigger>
              <TabsTrigger value="electricity">Электричество</TabsTrigger>
              <TabsTrigger value="stage">Сцена / Свет</TabsTrigger>
              <TabsTrigger value="logistics">Логистика</TabsTrigger>
              <TabsTrigger value="notes">Заметки</TabsTrigger>
            </TabsList>

            <TabsContent value="main" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Название *</Label>
                  <Input value={formData.name} onChange={e => handleChange('name', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Город</Label>
                  <Input value={formData.city || ''} onChange={e => handleChange('city', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Адрес</Label>
                <Input value={formData.address || ''} onChange={e => handleChange('address', e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Контактное лицо</Label>
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
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Вместимость (чел.)</Label>
                  <Input type="number" value={formData.guest_capacity || ''} onChange={e => handleChange('guest_capacity', Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Сидячие</Label>
                  <Input type="number" value={formData.seating_capacity || ''} onChange={e => handleChange('seating_capacity', Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Стоячие</Label>
                  <Input type="number" value={formData.standing_capacity || ''} onChange={e => handleChange('standing_capacity', Number(e.target.value))} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="electricity" className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch checked={formData.has_380v} onCheckedChange={v => handleChange('has_380v', v)} />
                <Label>Есть 380В</Label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Мощность (кВт)</Label>
                  <Input type="number" value={formData.power_capacity_kw || ''} onChange={e => handleChange('power_capacity_kw', Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Расстояние до щита (м)</Label>
                  <Input type="number" step="0.1" value={formData.cable_distance_m || ''} onChange={e => handleChange('cable_distance_m', Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Тип прокладки кабеля</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={formData.cable_routing_type || ''}
                  onChange={e => handleChange('cable_routing_type', e.target.value || undefined)}
                >
                  <option value="">Не выбрано</option>
                  <option value="открытая">Открытая</option>
                  <option value="закрытая">Закрытая</option>
                  <option value="временная">Временная</option>
                  <option value="неизвестно">Неизвестно</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Описание пути кабеля</Label>
                <Textarea value={formData.cable_path_description || ''} onChange={e => handleChange('cable_path_description', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Примечания по электричеству</Label>
                <Textarea value={formData.power_notes || ''} onChange={e => handleChange('power_notes', e.target.value)} />
              </div>
            </TabsContent>

            <TabsContent value="stage" className="space-y-4">
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
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={formData.has_foh} onCheckedChange={v => handleChange('has_foh', v)} />
                  <Label>FOH-позиция</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={formData.has_monitors} onCheckedChange={v => handleChange('has_monitors', v)} />
                  <Label>Monitor world</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Гримерки (шт.)</Label>
                <Input type="number" value={formData.dressing_rooms || ''} onChange={e => handleChange('dressing_rooms', Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Тип подвеса света</Label>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Высота подвеса (м)</Label>
                  <Input type="number" step="0.01" value={formData.light_rig_height_m || ''} onChange={e => handleChange('light_rig_height_m', Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Грузоподъёмность (кг/м)</Label>
                  <Input type="number" step="0.1" value={formData.light_rig_capacity_kg_m || ''} onChange={e => handleChange('light_rig_capacity_kg_m', Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Описание подвеса</Label>
                <Textarea value={formData.light_rig_description || ''} onChange={e => handleChange('light_rig_description', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Анкера / крепления</Label>
                <Textarea value={formData.light_rig_anchors || ''} onChange={e => handleChange('light_rig_anchors', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Доступ к подвесу</Label>
                <Textarea value={formData.light_rig_access || ''} onChange={e => handleChange('light_rig_access', e.target.value)} />
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={formData.has_builtin_sound} onCheckedChange={v => handleChange('has_builtin_sound', v)} />
                  <Label>Встроенная акустика</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={formData.has_builtin_video} onCheckedChange={v => handleChange('has_builtin_video', v)} />
                  <Label>Встроенный видеоэкран</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Описание акустики</Label>
                <Textarea value={formData.builtin_sound_description || ''} onChange={e => handleChange('builtin_sound_description', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Пульт в FOH</Label>
                <Input value={formData.builtin_sound_console || ''} onChange={e => handleChange('builtin_sound_console', e.target.value)} />
              </div>
            </TabsContent>

            <TabsContent value="logistics" className="space-y-4">
              <div className="space-y-2">
                <Label>Время заезда / условия</Label>
                <Textarea value={formData.load_in_info || ''} onChange={e => handleChange('load_in_info', e.target.value)} />
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={formData.loading_dock} onCheckedChange={v => handleChange('loading_dock', v)} />
                  <Label>Погрузочный док</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={formData.elevator} onCheckedChange={v => handleChange('elevator', v)} />
                  <Label>Грузовой лифт</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={formData.truck_access} onCheckedChange={v => handleChange('truck_access', v)} />
                  <Label>Подъезд фуры</Label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Грузоподъёмность лифта (кг)</Label>
                  <Input type="number" value={formData.elevator_capacity_kg || ''} onChange={e => handleChange('elevator_capacity_kg', Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Ширина дверей (м)</Label>
                  <Input type="number" step="0.1" value={formData.door_width_m || ''} onChange={e => handleChange('door_width_m', Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Парковка</Label>
                <Textarea value={formData.parking_info || ''} onChange={e => handleChange('parking_info', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Питание / кейтеринг</Label>
                <Textarea value={formData.catering || ''} onChange={e => handleChange('catering', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Складские помещения</Label>
                <Textarea value={formData.storage_space || ''} onChange={e => handleChange('storage_space', e.target.value)} />
              </div>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={formData.has_wifi} onCheckedChange={v => handleChange('has_wifi', v)} />
                  <Label>Wi-Fi</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={formData.has_internet} onCheckedChange={v => handleChange('has_internet', v)} />
                  <Label>Интернет</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Примечания по сети</Label>
                <Textarea value={formData.internet_notes || ''} onChange={e => handleChange('internet_notes', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Заметки</Label>
                <Textarea value={formData.notes || ''} onChange={e => handleChange('notes', e.target.value)} rows={6} />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>Отмена</Button>
            <Button type="submit">{venue ? 'Сохранить' : 'Создать'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
