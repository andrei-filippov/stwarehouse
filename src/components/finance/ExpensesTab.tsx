import { useState } from 'react';
import { Plus, Package, Wrench, ShoppingCart, Home, Fuel, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ExpensesTabProps {
  companyId?: string;
}

type ExpenseCategory = 'equipment' | 'repair' | 'supplies' | 'rent' | 'fuel' | 'other';

interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
}

const categoryLabels: Record<ExpenseCategory, { label: string; icon: React.ElementType; color: string }> = {
  equipment: { label: 'Оборудование', icon: Package, color: 'blue' },
  repair: { label: 'Ремонт', icon: Wrench, color: 'orange' },
  supplies: { label: 'Расходники', icon: ShoppingCart, color: 'purple' },
  rent: { label: 'Аренда', icon: Home, color: 'green' },
  fuel: { label: 'Топливо', icon: Fuel, color: 'red' },
  other: { label: 'Прочее', icon: MoreHorizontal, color: 'gray' }
};

export function ExpensesTab({ companyId }: ExpensesTabProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: '' as ExpenseCategory | '',
    amount: '',
    description: ''
  });

  const handleAddExpense = () => {
    if (!newExpense.category || !newExpense.amount || !newExpense.description) return;
    
    const expense: Expense = {
      id: `exp_${Date.now()}`,
      date: newExpense.date,
      category: newExpense.category,
      amount: parseFloat(newExpense.amount),
      description: newExpense.description
    };
    
    setExpenses(prev => [expense, ...prev]);
    setNewExpense({
      date: format(new Date(), 'yyyy-MM-dd'),
      category: '',
      amount: '',
      description: ''
    });
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  // Группировка по категориям
  const expensesByCategory = expenses.reduce((acc, expense) => {
    if (!acc[expense.category]) acc[expense.category] = [];
    acc[expense.category].push(expense);
    return acc;
  }, {} as Record<ExpenseCategory, Expense[]>);

  const totalByCategory = Object.entries(expensesByCategory).map(([category, items]) => ({
    category: category as ExpenseCategory,
    total: items.reduce((sum, i) => sum + i.amount, 0),
    count: items.length
  }));

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary by Category */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Object.entries(categoryLabels).map(([key, { label, icon: Icon, color }]) => {
          const data = totalByCategory.find(t => t.category === key);
          const amount = data?.total || 0;
          const colorClasses: Record<string, string> = {
            blue: 'bg-blue-50 border-blue-200 text-blue-700',
            orange: 'bg-orange-50 border-orange-200 text-orange-700',
            purple: 'bg-purple-50 border-purple-200 text-purple-700',
            green: 'bg-green-50 border-green-200 text-green-700',
            red: 'bg-red-50 border-red-200 text-red-700',
            gray: 'bg-gray-50 border-gray-200 text-gray-700'
          };
          return (
            <Card key={key} className={colorClasses[color]}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-medium">{label}</span>
                </div>
                <p className="text-lg font-bold">
                  {amount.toLocaleString('ru-RU')} ₽
                </p>
                {data && (
                  <p className="text-xs opacity-70">{data.count} записей</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Total and Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Всего расходов</h3>
          <p className="text-2xl font-bold text-red-600">
            {totalExpenses.toLocaleString('ru-RU')} ₽
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Добавить расход
        </Button>
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый расход</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Дата</Label>
                <Input
                  type="date"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Категория</Label>
                <Select
                  value={newExpense.category}
                  onValueChange={(value) => setNewExpense(prev => ({ ...prev, category: value as ExpenseCategory }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Сумма (₽)</Label>
              <Input
                type="number"
                placeholder="0"
                value={newExpense.amount}
                onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Описание</Label>
              <Input
                placeholder="На что потрачено"
                value={newExpense.description}
                onChange={(e) => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <Button onClick={handleAddExpense} className="w-full">
              Добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expenses List */}
      <div className="space-y-4">
        {expenses.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Нет записей о расходах</p>
            <p className="text-sm">Добавьте первый расход</p>
          </div>
        ) : (
          expenses.map((expense) => {
            const categoryInfo = categoryLabels[expense.category];
            const Icon = categoryInfo.icon;
            return (
              <Card key={expense.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-${categoryInfo.color}-100`}>
                        <Icon className={`w-5 h-5 text-${categoryInfo.color}-600`} />
                      </div>
                      <div>
                        <p className="font-medium">{expense.description}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Badge variant="outline">{categoryInfo.label}</Badge>
                          <span>{format(new Date(expense.date), 'dd MMMM yyyy', { locale: ru })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-lg font-bold text-red-600">
                        -{expense.amount.toLocaleString('ru-RU')} ₽
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(expense.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
