# План: Полноценная вкладка "Проекты"

## 1. Перенос в основное меню (сделано)
- Проекты уже в `allNavItems` между "Учёт оборудования" и "Финансы"
- Права доступа: owner/admin/manager

## 2. useProjects hook — расширение
- [x] JOIN с estimates (name, date, status, total, customer)
- [x] JOIN с venue_details (name, city)
- [ ] JOIN с checklists (count, progress) — через project_id
- [ ] JOIN с project_staff (count, list)
- [ ] notes поле в projects
- [ ] updateProject для notes, venue_id, guest_count

## 3. ProjectManager — новая деталка
- [ ] Убрать карточку "Финансы"
- [ ] Заметки по проекту (редактируемые)
- [ ] Чек-листы сметы (если есть)
- [ ] Площадка — подробная инфо-карточка
- [ ] Персонал — список + назначение
- [ ] Таймлайн — визуальная шкала

## 4. Табы в деталке проекта
- Общее (даты, площадка, заметки)
- Чек-листы
- Персонал
- Таймлайн
