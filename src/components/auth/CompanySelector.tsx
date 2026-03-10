import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Building2, Plus, Check, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Company, CompanyMember } from '../../types/company';

interface CompanySelectorProps {
  onSelect: (companyId: string) => void;
  onCreateNew: () => void;
}

export function CompanySelector({ onSelect, onCreateNew }: CompanySelectorProps) {
  const [companies, setCompanies] = useState<(CompanyMember & { company: Company })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserCompanies();
  }, []);

  const loadUserCompanies = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('company_members')
        .select(`
          *,
          company:company_id (*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('joined_at', { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (err) {
      console.error('Error loading companies:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center text-muted-foreground">
          Загрузка...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Выберите компанию</CardTitle>
        <CardDescription>
          У вас доступ к {companies.length} {companies.length === 1 ? 'компании' : 'компаниям'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {companies.map((member) => (
          <button
            key={member.id}
            onClick={() => onSelect(member.company_id)}
            className="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-muted transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="font-medium">{member.company.name}</div>
              <div className="text-sm text-muted-foreground">
                {member.role === 'owner' ? 'Владелец' : 
                 member.role === 'admin' ? 'Администратор' : 
                 member.role === 'manager' ? 'Менеджер' : 
                 member.role === 'accountant' ? 'Бухгалтер' : 'Наблюдатель'}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        ))}

        <div className="pt-2 border-t">
          <Button variant="outline" onClick={onCreateNew} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Создать новую компанию
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
