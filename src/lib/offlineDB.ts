import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from './supabase';
import { debugLog, debugError } from './utils';

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
  customers: {
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
  // Кабельный учёт
  cableCategories: {
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
  cableInventory: {
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
  cableMovements: {
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
  equipmentRepairs: {
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
const DB_VERSION = 4; // Увеличиваем версию для добавления кабельного учёта

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
        
        // Таблица заказчиков (новая в версии 3)
        if (!database.objectStoreNames.contains('customers')) {
          const customersStore = database.createObjectStore('customers', { keyPath: 'id' });
          customersStore.createIndex('by-company', 'companyId');
          customersStore.createIndex('by-synced', 'synced');
        }
        
        // Таблицы кабельного учёта (новые в версии 4)
        if (!database.objectStoreNames.contains('cableCategories')) {
          const cableCategoriesStore = database.createObjectStore('cableCategories', { keyPath: 'id' });
          cableCategoriesStore.createIndex('by-company', 'companyId');
          cableCategoriesStore.createIndex('by-synced', 'synced');
        }
        
        if (!database.objectStoreNames.contains('cableInventory')) {
          const cableInventoryStore = database.createObjectStore('cableInventory', { keyPath: 'id' });
          cableInventoryStore.createIndex('by-company', 'companyId');
          cableInventoryStore.createIndex('by-synced', 'synced');
        }
        
        if (!database.objectStoreNames.contains('cableMovements')) {
          const cableMovementsStore = database.createObjectStore('cableMovements', { keyPath: 'id' });
          cableMovementsStore.createIndex('by-company', 'companyId');
          cableMovementsStore.createIndex('by-synced', 'synced');
        }
        
        if (!database.objectStoreNames.contains('equipmentRepairs')) {
          const equipmentRepairsStore = database.createObjectStore('equipmentRepairs', { keyPath: 'id' });
          equipmentRepairsStore.createIndex('by-company', 'companyId');
          equipmentRepairsStore.createIndex('by-synced', 'synced');
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
  debugLog('[saveEstimateLocal] Saving estimate:', estimate.id, 'fallback:', useLocalStorageFallback);
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
    debugLog('[saveEstimateLocal] Saved to localStorage');
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
    debugLog('[saveEstimateLocal] Saved to IndexedDB');
  } catch (e) {
    debugError('[saveEstimateLocal] Error, switching to localStorage:', e);
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
    debugLog('[saveEstimateLocal] Saved to localStorage (fallback)');
  }
}

export async function getEstimatesLocal(companyId: string) {
  if (useLocalStorageFallback) {
    const estimates = getFromStorage<Record<string, any>>('estimates', {});
    const result = Object.values(estimates)
      .filter((e: any) => e.companyId === companyId)
      .map((e: any) => e.data);
    debugLog('[getEstimatesLocal] localStorage mode, found:', result.length);
    return result;
  }
  try {
    const database = await initOfflineDB();
    const items = await database.getAllFromIndex('estimates', 'by-company', companyId);
    debugLog('[getEstimatesLocal] IndexedDB mode, found:', items.length);
    return items.map(item => item.data);
  } catch (e) {
    debugError('[getEstimatesLocal] Error, switching to localStorage:', e);
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
  debugLog('[deleteEstimateLocal] Deleting estimate:', id, 'fallback:', useLocalStorageFallback);
  if (useLocalStorageFallback) {
    const estimates = getFromStorage<Record<string, any>>('estimates', {});
    delete estimates[id];
    setToStorage('estimates', estimates);
    debugLog('[deleteEstimateLocal] Deleted from localStorage');
    return;
  }
  try {
    const database = await initOfflineDB();
    await database.delete('estimates', id);
    debugLog('[deleteEstimateLocal] Deleted from IndexedDB');
  } catch (e) {
    debugError('[deleteEstimateLocal] Error, switching to localStorage:', e);
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
  const dataId = data?.id || data?.estimateId;
  debugLog('[addToSyncQueue] Adding to queue:', { table, operation, dataId });
  
  // Проверяем, есть ли уже запись для этого ID в очереди
  // Для estimates ищем по data.id, для estimate_items ищем по data.estimateId
  const existingQueue = await getSyncQueue();
  const existingIndex = existingQueue.findIndex(item => {
    if (item.table !== table) return false;
    
    if (table === 'estimates') {
      // Для estimates сравниваем по data.id
      return item.data?.id === dataId;
    } else if (table === 'estimate_items') {
      // Для estimate_items сравниваем по data.estimateId
      return item.data?.estimateId === dataId;
    } else {
      // Для остальных таблиц - общая логика
      return item.data?.id === dataId || item.data?.estimateId === dataId;
    }
  });
  
  // Если есть существующая запись для ТОЙ ЖЕ таблицы - удаляем её
  if (existingIndex >= 0) {
    debugLog('[addToSyncQueue] Found existing entry for same table, removing duplicate');
    await removeFromSyncQueue(existingQueue[existingIndex].id!);
  }
  
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
    debugLog('[getSyncQueue] localStorage mode, count:', queue.length, 'items:', queue.map(i => ({ table: i.table, operation: i.operation })));
    return queue;
  }
  try {
    const database = await initOfflineDB();
    const queue = await database.getAll('syncQueue');
    debugLog('[getSyncQueue] IndexedDB mode, count:', queue.length, 'items:', queue.map(i => ({ table: i.table, operation: i.operation })));
    return queue;
  } catch (e) {
    // Если IndexedDB не работает - переключаемся на localStorage
    useLocalStorageFallback = true;
    const queue = getFromStorage<any[]>('syncQueue', []);
    debugLog('[getSyncQueue] Error, fallback to localStorage, count:', queue.length);
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
    debugLog('[clearAllLocalData] Cleared localStorage keys:', keysToRemove);
  }
  
  // Всегда пытаемся очистить IndexedDB
  if (isIndexedDBAvailable()) {
    try {
      const database = await initOfflineDB();
      // Очищаем все таблицы
      const stores = ['estimates', 'equipment', 'checklists', 'customers', 'cableCategories', 'cableInventory', 'cableMovements', 'equipmentRepairs', 'syncQueue', 'settings'];
      for (const storeName of stores) {
        if (database.objectStoreNames.contains(storeName)) {
          const tx = database.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          await store.clear();
          debugLog('[clearAllLocalData] Cleared IndexedDB store:', storeName);
        }
      }
    } catch (e) {
      debugError('[clearAllLocalData] Error clearing IndexedDB:', e);
      // Если не удалось очистить IndexedDB - пробуем удалить всю базу
      try {
        indexedDB.deleteDatabase(DB_NAME);
        debugLog('[clearAllLocalData] Deleted entire IndexedDB database');
      } catch {}
    }
  }
  
  // Сбрасываем флаги
  useLocalStorageFallback = false;
  db = null;
  debugLog('[clearAllLocalData] Reset flags');
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



// === ������� ������ ������� (������ �� ������������) ===
const MAX_LOCAL_ESTIMATES = 1000;
const MAX_LOCAL_EQUIPMENT = 2000;
const CLEANUP_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 ����

export async function cleanupOldRecords(companyId: string) {
  const now = Date.now();
  const cutoff = now - CLEANUP_INTERVAL;
  
  try {
    const database = await initOfflineDB();
    
    // ������� ������ �����
    const estimates = await database.getAllFromIndex('estimates', 'by-company', companyId);
    const oldEstimates = estimates
      .filter(e => e.updatedAt < cutoff && e.synced)
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .slice(0, Math.max(0, estimates.length - MAX_LOCAL_ESTIMATES));
    
    for (const item of oldEstimates) {
      await database.delete('estimates', item.id);
    }
    if (oldEstimates.length > 0) {
      debugLog('[cleanup] Removed old estimates:', oldEstimates.length);
    }
    
    // Cleanup old equipment
    const equipment = await database.getAllFromIndex('equipment', 'by-company', companyId);
    const oldEquipment = equipment
      .filter(e => e.updatedAt < cutoff && e.synced)
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .slice(0, Math.max(0, equipment.length - MAX_LOCAL_EQUIPMENT));
    
    for (const item of oldEquipment) {
      await database.delete('equipment', item.id);
    }
    if (oldEquipment.length > 0) {
      debugLog('[cleanup] Removed old equipment:', oldEquipment.length);
    }
    
    // Cleanup old cable inventory (limit to 2000 items)
    const MAX_LOCAL_CABLE_INVENTORY = 2000;
    const cableInventory = await database.getAllFromIndex('cableInventory', 'by-company', companyId);
    const oldCableInventory = cableInventory
      .filter(i => i.updatedAt < cutoff && i.synced)
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .slice(0, Math.max(0, cableInventory.length - MAX_LOCAL_CABLE_INVENTORY));
    
    for (const item of oldCableInventory) {
      await database.delete('cableInventory', item.id);
    }
    if (oldCableInventory.length > 0) {
      debugLog('[cleanup] Removed old cable inventory:', oldCableInventory.length);
    }
    
    // Cleanup old cable movements (limit to 5000 items)
    const MAX_LOCAL_CABLE_MOVEMENTS = 5000;
    const cableMovements = await database.getAllFromIndex('cableMovements', 'by-company', companyId);
    const oldCableMovements = cableMovements
      .filter(m => m.updatedAt < cutoff && m.synced)
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .slice(0, Math.max(0, cableMovements.length - MAX_LOCAL_CABLE_MOVEMENTS));
    
    for (const item of oldCableMovements) {
      await database.delete('cableMovements', item.id);
    }
    if (oldCableMovements.length > 0) {
      debugLog('[cleanup] Removed old cable movements:', oldCableMovements.length);
    }
  } catch (e) {
    debugError('[cleanup] Error during cleanup:', e);
  }
}



// === 3aказчики ===
export async function saveCustomerLocal(customer: any, companyId: string, isSynced: boolean = false) {
  debugLog('[saveCustomerLocal] Saving customer:', customer.id, 'synced:', isSynced);
  if (useLocalStorageFallback) {
    const customers = getFromStorage<Record<string, any>>('customers', {});
    customers[customer.id] = {
      id: customer.id,
      data: customer,
      synced: isSynced,
      updatedAt: Date.now(),
      companyId
    };
    setToStorage('customers', customers);
    return;
  }
  try {
    const database = await initOfflineDB();
    await database.put('customers', {
      id: customer.id,
      data: customer,
      synced: isSynced,
      updatedAt: Date.now(),
      companyId
    });
  } catch (e) {
    debugError('[saveCustomerLocal] Error:', e);
  }
}

export async function getCustomersLocal(companyId: string) {
  if (useLocalStorageFallback) {
    const customers = getFromStorage<Record<string, any>>('customers', {});
    return Object.values(customers)
      .filter((c: any) => c.companyId === companyId)
      .map((c: any) => c.data);
  }
  try {
    const database = await initOfflineDB();
    const items = await database.getAllFromIndex('customers', 'by-company', companyId);
    return items.map(item => item.data);
  } catch (e) {
    return [];
  }
}

export async function deleteCustomerLocal(id: string) {
  if (useLocalStorageFallback) {
    const customers = getFromStorage<Record<string, any>>('customers', {});
    delete customers[id];
    setToStorage('customers', customers);
    return;
  }
  try {
    const database = await initOfflineDB();
    await database.delete('customers', id);
  } catch (e) {
    debugError('[deleteCustomerLocal] Error:', e);
  }
}

// === Кабельный учёт (категории) ===
export async function saveCableCategoryLocal(category: any, companyId: string, isSynced: boolean = false) {
  debugLog('[saveCableCategoryLocal] Saving category:', category.id, 'synced:', isSynced);
  if (useLocalStorageFallback) {
    const categories = getFromStorage<Record<string, any>>('cableCategories', {});
    categories[category.id] = {
      id: category.id,
      data: category,
      synced: isSynced,
      updatedAt: Date.now(),
      companyId
    };
    setToStorage('cableCategories', categories);
    return;
  }
  try {
    const database = await initOfflineDB();
    await database.put('cableCategories', {
      id: category.id,
      data: category,
      synced: isSynced,
      updatedAt: Date.now(),
      companyId
    });
  } catch (e) {
    debugError('[saveCableCategoryLocal] Error:', e);
  }
}

export async function getCableCategoriesLocal(companyId: string) {
  if (useLocalStorageFallback) {
    const categories = getFromStorage<Record<string, any>>('cableCategories', {});
    return Object.values(categories)
      .filter((c: any) => c.companyId === companyId)
      .map((c: any) => c.data);
  }
  try {
    const database = await initOfflineDB();
    const items = await database.getAllFromIndex('cableCategories', 'by-company', companyId);
    return items.map(item => item.data);
  } catch (e) {
    return [];
  }
}

export async function deleteCableCategoryLocal(id: string) {
  if (useLocalStorageFallback) {
    const categories = getFromStorage<Record<string, any>>('cableCategories', {});
    delete categories[id];
    setToStorage('cableCategories', categories);
    return;
  }
  try {
    const database = await initOfflineDB();
    await database.delete('cableCategories', id);
  } catch (e) {
    debugError('[deleteCableCategoryLocal] Error:', e);
  }
}

export async function clearCableCategoriesLocal(companyId: string) {
  if (useLocalStorageFallback) {
    const categories = getFromStorage<Record<string, any>>('cableCategories', {});
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(categories)) {
      if (value.companyId !== companyId) {
        filtered[key] = value;
      }
    }
    setToStorage('cableCategories', filtered);
    return;
  }
  try {
    const database = await initOfflineDB();
    const items = await database.getAllFromIndex('cableCategories', 'by-company', companyId);
    for (const item of items) {
      await database.delete('cableCategories', item.id);
    }
  } catch (e) {
    debugError('[clearCableCategoriesLocal] Error:', e);
  }
}

// === Кабельный учёт (инвентарь) ===
export async function saveCableInventoryLocal(item: any, companyId: string, isSynced: boolean = false) {
  debugLog('[saveCableInventoryLocal] Saving inventory:', item.id, 'synced:', isSynced);
  if (useLocalStorageFallback) {
    const inventory = getFromStorage<Record<string, any>>('cableInventory', {});
    inventory[item.id] = {
      id: item.id,
      data: item,
      synced: isSynced,
      updatedAt: Date.now(),
      companyId
    };
    setToStorage('cableInventory', inventory);
    return;
  }
  try {
    const database = await initOfflineDB();
    await database.put('cableInventory', {
      id: item.id,
      data: item,
      synced: isSynced,
      updatedAt: Date.now(),
      companyId
    });
  } catch (e) {
    debugError('[saveCableInventoryLocal] Error:', e);
  }
}

export async function getCableInventoryLocal(companyId: string) {
  if (useLocalStorageFallback) {
    const inventory = getFromStorage<Record<string, any>>('cableInventory', {});
    return Object.values(inventory)
      .filter((i: any) => i.companyId === companyId)
      .map((i: any) => i.data);
  }
  try {
    const database = await initOfflineDB();
    const items = await database.getAllFromIndex('cableInventory', 'by-company', companyId);
    return items.map(item => item.data);
  } catch (e) {
    return [];
  }
}

export async function deleteCableInventoryLocal(id: string) {
  if (useLocalStorageFallback) {
    const inventory = getFromStorage<Record<string, any>>('cableInventory', {});
    delete inventory[id];
    setToStorage('cableInventory', inventory);
    return;
  }
  try {
    const database = await initOfflineDB();
    await database.delete('cableInventory', id);
  } catch (e) {
    debugError('[deleteCableInventoryLocal] Error:', e);
  }
}

export async function clearCableInventoryLocal(companyId: string) {
  if (useLocalStorageFallback) {
    const inventory = getFromStorage<Record<string, any>>('cableInventory', {});
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(inventory)) {
      if (value.companyId !== companyId) {
        filtered[key] = value;
      }
    }
    setToStorage('cableInventory', filtered);
    return;
  }
  try {
    const database = await initOfflineDB();
    const items = await database.getAllFromIndex('cableInventory', 'by-company', companyId);
    for (const item of items) {
      await database.delete('cableInventory', item.id);
    }
  } catch (e) {
    debugError('[clearCableInventoryLocal] Error:', e);
  }
}

// === Кабельный учёт (движения) ===
export async function saveCableMovementLocal(movement: any, companyId: string, isSynced: boolean = false) {
  debugLog('[saveCableMovementLocal] Saving movement:', movement.id, 'synced:', isSynced);
  if (useLocalStorageFallback) {
    const movements = getFromStorage<Record<string, any>>('cableMovements', {});
    movements[movement.id] = {
      id: movement.id,
      data: movement,
      synced: isSynced,
      updatedAt: Date.now(),
      companyId
    };
    setToStorage('cableMovements', movements);
    return;
  }
  try {
    const database = await initOfflineDB();
    await database.put('cableMovements', {
      id: movement.id,
      data: movement,
      synced: isSynced,
      updatedAt: Date.now(),
      companyId
    });
  } catch (e) {
    debugError('[saveCableMovementLocal] Error:', e);
  }
}

export async function getCableMovementsLocal(companyId: string) {
  if (useLocalStorageFallback) {
    const movements = getFromStorage<Record<string, any>>('cableMovements', {});
    return Object.values(movements)
      .filter((m: any) => m.companyId === companyId)
      .map((m: any) => m.data);
  }
  try {
    const database = await initOfflineDB();
    const items = await database.getAllFromIndex('cableMovements', 'by-company', companyId);
    return items.map(item => item.data);
  } catch (e) {
    return [];
  }
}

export async function deleteCableMovementLocal(id: string) {
  if (useLocalStorageFallback) {
    const movements = getFromStorage<Record<string, any>>('cableMovements', {});
    delete movements[id];
    setToStorage('cableMovements', movements);
    return;
  }
  try {
    const database = await initOfflineDB();
    await database.delete('cableMovements', id);
  } catch (e) {
    debugError('[deleteCableMovementLocal] Error:', e);
  }
}

export async function clearCableMovementsLocal(companyId: string) {
  if (useLocalStorageFallback) {
    const movements = getFromStorage<Record<string, any>>('cableMovements', {});
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(movements)) {
      if (value.companyId !== companyId) {
        filtered[key] = value;
      }
    }
    setToStorage('cableMovements', filtered);
    return;
  }
  try {
    const database = await initOfflineDB();
    const items = await database.getAllFromIndex('cableMovements', 'by-company', companyId);
    for (const item of items) {
      await database.delete('cableMovements', item.id);
    }
  } catch (e) {
    debugError('[clearCableMovementsLocal] Error:', e);
  }
}

// === Кабельный учёт (ремонты) ===
export async function saveEquipmentRepairLocal(repair: any, companyId: string, isSynced: boolean = false) {
  debugLog('[saveEquipmentRepairLocal] Saving repair:', repair.id, 'synced:', isSynced);
  if (useLocalStorageFallback) {
    const repairs = getFromStorage<Record<string, any>>('equipmentRepairs', {});
    repairs[repair.id] = {
      id: repair.id,
      data: repair,
      synced: isSynced,
      updatedAt: Date.now(),
      companyId
    };
    setToStorage('equipmentRepairs', repairs);
    return;
  }
  try {
    const database = await initOfflineDB();
    await database.put('equipmentRepairs', {
      id: repair.id,
      data: repair,
      synced: isSynced,
      updatedAt: Date.now(),
      companyId
    });
  } catch (e) {
    debugError('[saveEquipmentRepairLocal] Error:', e);
  }
}

export async function getEquipmentRepairsLocal(companyId: string) {
  if (useLocalStorageFallback) {
    const repairs = getFromStorage<Record<string, any>>('equipmentRepairs', {});
    return Object.values(repairs)
      .filter((r: any) => r.companyId === companyId)
      .map((r: any) => r.data);
  }
  try {
    const database = await initOfflineDB();
    const items = await database.getAllFromIndex('equipmentRepairs', 'by-company', companyId);
    return items.map(item => item.data);
  } catch (e) {
    return [];
  }
}

export async function deleteEquipmentRepairLocal(id: string) {
  if (useLocalStorageFallback) {
    const repairs = getFromStorage<Record<string, any>>('equipmentRepairs', {});
    delete repairs[id];
    setToStorage('equipmentRepairs', repairs);
    return;
  }
  try {
    const database = await initOfflineDB();
    await database.delete('equipmentRepairs', id);
  } catch (e) {
    debugError('[deleteEquipmentRepairLocal] Error:', e);
  }
}

export async function clearEquipmentRepairsLocal(companyId: string) {
  if (useLocalStorageFallback) {
    const repairs = getFromStorage<Record<string, any>>('equipmentRepairs', {});
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(repairs)) {
      if (value.companyId !== companyId) {
        filtered[key] = value;
      }
    }
    setToStorage('equipmentRepairs', filtered);
    return;
  }
  try {
    const database = await initOfflineDB();
    const items = await database.getAllFromIndex('equipmentRepairs', 'by-company', companyId);
    for (const item of items) {
      await database.delete('equipmentRepairs', item.id);
    }
  } catch (e) {
    debugError('[clearEquipmentRepairsLocal] Error:', e);
  }
}
