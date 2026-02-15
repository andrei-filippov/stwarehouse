import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Package, Eye, EyeOff, Loader2 } from 'lucide-react';
import { signIn, signUp } from '@/lib/supabase';

interface LoginScreenProps {
    onLogin: (user: any) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (isLogin) {
            const { data, error } = await signIn(email, password);
            if (error) {
                setError(error.message === 'Invalid login credentials' 
                    ? 'Неверный email или пароль' 
                    : error.message);
            } else if (data.user) {
                onLogin(data.user);
            }
        } else {
            const { data, error } = await signUp(email, password, name);
            if (error) {
                setError(error.message);
            } else if (data.user) {
                setError('');
                alert('Регистрация успешна! Теперь вы можете войти.');
                setIsLogin(true);
            }
        }

        setLoading(false);
    };

    const fillDemoCredentials = (demoEmail: string, demoPassword: string) => {
        setEmail(demoEmail);
        setPassword(demoPassword);
    };

    const demoAccounts = [
        { email: 'admin@stwarehouse.ru', password: 'Admin2024!', name: 'Администратор' },
        { email: 'manager@stwarehouse.ru', password: 'Manager1!', name: 'Менеджер' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <Package className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">СкладОборуд</h1>
                    <p className="text-gray-500 mt-1">Система учета оборудования</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Имя</label>
                            <Input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ваше имя"
                                required={!isLogin}
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
                        <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Введите email"
                            required
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Пароль</label>
                        <div className="relative">
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Введите пароль"
                                required
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {isLogin ? 'Вход...' : 'Регистрация...'}
                            </>
                        ) : (
                            isLogin ? 'Войти' : 'Зарегистрироваться'
                        )}
                    </Button>
                </form>

                <div className="mt-4 text-center">
                    <button
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError('');
                        }}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                        {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
                    </button>
                </div>

                {isLogin && (
                    <div className="mt-6 pt-6 border-t">
                        <p className="text-sm text-gray-500 mb-3">Демо-аккаунты (нажмите для заполнения):</p>
                        <div className="space-y-2 text-sm">
                            {demoAccounts.map((acc, i) => (
                                <button
                                    key={i}
                                    onClick={() => fillDemoCredentials(acc.email, acc.password)}
                                    className="w-full flex justify-between items-center p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors text-left"
                                >
                                    <span className="font-medium">{acc.name}</span>
                                    <span className="text-gray-400 text-xs">{acc.email}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
