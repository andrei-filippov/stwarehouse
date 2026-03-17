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
const DB_VERSION = 3; // РЈРІРµР»РёС‡РёРІР°РµРј РІРµСЂСЃРёСЋ РґР»СЏ РґРѕР±Р°РІР»РµРЅРёСЏ Р·Р°РєР°Р·С‡РёРєРѕРІ

let db: IDBPDatabase<StwarehouseDB> | null = null;

// РџСЂРѕРІРµСЂРєР° РґРѕСЃС‚СѓРїРЅРѕСЃС‚Рё IndexedDB (Safari РІ РїСЂРёРІР°С‚РЅРѕРј СЂРµР¶РёРјРµ РјРѕР¶РµС‚ Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ)
function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 
           'indexedDB' in window && 
           window.indexedDB !== null;
  } catch {
    return false;
  }
}

// РџСЂРѕРІРµСЂРєР° РґРѕСЃС‚СѓРїРЅРѕСЃС‚Рё localStorage
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

// Fallback РЅР° localStorage РґР»СЏ Safari РїСЂРёРІР°С‚РЅРѕРіРѕ СЂРµР¶РёРјР°
const STORAGE_PREFIX = 'stwh_';
let useLocalStorageFallback = false;

// РџСѓР±Р»РёС‡РЅР°СЏ С„СѓРЅРєС†РёСЏ РїСЂРѕРІРµСЂРєРё РґРѕСЃС‚СѓРїРЅРѕСЃС‚Рё РѕС„Р»Р°Р№РЅ-С…СЂР°РЅРёР»РёС‰Р°
export function isOfflineStorageAvailable(): boolean {
  return isIndexedDBAvailable() || isLocalStorageAvailable();
}

// РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ Р±Р°Р·С‹ РґР°РЅРЅС‹С…
export async function initOfflineDB(): Promise<IDBPDatabase<StwarehouseDB>> {
  if (db) return db;
  
  // РџСЂРѕРІРµСЂСЏРµРј РґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ IndexedDB
  if (!isIndexedDBAvailable()) {
    useLocalStorageFallback = true;
    throw new Error('IndexedDB not available');
  }
  
  try {
    db = await openDB<StwarehouseDB>(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion) {
        // РўР°Р±Р»РёС†Р° СЃРјРµС‚
        if (!database.objectStoreNames.contains('estimates')) {
          const estimatesStore = database.createObjectStore('estimates', { keyPath: 'id' });
          estimatesStore.createIndex('by-company', 'companyId');
          estimatesStore.createIndex('by-synced', 'synced');
        }
        
        // РўР°Р±Р»РёС†Р° РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ
        if (!database.objectStoreNames.contains('equipment')) {
          const equipmentStore = database.createObjectStore('equipment', { keyPath: 'id' });
          equipmentStore.createIndex('by-company', 'companyId');
          equipmentStore.createIndex('by-synced', 'synced');
        }
        
        // РўР°Р±Р»РёС†Р° С‡РµРє-Р»РёСЃС‚РѕРІ (РЅРѕРІР°СЏ РІ РІРµСЂСЃРёРё 2)
        if (!database.objectStoreNames.contains('checklists')) {
          const checklistsStore = database.createObjectStore('checklists', { keyPath: 'id' });
          checklistsStore.createIndex('by-company', 'companyId');
          checklistsStore.createIndex('by-synced', 'synced');
        }
        
        // РўР°Р±Р»РёС†Р° Р·Р°РєР°Р·С‡РёРєРѕРІ (РЅРѕРІР°СЏ РІ РІРµСЂСЃРёРё 3)
        if (!database.objectStoreNames.contains('customers')) {
          const customersStore = database.createObjectStore('customers', { keyPath: 'id' });
          customersStore.createIndex('by-company', 'companyId');
          customersStore.createIndex('by-synced', 'synced');
        }
        
        // РћС‡РµСЂРµРґСЊ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё
        if (!database.objectStoreNames.contains('syncQueue')) {
          database.createObjectStore('syncQueue', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
        }
        
        // РќР°СЃС‚СЂРѕР№РєРё
        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings');
        }
      }
    });
    
    return db;
  } catch (err) {
    // Р•СЃР»Рё РЅРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РєСЂС‹С‚СЊ Р‘Р” (РїСЂРёРІР°С‚РЅС‹Р№ СЂРµР¶РёРј Safari) - РёСЃРїРѕР»СЊР·СѓРµРј localStorage
    if (isLocalStorageAvailable()) {
      useLocalStorageFallback = true;
    }
    throw err;
  }
}

// Helper РґР»СЏ localStorage fallback
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
    // localStorage РјРѕР¶РµС‚ Р±С‹С‚СЊ РїРµСЂРµРїРѕР»РЅРµРЅ
  }
}

// === РЎРјРµС‚С‹ ===
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
    // Р•СЃР»Рё IndexedDB РЅРµ СЂР°Р±РѕС‚Р°РµС‚ - РїРµСЂРµРєР»СЋС‡Р°РµРјСЃСЏ РЅР° localStorage
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
    // Р•СЃР»Рё IndexedDB РЅРµ СЂР°Р±РѕС‚Р°РµС‚ - РїРµСЂРµРєР»СЋС‡Р°РµРјСЃСЏ РЅР° localStorage
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

// === РћР±РѕСЂСѓРґРѕРІР°РЅРёРµ ===
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

// === Р§РµРє-Р»РёСЃС‚С‹ ===
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

// === РћС‡РµСЂРµРґСЊ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё ===
let queueIdCounter = 1;

export async function addToSyncQueue(
  table: string, 
  operation: 'create' | 'update' | 'delete', 
  data: any
) {
  const dataId = data?.id || data?.estimateId;
  debugLog('[addToSyncQueue] Adding to queue:', { table, operation, dataId });
  
  // РџСЂРѕРІРµСЂСЏРµРј, РµСЃС‚СЊ Р»Рё СѓР¶Рµ Р·Р°РїРёСЃСЊ РґР»СЏ СЌС‚РѕРіРѕ ID РІ РѕС‡РµСЂРµРґРё
  // Р”Р»СЏ estimates РёС‰РµРј РїРѕ data.id, РґР»СЏ estimate_items РёС‰РµРј РїРѕ data.estimateId
  const existingQueue = await getSyncQueue();
  const existingIndex = existingQueue.findIndex(item => {
    if (item.table !== table) return false;
    
    if (table === 'estimates') {
      // Р”Р»СЏ estimates СЃСЂР°РІРЅРёРІР°РµРј РїРѕ data.id
      return item.data?.id === dataId;
    } else if (table === 'estimate_items') {
      // Р”Р»СЏ estimate_items СЃСЂР°РІРЅРёРІР°РµРј РїРѕ data.estimateId
      return item.data?.estimateId === dataId;
    } else {
      // Р”Р»СЏ РѕСЃС‚Р°Р»СЊРЅС‹С… С‚Р°Р±Р»РёС† - РѕР±С‰Р°СЏ Р»РѕРіРёРєР°
      return item.data?.id === dataId || item.data?.estimateId === dataId;
    }
  });
  
  // Р•СЃР»Рё РµСЃС‚СЊ СЃСѓС‰РµСЃС‚РІСѓСЋС‰Р°СЏ Р·Р°РїРёСЃСЊ РґР»СЏ РўРћР™ Р–Р• С‚Р°Р±Р»РёС†С‹ - СѓРґР°Р»СЏРµРј РµС‘
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
    // Р•СЃР»Рё IndexedDB РЅРµ СЂР°Р±РѕС‚Р°РµС‚ - РїРµСЂРµРєР»СЋС‡Р°РµРјСЃСЏ РЅР° localStorage
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
    // Р•СЃР»Рё IndexedDB РЅРµ СЂР°Р±РѕС‚Р°РµС‚ - РїРµСЂРµРєР»СЋС‡Р°РµРјСЃСЏ РЅР° localStorage
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

// РџРѕР»РЅР°СЏ РѕС‡РёСЃС‚РєР° РІСЃРµС… Р»РѕРєР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С… (РґР»СЏ СЃР±СЂРѕСЃР° РєСЌС€Р° РЅР° iPhone)
export async function clearAllLocalData() {
  // Р’СЃРµРіРґР° РѕС‡РёС‰Р°РµРј localStorage (РЅР°С€Рё РґР°РЅРЅС‹Рµ СЃ РїСЂРµС„РёРєСЃРѕРј)
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
  
  // Р’СЃРµРіРґР° РїС‹С‚Р°РµРјСЃСЏ РѕС‡РёСЃС‚РёС‚СЊ IndexedDB
  if (isIndexedDBAvailable()) {
    try {
      const database = await initOfflineDB();
      // РћС‡РёС‰Р°РµРј РІСЃРµ С‚Р°Р±Р»РёС†С‹
      const stores = ['estimates', 'equipment', 'checklists', 'syncQueue', 'settings'];
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
      // Р•СЃР»Рё РЅРµ СѓРґР°Р»РѕСЃСЊ РѕС‡РёСЃС‚РёС‚СЊ IndexedDB - РїСЂРѕР±СѓРµРј СѓРґР°Р»РёС‚СЊ РІСЃСЋ Р±Р°Р·Сѓ
      try {
        indexedDB.deleteDatabase(DB_NAME);
        debugLog('[clearAllLocalData] Deleted entire IndexedDB database');
      } catch {}
    }
  }
  
  // РЎР±СЂР°СЃС‹РІР°РµРј С„Р»Р°РіРё
  useLocalStorageFallback = false;
  db = null;
  debugLog('[clearAllLocalData] Reset flags');
}

// === РЈРґР°Р»С‘РЅРЅС‹Рµ СЃРјРµС‚С‹ (РґР»СЏ С„РёР»СЊС‚СЂР°С†РёРё РїСЂРё РјРµСЂР¶Рµ СЃ СЃРµСЂРІРµСЂРѕРј) ===
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

// === РќР°СЃС‚СЂРѕР№РєРё ===
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

// === РџСЂР°РІРёР»Р° С‡РµРєР»РёСЃС‚РѕРІ (РєСЌС€ РґР»СЏ РѕС„Р»Р°Р№РЅ) ===
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

// === РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ (РґР»СЏ РѕС„Р»Р°Р№РЅ-Р°РІС‚РѕСЂРёР·Р°С†РёРё) ===
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

// === РЎС‚Р°С‚СѓСЃ СЃРµС‚Рё ===

// РљСЌС€ СЃС‚Р°С‚СѓСЃР° СЃРµСЂРІРµСЂР°
let serverStatusCache = {
  isAvailable: navigator.onLine,
  lastChecked: 0,
  checking: false
};

// Р‘С‹СЃС‚СЂР°СЏ РїСЂРѕРІРµСЂРєР° (Р±РµР· Р·Р°РїСЂРѕСЃР° Рє СЃРµСЂРІРµСЂСѓ)
export function checkIsOnline(): boolean {
  return navigator.onLine && serverStatusCache.isAvailable;
}

// Alias РґР»СЏ РѕР±СЂР°С‚РЅРѕР№ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё
export const isOnline = checkIsOnline;

// РџРѕР»РЅР°СЏ РїСЂРѕРІРµСЂРєР° СЃ РїРёРЅРіРѕРј Рє СЃРµСЂРІРµСЂСѓ (РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РїРµСЂРµРґ РІР°Р¶РЅС‹РјРё РѕРїРµСЂР°С†РёСЏРјРё)
export async function checkServerStatus(): Promise<boolean> {
  // Р•СЃР»Рё Р±СЂР°СѓР·РµСЂ РѕС„Р»Р°Р№РЅ - СЃРµСЂРІРµСЂ С‚РѕС‡РЅРѕ РЅРµРґРѕСЃС‚СѓРїРµРЅ
  if (!navigator.onLine) {
    serverStatusCache.isAvailable = false;
    return false;
  }
  
  // Р•СЃР»Рё РЅРµРґР°РІРЅРѕ РїСЂРѕРІРµСЂСЏР»Рё (РјРµРЅРµРµ 5 СЃРµРє РЅР°Р·Р°Рґ) - РІРѕР·РІСЂР°С‰Р°РµРј РєСЌС€
  const now = Date.now();
  if (now - serverStatusCache.lastChecked < 5000) {
    return serverStatusCache.isAvailable;
  }
  
  // Р•СЃР»Рё РїСЂРѕРІРµСЂРєР° СѓР¶Рµ РёРґС‘С‚ - Р¶РґС‘Рј СЂРµР·СѓР»СЊС‚Р°С‚Р°
  if (serverStatusCache.checking) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return serverStatusCache.isAvailable;
  }
  
  serverStatusCache.checking = true;
  
  try {
    // РџРёРЅРіСѓРµРј СЃРµСЂРІРµСЂ С‡РµСЂРµР· health check endpoint РёР»Рё РїСЂРѕСЃС‚РѕР№ Р·Р°РїСЂРѕСЃ
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    // РСЃРїРѕР»СЊР·СѓРµРј supabase РґР»СЏ РїСЂРѕРІРµСЂРєРё - РїСЂРѕСЃС‚РѕР№ Р·Р°РїСЂРѕСЃ Рє С‚РµРєСѓС‰РµР№ СЃРµСЃСЃРёРё
    const { error } = await supabase.auth.getSession();
    clearTimeout(timeout);
    
    // Р•СЃР»Рё РЅРµС‚ РѕС€РёР±РєРё СЃРµС‚Рё - СЃРµСЂРІРµСЂ РґРѕСЃС‚СѓРїРµРЅ
    serverStatusCache.isAvailable = !error || !error.message?.includes('fetch');
  } catch (e) {
    serverStatusCache.isAvailable = false;
  } finally {
    serverStatusCache.lastChecked = Date.now();
    serverStatusCache.checking = false;
  }
  
  return serverStatusCache.isAvailable;
}

// РћР±РЅРѕРІРёС‚СЊ СЃС‚Р°С‚СѓСЃ СЃРµСЂРІРµСЂР° (РІС‹Р·С‹РІР°С‚СЊ РїРµСЂРёРѕРґРёС‡РµСЃРєРё РёР»Рё РїСЂРё РёР·РјРµРЅРµРЅРёРё СЃРµС‚Рё)
export async function updateServerStatus(): Promise<boolean> {
  serverStatusCache.lastChecked = 0; // РЎР±СЂР°СЃС‹РІР°РµРј РєСЌС€
  return checkServerStatus();
}

export function setupNetworkListeners(
  onOnline: () => void,
  onOffline: () => void
) {
  const handleOnline = async () => {
    // РџСЂРё РїРѕСЏРІР»РµРЅРёРё СЃРµС‚Рё РїСЂРѕРІРµСЂСЏРµРј РґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ СЃРµСЂРІРµСЂР°
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



// === пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ (пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ) ===
const MAX_LOCAL_ESTIMATES = 1000;
const MAX_LOCAL_EQUIPMENT = 2000;
const CLEANUP_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 пїЅпїЅпїЅпїЅ

export async function cleanupOldRecords(companyId: string) {
  const now = Date.now();
  const cutoff = now - CLEANUP_INTERVAL;
  
  try {
    const database = await initOfflineDB();
    
    // пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ
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
    
    // пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
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
  } catch (e) {
    debugError('[cleanup] Error during cleanup:', e);
  }
}


