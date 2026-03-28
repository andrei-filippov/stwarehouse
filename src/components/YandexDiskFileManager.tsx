import { useState, useCallback, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { toast } from 'sonner';
import { 
  Upload, Download, Trash2, FolderPlus, RefreshCw, 
  ExternalLink, Folder, File, LogOut, CheckCircle, 
  Eye, X, User, Building2
} from 'lucide-react';
import { YandexDiskClient, getYandexOAuthUrl } from '../lib/yandexDisk';
import { useCompanyYandexDisk } from '../hooks/useCompanyYandexDisk';
import { supabase } from '../lib/supabase';

interface YandexDiskFileManagerProps {
  clientId: string;
  redirectUri: string;
  basePath?: string;
  companyId?: string;
}

interface DiskItem {
  name: string;
  path: string;
  type: 'dir' | 'file';
  size?: number;
  modified?: string;
  public_url?: string;
}

export function YandexDiskFileManager({ 
  clientId, 
  redirectUri,
  basePath: propsBasePath,
  companyId
}: YandexDiskFileManagerProps) {
  // Путь для хранения файлов компании
  const basePath = companyId 
    ? (propsBasePath || `/stwarehouse/${companyId}`)
    : (propsBasePath || '/stwarehouse');
  
  // Получаем токен из БД (общий для всех сотрудников компании)
  const { 
    token: dbToken, 
    isConnected, 
    loading: settingsLoading, 
    saveToken, 
    disconnect,
    refresh: refreshSettings 
  } = useCompanyYandexDisk(companyId);
  
  // Для владельца - возможность подключить свой токен
  const [isOwner, setIsOwner] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [manualToken, setManualToken] = useState('');
  
  const [client, setClient] = useState<YandexDiskClient | null>(null);
  const [items, setItems] = useState<DiskItem[]>([]);
  const [currentPath, setCurrentPath] = useState(basePath);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [previewItem, setPreviewItem] = useState<DiskItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Проверяем права владельца/админа
  useEffect(() => {
    if (!companyId) return;
    
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: member } = await supabase
        .from('company_members')
        .select('role')
        .eq('company_id', companyId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();
      
      setIsOwner(member?.role === 'owner' || member?.role === 'admin');
    };
    
    checkRole();
  }, [companyId]);

  // Инициализация клиента при наличии токена
  useEffect(() => {
    if (dbToken) {
      setClient(new YandexDiskClient(dbToken));
    } else {
      setClient(null);
      setItems([]);
    }
  }, [dbToken]);

  // Обработка OAuth callback (для владельца)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('access_token') && isOwner) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      if (accessToken) {
        saveToken(accessToken, basePath);
        window.location.hash = '';
      }
    }
  }, [isOwner, saveToken, basePath]);

  // Загрузка файлов
  const loadFiles = useCallback(async () => {
    if (!client) return;
    
    setLoading(true);
    try {
      // Создаем папку если её нет
      try {
        await client.createFolder(basePath);
      } catch {
        // Папка уже существует
      }
      
      const response = await client.listFiles(currentPath);
      setItems(response._embedded?.items || []);
    } catch (error: any) {
      if (error.message?.includes('401')) {
        toast.error('Токен истёк', { description: 'Владелец должен обновить подключение' });
      } else {
        toast.error('Ошибка загрузки файлов', { description: error.message });
      }
    } finally {
      setLoading(false);
    }
  }, [client, currentPath, basePath]);

  useEffect(() => {
    if (client && currentPath) {
      loadFiles();
    }
  }, [client, currentPath, loadFiles]);

  // Подключение вручную (для владельца)
  const handleConnect = () => {
    if (manualToken.length > 20) {
      saveToken(manualToken, basePath);
      setShowConnectDialog(false);
      setManualToken('');
    }
  };

  // Отключение (только для владельца)
  const handleDisconnect = async () => {
    await disconnect();
    setCurrentPath(basePath);
  };

  // Загрузка файла
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;

    setUploadProgress(0);
    try {
      const filePath = `${currentPath}/${file.name}`;
      await client.uploadFile(filePath, file, (progress) => {
        setUploadProgress(progress);
      });
      toast.success('Файл загружен', { description: file.name });
      await loadFiles();
    } catch (error: any) {
      toast.error('Ошибка загрузки', { description: error.message });
    } finally {
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  // Скачивание
  const handleDownload = async (item: DiskItem) => {
    if (!client || item.type !== 'file') return;
    try {
      const url = await client.getDownloadUrl(item.path);
      window.open(url, '_blank');
    } catch (error: any) {
      toast.error('Ошибка скачивания', { description: error.message });
    }
  };

  // Удаление
  const handleDelete = async (item: DiskItem) => {
    if (!client) return;
    try {
      await client.deleteFile(item.path);
      toast.success('Удалено', { description: item.name });
      await loadFiles();
    } catch (error: any) {
      toast.error('Ошибка удаления', { description: error.message });
    }
  };

  // Создание папки
  const handleCreateFolder = async () => {
    if (!client) return;
    const name = prompt('Название папки:');
    if (!name) return;

    try {
      await client.createFolder(`${currentPath}/${name}`);
      toast.success('Папка создана');
      await loadFiles();
    } catch (error: any) {
      toast.error('Ошибка создания папки', { description: error.message });
    }
  };

  // Публикация файла
  const handlePublish = async (item: DiskItem) => {
    if (!client || item.type !== 'file') return;
    try {
      const url = await client.publishFile(item.path);
      navigator.clipboard.writeText(url);
      toast.success('Публичная ссылка скопирована');
      await loadFiles();
    } catch (error: any) {
      toast.error('Ошибка публикации', { description: error.message });
    }
  };

  // Предпросмотр через публикацию файла
  const handlePreview = async (item: DiskItem) => {
    if (!client || item.type !== 'file') return;
    
    const isImage = item.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isPdf = item.name.match(/\.pdf$/i);
    const isText = item.name.match(/\.(txt|md|json|js|ts|jsx|tsx|css|html)$/i);
    
    if (!isImage && !isPdf && !isText) {
      toast.info('Предпросмотр доступен только для изображений, PDF и текстовых файлов');
      return;
    }

    try {
      toast.loading('Открытие...', { id: 'preview' });
      
      // Если файл уже опубликован - используем public_url
      if (item.public_url) {
        window.open(item.public_url, '_blank');
        toast.dismiss('preview');
        return;
      }
      
      // Иначе публикуем и открываем
      const publicUrl = await client.publishFile(item.path);
      window.open(publicUrl, '_blank');
      toast.success('Файл опубликован для просмотра');
      await loadFiles(); // Обновляем чтобы сохранить public_url
    } catch (error: any) {
      toast.dismiss('preview');
      toast.error('Ошибка открытия', { description: error.message });
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewItem(null);
    setPreviewUrl(null);
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (date?: string) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ru-RU');
  };

  // Если не подключен
  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="w-5 h-5" />
            Яндекс Диск
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isOwner ? (
            <>
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg text-sm">
                <p className="font-medium text-amber-500 mb-1">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Хранилище компании не подключено
                </p>
                <p className="text-muted-foreground">
                  Подключите Яндекс Диск, чтобы все сотрудники компании могли 
                  загружать и скачивать файлы из общего хранилища.
                </p>
              </div>
              
              <Button 
                className="w-full"
                onClick={() => {
                  const authUrl = getYandexOAuthUrl(clientId, redirectUri);
                  window.location.href = authUrl;
                }}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Подключить через Яндекс
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">или</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Input 
                  placeholder="Вставьте OAuth токен..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                />
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleConnect}
                  disabled={manualToken.length < 20}
                >
                  Подключить по токену
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium text-foreground mb-1">
                Хранилище не подключено
              </p>
              <p className="text-sm">
                Владелец компании должен подключить Яндекс Диск 
                для общего доступа к файлам.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Основной интерфейс
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Folder className="w-5 h-5" />
            Яндекс Диск
            <CheckCircle className="w-4 h-4 text-green-500" />
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground truncate max-w-[150px]">
              {currentPath}
            </span>
            {isOwner && (
              <Button variant="ghost" size="sm" onClick={handleDisconnect} title="Отключить">
                <LogOut className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => {}}>
            <label className="flex items-center cursor-pointer">
              <Upload className="w-4 h-4 mr-2" />
              Загрузить
              <input type="file" className="hidden" onChange={handleUpload} />
            </label>
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleCreateFolder}>
            <FolderPlus className="w-4 h-4 mr-2" />
            Папка
          </Button>
          
          <Button variant="outline" size="sm" onClick={loadFiles} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          
          {currentPath !== basePath && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentPath(currentPath.split('/').slice(0, -1).join('/') || basePath)}
            >
              ← Назад
            </Button>
          )}
        </div>

        {/* Progress */}
        {uploadProgress !== null && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Загрузка...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}

        {/* File List */}
        <div className="space-y-1 max-h-96 overflow-auto">
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Папка пуста</p>
          ) : (
            items.map((item) => (
              <div
                key={item.path}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.type === 'dir' ? (
                    <Folder 
                      className="w-5 h-5 text-blue-500 shrink-0 cursor-pointer"
                      onClick={() => setCurrentPath(item.path)}
                    />
                  ) : (
                    <File className="w-5 h-5 text-gray-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(item.size)} {formatDate(item.modified)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.type === 'file' && (
                    <>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handlePreview(item)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDownload(item)}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handlePublish(item)}>
                        {item.public_url ? <CheckCircle className="w-4 h-4 text-green-500" /> : <ExternalLink className="w-4 h-4" />}
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:text-red-500" onClick={() => handleDelete(item)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>

      {/* Preview Dialog */}
      <Dialog open={!!previewItem} onOpenChange={closePreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="truncate pr-8">{previewItem?.name}</DialogTitle>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={closePreview}>
              <X className="w-4 h-4" />
            </Button>
          </DialogHeader>
          
          {previewUrl && previewItem && (
            <div className="mt-4">
              {previewItem.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img src={previewUrl} alt={previewItem.name} className="max-w-full max-h-[70vh] mx-auto object-contain" />
              ) : previewItem.name.match(/\.pdf$/i) ? (
                <iframe src={previewUrl} className="w-full h-[70vh] border-0" title={previewItem.name} />
              ) : (
                <iframe src={previewUrl} className="w-full h-[70vh] border-0 bg-white" title={previewItem.name} />
              )}
            </div>
          )}
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => previewItem && handleDownload(previewItem)}>
              <Download className="w-4 h-4 mr-2" />
              Скачать
            </Button>
            <Button onClick={closePreview}>Закрыть</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
