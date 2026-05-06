import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Package, AlertCircle, Trash2, ArrowLeft, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '../lib/logger';

interface AuthProps {
  onSignIn: (email: string, password: string) => Promise<{ error: any }>;
  onSignUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  onResetPassword: (email: string) => Promise<{ error: any }>;
}

type AuthView = 'login' | 'register' | 'forgot';

export function Auth({ onSignIn, onSignUp, onResetPassword }: AuthProps) {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    logger.debug('Form submitted:', { view, email: email.trim(), passwordLength: password?.length });

    if (view === 'login') {
      const { error } = await onSignIn(email.trim(), password);
      logger.debug('SignIn result:', { error: error?.message || 'none' });
      if (error) setError(error.message || 'Ошибка входа');
    } else if (view === 'register') {
      const { error } = await onSignUp(email.trim(), password, name.trim());
      if (error) {
        setError(error.message || 'Ошибка регистрации');
      } else {
        toast.success('Аккаунт создан!', {
          description: 'На ваш email отправлено письмо для подтверждения. Пожалуйста, проверьте почту и перейдите по ссылке.',
          duration: 10000,
        });
        setView('login');
      }
    } else if (view === 'forgot') {
      const { error } = await onResetPassword(email.trim());
      if (error) {
        setError(error.message || 'Ошибка отправки письма');
      } else {
        setResetSent(true);
        toast.success('Письмо отправлено', {
          description: 'Проверьте вашу почту и перейдите по ссылке для сброса пароля.',
          duration: 10000,
        });
      }
    }

    setLoading(false);
  };

  const handleClearData = () => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase')) {
        localStorage.removeItem(key);
      }
    });
    window.location.reload();
  };

  const isTokenError = error?.toLowerCase().includes('refresh') || 
                       error?.toLowerCase().includes('token') ||
                       error?.toLowerCase().includes('session');

  const switchView = (newView: AuthView) => {
    setView(newView);
    setError('');
    setResetSent(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl rounded-xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center mb-4 shadow-lg">
            <Package className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl">СкладОборуд</CardTitle>
          <p className="text-muted-foreground mt-2">Система учета оборудования</p>
        </CardHeader>
        <CardContent>
          {view === 'forgot' && (
            <button
              onClick={() => switchView('login')}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Назад к входу
            </button>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {view === 'register' && (
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
            {view !== 'forgot' && (
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
            )}
            
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

            {resetSent && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-700 text-sm">
                  Письмо отправлено! Проверьте вашу почту (включая папку "Спам") и перейдите по ссылке для сброса пароля.
                </p>
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full rounded-lg shadow-md hover:shadow-lg transition-all" 
              disabled={loading || resetSent}
            >
              {loading ? 'Загрузка...' : 
                view === 'login' ? 'Войти' : 
                view === 'register' ? 'Зарегистрироваться' : 
                'Отправить ссылку'}
            </Button>
          </form>
          
          {view === 'login' && (
            <div className="mt-4 space-y-2 text-center">
              <button
                onClick={() => switchView('forgot')}
                className="text-sm text-muted-foreground hover:text-blue-600 transition-colors flex items-center justify-center gap-1 mx-auto"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Забыли пароль?
              </button>
              <p className="text-sm">
                Нет аккаунта?{' '}
                <button
                  onClick={() => switchView('register')}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Зарегистрироваться
                </button>
              </p>
            </div>
          )}

          {view === 'register' && (
            <p className="text-center mt-4 text-sm">
              Уже есть аккаунт?{' '}
              <button
                onClick={() => switchView('login')}
                className="text-blue-600 hover:underline font-medium"
              >
                Войти
              </button>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
