const { useState, useEffect, useRef, useCallback } = React;

// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
    apiKey: "AIzaSyDummyKeyForDemo123456789",
    authDomain: "stwarehouse-demo.firebaseapp.com",
    databaseURL: "https://stwarehouse-demo-default-rtdb.firebaseio.com",
    projectId: "stwarehouse-demo",
    storageBucket: "stwarehouse-demo.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// ==================== PRESET USERS ====================
const PRESET_USERS = [
    { email: "admin@stwarehouse.ru", password: "Admin2024!", name: "Администратор" },
    { email: "manager1@stwarehouse.ru", password: "Manager1!", name: "Менеджер 1" },
    { email: "manager2@stwarehouse.ru", password: "Manager2!", name: "Менеджер 2" },
    { email: "sklad@stwarehouse.ru", password: "Sklad2024!", name: "Складской работник" },
    { email: "buh@stwarehouse.ru", password: "Buh2024!", name: "Бухгалтер" }
];

// ==================== ICONS ====================
const Icons = {
    Package: () => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }, 
        React.createElement('path', { d: 'm7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z' }),
        React.createElement('path', { d: 'm3.3 7 8.7 5 8.7-5' }),
        React.createElement('path', { d: 'M12 22V12' })
    ),
    FileText: () => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('path', { d: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z' }),
        React.createElement('polyline', { points: '14 2 14 8 20 8' }),
        React.createElement('line', { x1: 16, y1: 13, x2: 8, y2: 13 }),
        React.createElement('line', { x1: 16, y1: 17, x2: 8, y2: 17 }),
        React.createElement('line', { x1: 10, y1: 9, x2: 8, y2: 9 })
    ),
    Layout: () => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('rect', { width: 18, height: 18, x: 3, y: 3, rx: 2 }),
        React.createElement('path', { d: 'M3 9h18' }),
        React.createElement('path', { d: 'M9 21V9' })
    ),
    Calendar: () => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('rect', { width: 18, height: 18, x: 3, y: 4, rx: 2, ry: 2 }),
        React.createElement('line', { x1: 16, y1: 2, x2: 16, y2: 6 }),
        React.createElement('line', { x1: 8, y1: 2, x2: 8, y2: 6 }),
        React.createElement('line', { x1: 3, y1: 10, x2: 21, y2: 10 })
    ),
    CheckSquare: () => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('path', { d: 'm9 11 3 3L22 4' }),
        React.createElement('path', { d: 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' })
    ),
    BarChart: () => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('line', { x1: 12, y1: 20, x2: 12, y2: 10 }),
        React.createElement('line', { x1: 18, y1: 20, x2: 18, y2: 4 }),
        React.createElement('line', { x1: 6, y1: 20, x2: 6, y2: 16 })
    ),
    Settings: () => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('path', { d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' }),
        React.createElement('circle', { cx: 12, cy: 12, r: 3 })
    ),
    Users: () => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }),
        React.createElement('circle', { cx: 9, cy: 7, r: 4 }),
        React.createElement('path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }),
        React.createElement('path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' })
    ),
    Plus: () => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('path', { d: 'M5 12h14' }),
        React.createElement('path', { d: 'M12 5v14' })
    ),
    Search: () => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('circle', { cx: 11, cy: 11, r: 8 }),
        React.createElement('path', { d: 'm21 21-4.3-4.3' })
    ),
    Edit: () => React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }),
        React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' })
    ),
    Trash: () => React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('polyline', { points: '3 6 5 6 21 6' }),
        React.createElement('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' })
    ),
    Download: () => React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
        React.createElement('polyline', { points: '7 10 12 15 17 10' }),
        React.createElement('line', { x1: 12, y1: 15, x2: 12, y2: 3 })
    ),
    Upload: () => React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
        React.createElement('polyline', { points: '17 8 12 3 7 8' }),
        React.createElement('line', { x1: 12, y1: 3, x2: 12, y2: 15 })
    ),
    X: () => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('path', { d: 'M18 6 6 18' }),
        React.createElement('path', { d: 'm6 6 12 12' })
    ),
    ChevronDown: () => React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('path', { d: 'm6 9 6 6 6-6' })
    ),
    ChevronUp: () => React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('path', { d: 'm18 15-6-6-6 6' })
    ),
    LogOut: () => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('path', { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' }),
        React.createElement('polyline', { points: '16 17 21 12 16 7' }),
        React.createElement('line', { x1: 21, y1: 12, x2: 9, y2: 12 })
    ),
    Eye: () => React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('path', { d: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z' }),
        React.createElement('circle', { cx: 12, cy: 12, r: 3 })
    ),
    EyeOff: () => React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('path', { d: 'M9.88 9.88a3 3 0 1 0 4.24 4.24' }),
        React.createElement('path', { d: 'M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68' }),
        React.createElement('path', { d: 'M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61' }),
        React.createElement('line', { x1: 2, y1: 2, x2: 22, y2: 22 })
    ),
    Ruble: () => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('path', { d: 'M6 3h12' }),
        React.createElement('path', { d: 'M6 8h12' }),
        React.createElement('path', { d: 'M6 13h9' }),
        React.createElement('path', { d: 'M9 18v5' }),
        React.createElement('path', { d: 'M6 18h6' })
    ),
    Image: () => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
        React.createElement('rect', { width: 18, height: 18, x: 3, y: 3, rx: 2, ry: 2 }),
        React.createElement('circle', { cx: 8.5, cy: 8.5, r: 1.5 }),
        React.createElement('polyline', { points: '21 15 16 10 5 21' })
    )
};

// ==================== UTILITY FUNCTIONS ====================
const formatCurrency = (value) => {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(value);
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
};

const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// ==================== LOCAL STORAGE SYNC ====================
const STORAGE_KEY = 'stwarehouse_data';
const USER_KEY = 'stwarehouse_user';

const getLocalData = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
};

const setLocalData = (data) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Error saving data:', e);
    }
};

const getLocalUser = () => {
    try {
        const user = localStorage.getItem(USER_KEY);
        return user ? JSON.parse(user) : null;
    } catch (e) {
        return null;
    }
};

const setLocalUser = (user) => {
    try {
        if (user) {
            localStorage.setItem(USER_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(USER_KEY);
        }
    } catch (e) {
        console.error('Error saving user:', e);
    }
};

// ==================== DEMO DATA ====================
const DEMO_EQUIPMENT = [
    { id: '1', name: 'Проектор Epson EB-E01', category: 'Проекторы', quantity: 5, price: 45000, description: 'XGA 1024x768, 3300 люмен, контраст 15000:1' },
    { id: '2', name: 'Проектор BenQ MX535', category: 'Проекторы', quantity: 3, price: 52000, description: 'XGA 1024x768, 3600 люмен, контраст 15000:1' },
    { id: '3', name: 'Экран проекционный 100"', category: 'Экраны', quantity: 8, price: 8500, description: 'Настенный, 203x152 см, матовый' },
    { id: '4', name: 'Экран проекционный 120"', category: 'Экраны', quantity: 4, price: 12000, description: 'Настенный, 244x183 см, матовый' },
    { id: '5', name: 'Микрофон Shure SM58', category: 'Звук', quantity: 12, price: 15000, description: 'Вокальный динамический микрофон' },
    { id: '6', name: 'Микшерный пульт Behringer Xenyx', category: 'Звук', quantity: 3, price: 18000, description: '12 каналов, USB интерфейс' },
    { id: '7', name: 'Колонка активная JBL EON615', category: 'Звук', quantity: 6, price: 42000, description: '15", 1000 Вт, Bluetooth' },
    { id: '8', name: 'Ноутбук Dell Latitude 5520', category: 'Компьютеры', quantity: 10, price: 95000, description: 'i5-1145G7, 16GB RAM, 512GB SSD' },
    { id: '9', name: 'Ноутбук HP ProBook 450 G8', category: 'Компьютеры', quantity: 8, price: 88000, description: 'i5-1135G7, 16GB RAM, 512GB SSD' },
    { id: '10', name: 'Кликер Logitech R800', category: 'Аксессуары', quantity: 15, price: 6500, description: 'Презентер с лазерной указкой' }
];

const DEMO_ESTIMATES = [
    {
        id: 'est1',
        name: 'Конференция "Технологии 2024"',
        eventName: 'Конференция "Технологии 2024"',
        venue: 'КВЦ "Экспоцентр", Москва',
        eventDate: '2024-03-15',
        date: '2024-02-10',
        items: [
            { equipmentId: '1', name: 'Проектор Epson EB-E01', quantity: 2, price: 45000 },
            { equipmentId: '3', name: 'Экран проекционный 100"', quantity: 2, price: 8500 },
            { equipmentId: '5', name: 'Микрофон Shure SM58', quantity: 4, price: 15000 },
            { equipmentId: '7', name: 'Колонка активная JBL EON615', quantity: 2, price: 42000 }
        ],
        total: 221000
    },
    {
        id: 'est2',
        name: 'Семинар по маркетингу',
        eventName: 'Семинар по маркетингу',
        venue: 'Отель "Марриотт", Санкт-Петербург',
        eventDate: '2024-02-28',
        date: '2024-02-15',
        items: [
            { equipmentId: '8', name: 'Ноутбук Dell Latitude 5520', quantity: 5, price: 95000 },
            { equipmentId: '10', name: 'Кликер Logitech R800', quantity: 5, price: 6500 }
        ],
        total: 507500
    }
];

// ==================== COMPONENTS ====================

// Button Component
const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = 'button' }) => {
    const baseStyles = 'px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2';
    const variants = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
        secondary: 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100',
        danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
        outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 disabled:border-blue-300 disabled:text-blue-300',
        ghost: 'text-gray-600 hover:bg-gray-100 disabled:text-gray-300'
    };
    
    return React.createElement('button', {
        type,
        onClick,
        disabled,
        className: `${baseStyles} ${variants[variant]} ${className}`
    }, children);
};

// Input Component
const Input = ({ label, value, onChange, type = 'text', placeholder = '', required = false, className = '' }) => {
    return React.createElement('div', { className: `flex flex-col gap-1 ${className}` },
        label && React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 
            label, required && React.createElement('span', { className: 'text-red-500' }, ' *')
        ),
        React.createElement('input', {
            type,
            value,
            onChange: (e) => onChange(e.target.value),
            placeholder,
            required,
            className: 'px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all'
        })
    );
};

// Modal Component
const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
    if (!isOpen) return null;
    
    const sizes = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl'
    };
    
    return React.createElement('div', { 
        className: 'fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay',
        onClick: onClose
    },
        React.createElement('div', { 
            className: `bg-white rounded-xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] overflow-auto`,
            onClick: (e) => e.stopPropagation()
        },
            React.createElement('div', { className: 'flex items-center justify-between p-4 border-b' },
                React.createElement('h3', { className: 'text-lg font-semibold text-gray-800' }, title),
                React.createElement('button', { 
                    onClick: onClose,
                    className: 'p-1 hover:bg-gray-100 rounded-lg transition-colors'
                }, React.createElement(Icons.X))
            ),
            React.createElement('div', { className: 'p-4' }, children)
        )
    );
};

// ==================== LOGIN COMPONENT ====================
const LoginScreen = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        // Check preset users
        const user = PRESET_USERS.find(u => u.email === email && u.password === password);
        
        if (user) {
            setTimeout(() => {
                setLocalUser(user);
                onLogin(user);
                setLoading(false);
            }, 500);
        } else {
            setError('Неверный email или пароль');
            setLoading(false);
        }
    };
    
    return React.createElement('div', { className: 'min-h-screen business-gradient flex items-center justify-center p-4' },
        React.createElement('div', { className: 'bg-white rounded-2xl shadow-2xl w-full max-w-md p-8' },
            React.createElement('div', { className: 'text-center mb-8' },
                React.createElement('div', { className: 'w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4' },
                    React.createElement(Icons.Package, { className: 'text-white' })
                ),
                React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'СкладОборуд'),
                React.createElement('p', { className: 'text-gray-500 mt-1' }, 'Система учета оборудования')
            ),
            
            error && React.createElement('div', { className: 'bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4' }, error),
            
            React.createElement('form', { onSubmit: handleSubmit, className: 'space-y-4' },
                React.createElement(Input, {
                    label: 'Email',
                    type: 'email',
                    value: email,
                    onChange: setEmail,
                    placeholder: 'Введите email',
                    required: true
                }),
                
                React.createElement('div', { className: 'flex flex-col gap-1' },
                    React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 'Пароль'),
                    React.createElement('div', { className: 'relative' },
                        React.createElement('input', {
                            type: showPassword ? 'text' : 'password',
                            value: password,
                            onChange: (e) => setPassword(e.target.value),
                            placeholder: 'Введите пароль',
                            required: true,
                            className: 'w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all'
                        }),
                        React.createElement('button', {
                            type: 'button',
                            onClick: () => setShowPassword(!showPassword),
                            className: 'absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600'
                        }, showPassword ? React.createElement(Icons.EyeOff) : React.createElement(Icons.Eye))
                    )
                ),
                
                React.createElement(Button, { 
                    type: 'submit', 
                    className: 'w-full justify-center',
                    disabled: loading 
                }, loading ? 'Вход...' : 'Войти')
            ),
            
            React.createElement('div', { className: 'mt-6 pt-6 border-t' },
                React.createElement('p', { className: 'text-sm text-gray-500 mb-3' }, 'Демо-аккаунты:'),
                React.createElement('div', { className: 'space-y-2 text-sm' },
                    PRESET_USERS.map((u, i) => 
                        React.createElement('div', { 
                            key: i, 
                            className: 'flex justify-between items-center p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100',
                            onClick: () => { setEmail(u.email); setPassword(u.password); }
                        },
                            React.createElement('span', { className: 'font-medium' }, u.name),
                            React.createElement('span', { className: 'text-gray-400 text-xs' }, u.email)
                        )
                    )
                )
            )
        )
    );
};

// ==================== EQUIPMENT MANAGEMENT COMPONENT ====================
const EquipmentManagement = ({ equipment, setEquipment, categories }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [expandedCategories, setExpandedCategories] = useState({});
    
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        quantity: 1,
        price: 0,
        description: ''
    });
    
    // Group equipment by category
    const groupedEquipment = equipment.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {});
    
    // Filter equipment
    const filteredEquipment = searchTerm 
        ? equipment.filter(item => 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        : equipment;
    
    const filteredGrouped = filteredEquipment.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {});
    
    const handleSave = () => {
        if (!formData.name || !formData.category) return;
        
        if (editingItem) {
            setEquipment(equipment.map(item => 
                item.id === editingItem.id 
                    ? { ...item, ...formData, quantity: parseInt(formData.quantity) || 0, price: parseFloat(formData.price) || 0 }
                    : item
            ));
        } else {
            const newItem = {
                id: generateId(),
                ...formData,
                quantity: parseInt(formData.quantity) || 0,
                price: parseFloat(formData.price) || 0
            };
            setEquipment([...equipment, newItem]);
        }
        
        closeModal();
    };
    
    const handleDelete = (id) => {
        if (confirm('Удалить это оборудование?')) {
            setEquipment(equipment.filter(item => item.id !== id));
        }
    };
    
    const openModal = (item = null) => {
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
            setFormData({ name: '', category: categories[0] || '', quantity: 1, price: 0, description: '' });
        }
        setIsModalOpen(true);
    };
    
    const closeModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
        setFormData({ name: '', category: '', quantity: 1, price: 0, description: '' });
    };
    
    const toggleCategory = (category) => {
        setExpandedCategories(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };
    
    // Export to CSV with UTF-8 BOM
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
    const importFromCSV = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        Papa.parse(file, {
            header: true,
            encoding: 'UTF-8',
            complete: (results) => {
                const imported = results.data.filter(row => row['Название']).map(row => ({
                    id: generateId(),
                    name: row['Название'] || '',
                    category: row['Категория'] || 'Без категории',
                    quantity: parseInt(row['Количество']) || 0,
                    price: parseFloat(row['Цена за ед.']) || 0,
                    description: row['Описание'] || ''
                }));
                
                if (imported.length > 0) {
                    setEquipment([...equipment, ...imported]);
                    alert(`Импортировано ${imported.length} позиций`);
                }
            },
            error: (err) => {
                alert('Ошибка импорта: ' + err.message);
            }
        });
        
        e.target.value = '';
    };
    
    return React.createElement('div', { className: 'space-y-4' },
        React.createElement('div', { className: 'flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4' },
            React.createElement('div', null,
                React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, 'Управление оборудованием'),
                React.createElement('p', { className: 'text-gray-500' }, `Всего позиций: ${equipment.length}`)
            ),
            React.createElement('div', { className: 'flex flex-wrap gap-2' },
                React.createElement('label', { className: 'cursor-pointer' },
                    React.createElement(Button, { variant: 'secondary' }, 
                        React.createElement(Icons.Upload), 'Импорт CSV'
                    ),
                    React.createElement('input', {
                        type: 'file',
                        accept: '.csv',
                        onChange: importFromCSV,
                        className: 'hidden'
                    })
                ),
                React.createElement(Button, { variant: 'secondary', onClick: exportToCSV }, 
                    React.createElement(Icons.Download), 'Экспорт CSV'
                ),
                React.createElement(Button, { onClick: () => openModal() }, 
                    React.createElement(Icons.Plus), 'Добавить оборудование'
                )
            )
        ),
        
        React.createElement('div', { className: 'relative' },
            React.createElement('div', { className: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-400' },
                React.createElement(Icons.Search)
            ),
            React.createElement('input', {
                type: 'text',
                value: searchTerm,
                onChange: (e) => setSearchTerm(e.target.value),
                placeholder: 'Поиск оборудования...',
                className: 'w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
            })
        ),
        
        React.createElement('div', { className: 'business-card rounded-xl overflow-hidden' },
            equipment.length === 0 
                ? React.createElement('div', { className: 'p-12 text-center text-gray-500' },
                    React.createElement(Icons.Package, { className: 'w-16 h-16 mx-auto mb-4 text-gray-300' }),
                    React.createElement('p', null, 'Оборудование не найдено')
                )
                : React.createElement('div', { className: 'divide-y' },
                    Object.entries(filteredGrouped).map(([category, items]) => 
                        React.createElement('div', { key: category },
                            React.createElement('button', {
                                onClick: () => toggleCategory(category),
                                className: 'w-full category-header px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors'
                            },
                                React.createElement('div', { className: 'flex items-center gap-2' },
                                    React.createElement('span', { className: 'font-semibold text-gray-700' }, category),
                                    React.createElement('span', { className: 'text-sm text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full' }, items.length)
                                ),
                                expandedCategories[category] !== false 
                                    ? React.createElement(Icons.ChevronUp) 
                                    : React.createElement(Icons.ChevronDown)
                            ),
                            (expandedCategories[category] !== false) && React.createElement('div', { className: 'overflow-x-auto' },
                                React.createElement('table', { className: 'w-full' },
                                    React.createElement('thead', { className: 'bg-gray-50' },
                                        React.createElement('tr', null,
                                            React.createElement('th', { className: 'px-4 py-3 text-left text-sm font-medium text-gray-600' }, 'Название'),
                                            React.createElement('th', { className: 'px-4 py-3 text-left text-sm font-medium text-gray-600' }, 'Описание'),
                                            React.createElement('th', { className: 'px-4 py-3 text-center text-sm font-medium text-gray-600 w-24' }, 'Кол-во'),
                                            React.createElement('th', { className: 'px-4 py-3 text-right text-sm font-medium text-gray-600 w-32' }, 'Цена за ед.'),
                                            React.createElement('th', { className: 'px-4 py-3 text-right text-sm font-medium text-gray-600 w-32' }, 'Сумма'),
                                            React.createElement('th', { className: 'px-4 py-3 text-center text-sm font-medium text-gray-600 w-24' }, 'Действия')
                                        )
                                    ),
                                    React.createElement('tbody', { className: 'divide-y' },
                                        items.map(item => 
                                            React.createElement('tr', { key: item.id, className: 'hover:bg-gray-50' },
                                                React.createElement('td', { className: 'px-4 py-3' },
                                                    React.createElement('div', { className: 'font-medium text-gray-800' }, item.name)
                                                ),
                                                React.createElement('td', { className: 'px-4 py-3 text-sm text-gray-500' },
                                                    item.description || '-'
                                                ),
                                                React.createElement('td', { className: 'px-4 py-3 text-center' },
                                                    React.createElement('span', { 
                                                        className: `inline-flex items-center justify-center w-10 h-6 rounded-full text-sm font-medium ${
                                                            item.quantity > 5 ? 'bg-green-100 text-green-700' : 
                                                            item.quantity > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                                        }`
                                                    }, item.quantity)
                                                ),
                                                React.createElement('td', { className: 'px-4 py-3 text-right font-medium' },
                                                    formatCurrency(item.price)
                                                ),
                                                React.createElement('td', { className: 'px-4 py-3 text-right font-medium text-blue-600' },
                                                    formatCurrency(item.price * item.quantity)
                                                ),
                                                React.createElement('td', { className: 'px-4 py-3' },
                                                    React.createElement('div', { className: 'flex items-center justify-center gap-1' },
                                                        React.createElement('button', {
                                                            onClick: () => openModal(item),
                                                            className: 'p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors'
                                                        }, React.createElement(Icons.Edit)),
                                                        React.createElement('button', {
                                                            onClick: () => handleDelete(item.id),
                                                            className: 'p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors'
                                                        }, React.createElement(Icons.Trash))
                                                    )
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
        ),
        
        React.createElement(Modal, {
            isOpen: isModalOpen,
            onClose: closeModal,
            title: editingItem ? 'Редактировать оборудование' : 'Добавить оборудование'
        },
            React.createElement('div', { className: 'space-y-4' },
                React.createElement(Input, {
                    label: 'Название',
                    value: formData.name,
                    onChange: (v) => setFormData({...formData, name: v}),
                    required: true
                }),
                
                React.createElement('div', { className: 'flex flex-col gap-1' },
                    React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 'Категория *'),
                    React.createElement('select', {
                        value: formData.category,
                        onChange: (e) => setFormData({...formData, category: e.target.value}),
                        className: 'px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
                    },
                        categories.map(cat => React.createElement('option', { key: cat, value: cat }, cat))
                    )
                ),
                
                React.createElement('div', { className: 'grid grid-cols-2 gap-4' },
                    React.createElement(Input, {
                        label: 'Количество',
                        type: 'number',
                        value: formData.quantity,
                        onChange: (v) => setFormData({...formData, quantity: v}),
                        required: true
                    }),
                    React.createElement(Input, {
                        label: 'Цена за ед. (₽)',
                        type: 'number',
                        value: formData.price,
                        onChange: (v) => setFormData({...formData, price: v}),
                        required: true
                    })
                ),
                
                React.createElement('div', { className: 'flex flex-col gap-1' },
                    React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 'Описание'),
                    React.createElement('textarea', {
                        value: formData.description,
                        onChange: (e) => setFormData({...formData, description: e.target.value}),
                        rows: 3,
                        className: 'px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none'
                    })
                ),
                
                React.createElement('div', { className: 'flex gap-2 pt-4' },
                    React.createElement(Button, { variant: 'secondary', onClick: closeModal, className: 'flex-1' }, 'Отмена'),
                    React.createElement(Button, { onClick: handleSave, className: 'flex-1' }, 'Сохранить')
                )
            )
        )
    );
};

// ==================== ESTIMATES COMPONENT ====================
const EstimatesManagement = ({ equipment, estimates, setEstimates }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPdfSettingsOpen, setIsPdfSettingsOpen] = useState(false);
    const [editingEstimate, setEditingEstimate] = useState(null);
    const [currentEstimate, setCurrentEstimate] = useState(null);
    
    const [pdfSettings, setPdfSettings] = useState({
        logo: null,
        companyName: '',
        companyDetails: '',
        position: '',
        personName: '',
        signature: null,
        stamp: null
    });
    
    const [formData, setFormData] = useState({
        eventName: '',
        venue: '',
        eventDate: '',
        items: []
    });
    
    const filteredEstimates = estimates.filter(est => 
        est.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        est.eventName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        est.venue?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const calculateTotal = (items) => {
        return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };
    
    const handleAddItem = (equipmentItem) => {
        const existing = formData.items.find(i => i.equipmentId === equipmentItem.id);
        if (existing) {
            setFormData({
                ...formData,
                items: formData.items.map(i => 
                    i.equipmentId === equipmentItem.id 
                        ? { ...i, quantity: i.quantity + 1 }
                        : i
                )
            });
        } else {
            setFormData({
                ...formData,
                items: [...formData.items, {
                    equipmentId: equipmentItem.id,
                    name: equipmentItem.name,
                    description: equipmentItem.description || '',
                    quantity: 1,
                    price: equipmentItem.price
                }]
            });
        }
    };
    
    const handleRemoveItem = (equipmentId) => {
        setFormData({
            ...formData,
            items: formData.items.filter(i => i.equipmentId !== equipmentId)
        });
    };
    
    const handleUpdateQuantity = (equipmentId, quantity) => {
        if (quantity <= 0) {
            handleRemoveItem(equipmentId);
            return;
        }
        setFormData({
            ...formData,
            items: formData.items.map(i => 
                i.equipmentId === equipmentId ? { ...i, quantity } : i
            )
        });
    };
    
    const handleSave = () => {
        if (!formData.eventName || formData.items.length === 0) return;
        
        const estimateData = {
            ...formData,
            name: formData.eventName,
            total: calculateTotal(formData.items),
            date: new Date().toISOString().split('T')[0]
        };
        
        if (editingEstimate) {
            setEstimates(estimates.map(est => 
                est.id === editingEstimate.id 
                    ? { ...est, ...estimateData }
                    : est
            ));
        } else {
            setEstimates([...estimates, { id: generateId(), ...estimateData }]);
        }
        
        closeModal();
    };
    
    const handleDelete = (id) => {
        if (confirm('Удалить эту смету?')) {
            setEstimates(estimates.filter(est => est.id !== id));
        }
    };
    
    const openModal = (estimate = null) => {
        if (estimate) {
            setEditingEstimate(estimate);
            setFormData({
                eventName: estimate.eventName || estimate.name || '',
                venue: estimate.venue || '',
                eventDate: estimate.eventDate || '',
                items: estimate.items || []
            });
        } else {
            setEditingEstimate(null);
            setFormData({ eventName: '', venue: '', eventDate: '', items: [] });
        }
        setIsModalOpen(true);
    };
    
    const closeModal = () => {
        setIsModalOpen(false);
        setEditingEstimate(null);
        setFormData({ eventName: '', venue: '', eventDate: '', items: [] });
    };
    
    // Export to CSV with UTF-8 BOM
    const exportToCSV = () => {
        const allItems = estimates.flatMap(est => 
            est.items.map(item => ({
                'Название сметы': est.name || est.eventName,
                'Мероприятие': est.eventName,
                'Место проведения': est.venue,
                'Дата мероприятия': est.eventDate,
                'Дата создания': est.date,
                'Оборудование': item.name,
                'Количество': item.quantity,
                'Цена': item.price,
                'Сумма': item.price * item.quantity
            }))
        );
        
        const csv = Papa.unparse(allItems);
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `сметы_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };
    
    // Custom PDF Export
    const exportToPDF = (estimate) => {
        setCurrentEstimate(estimate);
        setIsPdfSettingsOpen(true);
    };
    
    const generatePDF = () => {
        if (!currentEstimate) return;
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Business colors
        const primaryColor = '#1e3a5f';
        const secondaryColor = '#4a5568';
        
        let yPos = 20;
        
        // Logo
        if (pdfSettings.logo) {
            try {
                doc.addImage(pdfSettings.logo, 'JPEG', 15, yPos, 40, 25);
            } catch (e) {
                console.log('Logo error:', e);
            }
        }
        
        // Company details (right side)
        if (pdfSettings.companyName || pdfSettings.companyDetails) {
            doc.setFontSize(10);
            doc.setTextColor(secondaryColor);
            let detailsY = yPos + 5;
            
            if (pdfSettings.companyName) {
                doc.setFontSize(12);
                doc.setTextColor(primaryColor);
                doc.text(pdfSettings.companyName, 195, detailsY, { align: 'right' });
                detailsY += 6;
            }
            
            if (pdfSettings.companyDetails) {
                doc.setFontSize(9);
                doc.setTextColor(secondaryColor);
                const details = pdfSettings.companyDetails.split('\n');
                details.forEach(line => {
                    doc.text(line, 195, detailsY, { align: 'right' });
                    detailsY += 4;
                });
            }
        }
        
        yPos = pdfSettings.logo ? 55 : 30;
        
        // Event info
        doc.setFontSize(11);
        doc.setTextColor(primaryColor);
        doc.text(currentEstimate.eventName || currentEstimate.name, 15, yPos);
        yPos += 7;
        
        doc.setFontSize(10);
        doc.setTextColor(secondaryColor);
        if (currentEstimate.venue) {
            doc.text(`Место проведения: ${currentEstimate.venue}`, 15, yPos);
            yPos += 6;
        }
        if (currentEstimate.eventDate) {
            doc.text(`Дата: ${formatDate(currentEstimate.eventDate)}`, 15, yPos);
            yPos += 6;
        }
        
        yPos += 5;
        
        // Table
        const tableData = currentEstimate.items.map(item => [
            { content: item.name + (item.description ? `\n${item.description}` : ''), styles: { cellWidth: 80 } },
            item.quantity.toString(),
            formatCurrency(item.price).replace('₽', 'руб.'),
            formatCurrency(item.price * item.quantity).replace('₽', 'руб.')
        ]);
        
        doc.autoTable({
            startY: yPos,
            head: [['Наименование', 'Кол-во', 'Цена', 'Сумма']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [30, 58, 95],
                textColor: 255,
                fontSize: 10,
                fontStyle: 'bold'
            },
            bodyStyles: {
                fontSize: 9,
                textColor: [74, 85, 104]
            },
            columnStyles: {
                0: { cellWidth: 80 },
                1: { cellWidth: 25, halign: 'center' },
                2: { cellWidth: 35, halign: 'right' },
                3: { cellWidth: 35, halign: 'right' }
            },
            styles: {
                overflow: 'linebreak',
                lineWidth: 0.5,
                lineColor: [200, 200, 200]
            },
            didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 0) {
                    const lines = data.cell.text[0].split('\n');
                    if (lines.length > 1) {
                        data.cell.text = [lines[0]];
                        data.row.cells[0].text = lines[0];
                    }
                }
            }
        });
        
        yPos = doc.lastAutoTable.finalY + 10;
        
        // Total
        doc.setFontSize(11);
        doc.setTextColor(primaryColor);
        doc.setFont(undefined, 'bold');
        doc.text(`ИТОГО: ${formatCurrency(currentEstimate.total).replace('₽', 'руб.')}`, 195, yPos, { align: 'right' });
        doc.setFont(undefined, 'normal');
        
        yPos += 20;
        
        // Signature section
        if (pdfSettings.position || pdfSettings.personName) {
            doc.setFontSize(10);
            doc.setTextColor(secondaryColor);
            
            if (pdfSettings.position) {
                doc.text(pdfSettings.position, 15, yPos);
                yPos += 6;
            }
            
            if (pdfSettings.personName) {
                doc.text(`ФИО: ${pdfSettings.personName}`, 15, yPos);
                yPos += 15;
            }
            
            // Signature
            if (pdfSettings.signature) {
                try {
                    doc.addImage(pdfSettings.signature, 'PNG', 15, yPos - 10, 40, 20);
                } catch (e) {
                    console.log('Signature error:', e);
                }
            }
            
            // Stamp
            if (pdfSettings.stamp) {
                try {
                    doc.addImage(pdfSettings.stamp, 'PNG', 70, yPos - 15, 35, 35);
                } catch (e) {
                    console.log('Stamp error:', e);
                }
            }
        }
        
        // Save without "смета" in filename
        const fileName = `${currentEstimate.eventName || currentEstimate.name || 'документ'}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName.replace(/[^a-zA-Z0-9а-яА-Я\-_]/g, '_'));
        
        setIsPdfSettingsOpen(false);
        setCurrentEstimate(null);
    };
    
    const handleFileChange = (field, e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            setPdfSettings({ ...pdfSettings, [field]: event.target.result });
        };
        reader.readAsDataURL(file);
    };
    
    return React.createElement('div', { className: 'space-y-4' },
        React.createElement('div', { className: 'flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4' },
            React.createElement('div', null,
                React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, 'Сметы'),
                React.createElement('p', { className: 'text-gray-500' }, `Всего смет: ${estimates.length}`)
            ),
            React.createElement('div', { className: 'flex flex-wrap gap-2' },
                React.createElement(Button, { variant: 'secondary', onClick: exportToCSV }, 
                    React.createElement(Icons.Download), 'Экспорт всех смет'
                ),
                React.createElement(Button, { onClick: () => openModal() }, 
                    React.createElement(Icons.Plus), 'Новая смета'
                )
            )
        ),
        
        React.createElement('div', { className: 'relative' },
            React.createElement('div', { className: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-400' },
                React.createElement(Icons.Search)
            ),
            React.createElement('input', {
                type: 'text',
                value: searchTerm,
                onChange: (e) => setSearchTerm(e.target.value),
                placeholder: 'Поиск смет...',
                className: 'w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
            })
        ),
        
        React.createElement('div', { className: 'business-card rounded-xl overflow-hidden' },
            estimates.length === 0 
                ? React.createElement('div', { className: 'p-12 text-center text-gray-500' },
                    React.createElement(Icons.FileText, { className: 'w-16 h-16 mx-auto mb-4 text-gray-300' }),
                    React.createElement('p', null, 'Сметы не найдены')
                )
                : React.createElement('div', { className: 'overflow-x-auto' },
                    React.createElement('table', { className: 'w-full' },
                        React.createElement('thead', { className: 'bg-gray-50' },
                            React.createElement('tr', null,
                                React.createElement('th', { className: 'px-4 py-3 text-left text-sm font-medium text-gray-600' }, 'Название'),
                                React.createElement('th', { className: 'px-4 py-3 text-left text-sm font-medium text-gray-600' }, 'Место проведения'),
                                React.createElement('th', { className: 'px-4 py-3 text-left text-sm font-medium text-gray-600' }, 'Дата мероприятия'),
                                React.createElement('th', { className: 'px-4 py-3 text-center text-sm font-medium text-gray-600' }, 'Позиций'),
                                React.createElement('th', { className: 'px-4 py-3 text-right text-sm font-medium text-gray-600' }, 'Сумма'),
                                React.createElement('th', { className: 'px-4 py-3 text-center text-sm font-medium text-gray-600' }, 'Действия')
                            )
                        ),
                        React.createElement('tbody', { className: 'divide-y' },
                            filteredEstimates.map(estimate => 
                                React.createElement('tr', { key: estimate.id, className: 'hover:bg-gray-50' },
                                    React.createElement('td', { className: 'px-4 py-3' },
                                        React.createElement('div', { className: 'font-medium text-gray-800' }, estimate.eventName || estimate.name),
                                        React.createElement('div', { className: 'text-sm text-gray-500' }, `Создано: ${formatDate(estimate.date)}`)
                                    ),
                                    React.createElement('td', { className: 'px-4 py-3 text-sm text-gray-600' }, estimate.venue || '-'),
                                    React.createElement('td', { className: 'px-4 py-3 text-sm text-gray-600' }, formatDate(estimate.eventDate)),
                                    React.createElement('td', { className: 'px-4 py-3 text-center' },
                                        React.createElement('span', { className: 'bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm' }, 
                                            estimate.items?.length || 0
                                        )
                                    ),
                                    React.createElement('td', { className: 'px-4 py-3 text-right font-medium text-blue-600' },
                                        formatCurrency(estimate.total)
                                    ),
                                    React.createElement('td', { className: 'px-4 py-3' },
                                        React.createElement('div', { className: 'flex items-center justify-center gap-1' },
                                            React.createElement('button', {
                                                onClick: () => exportToPDF(estimate),
                                                className: 'p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors',
                                                title: 'Экспорт в PDF'
                                            }, React.createElement(Icons.Download)),
                                            React.createElement('button', {
                                                onClick: () => openModal(estimate),
                                                className: 'p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors'
                                            }, React.createElement(Icons.Edit)),
                                            React.createElement('button', {
                                                onClick: () => handleDelete(estimate.id),
                                                className: 'p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors'
                                            }, React.createElement(Icons.Trash))
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
        ),
        
        // Estimate Edit Modal
        React.createElement(Modal, {
            isOpen: isModalOpen,
            onClose: closeModal,
            title: editingEstimate ? 'Редактировать смету' : 'Новая смета',
            size: 'xl'
        },
            React.createElement('div', { className: 'space-y-4' },
                React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
                    React.createElement(Input, {
                        label: 'Название мероприятия',
                        value: formData.eventName,
                        onChange: (v) => setFormData({...formData, eventName: v}),
                        required: true
                    }),
                    React.createElement(Input, {
                        label: 'Место проведения',
                        value: formData.venue,
                        onChange: (v) => setFormData({...formData, venue: v})
                    }),
                    React.createElement(Input, {
                        label: 'Дата мероприятия',
                        type: 'date',
                        value: formData.eventDate,
                        onChange: (v) => setFormData({...formData, eventDate: v})
                    })
                ),
                
                React.createElement('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-4' },
                    // Available equipment
                    React.createElement('div', { className: 'border rounded-lg p-4' },
                        React.createElement('h4', { className: 'font-medium text-gray-700 mb-3' }, 'Доступное оборудование'),
                        React.createElement('div', { className: 'max-h-64 overflow-y-auto space-y-2' },
                            equipment.length === 0 
                                ? React.createElement('p', { className: 'text-gray-500 text-sm' }, 'Нет доступного оборудования')
                                : equipment.map(item => 
                                    React.createElement('div', { 
                                        key: item.id, 
                                        className: 'flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer',
                                        onClick: () => handleAddItem(item)
                                    },
                                        React.createElement('div', null,
                                            React.createElement('div', { className: 'font-medium text-sm' }, item.name),
                                            React.createElement('div', { className: 'text-xs text-gray-500' }, item.category)
                                        ),
                                        React.createElement('div', { className: 'text-right' },
                                            React.createElement('div', { className: 'text-sm font-medium' }, formatCurrency(item.price)),
                                            React.createElement('div', { className: 'text-xs text-gray-500' }, `Доступно: ${item.quantity}`)
                                        )
                                    )
                                )
                        )
                    ),
                    
                    // Selected items
                    React.createElement('div', { className: 'border rounded-lg p-4' },
                        React.createElement('h4', { className: 'font-medium text-gray-700 mb-3' }, 'Выбранное оборудование'),
                        formData.items.length === 0 
                            ? React.createElement('p', { className: 'text-gray-500 text-sm' }, 'Ничего не выбрано')
                            : React.createElement('div', { className: 'max-h-64 overflow-y-auto space-y-2' },
                                formData.items.map(item => 
                                    React.createElement('div', { key: item.equipmentId, className: 'flex items-center gap-2 p-2 bg-blue-50 rounded' },
                                        React.createElement('div', { className: 'flex-1' },
                                            React.createElement('div', { className: 'font-medium text-sm' }, item.name),
                                            React.createElement('div', { className: 'text-xs text-gray-500' }, formatCurrency(item.price))
                                        ),
                                        React.createElement('div', { className: 'flex items-center gap-2' },
                                            React.createElement('button', {
                                                onClick: () => handleUpdateQuantity(item.equipmentId, item.quantity - 1),
                                                className: 'w-6 h-6 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300'
                                            }, '-'),
                                            React.createElement('span', { className: 'w-8 text-center' }, item.quantity),
                                            React.createElement('button', {
                                                onClick: () => handleUpdateQuantity(item.equipmentId, item.quantity + 1),
                                                className: 'w-6 h-6 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300'
                                            }, '+'),
                                            React.createElement('button', {
                                                onClick: () => handleRemoveItem(item.equipmentId),
                                                className: 'p-1 text-red-600 hover:bg-red-100 rounded'
                                            }, React.createElement(Icons.Trash))
                                        )
                                    )
                                )
                            ),
                        formData.items.length > 0 && React.createElement('div', { className: 'mt-4 pt-4 border-t flex justify-between items-center' },
                            React.createElement('span', { className: 'font-medium' }, 'Итого:'),
                            React.createElement('span', { className: 'text-xl font-bold text-blue-600' }, formatCurrency(calculateTotal(formData.items)))
                        )
                    )
                ),
                
                React.createElement('div', { className: 'flex gap-2 pt-4' },
                    React.createElement(Button, { variant: 'secondary', onClick: closeModal, className: 'flex-1' }, 'Отмена'),
                    React.createElement(Button, { 
                        onClick: handleSave, 
                        className: 'flex-1',
                        disabled: !formData.eventName || formData.items.length === 0
                    }, 'Сохранить')
                )
            )
        ),
        
        // PDF Settings Modal
        React.createElement(Modal, {
            isOpen: isPdfSettingsOpen,
            onClose: () => setIsPdfSettingsOpen(false),
            title: 'Настройки PDF',
            size: 'md'
        },
            React.createElement('div', { className: 'space-y-4' },
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Логотип компании'),
                    React.createElement('input', {
                        type: 'file',
                        accept: 'image/*',
                        onChange: (e) => handleFileChange('logo', e),
                        className: 'w-full text-sm'
                    })
                ),
                
                React.createElement(Input, {
                    label: 'Название компании',
                    value: pdfSettings.companyName,
                    onChange: (v) => setPdfSettings({...pdfSettings, companyName: v})
                }),
                
                React.createElement('div', { className: 'flex flex-col gap-1' },
                    React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 'Реквизиты компании'),
                    React.createElement('textarea', {
                        value: pdfSettings.companyDetails,
                        onChange: (e) => setPdfSettings({...pdfSettings, companyDetails: e.target.value}),
                        placeholder: 'ИНН, КПП, адрес, телефон...',
                        rows: 3,
                        className: 'px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none'
                    })
                ),
                
                React.createElement(Input, {
                    label: 'Должность',
                    value: pdfSettings.position,
                    onChange: (v) => setPdfSettings({...pdfSettings, position: v}),
                    placeholder: 'например: Руководитель отдела'
                }),
                
                React.createElement(Input, {
                    label: 'ФИО',
                    value: pdfSettings.personName,
                    onChange: (v) => setPdfSettings({...pdfSettings, personName: v})
                }),
                
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Подпись (изображение PNG с прозрачностью)'),
                    React.createElement('input', {
                        type: 'file',
                        accept: 'image/png',
                        onChange: (e) => handleFileChange('signature', e),
                        className: 'w-full text-sm'
                    })
                ),
                
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Печать (изображение PNG с прозрачностью)'),
                    React.createElement('input', {
                        type: 'file',
                        accept: 'image/png',
                        onChange: (e) => handleFileChange('stamp', e),
                        className: 'w-full text-sm'
                    })
                ),
                
                React.createElement('div', { className: 'flex gap-2 pt-4' },
                    React.createElement(Button, { variant: 'secondary', onClick: () => setIsPdfSettingsOpen(false), className: 'flex-1' }, 'Отмена'),
                    React.createElement(Button, { onClick: generatePDF, className: 'flex-1' }, 'Сгенерировать PDF')
                )
            )
        )
    );
};

// ==================== ANALYTICS COMPONENT ====================
const Analytics = ({ equipment, estimates }) => {
    const chartsRef = useRef({});
    
    // Calculate statistics
    const totalEquipment = equipment.length;
    const totalQuantity = equipment.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = equipment.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const totalEstimates = estimates.length;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentMonthEstimates = estimates.filter(est => est.date?.startsWith(currentMonth));
    const currentMonthRevenue = currentMonthEstimates.reduce((sum, est) => sum + (est.total || 0), 0);
    const totalRevenue = estimates.reduce((sum, est) => sum + (est.total || 0), 0);
    
    // Equipment by category
    const equipmentByCategory = equipment.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + item.quantity;
        return acc;
    }, {});
    
    // Estimates by month
    const estimatesByMonth = estimates.reduce((acc, est) => {
        const month = est.date?.slice(0, 7) || 'unknown';
        acc[month] = (acc[month] || 0) + (est.total || 0);
        return acc;
    }, {});
    
    // Top equipment by revenue
    const equipmentRevenue = {};
    estimates.forEach(est => {
        est.items?.forEach(item => {
            equipmentRevenue[item.name] = (equipmentRevenue[item.name] || 0) + (item.price * item.quantity);
        });
    });
    const topEquipment = Object.entries(equipmentRevenue)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    useEffect(() => {
        // Cleanup previous charts
        Object.values(chartsRef.current).forEach(chart => chart.destroy());
        chartsRef.current = {};
        
        // Equipment by Category Chart
        const categoryCtx = document.getElementById('categoryChart');
        if (categoryCtx && Object.keys(equipmentByCategory).length > 0) {
            chartsRef.current.category = new Chart(categoryCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(equipmentByCategory),
                    datasets: [{
                        data: Object.values(equipmentByCategory),
                        backgroundColor: [
                            '#1e3a5f', '#2d5a87', '#3d7ab5', '#4e9ae3', 
                            '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                boxWidth: 12,
                                padding: 8,
                                font: { size: 11 }
                            }
                        }
                    }
                }
            });
        }
        
        // Estimates by Month Chart
        const monthCtx = document.getElementById('monthChart');
        if (monthCtx && Object.keys(estimatesByMonth).length > 0) {
            const sortedMonths = Object.keys(estimatesByMonth).sort();
            chartsRef.current.month = new Chart(monthCtx, {
                type: 'bar',
                data: {
                    labels: sortedMonths.map(m => {
                        const [year, month] = m.split('-');
                        return `${month}.${year}`;
                    }),
                    datasets: [{
                        label: 'Выручка (₽)',
                        data: sortedMonths.map(m => estimatesByMonth[m]),
                        backgroundColor: '#2563eb'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => value.toLocaleString('ru-RU')
                            }
                        }
                    }
                }
            });
        }
        
        // Top Equipment Chart
        const topCtx = document.getElementById('topChart');
        if (topCtx && topEquipment.length > 0) {
            chartsRef.current.top = new Chart(topCtx, {
                type: 'bar',
                data: {
                    labels: topEquipment.map(([name]) => name.length > 20 ? name.slice(0, 20) + '...' : name),
                    datasets: [{
                        label: 'Выручка (₽)',
                        data: topEquipment.map(([, revenue]) => revenue),
                        backgroundColor: '#1e3a5f'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            ticks: {
                                callback: (value) => value.toLocaleString('ru-RU')
                            }
                        }
                    }
                }
            });
        }
        
        return () => {
            Object.values(chartsRef.current).forEach(chart => chart.destroy());
        };
    }, [equipment, estimates]);
    
    return React.createElement('div', { className: 'space-y-6' },
        React.createElement('div', null,
            React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, 'Аналитика'),
            React.createElement('p', { className: 'text-gray-500' }, 'Статистика и показатели')
        ),
        
        // Stats Cards
        React.createElement('div', { className: 'grid grid-cols-2 md:grid-cols-4 gap-4' },
            React.createElement('div', { className: 'business-card rounded-xl p-4' },
                React.createElement('p', { className: 'text-sm text-gray-500' }, 'Всего оборудования'),
                React.createElement('p', { className: 'text-2xl font-bold text-gray-800' }, totalEquipment)
            ),
            React.createElement('div', { className: 'business-card rounded-xl p-4' },
                React.createElement('p', { className: 'text-sm text-gray-500' }, 'Всего смет'),
                React.createElement('p', { className: 'text-2xl font-bold text-gray-800' }, totalEstimates)
            ),
            React.createElement('div', { className: 'business-card rounded-xl p-4' },
                React.createElement('p', { className: 'text-sm text-gray-500' }, 'Смет в этом месяце'),
                React.createElement('p', { className: 'text-2xl font-bold text-gray-800' }, currentMonthEstimates.length)
            ),
            React.createElement('div', { className: 'business-card rounded-xl p-4' },
                React.createElement('div', { className: 'flex items-center gap-2' },
                    React.createElement('p', { className: 'text-sm text-gray-500' }, 'Выручка за месяц'),
                    React.createElement(Icons.Ruble, { className: 'w-4 h-4 text-green-600' })
                ),
                React.createElement('p', { className: 'text-xl font-bold text-green-600' }, formatCurrency(currentMonthRevenue))
            )
        ),
        
        // Charts
        React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
            // Equipment by Category
            React.createElement('div', { className: 'business-card rounded-xl p-4' },
                React.createElement('h3', { className: 'font-semibold text-gray-700 mb-4' }, 'Оборудование по категориям'),
                React.createElement('div', { className: 'chart-container' },
                    Object.keys(equipmentByCategory).length > 0 
                        ? React.createElement('canvas', { id: 'categoryChart' })
                        : React.createElement('div', { className: 'flex items-center justify-center h-full text-gray-400' }, 'Нет данных')
                )
            ),
            
            // Estimates by Month
            React.createElement('div', { className: 'business-card rounded-xl p-4' },
                React.createElement('h3', { className: 'font-semibold text-gray-700 mb-4' }, 'Сметы по месяцам'),
                React.createElement('div', { className: 'chart-container' },
                    Object.keys(estimatesByMonth).length > 0 
                        ? React.createElement('canvas', { id: 'monthChart' })
                        : React.createElement('div', { className: 'flex items-center justify-center h-full text-gray-400' }, 'Нет данных')
                )
            ),
            
            // Top Equipment
            React.createElement('div', { className: 'business-card rounded-xl p-4 md:col-span-2' },
                React.createElement('h3', { className: 'font-semibold text-gray-700 mb-4' }, 'Топ-10 оборудования по выручке'),
                React.createElement('div', { className: 'chart-container' },
                    topEquipment.length > 0 
                        ? React.createElement('canvas', { id: 'topChart' })
                        : React.createElement('div', { className: 'flex items-center justify-center h-full text-gray-400' }, 'Нет данных')
                )
            )
        ),
        
        // Warehouse Status
        React.createElement('div', { className: 'business-card rounded-xl p-4' },
            React.createElement('h3', { className: 'font-semibold text-gray-700 mb-4' }, 'Состояние склада'),
            React.createElement('div', { className: 'space-y-4' },
                Object.entries(equipment.reduce((acc, item) => {
                    if (!acc[item.category]) acc[item.category] = [];
                    acc[item.category].push(item);
                    return acc;
                }, {})).map(([category, items]) => 
                    React.createElement('div', { key: category, className: 'border rounded-lg overflow-hidden' },
                        React.createElement('div', { className: 'bg-gray-50 px-4 py-2 font-medium text-gray-700' }, 
                            `${category} (${items.length} позиций)`
                        ),
                        React.createElement('div', { className: 'divide-y' },
                            items.map(item => 
                                React.createElement('div', { key: item.id, className: 'px-4 py-2 flex justify-between items-center' },
                                    React.createElement('div', null,
                                        React.createElement('span', { className: 'font-medium' }, item.name),
                                        item.description && React.createElement('span', { className: 'text-sm text-gray-500 ml-2' }, item.description)
                                    ),
                                    React.createElement('div', { className: 'flex items-center gap-4' },
                                        React.createElement('span', { 
                                            className: `px-2 py-1 rounded text-sm ${
                                                item.quantity > 5 ? 'bg-green-100 text-green-700' : 
                                                item.quantity > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                            }`
                                        }, `${item.quantity} шт.`),
                                        React.createElement('span', { className: 'text-sm text-gray-600 w-24 text-right' }, formatCurrency(item.price))
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
    );
};

// ==================== TEMPLATES COMPONENT ====================
const Templates = () => {
    const [templates, setTemplates] = useState([
        { id: '1', name: 'Стандартная смета', description: 'Базовый шаблон для смет' },
        { id: '2', name: 'Конференция', description: 'Шаблон для конференций' },
        { id: '3', name: 'Семинар', description: 'Шаблон для семинаров' }
    ]);
    
    return React.createElement('div', { className: 'space-y-4' },
        React.createElement('div', { className: 'flex justify-between items-center' },
            React.createElement('div', null,
                React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, 'Шаблоны'),
                React.createElement('p', { className: 'text-gray-500' }, `Всего шаблонов: ${templates.length}`)
            ),
            React.createElement(Button, { onClick: () => {} }, 
                React.createElement(Icons.Plus), 'Новый шаблон'
            )
        ),
        
        React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' },
            templates.map(template => 
                React.createElement('div', { key: template.id, className: 'business-card rounded-xl p-4' },
                    React.createElement('div', { className: 'flex items-start justify-between' },
                        React.createElement('div', { className: 'w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center' },
                            React.createElement(Icons.Layout, { className: 'text-blue-600' })
                        ),
                        React.createElement('div', { className: 'flex gap-1' },
                            React.createElement('button', { className: 'p-1.5 text-blue-600 hover:bg-blue-50 rounded' }, React.createElement(Icons.Edit)),
                            React.createElement('button', { className: 'p-1.5 text-red-600 hover:bg-red-50 rounded' }, React.createElement(Icons.Trash))
                        )
                    ),
                    React.createElement('h3', { className: 'font-semibold text-gray-800 mt-3' }, template.name),
                    React.createElement('p', { className: 'text-sm text-gray-500' }, template.description)
                )
            )
        )
    );
};

// ==================== CALENDAR COMPONENT ====================
const Calendar = ({ estimates }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    
    const getDaysInMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };
    
    const getFirstDayOfMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };
    
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    
    const eventsByDate = estimates.reduce((acc, est) => {
        if (est.eventDate) {
            acc[est.eventDate] = acc[est.eventDate] || [];
            acc[est.eventDate].push(est);
        }
        return acc;
    }, {});
    
    return React.createElement('div', { className: 'space-y-4' },
        React.createElement('div', { className: 'flex justify-between items-center' },
            React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, 'Календарь'),
            React.createElement('div', { className: 'flex items-center gap-2' },
                React.createElement('button', {
                    onClick: () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)),
                    className: 'p-2 hover:bg-gray-100 rounded-lg'
                }, '<'),
                React.createElement('span', { className: 'font-medium' }, 
                    `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                ),
                React.createElement('button', {
                    onClick: () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)),
                    className: 'p-2 hover:bg-gray-100 rounded-lg'
                }, '>')
            )
        ),
        
        React.createElement('div', { className: 'business-card rounded-xl p-4' },
            React.createElement('div', { className: 'grid grid-cols-7 gap-1 mb-2' },
                ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => 
                    React.createElement('div', { key: day, className: 'text-center text-sm font-medium text-gray-500 py-2' }, day)
                )
            ),
            React.createElement('div', { className: 'grid grid-cols-7 gap-1' },
                Array.from({ length: firstDay === 0 ? 6 : firstDay - 1 }, (_, i) => 
                    React.createElement('div', { key: `empty-${i}` })
                ),
                Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const events = eventsByDate[dateStr] || [];
                    const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
                    
                    return React.createElement('div', { 
                        key: day, 
                        className: `min-h-20 p-2 border rounded-lg ${isToday ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`
                    },
                        React.createElement('div', { className: `text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-700'}` }, day),
                        events.map((event, idx) => 
                            React.createElement('div', { 
                                key: idx, 
                                className: 'mt-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded truncate'
                            }, event.eventName || event.name)
                        )
                    );
                })
            )
        )
    );
};

// ==================== CHECKLISTS COMPONENT ====================
const Checklists = () => {
    const [checklists, setChecklists] = useState([
        { id: '1', name: 'Проверка перед мероприятием', items: 8, completed: 5 },
        { id: '2', name: 'Возврат оборудования', items: 6, completed: 0 },
        { id: '3', name: 'Техническая подготовка', items: 10, completed: 10 }
    ]);
    
    return React.createElement('div', { className: 'space-y-4' },
        React.createElement('div', { className: 'flex justify-between items-center' },
            React.createElement('div', null,
                React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, 'Чек-листы'),
                React.createElement('p', { className: 'text-gray-500' }, `Всего чек-листов: ${checklists.length}`)
            ),
            React.createElement(Button, { onClick: () => {} }, 
                React.createElement(Icons.Plus), 'Новый чек-лист'
            )
        ),
        
        React.createElement('div', { className: 'space-y-3' },
            checklists.map(checklist => 
                React.createElement('div', { key: checklist.id, className: 'business-card rounded-xl p-4' },
                    React.createElement('div', { className: 'flex items-center justify-between' },
                        React.createElement('div', { className: 'flex items-center gap-3' },
                            React.createElement('div', { className: 'w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center' },
                                React.createElement(Icons.CheckSquare, { className: 'text-green-600' })
                            ),
                            React.createElement('div', null,
                                React.createElement('h3', { className: 'font-semibold text-gray-800' }, checklist.name),
                                React.createElement('p', { className: 'text-sm text-gray-500' }, 
                                    `${checklist.completed} из ${checklist.items} выполнено`
                                )
                            )
                        ),
                        React.createElement('div', { className: 'flex items-center gap-3' },
                            React.createElement('div', { className: 'w-32 h-2 bg-gray-200 rounded-full overflow-hidden' },
                                React.createElement('div', { 
                                    className: 'h-full bg-green-500 rounded-full',
                                    style: { width: `${(checklist.completed / checklist.items) * 100}%` }
                                })
                            ),
                            React.createElement('div', { className: 'flex gap-1' },
                                React.createElement('button', { className: 'p-1.5 text-blue-600 hover:bg-blue-50 rounded' }, React.createElement(Icons.Edit)),
                                React.createElement('button', { className: 'p-1.5 text-red-600 hover:bg-red-50 rounded' }, React.createElement(Icons.Trash))
                            )
                        )
                    )
                )
            )
        )
    );
};

// ==================== RULES COMPONENT ====================
const Rules = () => {
    const [rules, setRules] = useState([
        { id: '1', name: 'Минимальный заказ', value: '50000', description: 'Минимальная сумма сметы' },
        { id: '2', name: 'Скидка постоянным клиентам', value: '10%', description: 'Скидка при повторных заказах' },
        { id: '3', name: 'Срок бронирования', value: '7 дней', description: 'Максимальный срок бронирования' }
    ]);
    
    return React.createElement('div', { className: 'space-y-4' },
        React.createElement('div', { className: 'flex justify-between items-center' },
            React.createElement('div', null,
                React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, 'Правила'),
                React.createElement('p', { className: 'text-gray-500' }, `Всего правил: ${rules.length}`)
            ),
            React.createElement(Button, { onClick: () => {} }, 
                React.createElement(Icons.Plus), 'Новое правило'
            )
        ),
        
        React.createElement('div', { className: 'space-y-3' },
            rules.map(rule => 
                React.createElement('div', { key: rule.id, className: 'business-card rounded-xl p-4' },
                    React.createElement('div', { className: 'flex items-center justify-between' },
                        React.createElement('div', { className: 'flex items-center gap-3' },
                            React.createElement('div', { className: 'w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center' },
                                React.createElement(Icons.Settings, { className: 'text-purple-600' })
                            ),
                            React.createElement('div', null,
                                React.createElement('h3', { className: 'font-semibold text-gray-800' }, rule.name),
                                React.createElement('p', { className: 'text-sm text-gray-500' }, rule.description)
                            )
                        ),
                        React.createElement('div', { className: 'flex items-center gap-3' },
                            React.createElement('span', { className: 'text-lg font-bold text-purple-600' }, rule.value),
                            React.createElement('div', { className: 'flex gap-1' },
                                React.createElement('button', { className: 'p-1.5 text-blue-600 hover:bg-blue-50 rounded' }, React.createElement(Icons.Edit)),
                                React.createElement('button', { className: 'p-1.5 text-red-600 hover:bg-red-50 rounded' }, React.createElement(Icons.Trash))
                            )
                        )
                    )
                )
            )
        )
    );
};

// ==================== STAFF COMPONENT ====================
const Staff = () => {
    const [staff, setStaff] = useState([
        { id: '1', name: 'Иванов Иван Иванович', position: 'Менеджер', phone: '+7 (999) 123-45-67', email: 'ivanov@company.ru' },
        { id: '2', name: 'Петрова Мария Сергеевна', position: 'Бухгалтер', phone: '+7 (999) 234-56-78', email: 'petrova@company.ru' },
        { id: '3', name: 'Сидоров Алексей Петрович', position: 'Техник', phone: '+7 (999) 345-67-89', email: 'sidorov@company.ru' }
    ]);
    
    return React.createElement('div', { className: 'space-y-4' },
        React.createElement('div', { className: 'flex justify-between items-center' },
            React.createElement('div', null,
                React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, 'Персонал'),
                React.createElement('p', { className: 'text-gray-500' }, `Всего сотрудников: ${staff.length}`)
            ),
            React.createElement(Button, { onClick: () => {} }, 
                React.createElement(Icons.Plus), 'Добавить сотрудника'
            )
        ),
        
        React.createElement('div', { className: 'business-card rounded-xl overflow-hidden' },
            React.createElement('table', { className: 'w-full' },
                React.createElement('thead', { className: 'bg-gray-50' },
                    React.createElement('tr', null,
                        React.createElement('th', { className: 'px-4 py-3 text-left text-sm font-medium text-gray-600' }, 'ФИО'),
                        React.createElement('th', { className: 'px-4 py-3 text-left text-sm font-medium text-gray-600' }, 'Должность'),
                        React.createElement('th', { className: 'px-4 py-3 text-left text-sm font-medium text-gray-600' }, 'Телефон'),
                        React.createElement('th', { className: 'px-4 py-3 text-left text-sm font-medium text-gray-600' }, 'Email'),
                        React.createElement('th', { className: 'px-4 py-3 text-center text-sm font-medium text-gray-600' }, 'Действия')
                    )
                ),
                React.createElement('tbody', { className: 'divide-y' },
                    staff.map(person => 
                        React.createElement('tr', { key: person.id, className: 'hover:bg-gray-50' },
                            React.createElement('td', { className: 'px-4 py-3' },
                                React.createElement('div', { className: 'flex items-center gap-3' },
                                    React.createElement('div', { className: 'w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium' },
                                        person.name.split(' ').map(n => n[0]).join('')
                                    ),
                                    React.createElement('span', { className: 'font-medium' }, person.name)
                                )
                            ),
                            React.createElement('td', { className: 'px-4 py-3 text-sm text-gray-600' }, person.position),
                            React.createElement('td', { className: 'px-4 py-3 text-sm text-gray-600' }, person.phone),
                            React.createElement('td', { className: 'px-4 py-3 text-sm text-gray-600' }, person.email),
                            React.createElement('td', { className: 'px-4 py-3' },
                                React.createElement('div', { className: 'flex items-center justify-center gap-1' },
                                    React.createElement('button', { className: 'p-1.5 text-blue-600 hover:bg-blue-50 rounded' }, React.createElement(Icons.Edit)),
                                    React.createElement('button', { className: 'p-1.5 text-red-600 hover:bg-red-50 rounded' }, React.createElement(Icons.Trash))
                                )
                            )
                        )
                    )
                )
            )
        )
    );
};

// ==================== MAIN APP COMPONENT ====================
const App = () => {
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('equipment');
    const [loading, setLoading] = useState(true);
    
    // Data states
    const [equipment, setEquipment] = useState([]);
    const [estimates, setEstimates] = useState([]);
    
    // Categories
    const categories = [...new Set(equipment.map(item => item.category))].sort();
    
    // Load data on mount
    useEffect(() => {
        const savedUser = getLocalUser();
        if (savedUser) {
            setUser(savedUser);
        }
        
        const savedData = getLocalData();
        if (savedData) {
            setEquipment(savedData.equipment || []);
            setEstimates(savedData.estimates || []);
        } else {
            // Load demo data
            setEquipment(DEMO_EQUIPMENT);
            setEstimates(DEMO_ESTIMATES);
        }
        
        setLoading(false);
    }, []);
    
    // Save data when changed
    useEffect(() => {
        if (!loading) {
            setLocalData({ equipment, estimates });
        }
    }, [equipment, estimates, loading]);
    
    const handleLogin = (userData) => {
        setUser(userData);
    };
    
    const handleLogout = () => {
        setLocalUser(null);
        setUser(null);
    };
    
    // Export all data
    const exportAllData = () => {
        const data = {
            equipment,
            estimates,
            exportDate: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `stwarehouse_backup_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    };
    
    // Import all data
    const importAllData = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.equipment) setEquipment(data.equipment);
                if (data.estimates) setEstimates(data.estimates);
                alert('Данные успешно импортированы');
            } catch (err) {
                alert('Ошибка импорта: ' + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };
    
    if (loading) {
        return React.createElement('div', { className: 'min-h-screen flex items-center justify-center' },
            React.createElement('div', { className: 'text-center' },
                React.createElement('div', { className: 'w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4' }),
                React.createElement('p', { className: 'text-gray-500' }, 'Загрузка...')
            )
        );
    }
    
    if (!user) {
        return React.createElement(LoginScreen, { onLogin: handleLogin });
    }
    
    const navItems = [
        { id: 'equipment', label: 'Оборудование', icon: Icons.Package, count: equipment.length },
        { id: 'estimates', label: 'Сметы', icon: Icons.FileText, count: estimates.length },
        { id: 'templates', label: 'Шаблоны', icon: Icons.Layout },
        { id: 'calendar', label: 'Календарь', icon: Icons.Calendar },
        { id: 'checklists', label: 'Чек-листы', icon: Icons.CheckSquare },
        { id: 'analytics', label: 'Аналитика', icon: Icons.BarChart },
        { id: 'rules', label: 'Правила', icon: Icons.Settings },
        { id: 'staff', label: 'Персонал', icon: Icons.Users }
    ];
    
    const renderContent = () => {
        switch (activeTab) {
            case 'equipment':
                return React.createElement(EquipmentManagement, { 
                    equipment, 
                    setEquipment, 
                    categories: categories.length > 0 ? categories : ['Проекторы', 'Экраны', 'Звук', 'Компьютеры', 'Аксессуары'] 
                });
            case 'estimates':
                return React.createElement(EstimatesManagement, { 
                    equipment, 
                    estimates, 
                    setEstimates 
                });
            case 'templates':
                return React.createElement(Templates);
            case 'calendar':
                return React.createElement(Calendar, { estimates });
            case 'checklists':
                return React.createElement(Checklists);
            case 'analytics':
                return React.createElement(Analytics, { equipment, estimates });
            case 'rules':
                return React.createElement(Rules);
            case 'staff':
                return React.createElement(Staff);
            default:
                return React.createElement(EquipmentManagement, { equipment, setEquipment, categories });
        }
    };
    
    return React.createElement('div', { className: 'min-h-screen bg-gray-50' },
        // Header
        React.createElement('header', { className: 'bg-white border-b sticky top-0 z-40' },
            React.createElement('div', { className: 'max-w-7xl mx-auto px-4' },
                React.createElement('div', { className: 'flex items-center justify-between h-16' },
                    React.createElement('div', { className: 'flex items-center gap-3' },
                        React.createElement('div', { className: 'w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center' },
                            React.createElement(Icons.Package, { className: 'text-white' })
                        ),
                        React.createElement('div', null,
                            React.createElement('h1', { className: 'font-bold text-gray-800' }, 'СкладОборуд'),
                            React.createElement('p', { className: 'text-xs text-gray-500' }, 'Система учета оборудования')
                        )
                    ),
                    
                    React.createElement('div', { className: 'flex items-center gap-4' },
                        React.createElement('div', { className: 'hidden md:flex items-center gap-2 text-sm text-gray-600' },
                            React.createElement('span', null, user.name),
                            React.createElement('span', { className: 'text-gray-300' }, '|'),
                            React.createElement('span', { className: 'text-gray-400' }, user.email)
                        ),
                        React.createElement('button', {
                            onClick: handleLogout,
                            className: 'flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors'
                        }, 
                            React.createElement(Icons.LogOut),
                            React.createElement('span', { className: 'hidden sm:inline' }, 'Выйти')
                        )
                    )
                )
            )
        ),
        
        // Navigation
        React.createElement('nav', { className: 'bg-white border-b' },
            React.createElement('div', { className: 'max-w-7xl mx-auto px-4' },
                React.createElement('div', { className: 'flex items-center gap-1 overflow-x-auto py-2' },
                    navItems.map(item => 
                        React.createElement('button', {
                            key: item.id,
                            onClick: () => setActiveTab(item.id),
                            className: `flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                                activeTab === item.id 
                                    ? 'bg-blue-600 text-white' 
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`
                        },
                            React.createElement(item.icon),
                            React.createElement('span', null, item.label),
                            item.count !== undefined && React.createElement('span', { 
                                className: `ml-1 px-2 py-0.5 text-xs rounded-full ${
                                    activeTab === item.id ? 'bg-blue-500' : 'bg-gray-200'
                                }` 
                            }, item.count)
                        )
                    )
                )
            )
        ),
        
        // Main Content
        React.createElement('main', { className: 'max-w-7xl mx-auto px-4 py-6' },
            React.createElement('div', { className: 'mb-4 flex flex-wrap gap-2' },
                React.createElement('label', { className: 'cursor-pointer' },
                    React.createElement(Button, { variant: 'outline', className: 'text-sm' }, 
                        React.createElement(Icons.Upload, { className: 'w-4 h-4' }), 'Импорт всех данных'
                    ),
                    React.createElement('input', {
                        type: 'file',
                        accept: '.json',
                        onChange: importAllData,
                        className: 'hidden'
                    })
                ),
                React.createElement(Button, { variant: 'outline', onClick: exportAllData, className: 'text-sm' }, 
                    React.createElement(Icons.Download, { className: 'w-4 h-4' }), 'Экспорт всех данных'
                )
            ),
            renderContent()
        ),
        
        // Footer
        React.createElement('footer', { className: 'bg-white border-t mt-auto' },
            React.createElement('div', { className: 'max-w-7xl mx-auto px-4 py-4' },
                React.createElement('div', { className: 'flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500' },
                    React.createElement('p', null, 'Система учета оборудования © 2024'),
                    React.createElement('div', { className: 'flex gap-4' },
                        React.createElement('span', null, `Оборудования: ${equipment.length}`),
                        React.createElement('span', null, `Смет: ${estimates.length}`),
                        React.createElement('span', null, `Чек-листов: 3`),
                        React.createElement('span', null, `Персонал: 3`)
                    )
                )
            )
        )
    );
};

// ==================== RENDER APP ====================
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
