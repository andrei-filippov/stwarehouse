import { useState, useEffect } from 'react';
import { Package, FileText, Layout, Calendar as CalendarIcon, CheckSquare, BarChart3, Settings, Users, LogOut, Loader2 } from 'lucide-react';
import type { Equipment, Estimate, Checklist, Staff } from '@/types';
import { getCurrentUser, getProfile, signOut, getEquipment, getEstimates, getChecklists, getStaff } from '@/lib/supabase';

import LoginScreen from '@/components/LoginScreen';
import EquipmentManagement from '@/components/EquipmentManagement';
import EstimatesManagement from '@/components/EstimatesManagement';
import Templates from '@/components/Templates';
import Calendar from '@/components/Calendar';
import Checklists from '@/components/Checklists';
import Analytics from '@/components/Analytics';
import Rules from '@/components/Rules';
import StaffComponent from '@/components/StaffComponent';

function App() {
    const [user, setUser] = useState<any | null>(null);
    const [profile, setProfile] = useState<{ name: string; role: string } | null>(null);
    const [activeTab, setActiveTab] = useState('equipment');
    const [loading, setLoading] = useState(true);

    // Data states
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [checklists, setChecklists] = useState<Checklist[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);

    // Check auth on mount
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const user = await getCurrentUser();
        if (user) {
            setUser(user);
            const { data: profileData } = await getProfile(user.id);
            if (profileData) setProfile(profileData);
            await loadAllData();
        }
        setLoading(false);
    };

    const loadAllData = async () => {
        const [{ data: eqData }, { data: estData }, { data: chkData }, { data: staffData }] = await Promise.all([
            getEquipment(), getEstimates(), getChecklists(), getStaff()
        ]);
        setEquipment(eqData);
        setEstimates(estData);
        setChecklists(chkData);
        setStaff(staffData);
    };

    const handleLogin = (userData: any) => {
        setUser(userData);
        checkAuth();
    };

    const handleLogout = async () => {
        await signOut();
        setUser(null);
        setProfile(null);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-500">Загрузка...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <LoginScreen onLogin={handleLogin} />;
    }

    const navItems = [
        { id: 'equipment', label: 'Оборудование', icon: Package },
        { id: 'estimates', label: 'Сметы', icon: FileText },
        { id: 'templates', label: 'Шаблоны', icon: Layout },
        { id: 'calendar', label: 'Календарь', icon: CalendarIcon },
        { id: 'checklists', label: 'Чек-листы', icon: CheckSquare },
        { id: 'analytics', label: 'Аналитика', icon: BarChart3 },
        { id: 'rules', label: 'Правила', icon: Settings },
        { id: 'staff', label: 'Персонал', icon: Users }
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'equipment': return <EquipmentManagement />;
            case 'estimates': return <EstimatesManagement />;
            case 'templates': return <Templates />;
            case 'calendar': return <Calendar estimates={estimates} />;
            case 'checklists': return <Checklists />;
            case 'analytics': return <Analytics equipment={equipment} estimates={estimates} />;
            case 'rules': return <Rules />;
            case 'staff': return <StaffComponent />;
            default: return <EquipmentManagement />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                                <Package className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-800">СкладОборуд</h1>
                                <p className="text-xs text-gray-500">Система учета оборудования</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
                                <span>{profile?.name || user.email}</span>
                                <span className="text-gray-300">|</span>
                                <span className="text-gray-400 text-xs">{user.email}</span>
                            </div>
                            <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                                <LogOut className="w-4 h-4" />
                                <span className="hidden sm:inline">Выйти</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Navigation */}
            <nav className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center gap-1 overflow-x-auto py-2">
                        {navItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                                    activeTab === item.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                <item.icon className="w-4 h-4" />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-6">
                {renderContent()}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t mt-auto">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
                        <p>Система учета оборудования © 2024</p>
                        <div className="flex gap-4">
                            <span>Оборудования: {equipment.length}</span>
                            <span>Смет: {estimates.length}</span>
                            <span>Чек-листов: {checklists.length}</span>
                            <span>Персонал: {staff.length}</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default App;
