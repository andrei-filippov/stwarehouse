import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { getCurrentUserDisplayName } from '../lib/utils';
import { getCached, setCached, DEFAULT_CACHE_TTL_MS } from '../lib/queryCache';
import { useRealtimeWithFallback } from './useRealtimeWithFallback';
import {
  isOnline,
  saveCableCategoryLocal,
  getCableCategoriesLocal,
  saveCableInventoryLocal,
  getCableInventoryLocal,
  saveCableMovementLocal,
  getCableMovementsLocal,
  saveEquipmentRepairLocal,
  getEquipmentRepairsLocal,
  saveInventoryItemLocal,
  getInventoryItemsLocal,
  addToSyncQueue
} from '../lib/offlineDB';
import type { CableCategory, CableInventory, CableMovement, EquipmentRepair } from '../types';
import type { InventoryItem } from '../types/inventoryItem';

export function useCableInventory(companyId: string | undefined, activeTab?: string) {
  const [categories, setCategories] = useState<CableCategory[]>([]);
  const [inventory, setInventory] = useState<CableInventory[]>([]);
  const [movements, setMovements] = useState<CableMovement[]>([]);
  const [repairs, setRepairs] = useState<EquipmentRepair[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const lastFetchRef = useRef<number>(0);

  const fetchCategories = useCallback(async (force = false) => {
    if (!companyId) return;
    const cacheKey = `categories_${companyId}`;
    if (!force) {
      const cached = getCached<CableCategory[]>(cacheKey);
      if (cached) { setCategories(cached); return; }
    }

    if (isOnline()) {
      const { data, error } = await supabase
        .from('cable_categories')
        .select('*, type')
        .eq('company_id', companyId)
        .order('sort_order');

      if (error) {
        toast.error('Ошибка при загрузке категорий', { description: error.message });
        // Fallback to local
        const local = await getCableCategoriesLocal(companyId);
        setCategories(local);
        setCached(cacheKey, local);
        return;
      }

      const items = data || [];
      setCategories(items);
      setCached(cacheKey, items);
      for (const item of items) {
        await saveCableCategoryLocal(item, companyId, true);
      }
    } else {
      const local = await getCableCategoriesLocal(companyId);
      setCategories(local);
      setCached(cacheKey, local);
    }
  }, [companyId]);

  const fetchInventory = useCallback(async (force = false) => {
    if (!companyId) return;
    const cacheKey = `inventory_${companyId}`;
    if (!force) {
      const cached = getCached<CableInventory[]>(cacheKey);
      if (cached) { setInventory(cached); return; }
    }

    if (isOnline()) {
      const { data, error } = await supabase
        .from('cable_inventory')
        .select('*')
        .eq('company_id', companyId)
        .limit(1000);

      if (error) {
        toast.error('Ошибка при загрузке инвентаря', { description: error.message });
        const local = await getCableInventoryLocal(companyId);
        setInventory(local);
        setCached(cacheKey, local);
        return;
      }

      const items = data || [];
      setInventory(items);
      setCached(cacheKey, items);
      for (const item of items) {
        await saveCableInventoryLocal(item, companyId, true);
      }
    } else {
      const local = await getCableInventoryLocal(companyId);
      setInventory(local);
      setCached(cacheKey, local);
    }
  }, [companyId]);

  const fetchInventoryItems = useCallback(async (force = false) => {
    if (!companyId) return;
    const cacheKey = `inventory_items_${companyId}`;
    if (!force) {
      const cached = getCached<InventoryItem[]>(cacheKey);
      if (cached) { setInventoryItems(cached); return; }
    }

    if (isOnline()) {
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          *,
          cable_inventory!inner(name, category_id)
        `)
        .eq('company_id', companyId)
        .limit(1000);

      if (error) {
        console.error('Error fetching inventory items:', error);
        const local = await getInventoryItemsLocal(companyId);
        setInventoryItems(local);
        setCached(cacheKey, local);
        return;
      }

      const mapped = (data || []).map((item: any) => ({
        ...item,
        inventory_name: item.cable_inventory?.name,
        inventory_category_id: item.cable_inventory?.category_id,
      }));
      setInventoryItems(mapped);
      setCached(cacheKey, mapped);
      for (const item of mapped) {
        await saveInventoryItemLocal(item, companyId, true);
      }
    } else {
      const local = await getInventoryItemsLocal(companyId);
      setInventoryItems(local);
      setCached(cacheKey, local);
    }
  }, [companyId]);

  const fetchMovements = useCallback(async (force = false) => {
    if (!companyId) return;
    const cacheKey = `movements_${companyId}`;
    if (!force) {
      const cached = getCached<CableMovement[]>(cacheKey);
      if (cached) { setMovements(cached); return; }
    }

    if (isOnline()) {
      const { data, error } = await supabase
        .from('cable_movements')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        toast.error('Ошибка при загрузке движений', { description: error.message });
        const local = await getCableMovementsLocal(companyId);
        setMovements(local);
        setCached(cacheKey, local);
        return;
      }

      const items = data || [];
      setMovements(items);
      setCached(cacheKey, items);
      for (const item of items) {
        await saveCableMovementLocal(item, companyId, true);
      }
    } else {
      const local = await getCableMovementsLocal(companyId);
      setMovements(local);
      setCached(cacheKey, local);
    }
  }, [companyId]);

  const addCategory = useCallback(async (category: Partial<CableCategory>) => {
    if (!companyId) return { error: new Error('No company selected') };

    const tempId = crypto.randomUUID();
    const newCategory = { ...category, id: tempId, company_id: companyId } as CableCategory;

    // Optimistic update
    setCategories(prev => [...prev, newCategory]);
    await saveCableCategoryLocal(newCategory, companyId, false);

    if (isOnline()) {
      try {
        const { error } = await supabase
          .from('cable_categories')
          .insert({ ...category, company_id: companyId });

        if (error) throw error;

        await fetchCategories(true);
        toast.success('Категория добавлена');
        return { error: null };
      } catch (err: any) {
        toast.error('Ошибка при добавлении', { description: err.message });
        return { error: err };
      }
    } else {
      await addToSyncQueue('cable_categories', 'create', { ...category, company_id: companyId, id: tempId });
      toast.success('Категория сохранена локально (офлайн)');
      return { error: null };
    }
  }, [companyId, fetchCategories]);

  const updateCategory = useCallback(async (id: string, updates: Partial<CableCategory>) => {
    if (!companyId) return { error: new Error('No company selected') };

    // Optimistic update
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    const updated = { ...updates, id, company_id: companyId };
    await saveCableCategoryLocal(updated, companyId, false);

    if (isOnline()) {
      try {
        const { error } = await supabase
          .from('cable_categories')
          .update(updates)
          .eq('id', id)
          .eq('company_id', companyId);

        if (error) throw error;

        await fetchCategories(true);
        toast.success('Категория обновлена');
        return { error: null };
      } catch (err: any) {
        toast.error('Ошибка при обновлении', { description: err.message });
        return { error: err };
      }
    } else {
      await addToSyncQueue('cable_categories', 'update', { ...updates, id, company_id: companyId });
      toast.success('Категория обновлена локально (офлайн)');
      return { error: null };
    }
  }, [companyId, fetchCategories]);

  const deleteCategory = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };

    // Optimistic update
    setCategories(prev => prev.filter(c => c.id !== id));

    if (isOnline()) {
      try {
        const { error } = await supabase
          .from('cable_categories')
          .delete()
          .eq('id', id)
          .eq('company_id', companyId);

        if (error) throw error;

        await fetchCategories(true);
        toast.success('Категория удалена');
        return { error: null };
      } catch (err: any) {
        toast.error('Ошибка при удалении', { description: err.message });
        return { error: err };
      }
    } else {
      await addToSyncQueue('cable_categories', 'delete', { id, company_id: companyId });
      toast.success('Категория удалена локально (офлайн)');
      return { error: null };
    }
  }, [companyId, fetchCategories]);

  // Функция для изменения порядка категорий
  const reorderCategories = useCallback(async (categoryIds: string[]) => {
    if (!companyId) return { error: new Error('No company selected') };

    // Optimistic update
    setCategories(prev => {
      const updatedCategories = prev.map(cat => {
        const newIndex = categoryIds.indexOf(cat.id);
        if (newIndex !== -1) {
          return { ...cat, sort_order: newIndex };
        }
        return cat;
      });
      return updatedCategories.sort((a, b) => a.sort_order - b.sort_order);
    });

    if (isOnline()) {
      try {
        for (let i = 0; i < categoryIds.length; i++) {
          const { error } = await supabase
            .from('cable_categories')
            .update({ sort_order: i })
            .eq('id', categoryIds[i])
            .eq('company_id', companyId);

          if (error) throw error;
        }

        return { error: null };
      } catch (err: any) {
        toast.error('Ошибка при изменении порядка', { description: err.message });
        return { error: err };
      }
    } else {
      for (let i = 0; i < categoryIds.length; i++) {
        await addToSyncQueue('cable_categories', 'update', { id: categoryIds[i], sort_order: i, company_id: companyId });
      }
      toast.success('Порядок сохранён локально (офлайн)');
      return { error: null };
    }
  }, [companyId]);

  const upsertInventory = useCallback(async (item: Partial<CableInventory>) => {
    if (!companyId) return { error: new Error('No company selected') };

    const tempId = item.id || crypto.randomUUID();
    const newItem = { ...item, id: tempId, company_id: companyId } as CableInventory;

    // Optimistic update
    setInventory(prev => {
      const exists = prev.find(i => i.id === tempId);
      if (exists) {
        return prev.map(i => i.id === tempId ? { ...i, ...item } : i);
      }
      return [...prev, newItem];
    });
    await saveCableInventoryLocal(newItem, companyId, false);

    if (isOnline()) {
      try {
        const { error } = await supabase
          .from('cable_inventory')
          .upsert({ ...item, company_id: companyId });

        if (error) throw error;

        await fetchInventory(true);
        return { error: null };
      } catch (err: any) {
        return { error: err };
      }
    } else {
      await addToSyncQueue('cable_inventory', item.id ? 'update' : 'create', { ...item, company_id: companyId, id: tempId });
      return { error: null };
    }
  }, [companyId, fetchInventory]);

  const updateInventoryQty = useCallback(async (id: string, quantity: number) => {
    if (!companyId) return { error: new Error('No company selected') };

    // Optimistic update
    setInventory(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
    const updated = { id, quantity, company_id: companyId };
    await saveCableInventoryLocal(updated, companyId, false);

    if (isOnline()) {
      try {
        const { error } = await supabase
          .from('cable_inventory')
          .update({ quantity })
          .eq('id', id)
          .eq('company_id', companyId);

        if (error) throw error;

        await fetchInventory(true);
        return { error: null };
      } catch (err: any) {
        return { error: err };
      }
    } else {
      await addToSyncQueue('cable_inventory', 'update', { id, quantity, company_id: companyId });
      return { error: null };
    }
  }, [companyId, fetchInventory]);

  const deleteInventory = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };

    // Optimistic update
    setInventory(prev => prev.filter(i => i.id !== id));

    if (isOnline()) {
      try {
        const { error } = await supabase
          .from('cable_inventory')
          .delete()
          .eq('id', id)
          .eq('company_id', companyId);

        if (error) throw error;

        await fetchInventory(true);
        return { error: null };
      } catch (err: any) {
        return { error: err };
      }
    } else {
      await addToSyncQueue('cable_inventory', 'delete', { id, company_id: companyId });
      return { error: null };
    }
  }, [companyId, fetchInventory]);

  const issueCable = useCallback(async (movement: Partial<CableMovement>) => {
    if (!companyId) return { error: new Error('No company selected') };

    const tempId = crypto.randomUUID();
    const displayName = await getCurrentUserDisplayName().catch(() => 'Unknown');
    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

    const newMovement = {
      ...movement,
      id: tempId,
      company_id: companyId,
      type: 'issue',
      issued_by: user?.id,
      issued_by_name: displayName,
    } as CableMovement;

    // Optimistic update
    setMovements(prev => [newMovement, ...prev]);
    await saveCableMovementLocal(newMovement, companyId, false);

    if (movement.item_id) {
      setInventoryItems(prev => prev.map(ii => ii.id === movement.item_id ? { ...ii, status: 'issued' as const, updated_at: new Date().toISOString() } : ii));
    }

    if (isOnline()) {
      try {
        const { error } = await supabase
          .from('cable_movements')
          .insert({
            ...movement,
            company_id: companyId,
            type: 'issue',
            issued_by: user?.id,
            issued_by_name: displayName
          });

        if (error) throw error;

        if (movement.item_id) {
          await supabase
            .from('inventory_items')
            .update({ status: 'issued', updated_at: new Date().toISOString() })
            .eq('id', movement.item_id)
            .eq('company_id', companyId);
        }

        await fetchMovements(true);
        await fetchInventory(true);
        await fetchInventoryItems(true);
        toast.success('Выдано');
        return { error: null };
      } catch (err: any) {
        toast.error('Ошибка при выдаче', { description: err.message });
        return { error: err };
      }
    } else {
      await addToSyncQueue('cable_movements', 'create', {
        ...movement,
        company_id: companyId,
        type: 'issue',
        issued_by: user?.id,
        issued_by_name: displayName,
        id: tempId
      });
      if (movement.item_id) {
        await addToSyncQueue('inventory_items', 'update', { id: movement.item_id, status: 'issued', updated_at: new Date().toISOString(), company_id: companyId });
      }
      toast.success('Выдача сохранена локально (офлайн)');
      return { error: null };
    }
  }, [companyId, fetchMovements, fetchInventory, fetchInventoryItems]);

  const returnCable = useCallback(async (movementId: string, returnedQty?: number) => {
    if (!companyId) return { error: new Error('No company selected') };

    // Optimistic update
    setMovements(prev => prev.map(m => m.id === movementId ? { ...m, is_returned: true, returned_quantity: returnedQty ?? m.quantity, returned_at: new Date().toISOString() } : m));

    let movement: { quantity: number; item_id: string | null } | null = null;

    if (isOnline()) {
      try {
        const { data: mov } = await supabase
          .from('cable_movements')
          .select('quantity, item_id')
          .eq('id', movementId)
          .eq('company_id', companyId)
          .single();

        movement = mov;

        let qty = returnedQty;
        if (qty === undefined) {
          qty = movement?.quantity || 0;
        }

        const { error } = await supabase
          .from('cable_movements')
          .update({
            is_returned: true,
            returned_quantity: qty,
            returned_at: new Date().toISOString()
          })
          .eq('id', movementId)
          .eq('company_id', companyId);

        if (error) throw error;

        if (movement?.item_id) {
          await supabase
            .from('inventory_items')
            .update({ status: 'available', updated_at: new Date().toISOString() })
            .eq('id', movement.item_id)
            .eq('company_id', companyId);
        }

        await fetchMovements(true);
        await fetchInventory(true);
        await fetchInventoryItems(true);
        toast.success('Возвращено');
        return { error: null };
      } catch (err: any) {
        toast.error('Ошибка при возврате', { description: err.message });
        return { error: err };
      }
    } else {
      await addToSyncQueue('cable_movements', 'update', {
        id: movementId,
        is_returned: true,
        returned_quantity: returnedQty,
        returned_at: new Date().toISOString(),
        company_id: companyId
      });
      toast.success('Возврат сохранён локально (офлайн)');
      return { error: null };
    }
  }, [companyId, fetchMovements, fetchInventory, fetchInventoryItems]);

  // ===== Функции для работы с ремонтом =====
  const fetchRepairs = useCallback(async (force = false) => {
    if (!companyId) return;
    const cacheKey = `repairs_${companyId}`;
    if (!force) {
      const cached = getCached<EquipmentRepair[]>(cacheKey);
      if (cached) { setRepairs(cached); return; }
    }

    if (isOnline()) {
      const { data, error } = await supabase
        .from('equipment_repairs')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        toast.error('Ошибка при загрузке ремонтов', { description: error.message });
        const local = await getEquipmentRepairsLocal(companyId);
        setRepairs(local);
        setCached(cacheKey, local);
        return;
      }

      const items = data || [];
      setRepairs(items);
      setCached(cacheKey, items);
      for (const item of items) {
        await saveEquipmentRepairLocal(item, companyId, true);
      }
    } else {
      const local = await getEquipmentRepairsLocal(companyId);
      setRepairs(local);
      setCached(cacheKey, local);
    }
  }, [companyId]);

  const sendToRepair = useCallback(async (repair: Partial<EquipmentRepair>) => {
    if (!companyId) return { error: new Error('No company selected') };

    const tempId = crypto.randomUUID();
    const newRepair = { ...repair, id: tempId, company_id: companyId } as EquipmentRepair;

    // Optimistic update
    setRepairs(prev => [newRepair, ...prev]);
    await saveEquipmentRepairLocal(newRepair, companyId, false);

    if (repair.item_id) {
      setInventoryItems(prev => prev.map(ii => ii.id === repair.item_id ? { ...ii, status: 'repair' as const, updated_at: new Date().toISOString() } : ii));
    }

    if (isOnline()) {
      try {
        const { error } = await supabase
          .from('equipment_repairs')
          .insert({ ...repair, company_id: companyId });

        if (error) throw error;

        if (repair.item_id) {
          await supabase
            .from('inventory_items')
            .update({ status: 'repair', updated_at: new Date().toISOString() })
            .eq('id', repair.item_id)
            .eq('company_id', companyId);
        }

        await fetchRepairs(true);
        await fetchInventory(true);
        await fetchInventoryItems(true);
        toast.success('Оборудование отправлено в ремонт');
        return { error: null };
      } catch (err: any) {
        toast.error('Ошибка при отправке в ремонт', { description: err.message });
        return { error: err };
      }
    } else {
      await addToSyncQueue('equipment_repairs', 'create', { ...repair, company_id: companyId, id: tempId });
      if (repair.item_id) {
        await addToSyncQueue('inventory_items', 'update', { id: repair.item_id, status: 'repair', updated_at: new Date().toISOString(), company_id: companyId });
      }
      toast.success('Ремонт сохранён локально (офлайн)');
      return { error: null };
    }
  }, [companyId, fetchRepairs, fetchInventory, fetchInventoryItems]);

  const updateRepairStatus = useCallback(async (repairId: string, status: EquipmentRepair['status'], returnedDate?: string) => {
    if (!companyId) return { error: new Error('No company selected') };

    // Optimistic update
    setRepairs(prev => prev.map(r => r.id === repairId ? { ...r, status, ...(returnedDate ? { returned_date: returnedDate } : {}) } : r));

    let repair: { item_id: string | null } | null = null;

    if (isOnline()) {
      try {
        const { data: r } = await supabase
          .from('equipment_repairs')
          .select('item_id')
          .eq('id', repairId)
          .eq('company_id', companyId)
          .single();

        repair = r;

        const updates: any = { status };
        if (returnedDate) updates.returned_date = returnedDate;

        const { error } = await supabase
          .from('equipment_repairs')
          .update(updates)
          .eq('id', repairId)
          .eq('company_id', companyId);

        if (error) throw error;

        if (repair?.item_id) {
          const itemStatus = status === 'returned' ? 'available' :
            status === 'written_off' ? 'written_off' : 'repair';
          await supabase
            .from('inventory_items')
            .update({ status: itemStatus, updated_at: new Date().toISOString() })
            .eq('id', repair.item_id)
            .eq('company_id', companyId);
        }

        await fetchRepairs(true);
        await fetchInventoryItems(true);
        toast.success('Статус ремонта обновлён');
        return { error: null };
      } catch (err: any) {
        toast.error('Ошибка при обновлении', { description: err.message });
        return { error: err };
      }
    } else {
      await addToSyncQueue('equipment_repairs', 'update', { id: repairId, status, ...(returnedDate ? { returned_date: returnedDate } : {}), company_id: companyId });
      toast.success('Статус ремонта сохранён локально (офлайн)');
      return { error: null };
    }
  }, [companyId, fetchRepairs, fetchInventoryItems]);

  const deleteRepair = useCallback(async (repairId: string) => {
    if (!companyId) return { error: new Error('No company selected') };

    // Optimistic update
    setRepairs(prev => prev.filter(r => r.id !== repairId));

    if (isOnline()) {
      try {
        const { error } = await supabase
          .from('equipment_repairs')
          .delete()
          .eq('id', repairId)
          .eq('company_id', companyId);

        if (error) throw error;

        await fetchRepairs(true);
        toast.success('Запись о ремонте удалена');
        return { error: null };
      } catch (err: any) {
        toast.error('Ошибка при удалении', { description: err.message });
        return { error: err };
      }
    } else {
      await addToSyncQueue('equipment_repairs', 'delete', { id: repairId, company_id: companyId });
      toast.success('Запись о ремонте удалена локально (офлайн)');
      return { error: null };
    }
  }, [companyId, fetchRepairs]);

  // Импорт категорий и оборудования из вкладки "Оборудование"
  const importFromEquipment = useCallback(async () => {
    if (!companyId) return { error: new Error('No company selected') };

    if (!isOnline()) {
      toast.error('Импорт недоступен в офлайн-режиме');
      return { error: new Error('Offline') };
    }

    try {
      const { data, error } = await supabase.rpc('import_equipment_to_cable', {
        p_company_id: companyId
      });

      if (error) {
        if (error.message.includes('function') || error.message.includes('rpc')) {
          toast.error('Функция импорта не настроена', {
            description: 'Выполните SQL скрипт supabase_copy_equipment_to_cable.sql в Supabase Dashboard'
          });
          return { error: new Error('RPC function not found') };
        }
        throw error;
      }

      await fetchCategories(true);
      await fetchInventory(true);

      const importedCategories = data?.categories || 0;
      const importedItems = data?.items || 0;

      toast.success('Импорт завершён', {
        description: `Категорий: ${importedCategories}, позиций: ${importedItems}`
      });

      return { error: null, data };
    } catch (err: any) {
      toast.error('Ошибка при импорте', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchCategories, fetchInventory]);

  // Initial load - use cache if available
  useEffect(() => {
    const now = Date.now();
    if (now - lastFetchRef.current < DEFAULT_CACHE_TTL_MS) return;
    lastFetchRef.current = now;
    fetchCategories();
    fetchInventory();
    fetchInventoryItems();
    fetchMovements();
    fetchRepairs();
  }, [fetchCategories, fetchInventory, fetchInventoryItems, fetchMovements, fetchRepairs]);

  // Realtime on Vercel, smart polling on Yandex proxy
  useRealtimeWithFallback({
    channelName: 'cable_inventory_changes',
    companyId,
    tables: [
      { table: 'cable_inventory', filter: `company_id=eq.${companyId}`, onChange: () => fetchInventory(true) },
      { table: 'inventory_items', filter: `company_id=eq.${companyId}`, onChange: () => { fetchInventoryItems(true); fetchInventory(true); } },
      { table: 'cable_categories', filter: `company_id=eq.${companyId}`, onChange: () => fetchCategories(true) },
    ],
    pollingIntervalMs: 60000, // 1 min
    enabled: !activeTab || ['equipment', 'cables', 'dashboard'].includes(activeTab),
  });

  useRealtimeWithFallback({
    channelName: 'cable_movements_changes',
    companyId,
    tables: [
      { table: 'cable_movements', filter: `company_id=eq.${companyId}`, onChange: () => { fetchMovements(true); fetchInventory(true); } },
      { table: 'equipment_repairs', filter: `company_id=eq.${companyId}`, onChange: () => { fetchRepairs(true); fetchInventory(true); fetchInventoryItems(true); } },
    ],
    pollingIntervalMs: 120000, // 2 min
    enabled: !activeTab || ['equipment', 'cables', 'dashboard'].includes(activeTab),
  });

  // Рекурсивно получаем все ID категорий включая дочерние
  const getAllCategoryIds = useCallback((catId: string, cats: CableCategory[]): string[] => {
    const ids = [catId];
    const children = cats.filter(c => c.parent_id === catId);
    children.forEach(child => {
      ids.push(...getAllCategoryIds(child.id, cats));
    });
    return ids;
  }, []);

  // Статистика по категориям для CableManager
  const stats = useMemo(() => {
    const result: Record<string, { totalLength: number; totalQty: number; issuedQty: number; repairQty: number }> = {};
    
    // Инициализируем все категории
    categories.forEach(cat => {
      result[cat.id] = { totalLength: 0, totalQty: 0, issuedQty: 0, repairQty: 0 };
    });
    
    // Для каждой категории считаем статистику включая дочерние
    categories.forEach(cat => {
      const allIds = getAllCategoryIds(cat.id, categories);
      
      // Считаем инвентарь для всех категорий
      inventory.forEach(item => {
        if (allIds.includes(item.category_id)) {
          if (item.track_items && inventoryItems.length > 0) {
            // При track_items считаем из inventory_items
            const itemInstances = inventoryItems.filter(ii => ii.inventory_id === item.id);
            const availableCount = itemInstances.filter(ii => ii.status === 'available').length;
            const issuedCount = itemInstances.filter(ii => ii.status === 'issued').length;
            const repairCount = itemInstances.filter(ii => ii.status === 'repair').length;
            
            result[cat.id].totalLength += (item.length || 0) * itemInstances.length;
            result[cat.id].totalQty += itemInstances.length;
            result[cat.id].issuedQty += issuedCount;
            result[cat.id].repairQty += repairCount;
          } else {
            // Обычный режим — считаем из cable_inventory
            result[cat.id].totalLength += (item.length || 0) * item.quantity;
            result[cat.id].totalQty += item.quantity;
          }
        }
      });
      
      // Для не-track_items считаем выданное/ремонт из movements/repairs
      inventory
        .filter(item => allIds.includes(item.category_id) && !item.track_items)
        .forEach(item => {
          movements
            .filter(m => m.is_returned !== true && m.category_id === item.category_id)
            .filter(m => item.name ? m.equipment_name === item.name : m.length === item.length)
            .forEach(m => {
              result[cat.id].issuedQty += m.quantity;
            });
          
          repairs
            .filter(r => r.status === 'in_repair' && r.category_id === item.category_id)
            .filter(r => item.name ? r.equipment_name === item.name : r.length === item.length)
            .forEach(r => {
              result[cat.id].repairQty += r.quantity;
            });
        });
    });
    
    return result;
  }, [inventory, inventoryItems, movements, repairs, categories, getAllCategoryIds]);

  return {
    categories,
    inventory,
    movements,
    repairs,
    inventoryItems,
    stats,
    loading,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    upsertInventory,
    updateInventoryQty,
    deleteInventory,
    issueCable,
    returnCable,
    sendToRepair,
    updateRepairStatus,
    deleteRepair,
    importFromEquipment,
    fetchInventoryItems,
    refresh: () => {
      fetchCategories();
      fetchInventory();
      fetchInventoryItems();
      fetchMovements();
      fetchRepairs();
    }
  };
}
