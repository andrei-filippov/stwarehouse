import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ArrowLeft, Edit, Trash2, MapPin, Phone, Mail, Zap, Ruler, Users, Truck, Wifi, Speaker, Lightbulb, Monitor, StickyNote } from 'lucide-react';
import type { VenueDetails } from '../../types/venues';

interface VenueDetailProps {
  venue: VenueDetails;
  onBack: () => void;
  onEdit: (venue: VenueDetails) => void;
  onDelete: (id: string) => Promise<{ error: any }>;
}

export function VenueDetail({ venue, onBack, onEdit, onDelete }: VenueDetailProps) {
  const handleDelete = async () => {
    if (!confirm(`Удалить площадку "${venue.name}"?`)) return;
    await onDelete(venue.id);
    onBack();
  };

  const cableReserve = venue.cable_distance_m ? Math.ceil(venue.cable_distance_m * 1.2) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-2xl font-bold">{venue.name}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(venue)}>
            <Edit className="w-4 h-4 mr-1" />
            Редактировать
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-1" />
            Удалить
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Основное */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Контакты
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {venue.city && <div>{venue.city}</div>}
            {venue.address && <div>{venue.address}</div>}
            {venue.contact_name && (
              <div className="flex items-center gap-2">
                <Users className="w-3 h-3" />
                {venue.contact_name}
              </div>
            )}
            {venue.contact_phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-3 h-3" />
                {venue.contact_phone}
              </div>
            )}
            {venue.contact_email && (
              <div className="flex items-center gap-2">
                <Mail className="w-3 h-3" />
                {venue.contact_email}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Электричество */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              Электричество
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>380В: {venue.has_380v ? 'Да' : 'Нет'}</div>
            {venue.power_capacity_kw && <div>Мощность: {venue.power_capacity_kw} кВт</div>}
            {venue.cable_distance_m && (
              <>
                <div>До щита: {venue.cable_distance_m} м</div>
                {cableReserve && <div className="text-green-600">Запас кабеля: ~{cableReserve} м</div>}
              </>
            )}
            {venue.cable_routing_type && <div>Прокладка: {venue.cable_routing_type}</div>}
            {venue.power_notes && <div className="text-muted-foreground">{venue.power_notes}</div>}
          </CardContent>
        </Card>

        {/* Вместимость */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              Вместимость
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {venue.guest_capacity && <div>Общая: {venue.guest_capacity} чел.</div>}
            {venue.seating_capacity && <div>Сидячие: {venue.seating_capacity}</div>}
            {venue.standing_capacity && <div>Стоячие: {venue.standing_capacity}</div>}
            {venue.dressing_rooms !== undefined && <div>Гримерки: {venue.dressing_rooms}</div>}
          </CardContent>
        </Card>

        {/* Сцена */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Ruler className="w-4 h-4 text-purple-500" />
              Сцена
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(venue.stage_width_m || venue.stage_depth_m || venue.stage_height_m) && (
              <div>
                {venue.stage_width_m && `${venue.stage_width_m} м`}
                {venue.stage_width_m && venue.stage_depth_m && ' × '}
                {venue.stage_depth_m && `${venue.stage_depth_m} м`}
                {venue.stage_height_m && `, высота ${venue.stage_height_m} м`}
              </div>
            )}
            <div>FOH: {venue.has_foh ? 'Да' : 'Нет'}</div>
            <div>Monitor world: {venue.has_monitors ? 'Да' : 'Нет'}</div>
          </CardContent>
        </Card>

        {/* Свет */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-orange-500" />
              Свет / Подвес
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {venue.light_rig_type && <div>Тип: {venue.light_rig_type}</div>}
            {venue.light_rig_height_m && <div>Высота: {venue.light_rig_height_m} м</div>}
            {venue.light_rig_capacity_kg_m && <div>Грузоподъёмность: {venue.light_rig_capacity_kg_m} кг/м</div>}
            {venue.light_rig_description && <div className="text-muted-foreground">{venue.light_rig_description}</div>}
            {venue.light_rig_anchors && <div>Анкера: {venue.light_rig_anchors}</div>}
          </CardContent>
        </Card>

        {/* Звук */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Speaker className="w-4 h-4 text-green-500" />
              Звук
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Встроенная акустика: {venue.has_builtin_sound ? 'Да' : 'Нет'}</div>
            {venue.builtin_sound_description && <div>{venue.builtin_sound_description}</div>}
            {venue.builtin_sound_console && <div>Пульт: {venue.builtin_sound_console}</div>}
            {venue.sound_notes && <div className="text-muted-foreground">{venue.sound_notes}</div>}
          </CardContent>
        </Card>

        {/* Логистика */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-4 h-4 text-red-500" />
              Логистика
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {venue.load_in_info && <div>Заезд: {venue.load_in_info}</div>}
            <div>Погрузочный док: {venue.loading_dock ? 'Да' : 'Нет'}</div>
            <div>Лифт: {venue.elevator ? 'Да' : 'Нет'}</div>
            {venue.elevator_capacity_kg && <div>Грузоподъёмность лифта: {venue.elevator_capacity_kg} кг</div>}
            {venue.door_width_m && <div>Ширина дверей: {venue.door_width_m} м</div>}
            <div>Подъезд фуры: {venue.truck_access ? 'Да' : 'Нет'}</div>
            {venue.parking_info && <div>Парковка: {venue.parking_info}</div>}
          </CardContent>
        </Card>

        {/* Инфраструктура */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wifi className="w-4 h-4 text-cyan-500" />
              Инфраструктура
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Wi-Fi: {venue.has_wifi ? 'Да' : 'Нет'}</div>
            <div>Интернет: {venue.has_internet ? 'Да' : 'Нет'}</div>
            {venue.internet_notes && <div>{venue.internet_notes}</div>}
            {venue.catering && <div>Питание: {venue.catering}</div>}
            {venue.storage_space && <div>Склад: {venue.storage_space}</div>}
          </CardContent>
        </Card>

        {/* Видео */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="w-4 h-4 text-indigo-500" />
              Видео
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Встроенный экран: {venue.has_builtin_video ? 'Да' : 'Нет'}</div>
            {venue.builtin_video_description && <div>{venue.builtin_video_description}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Заметки */}
      {venue.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-gray-500" />
              Заметки
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm whitespace-pre-wrap">{venue.notes}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
