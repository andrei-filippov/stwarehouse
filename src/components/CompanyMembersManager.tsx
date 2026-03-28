import { useState } from 'react';
import { Users, UserPlus, Trash2, Mail, UserCheck, Clock, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { useCompanyContext } from '../contexts/CompanyContext';
import type { CompanyRole } from '../types/company';
import { COMPANY_ROLE_LABELS } from '../types/company';

const ROLE_COLORS: Record<CompanyRole, string> = {
  owner: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  admin: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
  manager: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  accountant: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800',
  viewer: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
};

export function CompanyMembersManager() {
  const { members, myMember, canManage, inviteMember, removeMember, updateMemberRole } = useCompanyContext();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CompanyRole>('manager');
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error('Введите email');
      return;
    }

    setInviting(true);
    const { error } = await inviteMember(inviteEmail.trim(), inviteRole);
    setInviting(false);

    if (error) {
      toast.error('Ошибка приглашения: ' + error);
    } else {
      toast.success('Приглашение отправлено!', {
        description: `Письмо отправлено на ${inviteEmail}. Пользователь должен зарегистрироваться с этим email и подтвердить его.`,
        duration: 8000,
      });
      setInviteEmail('');
      setShowInviteForm(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm('Удалить пользователя из компании?')) return;

    setRemoving(memberId);
    const { error } = await removeMember(memberId);
    setRemoving(null);

    if (error) {
      toast.error('Ошибка удаления: ' + error);
    } else {
      toast.success('Пользователь удалён');
    }
  };

  const activeMembers = (members || []).filter(m => m.status === 'active');
  const pendingMembers = (members || []).filter(m => m.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Команда</h2>
            <p className="text-sm text-muted-foreground">{activeMembers.length} участников</p>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => setShowInviteForm(!showInviteForm)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Пригласить
          </Button>
        )}
      </div>

      {showInviteForm && canManage && (
        <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-900/10">
          <CardHeader>
            <CardTitle className="text-lg">Пригласить сотрудника</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.ru"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Роль</Label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as CompanyRole)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="manager">{COMPANY_ROLE_LABELS.manager}</option>
                    <option value="accountant">{COMPANY_ROLE_LABELS.accountant}</option>
                    <option value="viewer">{COMPANY_ROLE_LABELS.viewer}</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={inviting}>
                  {inviting ? 'Отправка...' : 'Отправить приглашение'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-green-500" />
            Активные участники
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activeMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-gray-100 dark:from-gray-800 to-gray-200 dark:to-gray-700 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {member.user?.name || 'Без имени'}
                      </span>
                      {member.user_id === myMember?.user_id && (
                        <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">Вы</Badge>
                      )}
                      <Badge variant="outline" className={ROLE_COLORS[member.role]}>
                        {COMPANY_ROLE_LABELS[member.role]}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{member.user?.email}</div>
                  </div>
                </div>
                {canManage && member.user_id !== myMember?.user_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(member.id)}
                    disabled={removing === member.id}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {pendingMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Ожидают приглашения
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-100 dark:from-amber-900/50 to-amber-200 dark:to-amber-900/30 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.user?.email || 'Приглашение'}</span>
                        <Badge variant="outline" className={ROLE_COLORS[member.role]}>
                          {COMPANY_ROLE_LABELS[member.role]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(member.id)}
                      disabled={removing === member.id}
                    >
                      Отменить
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
