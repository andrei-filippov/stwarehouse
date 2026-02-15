import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash, Users, Loader2 } from 'lucide-react';
import type { Staff } from '@/types';
import { getStaff, addStaff, updateStaff, deleteStaff } from '@/lib/supabase';

export default function StaffComponent() {
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPerson, setEditingPerson] = useState<Staff | null>(null);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({ name: '', position: '', phone: '', email: '' });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        const { data } = await getStaff();
        setStaff(data);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.position) return;
        setSaving(true);
        if (editingPerson) {
            await updateStaff(editingPerson.id, formData);
        } else {
            await addStaff(formData);
        }
        await loadData();
        closeModal();
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Удалить этого сотрудника?')) {
            await deleteStaff(id);
            await loadData();
        }
    };

    const openModal = (person: Staff | null = null) => {
        if (person) {
            setEditingPerson(person);
            setFormData({ name: person.name, position: person.position, phone: person.phone, email: person.email });
        } else {
            setEditingPerson(null);
            setFormData({ name: '', position: '', phone: '', email: '' });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingPerson(null);
        setFormData({ name: '', position: '', phone: '', email: '' });
    };

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div><h2 className="text-2xl font-bold text-gray-800">Персонал</h2><p className="text-gray-500">Всего сотрудников: {staff.length}</p></div>
                <Button onClick={() => openModal()}><Plus className="w-4 h-4 mr-2" /> Добавить сотрудника</Button>
            </div>

            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">ФИО</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Должность</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Телефон</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Email</th>
                            <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {staff.map(person => (
                            <tr key={person.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium">{person.name.split(' ').map(n => n[0]).join('')}</div>
                                        <span className="font-medium">{person.name}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">{person.position}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{person.phone}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{person.email}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-1">
                                        <button onClick={() => openModal(person)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(person.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash className="w-4 h-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {staff.length === 0 && <div className="text-center py-12 text-gray-500"><Users className="w-16 h-16 mx-auto mb-4 text-gray-300" /><p>Сотрудники не добавлены</p></div>}

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{editingPerson ? 'Редактировать сотрудника' : 'Новый сотрудник'}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">ФИО *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">Должность *</label><Input value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} required /></div>
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">Телефон</label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+7 (999) 123-45-67" /></div>
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">Email</label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
                        <div className="flex gap-2 pt-4">
                            <Button variant="outline" onClick={closeModal} className="flex-1" disabled={saving}>Отмена</Button>
                            <Button onClick={handleSave} className="flex-1" disabled={saving || !formData.name || !formData.position}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Сохранить</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
