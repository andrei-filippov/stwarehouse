import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash, Settings, X, Loader2 } from 'lucide-react';
import type { Rule, Equipment } from '@/types';
import { getRules, getRuleWithItems, addRule, updateRule, deleteRule, getEquipment } from '@/lib/supabase';

export default function Rules() {
    const [rules, setRules] = useState<Rule[]>([]);
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<Rule | null>(null);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({ equipment_name: '', description: '', required_items: [] as string[] });
    const [newRequiredItem, setNewRequiredItem] = useState('');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        const [{ data: rulesData }, { data: eqData }] = await Promise.all([getRules(), getEquipment()]);
        setRules(rulesData);
        setEquipment(eqData);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!formData.equipment_name || formData.required_items.length === 0) return;
        setSaving(true);
        if (editingRule) {
            await updateRule(editingRule.id, { equipment_name: formData.equipment_name, description: formData.description }, formData.required_items);
        } else {
            await addRule({ equipment_name: formData.equipment_name, description: formData.description }, formData.required_items);
        }
        await loadData();
        closeModal();
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Удалить это правило?')) {
            await deleteRule(id);
            await loadData();
        }
    };

    const openModal = async (rule: Rule | null = null) => {
        if (rule) {
            const { data } = await getRuleWithItems(rule.id);
            setEditingRule(rule);
            setFormData({ equipment_name: rule.equipment_name, description: rule.description || '', required_items: data?.items?.map((i: any) => i.item_name) || [] });
        } else {
            setEditingRule(null);
            setFormData({ equipment_name: '', description: '', required_items: [] });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingRule(null);
        setFormData({ equipment_name: '', description: '', required_items: [] });
        setNewRequiredItem('');
    };

    const addRequiredItem = () => {
        if (!newRequiredItem.trim()) return;
        setFormData({ ...formData, required_items: [...formData.required_items, newRequiredItem.trim()] });
        setNewRequiredItem('');
    };

    const removeRequiredItem = (index: number) => {
        setFormData({ ...formData, required_items: formData.required_items.filter((_, i) => i !== index) });
    };

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div><h2 className="text-2xl font-bold text-gray-800">Правила</h2><p className="text-gray-500">Связки оборудования с необходимыми аксессуарами</p></div>
                <Button onClick={() => openModal()}><Plus className="w-4 h-4 mr-2" /> Новое правило</Button>
            </div>

            <div className="space-y-3">
                {rules.map(rule => (
                    <div key={rule.id} className="bg-white border rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><Settings className="w-5 h-5 text-purple-600" /></div>
                                <div><h3 className="font-semibold text-gray-800">{rule.equipment_name}</h3><p className="text-sm text-gray-500">{rule.description}</p></div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right"><span className="text-sm text-gray-500">Необходимо:</span><div className="text-sm font-medium text-purple-600">{rule.items?.length || 0} позиций</div></div>
                                <div className="flex gap-1">
                                    <button onClick={() => openModal(rule)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete(rule.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash className="w-4 h-4" /></button>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t">
                            <div className="flex flex-wrap gap-2">
                                {rule.items?.map((item, idx) => (<span key={idx} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm">{item.item_name}</span>))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {rules.length === 0 && <div className="text-center py-12 text-gray-500"><Settings className="w-16 h-16 mx-auto mb-4 text-gray-300" /><p>Правила не созданы</p><p className="text-sm mt-1">Создайте правила для автоматической генерации чек-листов</p></div>}

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>{editingRule ? 'Редактировать правило' : 'Новое правило'}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Оборудование *</label>
                            <select value={formData.equipment_name} onChange={(e) => setFormData({ ...formData, equipment_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                <option value="">Выберите оборудование</option>
                                {equipment.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                            </select>
                        </div>
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">Описание</label><Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Например: Для каждого микрофона нужны батарейки" /></div>
                        <div className="border rounded-lg p-4">
                            <label className="text-sm font-medium text-gray-700 mb-2 block">Необходимые аксессуары *</label>
                            <div className="flex gap-2 mb-3">
                                <Input value={newRequiredItem} onChange={(e) => setNewRequiredItem(e.target.value)} placeholder="Например: Батарейки AA - 2шт" onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRequiredItem())} />
                                <Button variant="outline" onClick={addRequiredItem}><Plus className="w-4 h-4" /></Button>
                            </div>
                            <div className="space-y-2">
                                {formData.required_items.map((item, idx) => (<div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded"><span className="text-sm">{item}</span><button onClick={() => removeRequiredItem(idx)} className="p-1 text-red-600 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button></div>))}
                                {formData.required_items.length === 0 && <p className="text-sm text-gray-500 text-center py-2">Добавьте необходимые аксессуары</p>}
                            </div>
                        </div>
                        <div className="flex gap-2 pt-4">
                            <Button variant="outline" onClick={closeModal} className="flex-1" disabled={saving}>Отмена</Button>
                            <Button onClick={handleSave} className="flex-1" disabled={saving || !formData.equipment_name || formData.required_items.length === 0}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Сохранить</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
