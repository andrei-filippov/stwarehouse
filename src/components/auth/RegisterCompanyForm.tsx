import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Building2, Mail, Lock, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { generateSlug } from '../../lib/subdomain';
import { getCompanyPath, saveSelectedCompany } from '../../lib/companyUrl';
import { toast } from 'sonner';
import { COMPANY_TYPE_LABELS } from '../../types';
import { logger } from '../lib/logger';

interface RegisterCompanyFormProps {
  onSuccess: () => void;
  onLogin: () => void;
}

export function RegisterCompanyForm({ onSuccess, onLogin }: RegisterCompanyFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    companyName: '',
    companyType: 'company' as const,
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Валидация
    if (!formData.companyName.trim()) {
      setError('Введите название компании');
      return;
    }
    if (!formData.email.trim()) {
      setError('Введите email');
      return;
    }
    if (formData.password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);

    try {
      // 1. Регистрируем пользователя
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Ошибка регистрации');

      // 2. Входим в систему чтобы получить сессию (нужно для RPC)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      
      if (signInError) {
        console.error('Auto sign-in failed:', signInError);
        throw new Error('Ошибка входа после регистрации. Попробуйте войти вручную.');
      }

      // 3. Генерируем уникальный slug
      let slug = generateSlug(formData.companyName);
      let suffix = 1;
      
      // Проверяем уникальность slug
      while (true) {
        const { data: existing } = await supabase
          .from('companies')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();
        
        if (!existing) break;
        
        suffix++;
        slug = `${generateSlug(formData.companyName)}-${suffix}`;
      }

      // 4. Создаём компанию через RPC (обходит RLS)
      const { data: companyId, error: rpcError } = await supabase.rpc('create_company_with_owner', {
        p_name: formData.companyName,
        p_slug: slug,
        p_email: formData.email,
        p_plan: 'free',
        p_type: formData.companyType,
      });

      if (rpcError) {
        console.error('RPC Error:', rpcError);
        throw new Error('Ошибка создания компании: ' + rpcError.message);
      }

      logger.debug('Company created with ID:', companyId);

      // 5. Показываем уведомление о подтверждении email
      toast.success('Компания успешно создана!', {
        description: 'На ваш email отправлено письмо для подтверждения. Пожалуйста, проверьте почту и подтвердите email.',
        duration: 8000,
      });

      // Сохраняем выбранную компанию и редиректим
      saveSelectedCompany(slug);
      
      // Редирект на страницу компании
      const path = getCompanyPath(slug);
      window.location.href = path;
      return;
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Регистрация компании</CardTitle>
        <CardDescription>
          Создайте аккаунт для вашей компании
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">
              <Building2 className="w-4 h-4 inline mr-1" />
              Название компании *
            </Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              placeholder="ООО Ромашка"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyType">Тип компании *</Label>
            <select
              id="companyType"
              className="w-full border rounded-md px-3 py-2 bg-background"
              value={formData.companyType}
              onChange={(e) => setFormData({ ...formData, companyType: e.target.value as 'company' | 'ip' | 'individual' })}
              required
            >
              {Object.entries(COMPANY_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              <Mail className="w-4 h-4 inline mr-1" />
              Email (логин) *
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="ivan@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              <Lock className="w-4 h-4 inline mr-1" />
              Пароль *
            </Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Подтверждение пароля *</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Создание...' : 'Создать компанию'}
          </Button>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Уже есть аккаунт? </span>
            <button type="button" onClick={onLogin} className="text-primary hover:underline">
              Войти
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
