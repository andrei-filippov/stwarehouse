import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Plus, Edit, Trash, Download, FileText, AlertCircle, Loader2 } from 'lucide-react';
import type { Equipment, Estimate, EstimateItem, PDFSettings } from '@/types';
import { getEquipment, getEstimates, addEstimate, updateEstimate, deleteEstimate, formatCurrency, formatDate } from '@/lib/supabase';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function EstimatesManagement() {
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPdfSettingsOpen, setIsPdfSettingsOpen] = useState(false);
    const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);
    const [currentEstimate, setCurrentEstimate] = useState<Estimate | null>(null);
    const [availabilityWarnings, setAvailabilityWarnings] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    const [pdfSettings, setPdfSettings] = useState<PDFSettings>({
        logo: null, companyName: '', companyDetails: '', position: '', personName: '', signature: null, stamp: null
    });

    const [formData, setFormData] = useState({
        event_name: '', venue: '', event_date: '', items: [] as EstimateItem[]
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [{ data: equipData }, { data: estData }] = await Promise.all([
            getEquipment(), getEstimates()
        ]);
        setEquipment(equipData);
        setEstimates(estData);
        setLoading(false);
    };

    const filteredEstimates = useMemo(() => {
        return estimates.filter(est =>
            est.event_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            est.venue?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [estimates, searchTerm]);

    const calculateTotal = (items: EstimateItem[]) => items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const getAvailableQuantity = (equipmentId: string, eventDate: string, currentEstimateId?: string) => {
        const usedInEstimates = estimates
            .filter(e => e.event_date === eventDate && e.id !== currentEstimateId)
            .flatMap(e => e.items || [])
            .filter(item => item.equipment_id === equipmentId)
            .reduce((sum, item) => sum + item.quantity, 0);
        return usedInEstimates;
    };

    const checkAvailability = (date: string, items: EstimateItem[], estimateId?: string) => {
        const warnings: string[] = [];
        items.forEach(item => {
            const equipmentItem = equipment.find(e => e.id === item.equipment_id);
            if (equipmentItem) {
                const usedInOtherEstimates = getAvailableQuantity(item.equipment_id, date, estimateId);
                const available = equipmentItem.quantity - usedInOtherEstimates;
                if (item.quantity > available) {
                    warnings.push(`"${item.name}" - доступно только ${available} шт.`);
                }
            }
        });
        setAvailabilityWarnings(warnings);
        return warnings.length === 0;
    };

    const handleAddItem = (equipmentItem: Equipment) => {
        if (!formData.event_date) { alert('Сначала выберите дату мероприятия'); return; }
        const usedInOtherEstimates = getAvailableQuantity(equipmentItem.id, formData.event_date, editingEstimate?.id);
        const available = equipmentItem.quantity - usedInOtherEstimates;
        if (available <= 0) { alert(`Все оборудование "${equipmentItem.name}" забронировано`); return; }

        const existing = formData.items.find(i => i.equipment_id === equipmentItem.id);
        if (existing) {
            if (existing.quantity >= available) { alert(`Достигнут лимит (${available} шт.)`); return; }
            const newItems = formData.items.map(i => i.equipment_id === equipmentItem.id ? { ...i, quantity: i.quantity + 1 } : i);
            setFormData({ ...formData, items: newItems });
            checkAvailability(formData.event_date, newItems, editingEstimate?.id);
        } else {
            const newItems = [...formData.items, { equipment_id: equipmentItem.id, name: equipmentItem.name, description: equipmentItem.description || '', quantity: 1, price: equipmentItem.price }];
            setFormData({ ...formData, items: newItems });
            checkAvailability(formData.event_date, newItems, editingEstimate?.id);
        }
    };

    const handleRemoveItem = (equipmentId: string) => {
        const newItems = formData.items.filter(i => i.equipment_id !== equipmentId);
        setFormData({ ...formData, items: newItems });
        checkAvailability(formData.event_date, newItems, editingEstimate?.id);
    };

    const handleUpdateQuantity = (equipmentId: string, quantity: number) => {
        if (quantity <= 0) { handleRemoveItem(equipmentId); return; }
        const equipmentItem = equipment.find(e => e.id === equipmentId);
        if (equipmentItem && formData.event_date) {
            const usedInOtherEstimates = getAvailableQuantity(equipmentId, formData.event_date, editingEstimate?.id);
            const available = equipmentItem.quantity - usedInOtherEstimates;
            if (quantity > available) { alert(`Доступно только ${available} шт.`); return; }
        }
        const newItems = formData.items.map(i => i.equipment_id === equipmentId ? { ...i, quantity } : i);
        setFormData({ ...formData, items: newItems });
        checkAvailability(formData.event_date, newItems, editingEstimate?.id);
    };

    const handleSave = async () => {
        if (!formData.event_name || formData.items.length === 0 || !formData.event_date) return;
        if (!checkAvailability(formData.event_date, formData.items, editingEstimate?.id)) {
            if (!confirm('Некоторое оборудование недоступно. Все равно сохранить?')) return;
        }
        setSaving(true);

        const estimateData = { event_name: formData.event_name, venue: formData.venue, event_date: formData.event_date, total: calculateTotal(formData.items) };

        if (editingEstimate) {
            await updateEstimate(editingEstimate.id, estimateData, formData.items);
        } else {
            await addEstimate(estimateData, formData.items);
        }
        await loadData();
        closeModal();
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Удалить эту смету?')) {
            await deleteEstimate(id);
            await loadData();
        }
    };

    const openModal = (estimate: Estimate | null = null) => {
        setAvailabilityWarnings([]);
        if (estimate) {
            setEditingEstimate(estimate);
            setFormData({ event_name: estimate.event_name, venue: estimate.venue || '', event_date: estimate.event_date, items: estimate.items || [] });
        } else {
            setEditingEstimate(null);
            setFormData({ event_name: '', venue: '', event_date: '', items: [] });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingEstimate(null);
        setAvailabilityWarnings([]);
        setFormData({ event_name: '', venue: '', event_date: '', items: [] });
    };

    const exportToCSV = () => {
        const allItems = estimates.flatMap(est => (est.items || []).map(item => ({
            'Название сметы': est.event_name, 'Мероприятие': est.event_name, 'Место': est.venue,
            'Дата': est.event_date, 'Оборудование': item.name, 'Количество': item.quantity,
            'Цена': item.price, 'Сумма': item.price * item.quantity
        })));
        const csv = Papa.unparse(allItems);
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `сметы_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const exportEstimateToCSV = (estimate: Estimate) => {
        const data = (estimate.items || []).map(item => ({
            'Оборудование': item.name, 'Описание': item.description, 'Количество': item.quantity,
            'Цена за ед.': item.price, 'Сумма': item.price * item.quantity
        }));
        const csv = Papa.unparse(data);
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${estimate.event_name}_${estimate.event_date}.csv`;
        link.click();
    };

    const exportToPDF = (estimate: Estimate) => {
        setCurrentEstimate(estimate);
        setIsPdfSettingsOpen(true);
    };

    const generatePDF = () => {
        if (!currentEstimate) return;
        const doc = new jsPDF();
        const primaryColor = '#1e3a5f';
        let yPos = 20;

        if (pdfSettings.logo) { try { doc.addImage(pdfSettings.logo, 'JPEG', 15, yPos, 40, 25); } catch (e) {} }
        if (pdfSettings.companyName) { doc.setFontSize(12); doc.setTextColor(primaryColor); doc.text(pdfSettings.companyName, 195, yPos + 5, { align: 'right' }); }
        yPos = pdfSettings.logo ? 55 : 30;

        doc.setFontSize(11); doc.setTextColor(primaryColor); doc.text(currentEstimate.event_name, 15, yPos); yPos += 7;
        doc.setFontSize(10); doc.setTextColor('#4a5568');
        if (currentEstimate.venue) { doc.text(`Место: ${currentEstimate.venue}`, 15, yPos); yPos += 6; }
        if (currentEstimate.event_date) { doc.text(`Дата: ${formatDate(currentEstimate.event_date)}`, 15, yPos); yPos += 6; }
        yPos += 5;

        const tableData = (currentEstimate.items || []).map(item => [item.name, item.quantity.toString(), formatCurrency(item.price).replace('₽', 'RUB'), formatCurrency(item.price * item.quantity).replace('₽', 'RUB')]);
        (doc as any).autoTable({ startY: yPos, head: [['Наименование', 'Кол-во', 'Цена', 'Сумма']], body: tableData, theme: 'grid', headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 10, fontStyle: 'bold' }, bodyStyles: { fontSize: 9 }, columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 25, halign: 'center' }, 2: { cellWidth: 35, halign: 'right' }, 3: { cellWidth: 35, halign: 'right' } } });
        yPos = (doc as any).lastAutoTable.finalY + 10;

        doc.setFontSize(11); doc.setTextColor(primaryColor); doc.setFont('helvetica', 'bold');
        doc.text(`ИТОГО: ${formatCurrency(currentEstimate.total).replace('₽', 'RUB')}`, 195, yPos, { align: 'right' });

        doc.save(`${currentEstimate.event_name}_${new Date().toISOString().split('T')[0]}.pdf`.replace(/[^a-zA-Z0-9а-яА-Я\-_]/g, '_'));
        setIsPdfSettingsOpen(false);
        setCurrentEstimate(null);
    };

    const handleFileChange = (field: keyof PDFSettings, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => setPdfSettings({ ...pdfSettings, [field]: event.target?.result as string });
        reader.readAsDataURL(file);
    };

    if (loading) {
        return (<div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>);
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Сметы</h2>
                    <p className="text-gray-500">Всего смет: {estimates.length}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={exportToCSV}><Download className="w-4 h-4 mr-2" /> Экспорт всех</Button>
                    <Button size="sm" onClick={() => openModal()}><Plus className="w-4 h-4 mr-2" /> Новая смета</Button>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Поиск смет..." className="pl-10" />
            </div>

            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                {estimates.length === 0 ? (
                    <div className="p-12 text-center text-gray-500"><FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" /><p>Сметы не найдены</p></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Название</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Место</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Дата</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Позиций</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Сумма</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Действия</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredEstimates.map(estimate => (
                                    <tr key={estimate.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-800">{estimate.event_name}</div>
                                            <div className="text-sm text-gray-500">Создано: {formatDate(estimate.created_at || '')}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{estimate.venue || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(estimate.event_date)}</td>
                                        <td className="px-4 py-3 text-center"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm">{estimate.items?.length || 0}</span></td>
                                        <td className="px-4 py-3 text-right font-medium text-blue-600">{formatCurrency(estimate.total)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => exportToPDF(estimate)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="PDF"><Download className="w-4 h-4" /></button>
                                                <button onClick={() => exportEstimateToCSV(estimate)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg" title="CSV"><FileText className="w-4 h-4" /></button>
                                                <button onClick={() => openModal(estimate)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(estimate.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Trash className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Estimate Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
                    <DialogHeader><DialogTitle>{editingEstimate ? 'Редактировать смету' : 'Новая смета'}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Название мероприятия *</label><Input value={formData.event_name} onChange={(e) => setFormData({ ...formData, event_name: e.target.value })} required /></div>
                            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Место проведения</label><Input value={formData.venue} onChange={(e) => setFormData({ ...formData, venue: e.target.value })} /></div>
                            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Дата мероприятия *</label><Input type="date" value={formData.event_date} onChange={(e) => { setFormData({ ...formData, event_date: e.target.value }); if (e.target.value && formData.items.length > 0) checkAvailability(e.target.value, formData.items, editingEstimate?.id); }} required /></div>
                        </div>

                        {availabilityWarnings.length > 0 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 text-yellow-700 mb-2"><AlertCircle className="w-5 h-5" /><span className="font-medium">Внимание! Проблемы с доступностью:</span></div>
                                <ul className="list-disc list-inside text-sm text-yellow-600 space-y-1">{availabilityWarnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="border rounded-lg p-4">
                                <h4 className="font-medium text-gray-700 mb-3">Доступное оборудование</h4>
                                <div className="max-h-64 overflow-y-auto space-y-2">
                                    {equipment.map(item => {
                                        const usedInOtherEstimates = formData.event_date ? getAvailableQuantity(item.id, formData.event_date, editingEstimate?.id) : 0;
                                        const available = item.quantity - usedInOtherEstimates;
                                        const inEstimate = formData.items.find(i => i.equipment_id === item.id)?.quantity || 0;
                                        return (
                                            <div key={item.id} className={`flex items-center justify-between p-2 rounded ${available > 0 ? 'bg-gray-50 hover:bg-gray-100 cursor-pointer' : 'bg-red-50 opacity-50'}`} onClick={() => available > 0 && handleAddItem(item)}>
                                                <div><div className="font-medium text-sm">{item.name}</div><div className="text-xs text-gray-500">{item.category}</div></div>
                                                <div className="text-right">
                                                    <div className="text-sm font-medium">{formatCurrency(item.price)}</div>
                                                    <div className={`text-xs ${available > 5 ? 'text-green-600' : available > 0 ? 'text-yellow-600' : 'text-red-600'}`}>Доступно: {available} {inEstimate > 0 && `(в смете: ${inEstimate})`}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="border rounded-lg p-4">
                                <h4 className="font-medium text-gray-700 mb-3">Выбранное оборудование</h4>
                                {formData.items.length === 0 ? (<p className="text-gray-500 text-sm">Ничего не выбрано</p>) : (
                                    <div className="max-h-64 overflow-y-auto space-y-2">
                                        {formData.items.map(item => (
                                            <div key={item.equipment_id} className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                                                <div className="flex-1"><div className="font-medium text-sm">{item.name}</div><div className="text-xs text-gray-500">{formatCurrency(item.price)}</div></div>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => handleUpdateQuantity(item.equipment_id, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300">-</button>
                                                    <span className="w-8 text-center">{item.quantity}</span>
                                                    <button onClick={() => handleUpdateQuantity(item.equipment_id, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300">+</button>
                                                    <button onClick={() => handleRemoveItem(item.equipment_id)} className="p-1 text-red-600 hover:bg-red-100 rounded"><Trash className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {formData.items.length > 0 && (<div className="mt-4 pt-4 border-t flex justify-between items-center"><span className="font-medium">Итого:</span><span className="text-xl font-bold text-blue-600">{formatCurrency(calculateTotal(formData.items))}</span></div>)}
                            </div>
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button variant="outline" onClick={closeModal} className="flex-1" disabled={saving}>Отмена</Button>
                            <Button onClick={handleSave} className="flex-1" disabled={saving || !formData.event_name || formData.items.length === 0 || !formData.event_date}>
                                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Сохранить
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* PDF Settings Modal */}
            <Dialog open={isPdfSettingsOpen} onOpenChange={setIsPdfSettingsOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Настройки PDF</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Логотип</label><input type="file" accept="image/*" onChange={(e) => handleFileChange('logo', e)} className="w-full text-sm" /></div>
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">Название компании</label><Input value={pdfSettings.companyName} onChange={(e) => setPdfSettings({ ...pdfSettings, companyName: e.target.value })} /></div>
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">Реквизиты</label><textarea value={pdfSettings.companyDetails} onChange={(e) => setPdfSettings({ ...pdfSettings, companyDetails: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none" /></div>
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">Должность</label><Input value={pdfSettings.position} onChange={(e) => setPdfSettings({ ...pdfSettings, position: e.target.value })} /></div>
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">ФИО</label><Input value={pdfSettings.personName} onChange={(e) => setPdfSettings({ ...pdfSettings, personName: e.target.value })} /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Подпись (PNG)</label><input type="file" accept="image/png" onChange={(e) => handleFileChange('signature', e)} className="w-full text-sm" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Печать (PNG)</label><input type="file" accept="image/png" onChange={(e) => handleFileChange('stamp', e)} className="w-full text-sm" /></div>
                        <div className="flex gap-2 pt-4"><Button variant="outline" onClick={() => setIsPdfSettingsOpen(false)} className="flex-1">Отмена</Button><Button onClick={generatePDF} className="flex-1">Сгенерировать PDF</Button></div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
