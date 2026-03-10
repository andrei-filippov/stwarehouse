import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Building2, User, Mail, Lock, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface RegisterCompanyFormProps {
  onSuccess: () => void;
  onLogin: () => void;
}

type Step = 1 | 2 | 3;

export function RegisterCompanyForm({ onSuccess, onLogin }: RegisterCompanyFormProps) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Данные компании
  const [companyData, setCompanyData] = useState({
    name: '',
    inn: '',
    legal_address: '',
    phone: '',
  });

  // Данные владельца
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Автозаполнение по ИНН
  const fetchCompanyByInn = async (inn: string) => {
    if (inn.length !== 10 && inn.length !== 12) return;
    
    try {
      const apiKey = import.meta.env.VITE_DADATA_API_KEY;
      if (!apiKey) return;

      const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Token ${apiKey}`,
        },
        body: JSON.stringify({ query: inn }),
      });

      const data = await response.json();
      if (data.suggestions && data.suggestions[0]) {
        const company = data.suggestions[0].data;
        setCompanyData(prev => ({
          ...prev,
          name: company.name.short || company.name.full || prev.name,
          legal_address: company.address?.value || prev.legal_address,
        }));
      }
    } catch (err) {
      console.error('Error fetching company data:', err);
    }
  };

  const handleNext = () => {
    setError(null);
    
    if (step === 1) {
      if (!companyData.name.trim()) {
        setError('Введите название компании');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!userData.name.trim()) {
        setError('Введите ваше имя');
        return;
      }
      if (!userData.email.trim()) {
        setError('Введите email');
        return;
      }
      if (userData.password.length < 6) {
        setError('Пароль должен быть не менее 6 символов');
        return;
      }
      if (userData.password !== userData.confirmPassword) {
        setError('Пароли не совпадают');
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    setError(null);
    if (step > 1) setStep((prev) => (prev - 1) as Step);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Регистрируем пользователя
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Ошибка регистрации');

      // 2. Создаём компанию
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyData.name,
          inn: companyData.inn || null,
          legal_address: companyData.legal_address || null,
          phone: companyData.phone || null,
          email: userData.email,
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

      onSuccess();
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
          Шаг {step} из 3: {step === 1 ? 'Данные компании' : step === 2 ? 'Данные владельца' : 'Подтверждение'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Шаг 1: Данные компании */}
        {step === 1 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="companyName">
                <Building2 className="w-4 h-4 inline mr-1" />
                Название компании *
              </Label>
              <Input
                id="companyName"
                value={companyData.name}
                onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                placeholder="ООО Ромашка"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inn">ИНН</Label>
              <Input
                id="inn"
                value={companyData.inn}
                onChange={(e) => {
                  setCompanyData({ ...companyData, inn: e.target.value });
                  if (e.target.value.length >= 10) {
                    fetchCompanyByInn(e.target.value);
                  }
                }}
                placeholder="7707083893"
                maxLength={12}
              />
              <p className="text-xs text-muted-foreground">
                Введите ИНН для автозаполнения данных
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="legalAddress">Юридический адрес</Label>
              <Input
                id="legalAddress"
                value={companyData.legal_address}
                onChange={(e) => setCompanyData({ ...companyData, legal_address: e.target.value })}
                placeholder="г. Москва, ул. Примерная, д. 1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                value={companyData.phone}
                onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                placeholder="+7 (999) 123-45-67"
              />
            </div>
          </>
        )}

        {/* Шаг 2: Данные владельца */}
        {step === 2 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="userName">
                <User className="w-4 h-4 inline mr-1" />
                Ваше имя *
              </Label>
              <Input
                id="userName"
                value={userData.name}
                onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                placeholder="Иван Иванов"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                <Mail className="w-4 h-4 inline mr-1" />
                Email *
              </Label>
              <Input
                id="email"
                type="email"
                value={userData.email}
                onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                placeholder="ivan@example.com"
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
                value={userData.password}
                onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Подтверждение пароля *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={userData.confirmPassword}
                onChange={(e) => setUserData({ ...userData, confirmPassword: e.target.value })}
                placeholder="••••••••"
              />
            </div>
          </>
        )}

        {/* Шаг 3: Подтверждение */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h4 className="font-medium">Компания</h4>
              <p className="text-sm">{companyData.name}</p>
              {companyData.inn && <p className="text-sm text-muted-foreground">ИНН: {companyData.inn}</p>}
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h4 className="font-medium">Владелец</h4>
              <p className="text-sm">{userData.name}</p>
              <p className="text-sm text-muted-foreground">{userData.email}</p>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="w-4 h-4 text-green-500" />
              <span>Бесплатный тариф</span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {step > 1 && (
            <Button variant="outline" onClick={handleBack} disabled={loading}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
          )}
          
          {step < 3 ? (
            <Button onClick={handleNext} className="flex-1">
              Далее
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading} className="flex-1">
              {loading ? 'Создание...' : 'Создать компанию'}
            </Button>
          )}
        </div>

        <div className="text-center text-sm">
          <span className="text-muted-foreground">Уже есть аккаунт? </span>
          <button onClick={onLogin} className="text-primary hover:underline">
            Войти
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
