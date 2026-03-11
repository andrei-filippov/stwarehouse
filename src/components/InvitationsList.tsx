import { useState, useEffect } from 'react';
import { Mail, Check, X, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

interface Invitation {
  invitation_id: string;
  company_id: string;
  company_name: string;
  member_role: string;
  member_position?: string;
  inviter_name: string;
  invited_at: string;
}

export function InvitationsList({ onAccept }: { onAccept: () => void }) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    // Проверяем авторизацию перед загрузкой
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setLoading(false);
        return;
      }
      loadInvitations();
    });
  }, []);

  const loadInvitations = async () => {
    try {
      const { data, error } = await supabase.rpc('get_user_invitations');
      if (error) throw error;
      setInvitations(data || []);
    } catch (err) {
      console.error('Error loading invitations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitationId: string) => {
    setProcessing(invitationId);
    try {
      const { data, error } = await supabase.rpc('accept_invitation_by_id', {
        p_invitation_id: invitationId
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Приглашение принято!');
      onAccept();
    } catch (err) {
      toast.error('Ошибка: ' + (err instanceof Error ? err.message : 'Неизвестная ошибка'));
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    setProcessing(invitationId);
    try {
      await supabase
        .from('company_members')
        .delete()
        .eq('id', invitationId);

      toast.success('Приглашение отклонено');
      loadInvitations();
    } catch (err) {
      toast.error('Ошибка при отклонении');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return null;
  if (invitations.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-500" />
            У вас {invitations.length} {invitations.length === 1 ? 'приглашение' : 'приглашения'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {invitations.map((inv) => (
            <div key={inv.invitation_id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">{inv.company_name}</h4>
                  <p className="text-sm text-gray-500">
                    Роль: {inv.member_role === 'manager' ? 'Менеджер' : 
                           inv.member_role === 'admin' ? 'Администратор' : 
                           inv.member_role === 'accountant' ? 'Бухгалтер' : 'Наблюдатель'}
                  </p>
                  {inv.member_position && (
                    <p className="text-sm text-gray-500">Должность: {inv.member_position}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Пригласил: {inv.inviter_name}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleAccept(inv.invitation_id)}
                  disabled={processing === inv.invitation_id}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Принять
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleDecline(inv.invitation_id)}
                  disabled={processing === inv.invitation_id}
                >
                  <X className="w-4 h-4 mr-1" />
                  Отклонить
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
