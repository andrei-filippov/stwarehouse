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
  Eye, X
} from 'lucide-react';
import { YandexDiskClient, getYandexOAuthUrl } from '../lib/yandexDisk';

interface YandexDiskFileManagerProps {
  clientId: string;
  redirectUri: string;
  basePath?: string;
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
  basePath = '/stwarehouse' 
}: YandexDiskFileManagerProps) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('yandex_disk_token'));
  const [client, setClient] = useState<YandexDiskClient | null>(null);
  const [items, setItems] = useState<DiskItem[]>([]);
  const [currentPath, setCurrentPath] = useState(basePath);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [previewItem, setPreviewItem] = useState<DiskItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Инициализация клиента
  useEffect(() => {
    if (token) {
      setClient(new YandexDiskClient(token));
    }
  }, [token]);

  // Загрузка списка файлов
  const loadFiles = useCallback(async () => {
    if (!client) return;
    
    setLoading(true);
    try {
      // Сначала пробуем создать папку (если её нет)
      try {
        await client.createFolder(basePath);
      } catch {
        // Папка уже существует или другая ошибка - игнорируем
      }
      
      const response = await client.listFiles(currentPath);
      setItems(response._embedded?.items || []);
    } catch (error: any) {
      if (error.message?.includes('403')) {
        toast.error('Доступ запрещён', { 
          description: 'Проверьте, что приложению на Яндексе разрешён доступ к Диску' 
        });
      } else if (error.message?.includes('401')) {
        toast.error('Токен истёк', { description: 'Авторизуйтесь заново' });
        handleLogout();
      } else {
        toast.error('Ошибка загрузки файлов', { description: error.message });
      }
    } finally {
      setLoading(false);
    }
  }, [client, currentPath, basePath]);

  useEffect(() => {
    if (client) {
      loadFiles();
    }
  }, [client, currentPath, loadFiles]);

  // Обработка OAuth callback (автоматическая)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      if (accessToken) {
        setToken(accessToken);
        localStorage.setItem('yandex_disk_token', accessToken);
        window.location.hash = '';
        toast.success('Авторизация успешна');
      }
    }
  }, []);
  
  // Ручной ввод токена
  const handleManualToken = (tokenValue: string) => {
    setToken(tokenValue);
    localStorage.setItem('yandex_disk_token', tokenValue);
    toast.success('Токен сохранен');
  };

  const handleLogin = () => {
    const authUrl = getYandexOAuthUrl(clientId, redirectUri);
    window.location.href = authUrl;
  };

  const handleLogout = () => {
    setToken(null);
    setClient(null);
    localStorage.removeItem('yandex_disk_token');
    toast.info('Вы вышли из Яндекс Диска');
  };

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

  const handleDownload = async (item: DiskItem) => {
    if (!client || item.type !== 'file') return;

    try {
      const downloadUrl = await client.getDownloadUrl(item.path);
      window.open(downloadUrl, '_blank');
    } catch (error: any) {
      toast.error('Ошибка скачивания', { description: error.message });
    }
  };

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

  const handlePublish = async (item: DiskItem) => {
    if (!client || item.type !== 'file') return;

    try {
      const publicUrl = await client.publishFile(item.path);
      navigator.clipboard.writeText(publicUrl);
      toast.success('Публичная ссылка скопирована');
      await loadFiles();
    } catch (error: any) {
      toast.error('Ошибка публикации', { description: error.message });
    }
  };

  const handlePreview = async (item: DiskItem) => {
    if (!client || item.type !== 'file') return;

    // Проверяем поддерживаемый тип файла
    const isImage = item.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isPdf = item.name.match(/\.pdf$/i);
    const isText = item.name.match(/\.(txt|md|json|js|ts|jsx|tsx|css|html)$/i);
    
    if (!isImage && !isPdf && !isText) {
      toast.info('Предпросмотр доступен только для изображений, PDF и текстовых файлов');
      return;
    }

    try {
      toast.loading('Загрузка файла...', { id: 'preview' });
      
      // Получаем URL для скачивания
      const downloadUrl = await client.getDownloadUrl(item.path);
      
      // Скачиваем файл через fetch с токеном
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `OAuth ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch file');
      
      // Создаем blob URL
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      setPreviewUrl(blobUrl);
      setPreviewItem(item);
      toast.dismiss('preview');
    } catch (error: any) {
      toast.dismiss('preview');
      toast.error('Ошибка загрузки файла', { description: error.message });
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
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

  // Если не авторизован
  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="w-5 h-5" />
            Яндекс Диск
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg text-sm">
            <p className="font-medium text-amber-500 mb-1">Важно!</p>
            <p className="text-muted-foreground">
              При создании приложения на Яндексе необходимо включить доступ к <strong>Яндекс.Диск REST API</strong> 
              с правами <strong>"Чтение всего Диска"</strong> и <strong>"Запись в любом месте"</strong>.
            </p>
          </div>
          
          <p className="text-muted-foreground">
            Для подключения получите токен на Яндексе и вставьте его ниже:
          </p>
          
          <Button 
            variant="outline" 
            onClick={() => window.open('https://oauth.yandex.ru/authorize?response_type=token&client_id=' + clientId, '_blank')}
            className="w-full"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Получить токен на Яндексе
          </Button>
          
          <div className="space-y-2">
            <Input 
              placeholder="Вставьте OAuth токен сюда..."
              onChange={(e) => {
                const value = e.target.value.trim();
                if (value.length > 20) {
                  handleManualToken(value);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Скопируйте токен из адресной строки после #access_token=
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Folder className="w-5 h-5" />
            Яндекс Диск
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{currentPath}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
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
              <input
                type="file"
                className="hidden"
                onChange={handleUpload}
              />
            </label>
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleCreateFolder}>
            <FolderPlus className="w-4 h-4 mr-2" />
            Папка
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadFiles}
            disabled={loading}
          >
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

        {/* Upload Progress */}
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
            <p className="text-center text-muted-foreground py-8">
              Папка пуста
            </p>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handlePreview(item)}
                        title="Просмотр"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleDownload(item)}
                        title="Скачать"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handlePublish(item)}
                        title={item.public_url ? 'Ссылка скопирована' : 'Поделиться'}
                      >
                        {item.public_url ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <ExternalLink className="w-4 h-4" />
                        )}
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:text-red-500"
                    onClick={() => handleDelete(item)}
                    title="Удалить"
                  >
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
                <img 
                  src={previewUrl} 
                  alt={previewItem.name}
                  className="max-w-full max-h-[70vh] mx-auto object-contain"
                />
              ) : previewItem.name.match(/\.pdf$/i) ? (
                <iframe 
                  src={previewUrl}
                  className="w-full h-[70vh] border-0"
                  title={previewItem.name}
                />
              ) : (
                <iframe 
                  src={previewUrl}
                  className="w-full h-[70vh] border-0 bg-white"
                  title={previewItem.name}
                />
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
