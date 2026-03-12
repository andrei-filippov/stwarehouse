import { Building2, Plus, Mail, ArrowRight, LogOut } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';

interface CompanyWelcomeProps {
  onCreateCompany: () => void;
  onCheckInvitations: () => void;
  onSignOut?: () => void;
}

export function CompanyWelcome({ onCreateCompany, onCheckInvitations, onSignOut }: CompanyWelcomeProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Добро пожаловать!</CardTitle>
          <CardDescription className="text-base">
            Вы успешно вошли в систему. Теперь нужно выбрать компанию.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Вариант 1: Создать компанию */}
          <div className="border rounded-lg p-4 hover:border-blue-500 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Plus className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-lg">Создать компанию</h3>
                <p className="text-sm text-gray-500 mb-3">
                  Создайте новую компанию и станьте её владельцем
                </p>
                <Button onClick={onCreateCompany} className="w-full">
                  Создать компанию
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>

          {/* Вариант 2: Проверить приглашения */}
          <div className="border rounded-lg p-4 hover:border-blue-500 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-lg">У меня есть приглашение</h3>
                <p className="text-sm text-gray-500 mb-3">
                  Проверьте приглашения, отправленные на ваш email
                </p>
                <Button onClick={onCheckInvitations} variant="outline" className="w-full">
                  Проверить приглашения
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 pt-4">
            Нужна помощь? Обратитесь к администратору вашей компании
          </p>
          
          {onSignOut && (
            <div className="pt-4 border-t mt-4">
              <button 
                onClick={onSignOut}
                className="flex items-center justify-center w-full text-sm text-gray-500 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Войти под другим аккаунтом
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
