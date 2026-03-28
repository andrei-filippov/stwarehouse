// Yandex Disk API интеграция
// Документация: https://yandex.ru/dev/disk/api/reference/overview.html

const API_BASE = 'https://cloud-api.yandex.net/v1/disk';

export class YandexDiskClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `OAuth ${this.token}`,
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Получить информацию о диске
  async getDiskInfo() {
    return this.request('');
  }

  // Получить список файлов в папке
  async listFiles(path: string = '/') {
    const params = new URLSearchParams({
      path,
      limit: '100',
    });
    return this.request(`/resources?${params}`);
  }

  // Получить ссылку для загрузки файла
  async getUploadUrl(path: string, overwrite: boolean = true) {
    const params = new URLSearchParams({
      path,
      overwrite: overwrite.toString(),
    });
    const response = await this.request(`/resources/upload?${params}`);
    return response.href;
  }

  // Загрузить файл
  async uploadFile(path: string, file: File, onProgress?: (progress: number) => void) {
    const uploadUrl = await this.getUploadUrl(path);
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress((e.loaded / e.total) * 100);
          }
        };
      }
      
      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          resolve(xhr.response);
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };
      
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.open('PUT', uploadUrl);
      xhr.send(file);
    });
  }

  // Получить ссылку для скачивания
  async getDownloadUrl(path: string) {
    const params = new URLSearchParams({ path });
    const response = await this.request(`/resources/download?${params}`);
    return response.href;
  }

  // Удалить файл
  async deleteFile(path: string, permanently: boolean = false) {
    const params = new URLSearchParams({
      path,
      permanently: permanently.toString(),
    });
    return this.request(`/resources?${params}`, { method: 'DELETE' });
  }

  // Создать папку
  async createFolder(path: string) {
    const params = new URLSearchParams({ path });
    try {
      return await this.request(`/resources?${params}`, { method: 'PUT' });
    } catch (error: any) {
      // 409 = папка уже существует, это не ошибка
      // Проверяем и по сообщению и по коду ошибки
      if (error.message?.includes('409') || 
          error.message?.includes('already exists') ||
          error.message?.includes('уже существует') ||
          error.message?.includes('Resource already exists')) {
        return { created: true, path };
      }
      throw error;
    }
  }

  // Опубликовать файл (получить публичную ссылку)
  async publishFile(path: string) {
    const params = new URLSearchParams({ path });
    await this.request(`/resources/publish?${params}`, { method: 'PUT' });
    
    // Получить мета-информацию с публичной ссылкой
    const meta = await this.listFiles(path);
    return meta.public_url;
  }

  // Отменить публикацию
  async unpublishFile(path: string) {
    const params = new URLSearchParams({ path });
    return this.request(`/resources/unpublish?${params}`, { method: 'PUT' });
  }
}

// Хук для работы с Yandex Disk
export function useYandexDisk(token: string | null) {
  const client = token ? new YandexDiskClient(token) : null;
  
  return {
    isAuthenticated: !!client,
    client,
    
    // Проверка токена
    async verifyToken() {
      if (!client) return false;
      try {
        await client.getDiskInfo();
        return true;
      } catch {
        return false;
      }
    },
  };
}

// URL для OAuth авторизации
export function getYandexOAuthUrl(clientId: string, redirectUri: string) {
  const params = new URLSearchParams({
    response_type: 'token',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'cloud_api:disk.write cloud_api:disk.read',
  });
  return `https://oauth.yandex.ru/authorize?${params}`;
}
