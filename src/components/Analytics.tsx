import { useEffect, useRef, useMemo } from 'react';
import { Package, FileText, TrendingUp, Calendar } from 'lucide-react';
import type { Equipment, Estimate } from '@/types';
import { formatCurrency } from '@/lib/supabase';
import Chart from 'chart.js/auto';

interface AnalyticsProps {
    equipment: Equipment[];
    estimates: Estimate[];
}

export default function Analytics({ equipment, estimates }: AnalyticsProps) {
    const categoryChartRef = useRef<HTMLCanvasElement>(null);
    const monthChartRef = useRef<HTMLCanvasElement>(null);
    const topChartRef = useRef<HTMLCanvasElement>(null);
    const chartsRef = useRef<Chart[]>([]);

    const stats = useMemo(() => {
        const totalEquipment = equipment.length;
        const totalQuantity = equipment.reduce((sum, item) => sum + item.quantity, 0);
        const totalValue = equipment.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalEstimates = estimates.length;
        const currentMonth = new Date().toISOString().slice(0, 7);
        const currentMonthEstimates = estimates.filter(est => (est.created_at || '').startsWith(currentMonth));
        const currentMonthRevenue = currentMonthEstimates.reduce((sum, est) => sum + (est.total || 0), 0);
        return { totalEquipment, totalQuantity, totalValue, totalEstimates, currentMonthEstimates, currentMonthRevenue };
    }, [equipment, estimates]);

    const equipmentByCategory = useMemo(() => {
        return equipment.reduce((acc, item) => { acc[item.category] = (acc[item.category] || 0) + item.quantity; return acc; }, {} as Record<string, number>);
    }, [equipment]);

    const estimatesByMonth = useMemo(() => {
        return estimates.reduce((acc, est) => { const month = (est.created_at || '').slice(0, 7) || 'unknown'; acc[month] = (acc[month] || 0) + (est.total || 0); return acc; }, {} as Record<string, number>);
    }, [estimates]);

    const topEquipment = useMemo(() => {
        const equipmentRevenue: Record<string, number> = {};
        estimates.forEach(est => (est.items || []).forEach(item => { equipmentRevenue[item.name] = (equipmentRevenue[item.name] || 0) + (item.price * item.quantity); }));
        return Object.entries(equipmentRevenue).sort((a, b) => b[1] - a[1]).slice(0, 10);
    }, [estimates]);

    useEffect(() => {
        chartsRef.current.forEach(chart => chart.destroy());
        chartsRef.current = [];

        if (categoryChartRef.current && Object.keys(equipmentByCategory).length > 0) {
            const ctx = categoryChartRef.current.getContext('2d');
            if (ctx) chartsRef.current.push(new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(equipmentByCategory), datasets: [{ data: Object.values(equipmentByCategory), backgroundColor: ['#1e3a5f', '#2d5a87', '#3d7ab5', '#4e9ae3', '#6b7280', '#9ca3af'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } } } } }));
        }

        if (monthChartRef.current && Object.keys(estimatesByMonth).length > 0) {
            const ctx = monthChartRef.current.getContext('2d');
            const sortedMonths = Object.keys(estimatesByMonth).sort();
            if (ctx) chartsRef.current.push(new Chart(ctx, { type: 'bar', data: { labels: sortedMonths.map(m => { const [year, month] = m.split('-'); return `${month}.${year}`; }), datasets: [{ label: 'Выручка (₽)', data: sortedMonths.map(m => estimatesByMonth[m]), backgroundColor: '#2563eb' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: function(value) { return Number(value).toLocaleString('ru-RU'); } } } } } }));
        }

        if (topChartRef.current && topEquipment.length > 0) {
            const ctx = topChartRef.current.getContext('2d');
            if (ctx) chartsRef.current.push(new Chart(ctx, { type: 'bar', data: { labels: topEquipment.map(([name]) => name.length > 20 ? name.slice(0, 20) + '...' : name), datasets: [{ label: 'Выручка (₽)', data: topEquipment.map(([, revenue]) => revenue), backgroundColor: '#1e3a5f' }] }, options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: function(value) { return Number(value).toLocaleString('ru-RU'); } } } } } }));
        }

        return () => { chartsRef.current.forEach(chart => chart.destroy()); };
    }, [equipmentByCategory, estimatesByMonth, topEquipment]);

    return (
        <div className="space-y-6">
            <div><h2 className="text-2xl font-bold text-gray-800">Аналитика</h2><p className="text-gray-500">Статистика и показатели</p></div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border rounded-xl p-4 shadow-sm"><div className="flex items-center gap-2 text-gray-500 mb-2"><Package className="w-4 h-4" /><span className="text-sm">Всего оборудования</span></div><p className="text-2xl font-bold text-gray-800">{stats.totalEquipment}</p><p className="text-sm text-gray-400">{stats.totalQuantity} единиц</p></div>
                <div className="bg-white border rounded-xl p-4 shadow-sm"><div className="flex items-center gap-2 text-gray-500 mb-2"><FileText className="w-4 h-4" /><span className="text-sm">Всего смет</span></div><p className="text-2xl font-bold text-gray-800">{stats.totalEstimates}</p></div>
                <div className="bg-white border rounded-xl p-4 shadow-sm"><div className="flex items-center gap-2 text-gray-500 mb-2"><Calendar className="w-4 h-4" /><span className="text-sm">Смет в этом месяце</span></div><p className="text-2xl font-bold text-gray-800">{stats.currentMonthEstimates.length}</p></div>
                <div className="bg-white border rounded-xl p-4 shadow-sm"><div className="flex items-center gap-2 text-gray-500 mb-2"><TrendingUp className="w-4 h-4" /><span className="text-sm">Выручка за месяц</span></div><p className="text-xl font-bold text-green-600">{formatCurrency(stats.currentMonthRevenue)}</p></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border rounded-xl p-4 shadow-sm"><h3 className="font-semibold text-gray-700 mb-4">Оборудование по категориям</h3><div className="h-[250px]">{Object.keys(equipmentByCategory).length > 0 ? <canvas ref={categoryChartRef} /> : <div className="flex items-center justify-center h-full text-gray-400">Нет данных</div>}</div></div>
                <div className="bg-white border rounded-xl p-4 shadow-sm"><h3 className="font-semibold text-gray-700 mb-4">Сметы по месяцам</h3><div className="h-[250px]">{Object.keys(estimatesByMonth).length > 0 ? <canvas ref={monthChartRef} /> : <div className="flex items-center justify-center h-full text-gray-400">Нет данных</div>}</div></div>
                <div className="bg-white border rounded-xl p-4 shadow-sm md:col-span-2"><h3 className="font-semibold text-gray-700 mb-4">Топ-10 оборудования по выручке</h3><div className="h-[250px]">{topEquipment.length > 0 ? <canvas ref={topChartRef} /> : <div className="flex items-center justify-center h-full text-gray-400">Нет данных</div>}</div></div>
            </div>

            <div className="bg-white border rounded-xl p-4 shadow-sm">
                <h3 className="font-semibold text-gray-700 mb-4">Состояние склада</h3>
                <div className="space-y-4">
                    {Object.entries(equipment.reduce((acc, item) => { if (!acc[item.category]) acc[item.category] = []; acc[item.category].push(item); return acc; }, {} as Record<string, Equipment[]>)).map(([category, items]) => (
                        <div key={category} className="border rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2 font-medium text-gray-700">{category} ({items.length} позиций)</div>
                            <div className="divide-y">
                                {items.map(item => (
                                    <div key={item.id} className="px-4 py-2 flex justify-between items-center">
                                        <div><span className="font-medium">{item.name}</span>{item.description && <span className="text-sm text-gray-500 ml-2">{item.description}</span>}</div>
                                        <div className="flex items-center gap-4">
                                            <span className={`px-2 py-1 rounded text-sm ${item.quantity > 5 ? 'bg-green-100 text-green-700' : item.quantity > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{item.quantity} шт.</span>
                                            <span className="text-sm text-gray-600 w-24 text-right">{formatCurrency(item.price)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
