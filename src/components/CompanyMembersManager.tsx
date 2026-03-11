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
  owner: 'bg-purple-100 text-purple-800 border-purple-200',
  admin: 'bg-red-100 text-red-800 border-red-200',
  manager: 'bg-blue-100 text-blue-800 border-blue-200',
  accountant: 'bg-green-100 text-green-800 border-green-200',
  viewer: 'bg-gray-100 text-gray-800 border-gray-200',
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
      toast.success('Приглашение отправлено');
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
            <h2 className="text-xl font-bold text-gray-900">Команда</h2>
            <p className="text-sm text-gray-500">{activeMembers.length} участников</p>
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
        <Card className="border-blue-200 bg-blue-50/30">
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
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {member.user?.name || 'Без имени'}
                      </span>
                      {member.user_id === myMember?.user_id && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600">Вы</Badge>
                      )}
                      <Badge variant="outline" className={ROLE_COLORS[member.role]}>
                        {COMPANY_ROLE_LABELS[member.role]}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">{member.user?.email}</div>
                  </div>
                </div>
                {canManage && member.user_id !== myMember?.user_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(member.id)}
                    disabled={removing === member.id}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
                  className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5 text-amber-600" />
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
