export type VenueDetails = {
  id: string;
  company_id: string;
  
  // Основное
  name: string;
  address?: string;
  city?: string;
  
  // Контакты
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  
  // Электричество
  has_380v?: boolean;
  power_capacity_kw?: number;
  power_notes?: string;
  
  // Кабельная трасса
  cable_distance_m?: number;
  cable_routing_type?: 'открытая' | 'закрытая' | 'временная' | 'неизвестно';
  cable_path_description?: string;
  cable_interference?: string;
  cable_mounting?: string;
  
  // Вместимость
  guest_capacity?: number;
  seating_capacity?: number;
  standing_capacity?: number;
  
  // Логистика
  load_in_info?: string;
  loading_dock?: boolean;
  elevator?: boolean;
  elevator_capacity_kg?: number;
  door_width_m?: number;
  parking_info?: string;
  truck_access?: boolean;
  
  // Сцена
  stage_width_m?: number;
  stage_depth_m?: number;
  stage_height_m?: number;
  has_foh?: boolean;
  has_monitors?: boolean;
  dressing_rooms?: number;
  
  // Свет
  light_rig_type?: 'ферма' | 'штанкет' | 'точечные анкера' | 'стойки' | 'невозможно' | 'встроенный';
  light_rig_height_m?: number;
  light_rig_capacity_kg_m?: number;
  light_rig_description?: string;
  light_rig_anchors?: string;
  light_rig_access?: string;
  light_rig_photos?: string[];
  
  // Звук
  has_builtin_sound?: boolean;
  builtin_sound_description?: string;
  builtin_sound_console?: string;
  sound_notes?: string;
  
  // Видео
  has_builtin_video?: boolean;
  builtin_video_description?: string;
  
  // Инфраструктура
  has_wifi?: boolean;
  has_internet?: boolean;
  internet_notes?: string;
  catering?: string;
  storage_space?: string;
  
  // Фото
  photos?: string[];
  stage_plan_url?: string;
  tech_rider_url?: string;
  
  // Заметки
  notes?: string;
  
  created_at?: string;
  updated_at?: string;
};
