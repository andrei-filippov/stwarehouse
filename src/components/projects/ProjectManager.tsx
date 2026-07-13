import { useState } from 'react';
import { useProjects } from '../../hooks/useProjects';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Search, FolderKanban, Calendar, MapPin, Users, CheckSquare, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import type { ProjectWithDetails } from '../../hooks/useProjects';

interface ProjectManagerProps {
  companyId: string | undefined;
}

export function ProjectManager({ companyId }: ProjectManagerProps) {
  const { projects, loading, refresh } = useProjects(companyId);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<ProjectWithDetails | null>(null);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.venue_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Группировка по месяцам — сортировка: грядущие месяцы наверху, прошедшие внизу
  const groupedProjects = filteredProjects.reduce((acc, project) => {
    const date = new Date(project.event_date);
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthKey = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    if (!acc[yearMonth]) acc[yearMonth] = { label: monthKey, projects: [] };
    acc[yearMonth].projects.push(project);
    return acc;
  }, {} as Record<string, { label: string; projects: ProjectWithDetails[] }>);

  // Сортируем месяцы: грядущие наверху (по возрастанию даты), прошедшие внизу (по убыванию даты)
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const sortedMonthKeys = Object.keys(groupedProjects).sort((a, b) => {
    const aFuture = a >= currentYearMonth;
    const bFuture = b >= currentYearMonth;
    if (aFuture && bFuture) return a.localeCompare(b); // оба в будущем — по возрастанию
    if (!aFuture && !bFuture) return b.localeCompare(a); // оба в прошлом — по убыванию
    return aFuture ? -1 : 1; // будущее всегда перед прошлым
  });

  // По умолчанию сворачиваем все месяцы кроме текущего
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

  if (selectedProject) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedProject(null)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-2xl font-bold">{selectedProject.name}</h2>
          {getStatusBadge(selectedProject.status)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Даты
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div>{new Date(selectedProject.event_date).toLocaleDateString('ru-RU')}</div>
              {selectedProject.event_start_date && selectedProject.event_end_date && (
                <div className="text-muted-foreground">
                  {new Date(selectedProject.event_start_date).toLocaleDateString('ru-RU')} — {new Date(selectedProject.event_end_date).toLocaleDateString('ru-RU')}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Площадка
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {selectedProject.venue_name ? (
                <>
                  <div>{selectedProject.venue_name}</div>
                  {selectedProject.venue_city && <div className="text-muted-foreground">{selectedProject.venue_city}</div>}
                </>
              ) : (
                <span className="text-muted-foreground">Не указана</span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Персонал
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {selectedProject.staff_count > 0 ? (
                <div>{selectedProject.staff_count} человек</div>
              ) : (
                <span className="text-muted-foreground">Не назначен</span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-primary" />
                Чек-листы
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {selectedProject.checklist_progress.total > 0 ? (
                <div>{selectedProject.checklist_progress.completed} / {selectedProject.checklist_progress.total}</div>
              ) : (
                <span className="text-muted-foreground">Нет чек-листов</span>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Финансы</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedProject.total.toLocaleString('ru-RU')} ₽</div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                        <div className="pt-2 flex items-center justify-between">
                          <span className="font-medium text-foreground">
                            {project.total.toLocaleString('ru-RU')} ₽
                          </span>
                          <span className="text-xs">
                            {project.staff_count > 0 && `${project.staff_count} чел.`}
                          </span>
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
