import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Switch } from './ui/switch';
import { Shield, Users, Search, Save } from 'lucide-react';
import { Input } from './ui/input';
import { Spinner } from './ui/spinner';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { 
  getRoleLabel, 
  type UserRole, 
  PERMISSION_TEMPLATES,
  ALL_TABS,
  type UserPermissions,
  updateUserPermissions,
  type TabId,
} from '../lib/permissions';
import type { Profile } from '../types';

interface UserWithPermissions {
  id: string;
  email: string;
  profile: Profile | null;
  permissions: UserPermissions | null;
}

export function AdminPanel() {
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      const { data: permissions, error: permsError } = await supabase
        .from('user_permissions')
        .select('*');

      if (permsError) throw permsError;

      const combinedUsers: UserWithPermissions[] = (profiles || []).map((profile: Profile) => {
        const userPerms = permissions?.find((p: UserPermissions) => p.user_id === profile.id);
        return {
          id: profile.id,
          email: 'hidden@email.com',
          profile,
          permissions: userPerms || null,
        };
      });

      setUsers(combinedUsers);
    } catch (error: any) {
      toast.error('Ошибка при загрузке пользователей', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (userId: string, role: UserRole) => {
    const template = PERMISSION_TEMPLATES[role];
    if (!template) return;

    setUsers(prev => prev.map(user => {
      if (user.id !== userId) return user;
      return {
        ...user,
        permissions: {
          user_id: userId,
          allowed_tabs: template.allowed_tabs as TabId[],
          can_edit: template.can_edit ?? true,
          can_delete: template.can_delete ?? false,
          can_export: template.can_export ?? false,
        }
      };
    }));

    toast.success(`Применён шаблон: ${getRoleLabel(role)}`);
  };

  const toggleTab = (userId: string, tabId: TabId) => {
    setUsers(prev => prev.map(user => {
      if (user.id !== userId) return user;
      
      const currentTabs = user.permissions?.allowed_tabs || [];
      const newTabs = currentTabs.includes(tabId)
        ? currentTabs.filter(t => t !== tabId)
        : [...currentTabs, tabId];

      return {
        ...user,
        permissions: {
          ...user.permissions!,
          user_id: userId,
          allowed_tabs: newTabs,
        }
      };
    }));
  };

  const togglePermission = (userId: string, field: 'can_edit' | 'can_delete' | 'can_export') => {
    setUsers(prev => prev.map(user => {
      if (user.id !== userId) return user;
      return {
        ...user,
        permissions: {
          ...user.permissions!,
          user_id: userId,
          [field]: !(user.permissions?.[field] ?? false),
        }
      };
    }));
  };

  const savePermissions = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user?.permissions) return;

    setSaving(userId);
    try {
      const { error } = await updateUserPermissions(userId, {
        allowed_tabs: user.permissions.allowed_tabs,
        can_edit: user.permissions.can_edit,
        can_delete: user.permissions.can_delete,
        can_export: user.permissions.can_export,
      });

      if (error) throw error;

      toast.success('Права сохранены');
      setEditingUser(null);
    } catch (error: any) {
      toast.error('Ошибка при сохранении', { description: error.message });
    } finally {
      setSaving(null);
    }
  };

  const filteredUsers = users.filter(user => 
    user.profile?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.profile?.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-800 border-red-300',
      manager: 'bg-blue-100 text-blue-800 border-blue-300',
      warehouse: 'bg-green-100 text-green-800 border-green-300',
      accountant: 'bg-purple-100 text-purple-800 border-purple-300',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-sm hover:shadow-md transition-shadow rounded-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            <CardTitle>Управление правами доступа</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Быстрое применение шаблонов</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PERMISSION_TEMPLATES).map(([role, config]) => (
                <div key={role} className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                  <span className="font-medium">{getRoleLabel(role as UserRole)}:</span>
                  {' '}{config.allowed_tabs?.length || 0} вкладок
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Пользователи
              </h3>
              <div className="relative w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Поиск..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-lg"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <Spinner className="w-8 h-8 mx-auto" />
              </div>
            ) : (
              <div className="space-y-4">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Пользователи не найдены</div>
                ) : (
                  filteredUsers.map((user) => (
                    <Card key={user.id} className={`p-4 ${editingUser === user.id ? 'ring-2 ring-blue-500' : ''}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{user.profile?.name || 'Без имени'}</p>
                            <Badge 
                              variant="outline" 
                              className={getRoleBadgeColor(user.profile?.role || 'manager')}
                            >
                              {getRoleLabel(user.profile?.role as UserRole)}
                            </Badge>
                          </div>
                          <code className="text-xs text-gray-400">{user.id.slice(0, 8)}...</code>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            className="text-sm border rounded-lg px-2 py-1"
                            onChange={(e) => applyTemplate(user.id, e.target.value as UserRole)}
                            value=""
                          >
                            <option value="" disabled>Применить шаблон...</option>
                            <option value="admin">Администратор</option>
                            <option value="manager">Менеджер</option>
                            <option value="warehouse">Кладовщик</option>
                            <option value="accountant">Бухгалтер</option>
                          </select>
                          
                          {editingUser !== user.id ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingUser(user.id)}
                            >
                              Настроить
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => savePermissions(user.id)}
                              disabled={saving === user.id}
                            >
                              {saving === user.id ? (
                                <Spinner className="w-4 h-4" />
                              ) : (
                                <>
                                  <Save className="w-4 h-4 mr-1" />
                                  Сохранить
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-2">Доступные вкладки:</p>
                          <div className="flex flex-wrap gap-2">
                            {ALL_TABS.map(tab => {
                              const isEnabled = user.permissions?.allowed_tabs?.includes(tab.id);
                              return (
                                <label
                                  key={tab.id}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm cursor-pointer transition-colors ${
                                    isEnabled 
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                      : 'bg-gray-50 text-gray-400 border border-gray-200'
                                  } ${editingUser !== user.id ? 'pointer-events-none opacity-60' : ''}`}
                                >
                                  <Checkbox
                                    checked={isEnabled}
                                    onCheckedChange={() => toggleTab(user.id, tab.id)}
                                    className="w-3 h-3"
                                  />
                                  {tab.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex gap-4 pt-2 border-t">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Switch
                              checked={user.permissions?.can_edit ?? true}
                              onCheckedChange={() => togglePermission(user.id, 'can_edit')}
                              disabled={editingUser !== user.id}
                            />
                            Редактирование
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Switch
                              checked={user.permissions?.can_delete ?? false}
                              onCheckedChange={() => togglePermission(user.id, 'can_delete')}
                              disabled={editingUser !== user.id}
                            />
                            Удаление
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Switch
                              checked={user.permissions?.can_export ?? false}
                              onCheckedChange={() => togglePermission(user.id, 'can_export')}
                              disabled={editingUser !== user.id}
                            />
                            Экспорт
                          </label>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
