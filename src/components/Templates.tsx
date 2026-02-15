import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash, Layout, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import type { Template, TemplateItem, Category, Equipment } from '@/types';
import { getTemplates, getTemplateWithItems, addTemplate, updateTemplate, deleteTemplate, getCategories, getEquipment } from '@/lib/supabase';

export default function Templates() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({ name: '', description: '', items: [] as TemplateItem[] });
    const [newItem, setNewItem] = useState<TemplateItem>({ category: '', equipment_name: '', default_quantity: 1 });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        const [{ data: tplData }, { data: catData }, { data: eqData }] = await Promise.all([
            getTemplates(), getCategories(), getEquipment()
        ]);
        setTemplates(tplData);
        setCategories(catData);
        setEquipment(eqData);
        if (catData.length > 0) setNewItem(prev => ({ ...prev, category: catData[0].name }));
        setLoading(false);
    };

    const handleSave = async () => {
        if (!formData.name) return;
        setSaving(true);
        if (editingTemplate) {
            await updateTemplate(editingTemplate.id, { name: formData.name, description: formData.description }, formData.items);
        } else {
            await addTemplate({ name: formData.name, description: formData.description }, formData.items);
        }
        await loadData();
        closeModal();
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Удалить этот шаблон?')) {
            await deleteTemplate(id);
            await loadData();
        }
    };

    const openModal = async (template: Template | null = null) => {
        if (template) {
            const { data } = await getTemplateWithItems(template.id);
            setEditingTemplate(template);
            setFormData({ name: template.name, description: template.description || '', items: data?.items || [] });
        } else {
            setEditingTemplate(null);
            setFormData({ name: '', description: '', items: [] });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingTemplate(null);
        setFormData({ name: '', description: '', items: [] });
        setNewItem({ category: categories[0]?.name || '', equipment_name: '', default_quantity: 1 });
    };

    const addItemToTemplate = () => {
        if (!newItem.equipment_name) return;
        setFormData({ ...formData, items: [...formData.items, { ...newItem }] });
        setNewItem({ category: categories[0]?.name || '', equipment_name: '', default_quantity: 1 });
    };

    const removeItemFromTemplate = (index: number) => {
        setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
    };

    const toggleExpand = (id: string) => setExpandedTemplate(expandedTemplate === id ? null : id);
    const getEquipmentByCategory = (category: string) => equipment.filter(e => e.category === category).map(e => e.name);

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div><h2 className="text-2xl font-bold text-gray-800">Шаблоны</h2><p className="text-gray-500">Всего шаблонов: {templates.length}</p></div>
                <Button onClick={() => openModal()}><Plus className="w-4 h-4 mr-2" /> Новый шаблон</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(template => (
                    <div key={template.id} className="bg-white border rounded-xl p-4 shadow-sm">
                        <div className="flex items-start justify-between">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Layout className="w-5 h-5 text-blue-600" /></div>
                            <div className="flex gap-1">
                                <button onClick={() => openModal(template)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(template.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <h3 className="font-semibold text-gray-800 mt-3">{template.name}</h3>
                        <p className="text-sm text-gray-500">{template.description}</p>
                        {template.items && template.items.length > 0 && (
                            <button onClick={() => toggleExpand(template.id)} className="flex items-center gap-1 mt-3 text-sm text-blue-600 hover:text-blue-700">
                                {expandedTemplate === template.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                {template.items.length} позиций
                            </button>
                        )}
                        {expandedTemplate === template.id && template.items && (
                            <div className="mt-3 pt-3 border-t space-y-1">
                                {template.items.map((item, idx) => (
                                    <div key={idx} className="text-sm text-gray-600 flex justify-between"><span>{item.equipment_name}</span><span className="text-gray-400">{item.default_quantity} шт.</span></div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {templates.length === 0 && <div className="text-center py-12 text-gray-500"><Layout className="w-16 h-16 mx-auto mb-4 text-gray-300" /><p>Шаблоны не созданы</p></div>}

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>{editingTemplate ? 'Редактировать шаблон' : 'Новый шаблон'}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">Название *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">Описание</label><Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
                        <div className="border rounded-lg p-4">
                            <h4 className="font-medium text-gray-700 mb-3">Позиции шаблона</h4>
                            <div className="space-y-2 mb-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <select value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value, equipment_name: '' })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">{categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}</select>
                                    <Input type="number" min={1} value={newItem.default_quantity} onChange={(e) => setNewItem({ ...newItem, default_quantity: parseInt(e.target.value) || 1 })} className="text-sm" />
                                </div>
                                <select value={newItem.equipment_name} onChange={(e) => setNewItem({ ...newItem, equipment_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                                    <option value="">Выберите оборудование</option>
                                    {getEquipmentByCategory(newItem.category).map(name => <option key={name} value={name}>{name}</option>)}
                                </select>
                                <Button variant="outline" onClick={addItemToTemplate} className="w-full text-sm"><Plus className="w-4 h-4 mr-2" /> Добавить позицию</Button>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {formData.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                        <div><div className="text-sm font-medium">{item.equipment_name}</div><div className="text-xs text-gray-500">{item.category} — {item.default_quantity} шт.</div></div>
                                        <button onClick={() => removeItemFromTemplate(idx)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash className="w-4 h-4" /></button>
                                    </div>
                                ))}
                                {formData.items.length === 0 && <p className="text-sm text-gray-500 text-center py-2">Нет позиций</p>}
                            </div>
                        </div>
                        <div className="flex gap-2 pt-4">
                            <Button variant="outline" onClick={closeModal} className="flex-1" disabled={saving}>Отмена</Button>
                            <Button onClick={handleSave} className="flex-1" disabled={saving || !formData.name}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Сохранить</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
