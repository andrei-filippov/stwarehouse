import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface StwarehouseDB extends DBSchema {
  estimates: {
    key: string;
    value: {
      id: string;
      data: any;
      synced: boolean;
      updatedAt: number;
      companyId: string;
    };
    indexes: { 'by-company': string; 'by-synced': number };
  };
  equipment: {
    key: string;
    value: {
      id: string;
      data: any;
      synced: boolean;
      updatedAt: number;
      companyId: string;
    };
    indexes: { 'by-company': string; 'by-synced': number };
  };
  checklists: {
    key: string;
    value: {
      id: string;
      data: any;
      synced: boolean;
      updatedAt: number;
      companyId: string;
    };
    indexes: { 'by-company': string; 'by-synced': number };
  };
  syncQueue: {
    key: number;
    value: {
      id?: number;
      table: string;
      operation: 'create' | 'update' | 'delete';
      data: any;
      retryCount: number;
      createdAt: number;
    };
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'stwarehouse-offline';
const DB_VERSION = 2; // Увеличиваем версию для добавления чек-листов

let db: IDBPDatabase<StwarehouseDB> | null = null;

// Проверка доступности IndexedDB (Safari в приватном режиме может блокировать)
function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 
           'indexedDB' in window && 
           window.indexedDB !== null;
  } catch {
    return false;
  }
}

// Проверка доступности localStorage
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

// Fallback на localStorage для Safari приватного режима
const STORAGE_PREFIX = 'stwh_';
let useLocalStorageFallback = false;

// Публичная функция проверки доступности офлайн-хранилища
export function isOfflineStorageAvailable(): boolean {
  return isIndexedDBAvailable() || isLocalStorageAvailable();
}

// Инициализация базы данных
export async function initOfflineDB(): Promise<IDBPDatabase<StwarehouseDB>> {
  if (db) return db;
  
  // Проверяем доступность IndexedDB
  if (!isIndexedDBAvailable()) {
    useMemoryFallback = true;
    throw new Error('IndexedDB not available');
  }
  
  try {
    db = await openDB<StwarehouseDB>(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion) {
        // Таблица смет
        if (!database.objectStoreNames.contains('estimates')) {
          const estimatesStore = database.createObjectStore('estimates', { keyPath: 'id' });
          estimatesStore.createIndex('by-company', 'companyId');
          estimatesStore.createIndex('by-synced', 'synced');
        }
        
        // Таблица оборудования
        if (!database.objectStoreNames.contains('equipment')) {
          const equipmentStore = database.createObjectStore('equipment', { keyPath: 'id' });
          equipmentStore.createIndex('by-company', 'companyId');
          equipmentStore.createIndex('by-synced', 'synced');
        }
        
        // Таблица чек-листов (новая в версии 2)
        if (!database.objectStoreNames.contains('checklists')) {
          const checklistsStore = database.createObjectStore('checklists', { keyPath: 'id' });
          checklistsStore.createIndex('by-company', 'companyId');
          checklistsStore.createIndex('by-synced', 'synced');
        }
        
        // Очередь синхронизации
        if (!database.objectStoreNames.contains('syncQueue')) {
          database.createObjectStore('syncQueue', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
        }
        
        // Настройки
        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings');
        }
      }
    });
    
    return db;
  } catch (err) {
    // Если не удалось открыть БД (приватный режим Safari) - используем localStorage
    if (isLocalStorageAvailable()) {
      useLocalStorageFallback = true;
    }
    throw err;
  }
}

// Helper для localStorage fallback
function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setToStorage(key: string, value: any): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // localStorage может быть переполнен
  }
}

// === Сметы ===
export async function saveEstimateLocal(estimate: any, companyId: string) {
  if (useLocalStorageFallback) {
    const estimates = getFromStorage<Record<string, any>>('estimates', {});
    estimates[estimate.id] = {
      id: estimate.id,
      data: estimate,
      synced: false,
      updatedAt: Date.now(),
      companyId
    };
    setToStorage('estimates', estimates);
    return;
  }
  const database = await initOfflineDB();
  await database.put('estimates', {
    id: estimate.id,
    data: estimate,
    synced: false,
    updatedAt: Date.now(),
    companyId
  });
}

export async function getEstimatesLocal(companyId: string) {
  if (useLocalStorageFallback) {
    const estimates = getFromStorage<Record<string, any>>('estimates', {});
    return Object.values(estimates).filter((e: any) => e.companyId === companyId);
  }
  const database = await initOfflineDB();
  return database.getAllFromIndex('estimates', 'by-company', companyId);
}

export async function getEstimateLocal(id: string) {
  if (useLocalStorageFallback) {
    const estimates = getFromStorage<Record<string, any>>('estimates', {});
    return estimates[id] || null;
  }
  const database = await initOfflineDB();
  return database.get('estimates', id);
}

export async function deleteEstimateLocal(id: string) {
  if (useLocalStorageFallback) {
    const estimates = getFromStorage<Record<string, any>>('estimates', {});
    delete estimates[id];
    setToStorage('estimates', estimates);
    return;
  }
  const database = await initOfflineDB();
  await database.delete('estimates', id);
}

export async function clearEstimatesLocal(companyId: string) {
  if (useLocalStorageFallback) {
    const estimates = getFromStorage<Record<string, any>>('estimates', {});
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(estimates)) {
      if (value.companyId !== companyId) {
        filtered[key] = value;
      }
    }
    setToStorage('estimates', filtered);
    return;
  }
  const database = await initOfflineDB();
  const items = await database.getAllFromIndex('estimates', 'by-company', companyId);
  for (const item of items) {
    await database.delete('estimates', item.id);
  }
}

export async function markEstimateSynced(id: string) {
  if (useLocalStorageFallback) {
    const estimates = getFromStorage<Record<string, any>>('estimates', {});
    if (estimates[id]) {
      estimates[id].synced = true;
      setToStorage('estimates', estimates);
    }
    return;
  }
  const database = await initOfflineDB();
  const estimate = await database.get('estimates', id);
  if (estimate) {
    estimate.synced = true;
    await database.put('estimates', estimate);
  }
}

// === Оборудование ===
export async function saveEquipmentLocal(equipment: any, companyId: string) {
  const database = await initOfflineDB();
  await database.put('equipment', {
    id: equipment.id,
    data: equipment,
    synced: true,
    updatedAt: Date.now(),
    companyId
  });
}

export async function getEquipmentLocal(companyId: string) {
  const database = await initOfflineDB();
  const items = await database.getAllFromIndex('equipment', 'by-company', companyId);
  return items.map(item => item.data);
}

export async function clearEquipmentLocal(companyId: string) {
  const database = await initOfflineDB();
  const items = await database.getAllFromIndex('equipment', 'by-company', companyId);
  for (const item of items) {
    await database.delete('equipment', item.id);
  }
}

export async function deleteEquipmentLocal(id: string) {
  const database = await initOfflineDB();
  await database.delete('equipment', id);
}

// === Чек-листы ===
export async function saveChecklistLocal(checklist: any, companyId: string) {
  const database = await initOfflineDB();
  await database.put('checklists', {
    id: checklist.id,
    data: checklist,
    synced: false,
    updatedAt: Date.now(),
    companyId
  });
}

export async function getChecklistsLocal(companyId: string) {
  const database = await initOfflineDB();
  const items = await database.getAllFromIndex('checklists', 'by-company', companyId);
  return items.map(item => item.data);
}

export async function getChecklistLocal(id: string) {
  const database = await initOfflineDB();
  const item = await database.get('checklists', id);
  return item?.data;
}

export async function deleteChecklistLocal(id: string) {
  const database = await initOfflineDB();
  await database.delete('checklists', id);
}

export async function clearChecklistsLocal(companyId: string) {
  const database = await initOfflineDB();
  const items = await database.getAllFromIndex('checklists', 'by-company', companyId);
  for (const item of items) {
    await database.delete('checklists', item.id);
  }
}

export async function markChecklistSynced(id: string) {
  const database = await initOfflineDB();
  const checklist = await database.get('checklists', id);
  if (checklist) {
    checklist.synced = true;
    await database.put('checklists', checklist);
  }
}

// === Очередь синхронизации ===
let queueIdCounter = 1;

export async function addToSyncQueue(
  table: string, 
  operation: 'create' | 'update' | 'delete', 
  data: any
) {
  if (useLocalStorageFallback) {
    const queue = getFromStorage<any[]>('syncQueue', []);
    const id = queueIdCounter++;
    queue.push({
      id,
      table,
      operation,
      data,
      retryCount: 0,
      createdAt: Date.now()
    });
    setToStorage('syncQueue', queue);
    return id;
  }
  const database = await initOfflineDB();
  await database.add('syncQueue', {
    table,
    operation,
    data,
    retryCount: 0,
    createdAt: Date.now()
  });
}

export async function getSyncQueue() {
  if (useLocalStorageFallback) {
    return getFromStorage<any[]>('syncQueue', []);
  }
  const database = await initOfflineDB();
  return await database.getAll('syncQueue');
}

export async function removeFromSyncQueue(id: number) {
  if (useLocalStorageFallback) {
    const queue = getFromStorage<any[]>('syncQueue', []);
    const filtered = queue.filter(item => item.id !== id);
    setToStorage('syncQueue', filtered);
    return;
  }
  const database = await initOfflineDB();
  await database.delete('syncQueue', id);
}

export async function updateSyncQueueRetry(id: number, retryCount: number) {
  if (useLocalStorageFallback) {
    const queue = getFromStorage<any[]>('syncQueue', []);
    const item = queue.find(i => i.id === id);
    if (item) {
      item.retryCount = retryCount;
      setToStorage('syncQueue', queue);
    }
    return;
  }
  const database = await initOfflineDB();
  const item = await database.get('syncQueue', id);
  if (item) {
    item.retryCount = retryCount;
    await database.put('syncQueue', item);
  }
}

export async function clearSyncQueue() {
  if (useLocalStorageFallback) {
    setToStorage('syncQueue', []);
    queueIdCounter = 1;
    return;
  }
  const database = await initOfflineDB();
  const items = await database.getAll('syncQueue');
  for (const item of items) {
    if (item.id !== undefined) {
      await database.delete('syncQueue', item.id);
    }
  }
}

// Полная очистка всех локальных данных (для сброса кэша на iPhone)
export async function clearAllLocalData() {
  // Очищаем localStorage fallback
  if (useLocalStorageFallback || isLocalStorageAvailable()) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
  
  // Очищаем IndexedDB
  if (!useLocalStorageFallback && isIndexedDBAvailable()) {
    try {
      const database = await initOfflineDB();
      // Очищаем все таблицы
      const stores = ['estimates', 'equipment', 'checklists', 'syncQueue', 'settings'];
      for (const storeName of stores) {
        if (database.objectStoreNames.contains(storeName)) {
          const tx = database.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          await store.clear();
        }
      }
    } catch (e) {
      // Если не удалось очистить IndexedDB - пробуем удалить всю базу
      try {
        indexedDB.deleteDatabase(DB_NAME);
      } catch {}
    }
  }
  
  // Сбрасываем флаги
  useLocalStorageFallback = false;
  db = null;
}

// === Удалённые сметы (для фильтрации при мерже с сервером) ===
const DELETED_ESTIMATES_KEY = 'deleted_estimates';

export async function markEstimateDeleted(id: string) {
  const deleted = await getDeletedEstimates();
  if (!deleted.includes(id)) {
    deleted.push(id);
    if (useLocalStorageFallback) {
      setToStorage(DELETED_ESTIMATES_KEY, deleted);
    } else {
      const database = await initOfflineDB();
      await database.put('settings', deleted, DELETED_ESTIMATES_KEY);
    }
  }
}

export async function getDeletedEstimates(): Promise<string[]> {
  if (useLocalStorageFallback) {
    return getFromStorage<string[]>(DELETED_ESTIMATES_KEY, []);
  }
  try {
    const database = await initOfflineDB();
    return (await database.get('settings', DELETED_ESTIMATES_KEY)) || [];
  } catch {
    return [];
  }
}

export async function clearDeletedEstimates() {
  if (useLocalStorageFallback) {
    localStorage.removeItem(STORAGE_PREFIX + DELETED_ESTIMATES_KEY);
  } else {
    try {
      const database = await initOfflineDB();
      await database.delete('settings', DELETED_ESTIMATES_KEY);
    } catch {}
  }
}

// === Настройки ===
export async function saveSetting(key: string, value: any) {
  const database = await initOfflineDB();
  await database.put('settings', value, key);
}

export async function getSetting(key: string) {
  const database = await initOfflineDB();
  return database.get('settings', key);
}

// === Пользователь (для офлайн-авторизации) ===
export async function saveUserLocal(user: any) {
  const database = await initOfflineDB();
  await database.put('settings', user, 'current_user');
}

export async function getUserLocal() {
  const database = await initOfflineDB();
  return database.get('settings', 'current_user');
}

export async function saveProfileLocal(profile: any) {
  const database = await initOfflineDB();
  await database.put('settings', profile, 'current_profile');
}

export async function getProfileLocal() {
  const database = await initOfflineDB();
  return database.get('settings', 'current_profile');
}

export async function saveCompanyLocal(company: any) {
  const database = await initOfflineDB();
  await database.put('settings', company, 'current_company');
}

export async function getCompanyLocal() {
  const database = await initOfflineDB();
  return database.get('settings', 'current_company');
}

// === Статус сети ===
export function isOnline(): boolean {
  return navigator.onLine;
}

export function setupNetworkListeners(
  onOnline: () => void,
  onOffline: () => void
) {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
