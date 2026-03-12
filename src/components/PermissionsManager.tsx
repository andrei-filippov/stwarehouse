import { useState, useEffect } from 'react';
import { Shield, Check, X, UserCog, RefreshCw } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Spinner } from './ui/spinner';
import { toast } from 'sonner';
import { useCompanyContext } from '../contexts/CompanyContext';
import {
  fetchUserEffectivePermissions,
  setUserPermission,
  removeUserPermission,
  getRoleLabel,
  ALL_TABS,
  type UserRole,
  type TabId,
  type EffectivePermission,
} from '../lib/permissions';

interface Member {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface PermissionsManagerProps {
  currentUserId?: string;
}

export function PermissionsManager({ currentUserId }: PermissionsManagerProps) {
  const { members, myMember, updateMemberRole } = useCompanyContext();
  const [users, setUsers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, EffectivePermission[]>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadUsers();
  }, [members]);

  const loadUsers = async () => {
    setLoading(true);
    // Загружаем только членов текущей компании
    if (members) {
      const formattedMembers = members
        .filter(m => m.status === 'active' && m.user_id) // Только активные с привязанным пользователем
        .map(m => ({
          id: m.user_id!,
          user_id: m.user_id!,
          name: m.user?.name || m.email || 'Без имени',
          email: m.email || m.user?.email || '',
          role: (m.role as UserRole) || 'manager',
        }));
      setUsers(formattedMembers);
    } else {
      setUsers([]);
    }
    setLoading(false);
  };

  const handleRoleChange = async (memberId: string, newRole: UserRole) => {
    setSaving(prev => ({ ...prev, [`role-${memberId}`]: true }));
    
    // Находим member по user_id
    const member = members?.find(m => m.user_id === memberId);
    if (!member) {
      toast.error('Участник не найден');
      setSaving(prev => ({ ...prev, [`role-${memberId}`]: false }));
      return;
    }
    
    // Обновляем роль через контекст компании
    const { error } = await updateMemberRole(member.id, newRole);
    
    if (error) {
      toast.error('Ошибка обновления роли');
    } else {
      setUsers(prev => prev.map(u => 
        u.user_id === memberId ? { ...u, role: newRole } : u
      ));
      toast.success('Роль обновлена');
      
      if (expandedUser === memberId) {
        loadUserPermissions(memberId);
      }
    }
    
    setSaving(prev => ({ ...prev, [`role-${memberId}`]: false }));
  };

  const loadUserPermissions = async (userId: string) => {
    const perms = await fetchUserEffectivePermissions(userId);
    if (perms) {
      setUserPermissions(prev => ({ ...prev, [userId]: perms }));
    }
  };

  const toggleUserExpand = async (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
    } else {
      setExpandedUser(userId);
      if (!userPermissions[userId]) {
        await loadUserPermissions(userId);
      }
    }
  };

  const handlePermissionToggle = async (
    userId: string, 
    tabId: TabId, 
    currentAllowed: boolean,
    source: 'role' | 'custom'
  ) => {
    setSaving(prev => ({ ...prev, [`${userId}-${tabId}`]: true }));
    
    let error;
    
    if (source === 'role') {
      // Создаём кастомное разрешение противоположное ролевому
      ({ error } = await setUserPermission(userId, tabId, !currentAllowed));
    } else {
      // Удаляем кастомное разрешение, возвращаемся к ролевому
      ({ error } = await removeUserPermission(userId, tabId));
    }
    
    if (error) {
      toast.error('Ошибка обновления разрешения');
    } else {
      toast.success('Разрешение обновлено');
      await loadUserPermissions(userId);
    }
    
    setSaving(prev => ({ ...prev, [`${userId}-${tabId}`]: false }));
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'manager': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'warehouse': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'accountant': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const canManage = myMember?.role === 'owner' || myMember?.role === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-md">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Управление доступом</h2>
            <p className="text-sm text-gray-500">Настройка ролей и разрешений пользователей</p>
          </div>
        </div>
        <Button variant="outline" onClick={loadUsers} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Обновить
        </Button>
      </div>

      {/* Легенда */}
      <Card className="p-4 bg-gray-50/50 border-gray-200">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Check className="w-3 h-3 mr-1" /> Доступно
            </Badge>
            <span className="text-gray-500">- вкладка доступна</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              <X className="w-3 h-3 mr-1" /> Запрещено
            </Badge>
            <span className="text-gray-500">- доступ закрыт</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-gray-500">Кастомное</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            <span className="text-gray-500">По роли</span>
          </div>
        </div>
      </Card>

      {/* Список пользователей */}
      <div className="space-y-3">
        {users.map((user) => (
          <Card 
            key={user.user_id} 
            className={`overflow-hidden transition-shadow ${expandedUser === user.user_id ? 'ring-2 ring-blue-100 shadow-lg' : 'hover:shadow-md'}`}
          >
            {/* Заголовок карточки пользователя */}
            <div 
              className="p-4 flex items-center justify-between cursor-pointer bg-white"
              onClick={() => toggleUserExpand(user.user_id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                  <UserCog className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{user.name || 'Без имени'}</span>
                    {user.user_id === currentUserId && (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                        Вы
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">{user.email}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Селект роли */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 hidden sm:inline">Роль:</span>
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.user_id, e.target.value as UserRole)}
                    onClick={(e) => e.stopPropagation()}
                    disabled={!canManage || saving[`role-${user.user_id}`] || user.user_id === currentUserId}
                    className={`text-sm border rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50 ${getRoleBadgeColor(user.role)}`}
                  >
                    <option value="owner">Владелец</option>
                    <option value="admin">Администратор</option>
                    <option value="manager">Менеджер</option>
                    <option value="warehouse">Кладовщик</option>
                    <option value="accountant">Бухгалтер</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Развёрнутые разрешения */}
            {expandedUser === user.user_id && (
              <div className="border-t bg-gray-50/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <UserCog className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-gray-700">Индивидуальные разрешения</span>
                  <span className="text-xs text-gray-400">(переопределяют ролевые)</span>
                </div>

                {userPermissions[user.id] ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {userPermissions[user.id].map((perm) => {
                      const tabLabel = ALL_TABS.find(t => t.id === perm.tab_id)?.label || perm.tab_id;
                      const isSaving = saving[`${user.id}-${perm.tab_id}`];
                      
                      return (
                        <button
                          key={perm.tab_id}
                          onClick={() => handlePermissionToggle(
                            user.user_id, 
                            perm.tab_id, 
                            perm.allowed,
                            perm.source
                          )}
                          disabled={!canManage || isSaving || user.user_id === currentUserId}
                          className={`
                            relative p-3 rounded-lg border text-left transition-all
                            ${perm.allowed 
                              ? 'bg-green-50 border-green-200 hover:border-green-300' 
                              : 'bg-red-50 border-red-200 hover:border-red-300'
                            }
                            ${perm.source === 'custom' ? 'ring-2 ring-blue-200' : ''}
                            ${isSaving ? 'opacity-50' : ''}
                            ${user.id === currentUserId ? 'cursor-not-allowed opacity-70' : 'hover:shadow-sm'}
                          `}
                        >
                          <div className="flex items-start justify-between">
                            <span className={`text-sm font-medium ${perm.allowed ? 'text-green-900' : 'text-red-900'}`}>
                              {tabLabel}
                            </span>
                            {perm.source === 'custom' && (
                              <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" title="Кастомное разрешение" />
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1">
                            {perm.allowed ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <X className="w-3 h-3 text-red-600" />
                            )}
                            <span className="text-xs text-gray-500">
                              {perm.source === 'custom' ? 'Кастом' : 'По роли'}
                            </span>
                          </div>
                          {isSaving && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                              <Spinner className="w-4 h-4" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <Spinner className="w-6 h-6" />
                  </div>
                )}

                {user.user_id === currentUserId && (
                  <p className="text-sm text-amber-600 mt-4 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Вы не можете изменять свои собственные разрешения
                  </p>
                )}
                {!canManage && user.user_id !== currentUserId && (
                  <p className="text-sm text-gray-500 mt-4 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Только владелец или администратор может изменять разрешения
                  </p>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Пустое состояние */}
      {users.length === 0 && !loading && (
        <Card className="p-8 text-center">
          <UserCog className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Пользователей не найдено</p>
        </Card>
      )}
    </div>
  );
}
