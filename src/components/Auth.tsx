import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Package, AlertCircle, Trash2 } from 'lucide-react';

interface AuthProps {
  onSignIn: (email: string, password: string) => Promise<{ error: any }>;
  onSignUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
}

export function Auth({ onSignIn, onSignUp }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isLogin) {
      const { error } = await onSignIn(email, password);
      if (error) setError(error.message);
    } else {
      const { error } = await onSignUp(email, password, name);
      if (error) setError(error.message);
    }

    setLoading(false);
  };

  const handleClearData = () => {
    // Очищаем все данные Supabase из localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase')) {
        localStorage.removeItem(key);
      }
    });
    // Перезагружаем страницу
    window.location.reload();
  };

  const isTokenError = error?.toLowerCase().includes('refresh') || 
                       error?.toLowerCase().includes('token') ||
                       error?.toLowerCase().includes('session');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md shadow-xl rounded-xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center mb-4 shadow-lg">
            <Package className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl">СкладОборуд</CardTitle>
          <p className="text-gray-500 mt-2">Система учета оборудования</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Имя</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="rounded-lg"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-lg"
              />
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-red-600 text-sm">{error}</p>
                    {isTokenError && (
                      <button
                        type="button"
                        onClick={handleClearData}
                        className="mt-2 text-xs text-red-700 hover:text-red-800 underline flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Очистить данные и попробовать снова
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full rounded-lg shadow-md hover:shadow-lg transition-all" 
              disabled={loading}
            >
              {loading ? 'Загрузка...' : isLogin ? 'Войти' : 'Зарегистрироваться'}
            </Button>
          </form>
          
          <p className="text-center mt-4 text-sm">
            {isLogin ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-blue-600 hover:underline font-medium"
            >
              {isLogin ? 'Зарегистрироваться' : 'Войти'}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
