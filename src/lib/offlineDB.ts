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

// Инициализация базы данных
export async function initOfflineDB(): Promise<IDBPDatabase<StwarehouseDB>> {
  if (db) return db;
  
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

export async function clearEstimatesLocal(companyId: string) {
  const database = await initOfflineDB();
  const items = await database.getAllFromIndex('estimates', 'by-company', companyId);
  for (const item of items) {
    await database.delete('estimates', item.id);
  }
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
