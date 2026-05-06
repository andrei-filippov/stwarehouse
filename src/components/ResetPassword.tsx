import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Package, AlertCircle, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '../lib/logger';

interface ResetPasswordProps {
  onUpdatePassword: (newPassword: string) => Promise<{ error: any }>;
  onComplete: () => void;
}

export function ResetPassword({ onUpdatePassword, onComplete }: ResetPasswordProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    logger.debug('[ResetPassword] Component mounted');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    const { error } = await onUpdatePassword(password);
    setLoading(false);

    if (error) {
      setError(error.message || 'Ошибка сброса пароля');
    } else {
      setSuccess(true);
      toast.success('Пароль успешно изменён!', {
        description: 'Теперь вы можете войти с новым паролем.',
        duration: 5000,
      });
      // Auto-redirect after 3 seconds
      setTimeout(() => {
        onComplete();
      }, 3000);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-xl rounded-xl">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Пароль изменён!</h2>
            <p className="text-muted-foreground mb-4">
              Ваш пароль успешно обновлён. Сейчас вы будете перенаправлены на страницу входа.
            </p>
            <Button onClick={onComplete} className="w-full rounded-lg">
              Войти сейчас
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl rounded-xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center mb-4 shadow-lg">
            <Package className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl">Сброс пароля</CardTitle>
          <p className="text-muted-foreground mt-2">Введите новый пароль для вашего аккаунта</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Новый пароль</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="rounded-lg pr-10"
                  placeholder="Минимум 6 символов"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="rounded-lg"
                placeholder="Повторите пароль"
              />
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full rounded-lg shadow-md hover:shadow-lg transition-all" 
              disabled={loading}
            >
              {loading ? 'Сохранение...' : 'Сохранить новый пароль'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
