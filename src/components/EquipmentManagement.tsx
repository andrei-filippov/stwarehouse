import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Plus, Edit, Trash, Download, Upload, ChevronDown, ChevronUp, FolderPlus, Package, Loader2 } from 'lucide-react';
import type { Equipment, Category } from '@/types';
import { getEquipment, getCategories, addEquipment, updateEquipment, deleteEquipment, addCategory, deleteCategory, formatCurrency } from '@/lib/supabase';
import Papa from 'papaparse';

export default function EquipmentManagement() {
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Equipment | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [newCategoryName, setNewCategoryName] = useState('');
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        category: '',
        quantity: 1,
        price: 0,
        description: ''
    });

    // Load data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [{ data: equipData }, { data: catData }] = await Promise.all([
            getEquipment(),
            getCategories()
        ]);
        setEquipment(equipData);
        setCategories(catData);
        setLoading(false);
    };

    // Filter equipment
    const filteredEquipment = useMemo(() => {
        if (!searchTerm) return equipment;
        return equipment.filter(item =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [equipment, searchTerm]);

    const filteredGrouped = useMemo(() => {
        return filteredEquipment.reduce((acc, item) => {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
            return acc;
        }, {} as Record<string, Equipment[]>);
    }, [filteredEquipment]);

    const handleSave = async () => {
        if (!formData.name || !formData.category) return;
        setSaving(true);

        const itemData = {
            name: formData.name,
            category: formData.category,
            quantity: parseInt(formData.quantity as any) || 0,
            price: parseFloat(formData.price as any) || 0,
            description: formData.description
        };

        if (editingItem) {
            await updateEquipment(editingItem.id, itemData);
        } else {
            await addEquipment(itemData);
        }

        await loadData();
        closeModal();
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Удалить это оборудование?')) {
            await deleteEquipment(id);
            await loadData();
        }
    };

    const openModal = (item: Equipment | null = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                category: item.category,
                quantity: item.quantity,
                price: item.price,
                description: item.description || ''
            });
        } else {
            setEditingItem(null);
            setFormData({ name: '', category: categories[0]?.name || '', quantity: 1, price: 0, description: '' });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
        setFormData({ name: '', category: '', quantity: 1, price: 0, description: '' });
    };

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
    };

    // Export to CSV
    const exportToCSV = () => {
        const data = equipment.map(item => ({
            'Название': item.name,
            'Категория': item.category,
            'Количество': item.quantity,
            'Цена за ед.': item.price,
            'Описание': item.description || ''
        }));
        const csv = Papa.unparse(data);
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `оборудование_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    // Import from CSV
    const importFromCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            encoding: 'UTF-8',
            complete: async (results) => {
                const imported = (results.data as any[]).filter(row => row['Название']).map(row => ({
                    name: row['Название'] || '',
                    category: row['Категория'] || 'Без категории',
                    quantity: parseInt(row['Количество']) || 0,
                    price: parseFloat(row['Цена за ед.']) || 0,
                    description: row['Описание'] || ''
                }));

                if (imported.length > 0) {
                    for (const item of imported) {
                        await addEquipment(item);
                    }
                    await loadData();
                    alert(`Импортировано ${imported.length} позиций`);
                }
            },
            error: (err) => alert('Ошибка импорта: ' + err.message)
        });
        e.target.value = '';
    };

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        if (categories.some(c => c.name === newCategoryName.trim())) {
            alert('Такая категория уже существует');
            return;
        }
        await addCategory(newCategoryName.trim());
        await loadData();
        setNewCategoryName('');
        setIsCategoryModalOpen(false);
    };

    const handleDeleteCategory = async (id: string, name: string) => {
        if (equipment.some(e => e.category === name)) {
            alert('Нельзя удалить категорию, в которой есть оборудование');
            return;
        }
        if (confirm(`Удалить категорию "${name}"?`)) {
            await deleteCategory(id);
            await loadData();
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Управление оборудованием</h2>
                    <p className="text-gray-500">Всего позиций: {equipment.length}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <label className="cursor-pointer">
                        <Button variant="outline" size="sm">
                            <Upload className="w-4 h-4 mr-2" /> Импорт CSV
                        </Button>
                        <input type="file" accept=".csv" onChange={importFromCSV} className="hidden" />
                    </label>
                    <Button variant="outline" size="sm" onClick={exportToCSV}>
                        <Download className="w-4 h-4 mr-2" /> Экспорт CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsCategoryModalOpen(true)}>
                        <FolderPlus className="w-4 h-4 mr-2" /> Категории
                    </Button>
                    <Button size="sm" onClick={() => openModal()}>
                        <Plus className="w-4 h-4 mr-2" /> Добавить
                    </Button>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Поиск оборудования..."
                    className="pl-10"
                />
            </div>

            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                {equipment.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <p>Оборудование не найдено</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {Object.entries(filteredGrouped).map(([category, items]) => (
                            <div key={category}>
                                <button
                                    onClick={() => toggleCategory(category)}
                                    className="w-full bg-gray-50 border-l-4 border-blue-500 px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-700">{category}</span>
                                        <span className="text-sm text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{items.length}</span>
                                    </div>
                                    {expandedCategories[category] !== false ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                                {(expandedCategories[category] !== false) && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Название</th>
                                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Описание</th>
                                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 w-24">Кол-во</th>
                                                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 w-32">Цена за ед.</th>
                                                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 w-32">Сумма</th>
                                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 w-24">Действия</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {items.map(item => (
                                                    <tr key={item.id} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-500">{item.description || '-'}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`inline-flex items-center justify-center w-10 h-6 rounded-full text-sm font-medium ${
                                                                item.quantity > 5 ? 'bg-green-100 text-green-700' :
                                                                    item.quantity > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                                            }`}>
                                                                {item.quantity}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.price)}</td>
                                                        <td className="px-4 py-3 text-right font-medium text-blue-600">{formatCurrency(item.price * item.quantity)}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button onClick={() => openModal(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                                                                    <Edit className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">
                                                                    <Trash className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Equipment Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'Редактировать оборудование' : 'Добавить оборудование'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Название *</label>
                            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Категория *</label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Количество</label>
                                <Input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Цена за ед. (₽)</label>
                                <Input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Описание</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            />
                        </div>
                        <div className="flex gap-2 pt-4">
                            <Button variant="outline" onClick={closeModal} className="flex-1" disabled={saving}>Отмена</Button>
                            <Button onClick={handleSave} className="flex-1" disabled={saving || !formData.name}>
                                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Сохранить
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Categories Modal */}
            <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Управление категориями</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="flex gap-2">
                            <Input placeholder="Новая категория" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
                            <Button onClick={handleAddCategory}><Plus className="w-4 h-4" /></Button>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {categories.map(cat => (
                                <div key={cat.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                    <span>{cat.name}</span>
                                    <button onClick={() => handleDeleteCategory(cat.id, cat.name)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                                        <Trash className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
