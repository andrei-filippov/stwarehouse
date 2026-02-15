import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash, CheckSquare, Check, Download, Loader2 } from 'lucide-react';
import type { Checklist, ChecklistItem, Estimate, Rule } from '@/types';
import { getChecklists, getChecklistWithItems, addChecklist, updateChecklistItem, deleteChecklist, getEstimates, getRules, formatDate, downloadCSV } from '@/lib/supabase';

export default function Checklists() {
    const [checklists, setChecklists] = useState<Checklist[]>([]);
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [rules, setRules] = useState<Rule[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null);
    const [selectedEstimate, setSelectedEstimate] = useState<string>('');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        const [{ data: chkData }, { data: estData }, { data: rulesData }] = await Promise.all([
            getChecklists(), getEstimates(), getRules()
        ]);
        setChecklists(chkData);
        setEstimates(estData);
        setRules(rulesData);
        setLoading(false);
    };

    const generateChecklistItems = (estimate: Estimate): ChecklistItem[] => {
        const items: ChecklistItem[] = [];
        (estimate.items || []).forEach(estItem => {
            items.push({ id: crypto.randomUUID(), text: `Проверить ${estItem.name} (${estItem.quantity} шт.)`, completed: false, category: 'Оборудование' });
            const applicableRules = rules.filter(r => estItem.name.toLowerCase().includes(r.equipment_name.toLowerCase()) || r.equipment_name.toLowerCase().includes(estItem.name.toLowerCase()));
            applicableRules.forEach(rule => {
                rule.items?.forEach(ruleItem => items.push({ id: crypto.randomUUID(), text: `${ruleItem.item_name} × ${estItem.quantity}`, completed: false, category: 'Аксессуары' }));
            });
        });
        items.push({ id: crypto.randomUUID(), text: 'Упаковочный материал', completed: false, category: 'Упаковка' });
        items.push({ id: crypto.randomUUID(), text: 'Проверить комплектность', completed: false, category: 'Контроль' });
        return items;
    };

    const handleCreateFromEstimate = async () => {
        if (!selectedEstimate) return;
        const estimate = estimates.find(e => e.id === selectedEstimate);
        if (!estimate) return;
        const items = generateChecklistItems(estimate);
        await addChecklist({ name: `Чек-лист: ${estimate.event_name}`, estimate_id: estimate.id, estimate_name: estimate.event_name }, items);
        await loadData();
        setIsCreateModalOpen(false);
        setSelectedEstimate('');
    };

    const toggleItem = async (itemId: string, completed: boolean) => {
        await updateChecklistItem(itemId, !completed);
        await loadData();
    };

    const handleDelete = async (id: string) => {
        if (confirm('Удалить этот чек-лист?')) {
            await deleteChecklist(id);
            await loadData();
        }
    };

    const openEditModal = async (checklist: Checklist) => {
        const { data } = await getChecklistWithItems(checklist.id);
        setEditingChecklist(data);
        setIsModalOpen(true);
    };

    const closeModal = () => { setIsModalOpen(false); setEditingChecklist(null); };

    const exportToCSV = (checklist: Checklist) => {
        const data = (checklist.items || []).map(item => ({ 'Пункт': item.text, 'Категория': item.category, 'Статус': item.completed ? 'Выполнено' : 'Не выполнено' }));
        const csv = [['Чек-лист:', checklist.name], ['Смета:', checklist.estimate_name || ''], ['Создан:', checklist.created_at], [], ['Пункт', 'Категория', 'Статус'], ...data.map(d => [d['Пункт'], d['Категория'], d['Статус']])].map(row => row.join(';')).join('\n');
        downloadCSV(csv, `чеклист_${checklist.name}.csv`);
    };

    const getProgress = (checklist: Checklist) => {
        const completed = (checklist.items || []).filter(i => i.completed).length;
        const total = checklist.items?.length || 0;
        return { completed, total, percent: total > 0 ? (completed / total) * 100 : 0 };
    };

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div><h2 className="text-2xl font-bold text-gray-800">Чек-листы</h2><p className="text-gray-500">Всего чек-листов: {checklists.length}</p></div>
                <Button onClick={() => setIsCreateModalOpen(true)}><Plus className="w-4 h-4 mr-2" /> Создать из сметы</Button>
            </div>

            <div className="space-y-3">
                {checklists.map(checklist => {
                    const progress = getProgress(checklist);
                    return (
                        <div key={checklist.id} className="bg-white border rounded-xl p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><CheckSquare className="w-5 h-5 text-green-600" /></div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800">{checklist.name}</h3>
                                        <p className="text-sm text-gray-500">Смета: {checklist.estimate_name || '-'} | Создан: {formatDate(checklist.created_at || '')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress.percent}%` }} /></div>
                                        <span className="text-sm text-gray-600">{progress.completed}/{progress.total}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => exportToCSV(checklist)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="CSV"><Download className="w-4 h-4" /></button>
                                        <button onClick={() => openEditModal(checklist)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(checklist.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {checklists.length === 0 && <div className="text-center py-12 text-gray-500"><CheckSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" /><p>Чек-листы не созданы</p><p className="text-sm mt-1">Создайте чек-лист на основе сметы</p></div>}

            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Создать чек-лист из сметы</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">Выберите смету</label><select value={selectedEstimate} onChange={(e) => setSelectedEstimate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"><option value="">-- Выберите смету --</option>{estimates.map(est => <option key={est.id} value={est.id}>{est.event_name} ({formatDate(est.event_date)})</option>)}</select></div>
                        {selectedEstimate && <div className="bg-blue-50 p-3 rounded-lg"><p className="text-sm text-blue-700">Чек-лист будет автоматически сгенерирован на основе оборудования в смете с учетом правил.</p></div>}
                        <div className="flex gap-2 pt-4"><Button variant="outline" onClick={() => setIsCreateModalOpen(false)} className="flex-1">Отмена</Button><Button onClick={handleCreateFromEstimate} className="flex-1" disabled={!selectedEstimate}>Создать</Button></div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                    <DialogHeader><DialogTitle>{editingChecklist?.name}</DialogTitle></DialogHeader>
                    {editingChecklist && (
                        <div className="space-y-4 pt-4">
                            <p className="text-sm text-gray-500">Смета: {editingChecklist.estimate_name || '-'} | Создан: {formatDate(editingChecklist.created_at || '')}</p>
                            <div className="space-y-2">
                                {(editingChecklist.items || []).map(item => (
                                    <div key={item.id} onClick={() => toggleItem(item.id || '', item.completed)} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${item.completed ? 'bg-green-50' : 'bg-gray-50 hover:bg-gray-100'}`}>
                                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${item.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>{item.completed && <Check className="w-4 h-4 text-white" />}</div>
                                        <div className="flex-1"><span className={item.completed ? 'line-through text-gray-400' : ''}>{item.text}</span><span className="ml-2 text-xs text-gray-400">({item.category})</span></div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2 pt-4"><Button variant="outline" onClick={closeModal} className="flex-1">Закрыть</Button></div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
