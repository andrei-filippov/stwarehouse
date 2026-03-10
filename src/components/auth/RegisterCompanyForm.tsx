import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Building2, Mail, Lock, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { generateSlug } from '../../lib/subdomain';
import { getCompanyPath, saveSelectedCompany } from '../../lib/companyUrl';

interface RegisterCompanyFormProps {
  onSuccess: () => void;
  onLogin: () => void;
}

export function RegisterCompanyForm({ onSuccess, onLogin }: RegisterCompanyFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    companyName: '',
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

      // 2. Создаём компанию со slug
      const slug = generateSlug(formData.companyName);
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          slug,
          name: formData.companyName,
          email: formData.email,
          plan: 'free',
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // 3. Добавляем пользователя как владельца
      const { error: memberError } = await supabase
        .from('company_members')
        .insert({
          company_id: company.id,
          user_id: authData.user.id,
          role: 'owner',
          status: 'active',
        });

      if (memberError) throw memberError;

      // 4. Сохраняем выбранную компанию и редиректим
      saveSelectedCompany(slug);
      
      // Редирект на страницу компании
      const path = getCompanyPath(slug);
      window.location.href = path;
      return;
    } catch (err) {
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
