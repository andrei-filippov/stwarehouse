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
const DB_VERSION = 1;

let db: IDBPDatabase<StwarehouseDB> | null = null;

// Инициализация базы данных
export async function initOfflineDB(): Promise<IDBPDatabase<StwarehouseDB>> {
  if (db) return db;
  
  db = await openDB<StwarehouseDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
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
}

// === Сметы ===
export async function saveEstimateLocal(estimate: any, companyId: string) {
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
  const database = await initOfflineDB();
  return database.getAllFromIndex('estimates', 'by-company', companyId);
}

export async function getEstimateLocal(id: string) {
  const database = await initOfflineDB();
  return database.get('estimates', id);
}

export async function deleteEstimateLocal(id: string) {
  const database = await initOfflineDB();
  await database.delete('estimates', id);
}

export async function markEstimateSynced(id: string) {
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
    synced: true, // Оборудование обычно только читаем
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

// === Очередь синхронизации ===
export async function addToSyncQueue(
  table: string, 
  operation: 'create' | 'update' | 'delete', 
  data: any
) {
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
  const database = await initOfflineDB();
  return database.getAll('syncQueue');
}

export async function removeFromSyncQueue(id: number) {
  const database = await initOfflineDB();
  await database.delete('syncQueue', id);
}

export async function updateSyncQueueRetry(id: number, retryCount: number) {
  const database = await initOfflineDB();
  const item = await database.get('syncQueue', id);
  if (item) {
    item.retryCount = retryCount;
    await database.put('syncQueue', item);
  }
}

export async function clearSyncQueue() {
  const database = await initOfflineDB();
  const items = await database.getAll('syncQueue');
  for (const item of items) {
    if (item.id !== undefined) {
      await database.delete('syncQueue', item.id);
    }
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
