import { useState, useMemo } from 'react';
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
import type { Expense, ExpenseCategory } from '../../types';
import { getExpenseCategoryLabel, EXPENSE_CATEGORIES } from '../../types/expenses';

interface ExpensesTabProps {
  expenses: Expense[];
  companyId?: string;
}

// Маппинг старых категорий на новые иконки
const categoryIcons: Record<string, { icon: React.ElementType; color: string }> = {
  equipment: { icon: Package, color: 'blue' },
  consumables: { icon: ShoppingCart, color: 'purple' },
  salary: { icon: Users, color: 'indigo' },
  rent: { icon: Home, color: 'green' },
  transport: { icon: Fuel, color: 'red' },
  other: { icon: MoreHorizontal, color: 'gray' },
  repair: { icon: Wrench, color: 'orange' },
  supplies: { icon: ShoppingCart, color: 'purple' },
  fuel: { icon: Fuel, color: 'red' }
};

import { Users } from 'lucide-react';

export function ExpensesTab({ expenses }: ExpensesTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: '' as ExpenseCategory | '',
    amount: '',
    description: ''
  });

  // Группировка по категориям
  const expensesByCategory = useMemo(() => {
    const grouped: Record<string, Expense[]> = {};
    expenses.forEach(expense => {
      const cat = expense.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(expense);
    });
    return grouped;
  }, [expenses]);

  const totalByCategory = useMemo(() => {
    return Object.entries(expensesByCategory).map(([category, items]) => ({
      category,
      total: items.reduce((sum, i) => sum + i.amount, 0),
      count: items.length
    }));
  }, [expensesByCategory]);

  const totalExpenses = useMemo(() => 
    expenses.reduce((sum, e) => sum + e.amount, 0),
  [expenses]);

  const handleAddExpense = () => {
    // TODO: добавление через API
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Summary by Category */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {EXPENSE_CATEGORIES.map(({ value, label }) => {
          const data = totalByCategory.find(t => t.category === value);
          const amount = data?.total || 0;
          const iconData = categoryIcons[value] || categoryIcons.other;
          const Icon = iconData.icon;
          const color = iconData.color;
          
          const colorClasses: Record<string, string> = {
            blue: 'bg-blue-50 border-blue-200 text-blue-700',
            orange: 'bg-orange-50 border-orange-200 text-orange-700',
            purple: 'bg-purple-50 border-purple-200 text-purple-700',
            green: 'bg-green-50 border-green-200 text-green-700',
            red: 'bg-red-50 border-red-200 text-red-700',
            gray: 'bg-gray-50 border-gray-200 text-gray-700',
            indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700'
          };
          
          return (
            <Card key={value} className={colorClasses[color]}>
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
                    {EXPENSE_CATEGORIES.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
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
            const iconData = categoryIcons[expense.category] || categoryIcons.other;
            const Icon = iconData.icon;
            const color = iconData.color;
            
            return (
              <Card key={expense.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full bg-${color}-100 flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 text-${color}-600`} />
                      </div>
                      <div>
                        <p className="font-medium">{expense.description}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Badge variant="outline">{getExpenseCategoryLabel(expense.category)}</Badge>
                          <span>{format(new Date(expense.date), 'dd MMMM yyyy', { locale: ru })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-lg font-bold text-red-600">
                        -{expense.amount.toLocaleString('ru-RU')} ₽
                      </p>
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
