import { useState } from 'react';
import { Users, UserPlus, Trash2, Mail, UserCheck, Clock, Shield, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import type { CompanyMember, CompanyRole } from '../types';
import { COMPANY_ROLE_LABELS } from '../types/company';

interface CompanyMembersManagerProps {
  members: CompanyMember[];
  currentUserId?: string;
  canManage: boolean;
  onInvite: (email: string, role: CompanyRole, position?: string) => Promise<{ error?: string }>;
  onRemove: (memberId: string) => Promise<{ error?: string }>;
  onUpdateRole?: (memberId: string, role: CompanyRole) => Promise<{ error?: string }>;
}

const ROLE_COLORS: Record<CompanyRole, string> = {
  owner: 'bg-purple-100 text-purple-800 border-purple-200',
  admin: 'bg-red-100 text-red-800 border-red-200',
  manager: 'bg-blue-100 text-blue-800 border-blue-200',
  accountant: 'bg-green-100 text-green-800 border-green-200',
  viewer: 'bg-gray-100 text-gray-800 border-gray-200',
};

const getRoleOptions = (): { value: CompanyRole; label: string }[] => [
  { value: 'manager', label: COMPANY_ROLE_LABELS?.manager || 'Менеджер' },
  { value: 'accountant', label: COMPANY_ROLE_LABELS?.accountant || 'Бухгалтер' },
  { value: 'viewer', label: COMPANY_ROLE_LABELS?.viewer || 'Наблюдатель' },
];

export function CompanyMembersManager({
  members,
  currentUserId,
  canManage,
  onInvite,
  onRemove,
  onUpdateRole,
}: CompanyMembersManagerProps) {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CompanyRole>('manager');
  const [invitePosition, setInvitePosition] = useState('');
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error('Введите email');
      return;
    }

    setInviting(true);
    const { error } = await onInvite(inviteEmail.trim(), inviteRole, invitePosition.trim() || undefined);
    setInviting(false);

    if (error) {
      toast.error('Ошибка приглашения: ' + error);
    } else {
      toast.success('Приглашение отправлено');
      setInviteEmail('');
      setInvitePosition('');
      setShowInviteForm(false);
    }
  };

  const handleRemove = async (member: CompanyMember) => {
    if (member.user_id === currentUserId) {
      toast.error('Вы не можете удалить себя');
      return;
    }

    if (!confirm(`Удалить ${member.user?.name || member.user?.email || 'пользователя'} из компании?`)) {
      return;
    }

    setRemoving(member.id);
    const { error } = await onRemove(member.id);
    setRemoving(null);

    if (error) {
      toast.error('Ошибка удаления: ' + error);
    } else {
      toast.success('Пользователь удалён');
    }
  };

  const handleRoleChange = async (member: CompanyMember, newRole: CompanyRole) => {
    if (!onUpdateRole) return;
    if (member.user_id === currentUserId) {
      toast.error('Вы не можете изменить свою роль');
      return;
    }

    const { error } = await onUpdateRole(member.id, newRole);

    if (error) {
      toast.error('Ошибка обновления роли: ' + error);
    } else {
      toast.success('Роль обновлена');
    }
  };

  const activeMembers = (members || []).filter(m => m.status === 'active');
  const pendingMembers = (members || []).filter(m => m.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Команда</h2>
            <p className="text-sm text-gray-500">
              {activeMembers.length} участников
              {pendingMembers.length > 0 && ` • ${pendingMembers.length} приглашений`}
            </p>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => setShowInviteForm(!showInviteForm)} className="gap-2">
            {showInviteForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {showInviteForm ? 'Отмена' : 'Пригласить'}
          </Button>
        )}
      </div>

      {/* Invite Form */}
      {showInviteForm && canManage && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-500" />
              Пригласить сотрудника
            </CardTitle>
            <CardDescription>
              Отправьте приглашение по email. Пользователь получит доступ после регистрации.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="invite-email">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.ru"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invite-role">Роль</Label>
                  <select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as CompanyRole)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    {getRoleOptions().map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invite-position">Должность</Label>
                  <Input
                    id="invite-position"
                    value={invitePosition}
                    onChange={(e) => setInvitePosition(e.target.value)}
                    placeholder="Менеджер"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={inviting} className="gap-2">
                  {inviting ? 'Отправка...' : <><Mail className="w-4 h-4" /> Отправить приглашение</>}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Active Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-green-500" />
            Активные участники
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activeMembers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Пока нет участников</p>
              </div>
            ) : (
              activeMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
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
                        {member.user_id === currentUserId && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600">
                            Вы
                          </Badge>
                        )}
                        <Badge variant="outline" className={ROLE_COLORS[member.role]}>
                          {COMPANY_ROLE_LABELS?.[member.role] || member.role}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        {member.user?.email || member.user_id}
                        {member.position && ` • ${member.position}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canManage && member.role !== 'owner' && member.user_id !== currentUserId && onUpdateRole && (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member, e.target.value as CompanyRole)}
                        className="text-sm border rounded-md px-2 py-1 bg-white"
                      >
                        {getRoleOptions().map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    )}
                    {canManage && member.user_id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(member)}
                        disabled={removing === member.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {removing === member.id ? '...' : <Trash2 className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {pendingMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Ожидают приглашения
            </CardTitle>
            <CardDescription>
              Пользователи, которым отправлены приглашения
            </CardDescription>
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
                        <span className="font-medium text-gray-900">
                          {member.user?.email || 'Приглашение отправлено'}
                        </span>
                        <Badge variant="outline" className={ROLE_COLORS[member.role]}>
                          {COMPANY_ROLE_LABELS?.[member.role] || member.role}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        {member.invited_at && `Приглашён ${new Date(member.invited_at).toLocaleDateString('ru-RU')}`}
                        {member.position && ` • ${member.position}`}
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(member)}
                      disabled={removing === member.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {removing === member.id ? '...' : <X className="w-4 h-4" />}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role Info */}
      <Card className="bg-gray-50/50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4" />
            О ролях
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className={ROLE_COLORS.owner}>Владелец</Badge>
              <span className="text-gray-600">Полный доступ, управление компанией и участниками</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className={ROLE_COLORS.admin}>Администратор</Badge>
              <span className="text-gray-600">Управление данными компании, приглашение пользователей</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className={ROLE_COLORS.manager}>Менеджер</Badge>
              <span className="text-gray-600">Создание смет, договоров, управление оборудованием</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className={ROLE_COLORS.accountant}>Бухгалтер</Badge>
              <span className="text-gray-600">Доступ к финансам, счетам, отчётам</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className={ROLE_COLORS.viewer}>Наблюдатель</Badge>
              <span className="text-gray-600">Только просмотр данных</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
