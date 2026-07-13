import { useState, useEffect } from 'react';
import { useProjects } from '../../hooks/useProjects';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Search, FolderKanban, Calendar, MapPin, Users,
  ArrowLeft, ChevronDown, ChevronRight, Clock, Phone, User,
  StickyNote, Plus, Trash2, Download, Package
} from 'lucide-react';
import type { ProjectWithDetails, ProjectStaff, ProjectTimeline } from '../../hooks/useProjects';
import type { PDFSettings, Staff } from '../../types';

interface ProjectManagerProps {
  companyId: string | undefined;
  venues?: { id: string; name: string; city?: string }[];
  staff?: Staff[];
  pdfSettings?: PDFSettings;
  company?: { name?: string; inn?: string; kpp?: string; ogrn?: string; legal_address?: string } | null;
}

const ROLE_LABELS: Record<string, string> = {
  montage: 'Монтаж',
  demontage: 'Демонтаж',
  sound_engineer: 'Звукорежиссёр',
  monitor_engineer: 'Мониторинг',
  light_engineer: 'Светорежиссёр',
  video_engineer: 'Видеоинженер',
  system_engineer: 'Системный инженер',
  stage_tech: 'Сценный техник',
  stage_manager: 'Stage manager',
  project_manager: 'Продюсер',
  technical_director: 'Технический директор',
  backline_tech: 'Backline',
  rf_tech: 'RF техник',
  cable_tech: 'Кабельщик',
  driver: 'Водитель',
  other: 'Другое',
};

const PHASE_LABELS: Record<string, string> = {
  load_in: 'Заезд',
  setup: 'Установка',
  soundcheck: 'Саундчек',
  rehearsal: 'Репетиция',
  show: 'Шоу',
  break: 'Перерыв',
  breakdown: 'Демонтаж',
  load_out: 'Выезд',
  custom: 'Другое',
};

const PHASE_COLORS: Record<string, string> = {
  load_in: 'bg-blue-500',
  setup: 'bg-indigo-500',
  soundcheck: 'bg-purple-500',
  rehearsal: 'bg-pink-500',
  show: 'bg-green-500',
  break: 'bg-yellow-500',
  breakdown: 'bg-orange-500',
  load_out: 'bg-red-500',
  custom: 'bg-gray-500',
};

// ========== ЭКСПОРТ ОБОРУДОВАНИЯ В EXCEL (формат сметы, без цен) ==========
async function exportEquipmentToExcel(
  project: ProjectWithDetails,
  pdfSettings?: PDFSettings,
  company?: { name?: string; inn?: string; kpp?: string; ogrn?: string; legal_address?: string } | null
) {
  if (project.equipment.length === 0) {
    toast.error('Нет оборудования для экспорта');
    return;
  }

  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Оборудование');

  let currentRow = 1;
  const startRow = 1;

  // === ШАПКА: Логотип слева ===
  if (pdfSettings?.logo) {
    try {
      const base64Data = pdfSettings.logo.split(',')[1];
      if (base64Data) {
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const imageType = pdfSettings.logo.includes('image/png') ? 'png' :
                         pdfSettings.logo.includes('image/jpeg') ? 'jpeg' : 'png';
        const imageId = workbook.addImage({
          buffer: bytes,
          extension: imageType as 'png' | 'jpeg',
        });
        worksheet.addImage(imageId, {
          tl: { col: 0.2, row: 0.5 },
          ext: { width: 180, height: 60 },
          editAs: 'absolute',
        });
      }
    } catch (e) {
      console.error('Error adding logo:', e);
    }
  }

  // === ШАПКА: Реквизиты справа ===
  let detailsRow = 1;

  if (company?.name || pdfSettings?.companyName) {
    worksheet.mergeCells(`D${detailsRow}:G${detailsRow}`);
    worksheet.getCell(detailsRow, 4).value = company?.name || pdfSettings?.companyName;
    worksheet.getCell(detailsRow, 4).font = { bold: true, size: 14 };
    worksheet.getCell(detailsRow, 4).alignment = { horizontal: 'right', vertical: 'center', wrapText: true };
    worksheet.getRow(detailsRow).height = 20;
    detailsRow++;
  }

  if (company?.inn || company?.kpp) {
    worksheet.mergeCells(`D${detailsRow}:G${detailsRow}`);
    worksheet.getCell(detailsRow, 4).value = `ИНН: ${company?.inn || '-'} / КПП: ${company?.kpp || '-'}`;
    worksheet.getCell(detailsRow, 4).font = { size: 10 };
    worksheet.getCell(detailsRow, 4).alignment = { horizontal: 'right', vertical: 'center', wrapText: true };
    worksheet.getRow(detailsRow).height = 16;
    detailsRow++;
  }

  if (company?.ogrn) {
    worksheet.mergeCells(`D${detailsRow}:G${detailsRow}`);
    worksheet.getCell(detailsRow, 4).value = `ОГРН: ${company.ogrn}`;
    worksheet.getCell(detailsRow, 4).font = { size: 10 };
    worksheet.getCell(detailsRow, 4).alignment = { horizontal: 'right', vertical: 'center', wrapText: true };
    worksheet.getRow(detailsRow).height = 16;
    detailsRow++;
  }

  if (company?.legal_address) {
    worksheet.mergeCells(`D${detailsRow}:G${detailsRow}`);
    worksheet.getCell(detailsRow, 4).value = company.legal_address;
    worksheet.getCell(detailsRow, 4).font = { size: 10 };
    worksheet.getCell(detailsRow, 4).alignment = { horizontal: 'right', vertical: 'center', wrapText: true };
    worksheet.getRow(detailsRow).height = 32;
    detailsRow++;
  } else if (pdfSettings?.companyDetails) {
    pdfSettings.companyDetails.split('\n').forEach((line) => {
      worksheet.mergeCells(`D${detailsRow}:G${detailsRow}`);
      worksheet.getCell(detailsRow, 4).value = line;
      worksheet.getCell(detailsRow, 4).font = { size: 10 };
      worksheet.getCell(detailsRow, 4).alignment = { horizontal: 'right', vertical: 'center', wrapText: true };
      worksheet.getRow(detailsRow).height = 16;
      detailsRow++;
    });
  }

  const headerEndRow = Math.max(detailsRow - 1, 4);
  worksheet.mergeCells(`A${startRow}:C${headerEndRow}`);

  // === Информация о проекте ===
  currentRow = headerEndRow + 2;
  worksheet.getCell(currentRow, 1).value = 'Коммерческое предложение:';
  worksheet.getCell(currentRow, 1).font = { bold: true, size: 12 };
  currentRow++;

  worksheet.getCell(currentRow, 1).value = `Заказчик: ${project.customer_name || 'не указан'}`;
  currentRow++;

  worksheet.getCell(currentRow, 1).value = `Дата начала: ${project.event_start_date ? new Date(project.event_start_date).toLocaleDateString('ru-RU') : new Date(project.event_date).toLocaleDateString('ru-RU')}`;
  currentRow++;

  worksheet.getCell(currentRow, 1).value = `Дата окончания: ${project.event_end_date ? new Date(project.event_end_date).toLocaleDateString('ru-RU') : new Date(project.event_date).toLocaleDateString('ru-RU')}`;
  currentRow++;

  worksheet.getCell(currentRow, 1).value = `Место: ${project.venue_name || 'не указано'}`;
  currentRow++;
  currentRow++;

  // === Шапка таблицы (без цен и сумм) ===
  const headerRow = worksheet.getRow(currentRow);
  headerRow.values = ['№', 'Наименование', 'Ед. изм.', 'Кол-во', 'Комментарий'];

  for (let col = 1; col <= 5; col++) {
    headerRow.getCell(col).font = { bold: true };
    headerRow.getCell(col).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE3F2FD' }
    };
    headerRow.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
  }
  currentRow++;

  const dataStartRow = currentRow;

  // === Группировка по категориям ===
  const groupedByCategory: Record<string, typeof project.equipment> = {};
  project.equipment.forEach((item) => {
    const cat = item.category || 'Без категории';
    if (!groupedByCategory[cat]) groupedByCategory[cat] = [];
    groupedByCategory[cat].push(item);
  });

  Object.entries(groupedByCategory).forEach(([category, items]) => {
    // Заголовок категории
    const categoryRow = worksheet.getRow(currentRow);
    categoryRow.values = [category, '', '', '', ''];
    categoryRow.font = { bold: true };
    categoryRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5F5F5' }
    };
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    categoryRow.getCell(1).alignment = { horizontal: 'left' };
    currentRow++;

    // Позиции оборудования
    items.forEach((item, idx) => {
      const row = worksheet.getRow(currentRow);
      row.values = [
        idx + 1,
        item.description ? `${item.name} - ${item.description}` : item.name,
        item.unit || 'шт',
        item.quantity,
        '' // Комментарий — пустой для ручного заполнения
      ];
      row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
      row.getCell(4).numFmt = '#';
      currentRow++;
    });

    currentRow++; // Пустая строка между категориями
  });

  // === Ширины колонок ===
  worksheet.columns = [
    { width: 5 },   // №
    { width: 70 },  // Наименование (широкая для описания)
    { width: 10 },  // Ед. изм.
    { width: 9 },   // Кол-во
    { width: 25 },  // Комментарий
  ];

  // === Границы ===
  for (let row = dataStartRow - 1; row <= currentRow - 1; row++) {
    for (let col = 1; col <= 5; col++) {
      const cell = worksheet.getCell(row, col);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
  }

  const fileName = `Оборудование ${project.name || 'без названия'} ${project.event_date || ''}.xlsx`.trim();

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast.success('Оборудование экспортировано в Excel');
}

function exportStaffToExcel(project: ProjectWithDetails) {
  const rows = project.staff.map(s => ({
    'ФИО': s.external_name || '—',
    'Роль': ROLE_LABELS[s.role] || s.role,
    'Доп. роль': s.custom_role || '',
    'Начало смены': s.shift_start ? new Date(s.shift_start).toLocaleString('ru-RU') : '',
    'Конец смены': s.shift_end ? new Date(s.shift_end).toLocaleString('ru-RU') : '',
    'Подтверждён': s.confirmed ? 'Да' : 'Нет',
    'Заметки': s.notes || '',
  }));

  if (rows.length === 0) {
    toast.error('Нет персонала для экспорта');
    return;
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join('\t'),
    ...rows.map(r => headers.map(h => (r as any)[h]).join('\t')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Персонал_${project.name}_${new Date(project.event_date).toLocaleDateString('ru-RU')}.csv`;
  link.click();
  toast.success('Персонал экспортирован');
}

// Импорт toast для экспорта
import { toast } from 'sonner';

export function ProjectManager({ companyId, venues = [], staff: companyStaff = [], pdfSettings, company }: ProjectManagerProps) {
  const { projects, loading, refresh, updateProject, addStaff, removeStaff, addTimeline, removeTimeline } = useProjects(companyId);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<ProjectWithDetails | null>(null);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showAddTimeline, setShowAddTimeline] = useState(false);

  // Синхронизируем selectedProject с обновлённым projects
  useEffect(() => {
    if (selectedProject) {
      const updated = projects.find(p => p.id === selectedProject.id);
      if (updated) {
        setSelectedProject(updated);
      }
    }
  }, [projects, selectedProject?.id]);

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.venue_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Группировка по месяцам
  const groupedProjects = filteredProjects.reduce((acc, project) => {
    const date = new Date(project.event_date);
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthKey = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    if (!acc[yearMonth]) acc[yearMonth] = { label: monthKey, projects: [] };
    acc[yearMonth].projects.push(project);
    return acc;
  }, {} as Record<string, { label: string; projects: ProjectWithDetails[] }>);

  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const sortedMonthKeys = Object.keys(groupedProjects).sort((a, b) => {
    const aFuture = a >= currentYearMonth;
    const bFuture = b >= currentYearMonth;
    if (aFuture && bFuture) return a.localeCompare(b);
    if (!aFuture && !bFuture) return b.localeCompare(a);
    return aFuture ? -1 : 1;
  });

  // По умолчанию сворачиваем все кроме текущего
  useState(() => {
    const defaultCollapsed = new Set(sortedMonthKeys.filter(m => m !== currentYearMonth));
    setCollapsedMonths(defaultCollapsed);
  });

  const toggleMonth = (yearMonth: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(yearMonth)) next.delete(yearMonth);
      else next.add(yearMonth);
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-100 text-green-700">Выполнен</Badge>;
      case 'approved': return <Badge className="bg-blue-100 text-blue-700">Согласован</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-700">В работе</Badge>;
      case 'cancelled': return <Badge className="bg-red-100 text-red-700">Отменён</Badge>;
      default: return <Badge variant="outline">Черновик</Badge>;
    }
  };

  // ========== ДЕТАЛЬНЫЙ ВИД ==========
  if (selectedProject) {
    return (
      <div className="space-y-4">
        {/* Шапка */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedProject(null)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-2xl font-bold">{selectedProject.name}</h2>
          {getStatusBadge(selectedProject.status)}
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="overview">Общее</TabsTrigger>
            <TabsTrigger value="equipment">Оборудование</TabsTrigger>
            <TabsTrigger value="staff">Персонал</TabsTrigger>
            <TabsTrigger value="timeline">Таймлайн</TabsTrigger>
          </TabsList>

          {/* === ОБЩЕЕ === */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Даты */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Даты
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div>{new Date(selectedProject.event_date).toLocaleDateString('ru-RU')}</div>
                  {selectedProject.event_start_date && selectedProject.event_end_date && (
                    <div className="text-muted-foreground">
                      {new Date(selectedProject.event_start_date).toLocaleDateString('ru-RU')} — {new Date(selectedProject.event_end_date).toLocaleDateString('ru-RU')}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Площадка */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Площадка
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  {selectedProject.venue_name ? (
                    <>
                      <div className="font-medium">{selectedProject.venue_name}</div>
                      {selectedProject.venue_city && <div className="text-muted-foreground">{selectedProject.venue_city}</div>}
                      {selectedProject.venue_address && <div className="text-muted-foreground text-xs">{selectedProject.venue_address}</div>}
                      {selectedProject.venue_contact_name && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <User className="w-3 h-3" />
                          {selectedProject.venue_contact_name}
                          {selectedProject.venue_contact_phone && (
                            <span className="flex items-center gap-1 ml-2">
                              <Phone className="w-3 h-3" />
                              {selectedProject.venue_contact_phone}
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Не указана</span>
                  )}
                </CardContent>
              </Card>

              {/* Заказчик */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Заказчик
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {selectedProject.customer_name || <span className="text-muted-foreground">Не указан</span>}
                </CardContent>
              </Card>
            </div>

            {/* Заметки */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-primary" />
                  Заметки по проекту
                  {!editingNotes && (
                    <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => { setEditingNotes(true); setNotesDraft(selectedProject.notes || ''); }}>
                      Редактировать
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {editingNotes ? (
                  <div className="space-y-2">
                    <Textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="Заметки, пожелания, особенности проекта..."
                      rows={4}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={async () => {
                        await updateProject(selectedProject.id, { notes: notesDraft });
                        setEditingNotes(false);
                      }}>Сохранить</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingNotes(false)}>Отмена</Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap">
                    {selectedProject.notes || <span className="text-muted-foreground">Нет заметок</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === ОБОРУДОВАНИЕ === */}
          <TabsContent value="equipment" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Package className="w-5 h-5" />
                Оборудование по смете
                <Badge variant="secondary">{selectedProject.equipment.length}</Badge>
              </h3>
              <Button size="sm" variant="outline" onClick={() => exportEquipmentToExcel(selectedProject, pdfSettings, company)}>
                <Download className="w-4 h-4 mr-1" />
                Экспорт Excel
              </Button>
            </div>

            {selectedProject.equipment.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Нет оборудования в смете</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left">Категория</th>
                      <th className="px-4 py-2 text-left">Наименование</th>
                      <th className="px-4 py-2 text-left">Описание</th>
                      <th className="px-4 py-2 text-center">Кол-во</th>
                      <th className="px-4 py-2 text-center">Ед.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProject.equipment.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="px-4 py-2 text-muted-foreground">{e.category}</td>
                        <td className="px-4 py-2 font-medium">{e.name}</td>
                        <td className="px-4 py-2 text-muted-foreground">{e.description || '—'}</td>
                        <td className="px-4 py-2 text-center">{e.quantity}</td>
                        <td className="px-4 py-2 text-center">{e.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* === ПЕРСОНАЛ === */}
          <TabsContent value="staff" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Задействованный персонал</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => exportStaffToExcel(selectedProject)}>
                  <Download className="w-4 h-4 mr-1" />
                  Экспорт CSV
                </Button>
                <Button size="sm" onClick={() => setShowAddStaff(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Добавить
                </Button>
              </div>
            </div>

          {showAddStaff && (
            <AddStaffMatrix
              companyStaff={companyStaff}
              existingStaff={selectedProject.staff}
              onAdd={async (assignments) => {
                for (const a of assignments) {
                  await addStaff(selectedProject.id, a);
                }
                setShowAddStaff(false);
              }}
              onCancel={() => setShowAddStaff(false)}
            />
          )}

            {selectedProject.staff.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Персонал не назначен</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedProject.staff.map(s => (
                  <Card key={s.id}>
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">
                            {s.external_name || companyStaff.find(cs => cs.id === s.staff_id)?.full_name || 'Неизвестно'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {ROLE_LABELS[s.role] || s.role}
                            {s.custom_role && ` — ${s.custom_role}`}
                          </div>
                          {s.shift_start && (
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(s.shift_start).toLocaleString('ru-RU')}
                              {s.shift_end && ` — ${new Date(s.shift_end).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {s.confirmed && <Badge className="bg-green-100 text-green-700">Подтв.</Badge>}
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeStaff(selectedProject.id, s.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* === ТАЙМЛАЙН === */}
          <TabsContent value="timeline" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">График работ</h3>
              <Button size="sm" onClick={() => setShowAddTimeline(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Добавить этап
              </Button>
            </div>

            {showAddTimeline && (
              <AddTimelineForm
                onAdd={(timeline) => {
                  addTimeline(selectedProject.id, timeline);
                  setShowAddTimeline(false);
                }}
                onCancel={() => setShowAddTimeline(false)}
              />
            )}

            {selectedProject.timeline.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Таймлайн не заполнен</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedProject.timeline.map((t, i) => (
                  <TimelineItem
                    key={t.id}
                    timeline={t}
                    isFirst={i === 0}
                    isLast={i === selectedProject.timeline.length - 1}
                    onDelete={() => removeTimeline(selectedProject.id, t.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // ========== СПИСОК ПРОЕКТОВ ==========
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Проекты</h2>
        <Button variant="outline" onClick={() => refresh()}>
          Обновить
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию, заказчику, площадке..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchQuery ? 'Ничего не найдено' : 'Нет проектов. Создайте смету — проект создастся автоматически.'}
        </div>
      ) : (
        <div className="space-y-6">
          {sortedMonthKeys.map((yearMonth) => {
            const group = groupedProjects[yearMonth];
            const isCollapsed = collapsedMonths.has(yearMonth);
            return (
            <div key={yearMonth}>
              <h3
                className="text-lg font-semibold mb-3 flex items-center gap-2 cursor-pointer select-none hover:text-primary transition-colors"
                onClick={() => toggleMonth(yearMonth)}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
                <Calendar className="w-5 h-5 text-muted-foreground" />
                {group.label}
                <Badge variant="secondary">{group.projects.length}</Badge>
              </h3>
              {!isCollapsed && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.projects.map((project) => (
                  <Card
                    key={project.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedProject(project)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FolderKanban className="w-5 h-5 text-primary" />
                          {project.name}
                        </CardTitle>
                        {getStatusBadge(project.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          {new Date(project.event_date).toLocaleDateString('ru-RU')}
                        </div>
                        {project.venue_name && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3" />
                            {project.venue_name}
                          </div>
                        )}
                        {project.customer_name && (
                          <div className="flex items-center gap-2">
                            <Users className="w-3 h-3" />
                            {project.customer_name}
                          </div>
                        )}
                        <div className="pt-2 flex items-center gap-3">
                          {project.staff_count > 0 && (
                            <span className="flex items-center gap-1 text-xs">
                              <Users className="w-3 h-3" />
                              {project.staff_count}
                            </span>
                          )}
                          {project.equipment.length > 0 && (
                            <span className="flex items-center gap-1 text-xs">
                              <Package className="w-3 h-3" />
                              {project.equipment.length}
                            </span>
                          )}
                          {project.timeline.length > 0 && (
                            <span className="flex items-center gap-1 text-xs">
                              <Clock className="w-3 h-3" />
                              {project.timeline.length} этапов
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ========== ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ==========

function AddStaffMatrix({ companyStaff, existingStaff, onAdd, onCancel }: {
  companyStaff: Staff[];
  existingStaff: ProjectStaff[];
  onAdd: (assignments: Omit<ProjectStaff, 'id'>[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>({}); // staffId -> roles[]
  const [customRoles, setCustomRoles] = useState<Record<string, Record<string, string>>>({}); // staffId -> { roleKey -> customRole }
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [isExternal, setIsExternal] = useState(false);
  const [externalName, setExternalName] = useState('');
  const [externalRole, setExternalRole] = useState('sound_engineer');
  const [externalCustomRole, setExternalCustomRole] = useState('');

  const roleEntries = Object.entries(ROLE_LABELS);

  const toggleRole = (staffId: string, role: string) => {
    setSelected(prev => {
      const current = prev[staffId] || [];
      if (current.includes(role)) {
        // Убираем роль
        const next = current.filter(r => r !== role);
        if (next.length === 0) {
          const updated = { ...prev };
          delete updated[staffId];
          return updated;
        }
        return { ...prev, [staffId]: next };
      }
      // Добавляем роль
      return { ...prev, [staffId]: [...current, role] };
    });
  };

  const isAssigned = (staffId: string, role: string) => {
    return (selected[staffId] || []).includes(role);
  };

  const setCustomRole = (staffId: string, role: string, value: string) => {
    setCustomRoles(prev => ({
      ...prev,
      [staffId]: { ...prev[staffId], [role]: value }
    }));
  };

  const getCustomRole = (staffId: string, role: string) => {
    return customRoles[staffId]?.[role] || '';
  };

  const handleSubmit = () => {
    const assignments: Omit<ProjectStaff, 'id'>[] = [];

    // Внутренние сотрудники — каждая роль отдельной записью
    Object.entries(selected).forEach(([staffId, roles]) => {
      roles.forEach(role => {
        assignments.push({
          staff_id: staffId,
          external_name: null,
          external_phone: null,
          role: role as any,
          custom_role: role === 'other' ? (getCustomRole(staffId, role) || 'Другое') : null,
          shift_start: shiftStart ? new Date(shiftStart).toISOString() : null,
          shift_end: shiftEnd ? new Date(shiftEnd).toISOString() : null,
          confirmed: false,
          notes: null,
        });
      });
    });

    // Внешний сотрудник
    if (isExternal && externalName.trim()) {
      assignments.push({
        staff_id: null,
        external_name: externalName.trim(),
        external_phone: null,
        role: externalRole as any,
        custom_role: externalRole === 'other' ? (externalCustomRole || 'Другое') : null,
        shift_start: shiftStart ? new Date(shiftStart).toISOString() : null,
        shift_end: shiftEnd ? new Date(shiftEnd).toISOString() : null,
        confirmed: false,
        notes: null,
      });
    }

    if (assignments.length === 0) {
      toast.error('Выберите хотя бы одного сотрудника и роль');
      return;
    }

    onAdd(assignments);
  };

  // Считаем общее количество назначений
  const totalAssignments = Object.values(selected).reduce((sum, roles) => sum + roles.length, 0) + (isExternal && externalName ? 1 : 0);

  return (
    <Card>
      <CardContent className="py-4 space-y-4">
        {/* Общие смены */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Начало смены (всех)</label>
            <Input type="datetime-local" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Конец смены (всех)</label>
            <Input type="datetime-local" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} />
          </div>
        </div>

        {/* Матрица: сотрудники × роли */}
        {companyStaff.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium sticky left-0 bg-muted z-10 min-w-[180px]">Сотрудник</th>
                    {roleEntries.map(([key, label]) => (
                      <th key={key} className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[70px]">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {companyStaff.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="px-3 py-2 sticky left-0 bg-card z-10 font-medium">
                        {s.full_name}
                      </td>
                      {roleEntries.map(([roleKey]) => (
                        <td key={roleKey} className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => toggleRole(s.id, roleKey)}
                            className={`
                              w-7 h-7 rounded-md border transition-colors flex items-center justify-center mx-auto
                              ${isAssigned(s.id, roleKey)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-border hover:border-primary/50'
                              }
                            `}
                          >
                            {isAssigned(s.id, roleKey) && <span className="text-xs font-bold">✓</span>}
                          </button>
                          {isAssigned(s.id, roleKey) && roleKey === 'other' && (
                            <Input
                              size={1}
                              placeholder="Роль"
                              value={getCustomRole(s.id, roleKey)}
                              onChange={(e) => setCustomRole(s.id, roleKey, e.target.value)}
                              className="mt-1 h-6 text-xs px-1"
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {companyStaff.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Нет сотрудников в компании. Добавьте их во вкладке «Персонал».
          </div>
        )}

        {/* Внешний сотрудник */}
        <div className="border rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="external-toggle"
              checked={isExternal}
              onChange={(e) => setIsExternal(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="external-toggle" className="text-sm font-medium cursor-pointer">
              Добавить внешнего сотрудника
            </label>
          </div>

          {isExternal && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input placeholder="ФИО" value={externalName} onChange={(e) => setExternalName(e.target.value)} />
              <select
                className="px-3 py-2 border rounded-md text-sm bg-card"
                value={externalRole}
                onChange={(e) => setExternalRole(e.target.value)}
              >
                {roleEntries.map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              {externalRole === 'other' && (
                <Input placeholder="Укажите роль" value={externalCustomRole} onChange={(e) => setExternalCustomRole(e.target.value)} />
              )}
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit}>
            Добавить ({totalAssignments})
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Отмена</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddTimelineForm({ onAdd, onCancel }: {
  onAdd: (timeline: Omit<ProjectTimeline, 'id'>) => void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState('setup');
  const [customName, setCustomName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      phase: phase as any,
      custom_phase_name: phase === 'custom' ? customName : null,
      start_time: new Date(startTime).toISOString(),
      end_time: endTime ? new Date(endTime).toISOString() : null,
      description: description || null,
      color: null,
    });
  };

  return (
    <Card>
      <CardContent className="py-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <select
            className="w-full px-3 py-2 border rounded-md text-sm bg-card"
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
          >
            {Object.entries(PHASE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {phase === 'custom' && (
            <Input placeholder="Название этапа" value={customName} onChange={(e) => setCustomName(e.target.value)} required />
          )}

          <div className="grid grid-cols-2 gap-2">
            <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>

          <Input placeholder="Описание (опционально)" value={description} onChange={(e) => setDescription(e.target.value)} />

          <div className="flex gap-2">
            <Button type="submit" size="sm">Добавить</Button>
            <Button type="button" size="sm" variant="outline" onClick={onCancel}>Отмена</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TimelineItem({ timeline, isFirst, isLast, onDelete }: {
  timeline: ProjectTimeline;
  isFirst: boolean;
  isLast: boolean;
  onDelete: () => void;
}) {
  const colorClass = PHASE_COLORS[timeline.phase] || 'bg-gray-500';
  const label = timeline.custom_phase_name || PHASE_LABELS[timeline.phase] || timeline.phase;

  return (
    <div className="flex gap-3">
      {/* Линия с точкой */}
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full ${colorClass} ${isFirst ? '' : 'mt-2'}`} />
        {!isLast && <div className="w-0.5 flex-1 bg-border mt-1" />}
      </div>

      {/* Контент */}
      <Card className="flex-1 mb-2">
        <CardContent className="py-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${colorClass}`} />
                {label}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                {new Date(timeline.start_time).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                {timeline.end_time && ` — ${new Date(timeline.end_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`}
              </div>
              {timeline.description && (
                <div className="text-sm text-muted-foreground mt-1">{timeline.description}</div>
              )}
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onDelete}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
