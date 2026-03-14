import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from './supabase';

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
    useLocalStorageFallback = true;
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
  console.log('[saveEstimateLocal] Saving estimate:', estimate.id, 'fallback:', useLocalStorageFallback);
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
    console.log('[saveEstimateLocal] Saved to localStorage');
    return;
  }
  try {
    const database = await initOfflineDB();
    await database.put('estimates', {
      id: estimate.id,
      data: estimate,
      synced: false,
      updatedAt: Date.now(),
      companyId
    });
    console.log('[saveEstimateLocal] Saved to IndexedDB');
  } catch (e) {
    console.error('[saveEstimateLocal] Error, switching to localStorage:', e);
    // Если IndexedDB не работает - переключаемся на localStorage
    useLocalStorageFallback = true;
    const estimates = getFromStorage<Record<string, any>>('estimates', {});
    estimates[estimate.id] = {
      id: estimate.id,
      data: estimate,
      synced: false,
      updatedAt: Date.now(),
      companyId
    };
    setToStorage('estimates', estimates);
    console.log('[saveEstimateLocal] Saved to localStorage (fallback)');
  }
}

export async function getEstimatesLocal(companyId: string) {
  if (useLocalStorageFallback) {
    const estimates = getFromStorage<Record<string, any>>('estimates', {});
    const result = Object.values(estimates)
      .filter((e: any) => e.companyId === companyId)
      .map((e: any) => e.data);
    console.log('[getEstimatesLocal] localStorage mode, found:', result.length);
    return result;
  }
  try {
    const database = await initOfflineDB();
    const items = await database.getAllFromIndex('estimates', 'by-company', companyId);
    console.log('[getEstimatesLocal] IndexedDB mode, found:', items.length);
    return items.map(item => item.data);
  } catch (e) {
    console.error('[getEstimatesLocal] Error, switching to localStorage:', e);
    useLocalStorageFallback = true;
    const estimates = getFromStorage<Record<string, any>>('estimates', {});
    return Object.values(estimates)
      .filter((e: any) => e.companyId === companyId)
      .map((e: any) => e.data);
  }
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
  console.log('[deleteEstimateLocal] Deleting estimate:', id, 'fallback:', useLocalStorageFallback);
  if (useLocalStorageFallback) {
    const estimates = getFromStorage<Record<string, any>>('estimates', {});
    delete estimates[id];
    setToStorage('estimates', estimates);
    console.log('[deleteEstimateLocal] Deleted from localStorage');
    return;
  }
  try {
    const database = await initOfflineDB();
    await database.delete('estimates', id);
    console.log('[deleteEstimateLocal] Deleted from IndexedDB');
  } catch (e) {
    console.error('[deleteEstimateLocal] Error, switching to localStorage:', e);
    // Если IndexedDB не работает - переключаемся на localStorage
    useLocalStorageFallback = true;
    const estimates = getFromStorage<Record<string, any>>('estimates', {});
    delete estimates[id];
    setToStorage('estimates', estimates);
  }
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
  if (useLocalStorageFallback) {
    const equipment = getFromStorage<Record<string, any>>('equipment', {});
    return Object.values(equipment)
      .filter((e: any) => e.companyId === companyId)
      .map((e: any) => e.data);
  }
  try {
    const database = await initOfflineDB();
    const items = await database.getAllFromIndex('equipment', 'by-company', companyId);
    return items.map(item => item.data);
  } catch (e) {
    useLocalStorageFallback = true;
    const equipment = getFromStorage<Record<string, any>>('equipment', {});
    return Object.values(equipment)
      .filter((e: any) => e.companyId === companyId)
      .map((e: any) => e.data);
  }
}

export async function clearEquipmentLocal(companyId: string) {
  const database = await initOfflineDB();
  const items = await database.getAllFromIndex('equipment', 'by-company', companyId);
  for (const item of items) {
    await database.delete('equipment', item.id);
  }
}

export async function deleteEquipmentLocal(id: string) {
  if (useLocalStorageFallback) {
    const equipment = getFromStorage<Record<string, any>>('equipment', {});
    delete equipment[id];
    setToStorage('equipment', equipment);
    return;
  }
  try {
    const database = await initOfflineDB();
    await database.delete('equipment', id);
  } catch (e) {
    useLocalStorageFallback = true;
    const equipment = getFromStorage<Record<string, any>>('equipment', {});
    delete equipment[id];
    setToStorage('equipment', equipment);
  }
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
  if (useLocalStorageFallback) {
    const checklists = getFromStorage<Record<string, any>>('checklists', {});
    return Object.values(checklists)
      .filter((e: any) => e.companyId === companyId)
      .map((e: any) => e.data);
  }
  try {
    const database = await initOfflineDB();
    const items = await database.getAllFromIndex('checklists', 'by-company', companyId);
    return items.map(item => item.data);
  } catch (e) {
    useLocalStorageFallback = true;
    const checklists = getFromStorage<Record<string, any>>('checklists', {});
    return Object.values(checklists)
      .filter((e: any) => e.companyId === companyId)
      .map((e: any) => e.data);
  }
}

export async function getChecklistLocal(id: string) {
  const database = await initOfflineDB();
  const item = await database.get('checklists', id);
  return item?.data;
}

export async function deleteChecklistLocal(id: string) {
  if (useLocalStorageFallback) {
    const checklists = getFromStorage<Record<string, any>>('checklists', {});
    delete checklists[id];
    setToStorage('checklists', checklists);
    return;
  }
  try {
    const database = await initOfflineDB();
    await database.delete('checklists', id);
  } catch (e) {
    useLocalStorageFallback = true;
    const checklists = getFromStorage<Record<string, any>>('checklists', {});
    delete checklists[id];
    setToStorage('checklists', checklists);
  }
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
  console.log('[addToSyncQueue] Adding to queue:', { table, operation, dataId: data?.id || data?.estimateId });
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
  try {
    const database = await initOfflineDB();
    await database.add('syncQueue', {
      table,
      operation,
      data,
      retryCount: 0,
      createdAt: Date.now()
    });
  } catch (e) {
    // Если IndexedDB не работает - переключаемся на localStorage
    useLocalStorageFallback = true;
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
}

export async function getSyncQueue() {
  if (useLocalStorageFallback) {
    const queue = getFromStorage<any[]>('syncQueue', []);
    console.log('[getSyncQueue] localStorage mode, count:', queue.length, 'items:', queue.map(i => ({ table: i.table, operation: i.operation })));
    return queue;
  }
  try {
    const database = await initOfflineDB();
    const queue = await database.getAll('syncQueue');
    console.log('[getSyncQueue] IndexedDB mode, count:', queue.length, 'items:', queue.map(i => ({ table: i.table, operation: i.operation })));
    return queue;
  } catch (e) {
    // Если IndexedDB не работает - переключаемся на localStorage
    useLocalStorageFallback = true;
    const queue = getFromStorage<any[]>('syncQueue', []);
    console.log('[getSyncQueue] Error, fallback to localStorage, count:', queue.length);
    return queue;
  }
}

export async function removeFromSyncQueue(id: number) {
  if (useLocalStorageFallback) {
    const queue = getFromStorage<any[]>('syncQueue', []);
    const filtered = queue.filter(item => item.id !== id);
    setToStorage('syncQueue', filtered);
    return;
  }
  try {
    const database = await initOfflineDB();
    await database.delete('syncQueue', id);
  } catch (e) {
    useLocalStorageFallback = true;
    const queue = getFromStorage<any[]>('syncQueue', []);
    const filtered = queue.filter(item => item.id !== id);
    setToStorage('syncQueue', filtered);
  }
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
  try {
    const database = await initOfflineDB();
    const item = await database.get('syncQueue', id);
    if (item) {
      item.retryCount = retryCount;
      await database.put('syncQueue', item);
    }
  } catch (e) {
    useLocalStorageFallback = true;
    const queue = getFromStorage<any[]>('syncQueue', []);
    const item = queue.find(i => i.id === id);
    if (item) {
      item.retryCount = retryCount;
      setToStorage('syncQueue', queue);
    }
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
  // Всегда очищаем localStorage (наши данные с префиксом)
  if (isLocalStorageAvailable()) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log('[clearAllLocalData] Cleared localStorage keys:', keysToRemove);
  }
  
  // Всегда пытаемся очистить IndexedDB
  if (isIndexedDBAvailable()) {
    try {
      const database = await initOfflineDB();
      // Очищаем все таблицы
      const stores = ['estimates', 'equipment', 'checklists', 'syncQueue', 'settings'];
      for (const storeName of stores) {
        if (database.objectStoreNames.contains(storeName)) {
          const tx = database.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          await store.clear();
          console.log('[clearAllLocalData] Cleared IndexedDB store:', storeName);
        }
      }
    } catch (e) {
      console.error('[clearAllLocalData] Error clearing IndexedDB:', e);
      // Если не удалось очистить IndexedDB - пробуем удалить всю базу
      try {
        indexedDB.deleteDatabase(DB_NAME);
        console.log('[clearAllLocalData] Deleted entire IndexedDB database');
      } catch {}
    }
  }
  
  // Сбрасываем флаги
  useLocalStorageFallback = false;
  db = null;
  console.log('[clearAllLocalData] Reset flags');
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
      try {
        const database = await initOfflineDB();
        await database.put('settings', deleted, DELETED_ESTIMATES_KEY);
      } catch (e) {
        useLocalStorageFallback = true;
        setToStorage(DELETED_ESTIMATES_KEY, deleted);
      }
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
  if (useLocalStorageFallback) {
    setToStorage(key, value);
    return;
  }
  const database = await initOfflineDB();
  await database.put('settings', value, key);
}

export async function getSetting(key: string) {
  if (useLocalStorageFallback) {
    return getFromStorage<any>(key, null);
  }
  const database = await initOfflineDB();
  return database.get('settings', key);
}

// === Правила чеклистов (кэш для офлайн) ===
const CHECKLIST_RULES_KEY = 'checklist_rules_cache';

export async function saveChecklistRulesCache(rules: any[], companyId: string) {
  const data = { rules, companyId, cachedAt: Date.now() };
  await saveSetting(CHECKLIST_RULES_KEY, data);
}

export async function getChecklistRulesCache(companyId: string): Promise<any[] | null> {
  const data = await getSetting(CHECKLIST_RULES_KEY);
  if (data && data.companyId === companyId) {
    return data.rules;
  }
  return null;
}

export async function clearChecklistRulesCache() {
  if (useLocalStorageFallback) {
    localStorage.removeItem(STORAGE_PREFIX + CHECKLIST_RULES_KEY);
  } else {
    try {
      const database = await initOfflineDB();
      await database.delete('settings', CHECKLIST_RULES_KEY);
    } catch {}
  }
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

// Кэш статуса сервера
let serverStatusCache = {
  isAvailable: navigator.onLine,
  lastChecked: 0,
  checking: false
};

// Быстрая проверка (без запроса к серверу)
export function checkIsOnline(): boolean {
  return navigator.onLine && serverStatusCache.isAvailable;
}

// Alias для обратной совместимости
export const isOnline = checkIsOnline;

// Полная проверка с пингом к серверу (использовать перед важными операциями)
export async function checkServerStatus(): Promise<boolean> {
  // Если браузер офлайн - сервер точно недоступен
  if (!navigator.onLine) {
    serverStatusCache.isAvailable = false;
    return false;
  }
  
  // Если недавно проверяли (менее 5 сек назад) - возвращаем кэш
  const now = Date.now();
  if (now - serverStatusCache.lastChecked < 5000) {
    return serverStatusCache.isAvailable;
  }
  
  // Если проверка уже идёт - ждём результата
  if (serverStatusCache.checking) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return serverStatusCache.isAvailable;
  }
  
  serverStatusCache.checking = true;
  
  try {
    // Пингуем сервер через health check endpoint или простой запрос
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    // Используем supabase для проверки - простой запрос к текущей сессии
    const { error } = await supabase.auth.getSession();
    clearTimeout(timeout);
    
    // Если нет ошибки сети - сервер доступен
    serverStatusCache.isAvailable = !error || !error.message?.includes('fetch');
  } catch (e) {
    serverStatusCache.isAvailable = false;
  } finally {
    serverStatusCache.lastChecked = Date.now();
    serverStatusCache.checking = false;
  }
  
  return serverStatusCache.isAvailable;
}

// Обновить статус сервера (вызывать периодически или при изменении сети)
export async function updateServerStatus(): Promise<boolean> {
  serverStatusCache.lastChecked = 0; // Сбрасываем кэш
  return checkServerStatus();
}

export function setupNetworkListeners(
  onOnline: () => void,
  onOffline: () => void
) {
  const handleOnline = async () => {
    // При появлении сети проверяем доступность сервера
    const isServerAvailable = await updateServerStatus();
    if (isServerAvailable) {
      onOnline();
    }
  };
  
  const handleOffline = () => {
    serverStatusCache.isAvailable = false;
    onOffline();
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
