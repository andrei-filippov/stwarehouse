import { createClient } from '@supabase/supabase-js';
import type { Equipment, Estimate, EstimateItem, Template, TemplateItem, Rule, Checklist, ChecklistItem, Staff } from '@/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://trivdyjfiyxsmrkihqet.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_l4TMwhafnf4JGPBqDu9UBQ_Rsk9_BKU';

export const supabase = createClient(supabaseUrl, supabaseKey);

// ==================== AUTH ====================

export const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
};

export const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { name }
        }
    });
    return { data, error };
};

export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
};

export const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
};

export const getProfile = async (userId: string) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    return { data, error };
};

// ==================== EQUIPMENT ====================

export const getEquipment = async () => {
    const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });
    return { data: data || [], error };
};

export const addEquipment = async (item: Omit<Equipment, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
        .from('equipment')
        .insert(item)
        .select()
        .single();
    return { data, error };
};

export const updateEquipment = async (id: string, item: Partial<Equipment>) => {
    const { data, error } = await supabase
        .from('equipment')
        .update(item)
        .eq('id', id)
        .select()
        .single();
    return { data, error };
};

export const deleteEquipment = async (id: string) => {
    const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', id);
    return { error };
};

// ==================== CATEGORIES ====================

export const getCategories = async () => {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
    return { data: data || [], error };
};

export const addCategory = async (name: string) => {
    const { data, error } = await supabase
        .from('categories')
        .insert({ name })
        .select()
        .single();
    return { data, error };
};

export const deleteCategory = async (id: string) => {
    const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);
    return { error };
};

// ==================== ESTIMATES ====================

export const getEstimates = async () => {
    const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .order('created_at', { ascending: false });
    return { data: data || [], error };
};

export const getEstimateWithItems = async (estimateId: string) => {
    const { data: estimate, error: estimateError } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', estimateId)
        .single();
    
    if (estimateError || !estimate) return { data: null, error: estimateError };
    
    const { data: items, error: itemsError } = await supabase
        .from('estimate_items')
        .select('*')
        .eq('estimate_id', estimateId);
    
    return { data: { ...estimate, items: items || [] }, error: itemsError };
};

export const addEstimate = async (estimate: Omit<Estimate, 'id' | 'created_at'>, items: Omit<EstimateItem, 'id' | 'estimate_id'>[]) => {
    // Start a transaction by using RPC or manual approach
    const { data: newEstimate, error: estimateError } = await supabase
        .from('estimates')
        .insert(estimate)
        .select()
        .single();
    
    if (estimateError || !newEstimate) return { data: null, error: estimateError };
    
    // Insert items
    const itemsWithEstimateId = items.map(item => ({
        ...item,
        estimate_id: newEstimate.id
    }));
    
    const { error: itemsError } = await supabase
        .from('estimate_items')
        .insert(itemsWithEstimateId);
    
    return { data: newEstimate, error: itemsError };
};

export const updateEstimate = async (id: string, estimate: Partial<Estimate>, items?: EstimateItem[]) => {
    // Update estimate
    const { data: updatedEstimate, error: estimateError } = await supabase
        .from('estimates')
        .update(estimate)
        .eq('id', id)
        .select()
        .single();
    
    if (estimateError) return { data: null, error: estimateError };
    
    // If items provided, delete old and insert new
    if (items) {
        await supabase.from('estimate_items').delete().eq('estimate_id', id);
        
        const itemsWithEstimateId = items.map(item => ({
            ...item,
            estimate_id: id
        }));
        
        await supabase.from('estimate_items').insert(itemsWithEstimateId);
    }
    
    return { data: updatedEstimate, error: null };
};

export const deleteEstimate = async (id: string) => {
    // Items will be deleted automatically via CASCADE
    const { error } = await supabase
        .from('estimates')
        .delete()
        .eq('id', id);
    return { error };
};

// ==================== TEMPLATES ====================

export const getTemplates = async () => {
    const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('name', { ascending: true });
    return { data: data || [], error };
};

export const getTemplateWithItems = async (templateId: string) => {
    const { data: template, error: templateError } = await supabase
        .from('templates')
        .select('*')
        .eq('id', templateId)
        .single();
    
    if (templateError || !template) return { data: null, error: templateError };
    
    const { data: items, error: itemsError } = await supabase
        .from('template_items')
        .select('*')
        .eq('template_id', templateId);
    
    return { data: { ...template, items: items || [] }, error: itemsError };
};

export const addTemplate = async (template: Omit<Template, 'id' | 'created_at'>, items: Omit<TemplateItem, 'id' | 'template_id'>[]) => {
    const { data: newTemplate, error: templateError } = await supabase
        .from('templates')
        .insert(template)
        .select()
        .single();
    
    if (templateError || !newTemplate) return { data: null, error: templateError };
    
    const itemsWithTemplateId = items.map(item => ({
        ...item,
        template_id: newTemplate.id
    }));
    
    await supabase.from('template_items').insert(itemsWithTemplateId);
    
    return { data: newTemplate, error: null };
};

export const updateTemplate = async (id: string, template: Partial<Template>, items?: TemplateItem[]) => {
    const { data: updatedTemplate, error: templateError } = await supabase
        .from('templates')
        .update(template)
        .eq('id', id)
        .select()
        .single();
    
    if (templateError) return { data: null, error: templateError };
    
    if (items) {
        await supabase.from('template_items').delete().eq('template_id', id);
        
        const itemsWithTemplateId = items.map(item => ({
            ...item,
            template_id: id
        }));
        
        await supabase.from('template_items').insert(itemsWithTemplateId);
    }
    
    return { data: updatedTemplate, error: null };
};

export const deleteTemplate = async (id: string) => {
    const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id);
    return { error };
};

// ==================== RULES ====================

export const getRules = async () => {
    const { data, error } = await supabase
        .from('rules')
        .select('*')
        .order('equipment_name', { ascending: true });
    return { data: data || [], error };
};

export const getRuleWithItems = async (ruleId: string) => {
    const { data: rule, error: ruleError } = await supabase
        .from('rules')
        .select('*')
        .eq('id', ruleId)
        .single();
    
    if (ruleError || !rule) return { data: null, error: ruleError };
    
    const { data: items, error: itemsError } = await supabase
        .from('rule_items')
        .select('*')
        .eq('rule_id', ruleId);
    
    return { data: { ...rule, items: items || [] }, error: itemsError };
};

export const addRule = async (rule: Omit<Rule, 'id' | 'created_at' | 'items'>, items: string[]) => {
    const { data: newRule, error: ruleError } = await supabase
        .from('rules')
        .insert(rule)
        .select()
        .single();
    
    if (ruleError || !newRule) return { data: null, error: ruleError };
    
    const ruleItems = items.map(item_name => ({
        rule_id: newRule.id,
        item_name
    }));
    
    await supabase.from('rule_items').insert(ruleItems);
    
    return { data: newRule, error: null };
};

export const updateRule = async (id: string, rule: Partial<Rule>, items?: string[]) => {
    const { data: updatedRule, error: ruleError } = await supabase
        .from('rules')
        .update(rule)
        .eq('id', id)
        .select()
        .single();
    
    if (ruleError) return { data: null, error: ruleError };
    
    if (items) {
        await supabase.from('rule_items').delete().eq('rule_id', id);
        
        const ruleItems = items.map(item_name => ({
            rule_id: id,
            item_name
        }));
        
        await supabase.from('rule_items').insert(ruleItems);
    }
    
    return { data: updatedRule, error: null };
};

export const deleteRule = async (id: string) => {
    const { error } = await supabase
        .from('rules')
        .delete()
        .eq('id', id);
    return { error };
};

// ==================== CHECKLISTS ====================

export const getChecklists = async () => {
    const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .order('created_at', { ascending: false });
    return { data: data || [], error };
};

export const getChecklistWithItems = async (checklistId: string) => {
    const { data: checklist, error: checklistError } = await supabase
        .from('checklists')
        .select('*')
        .eq('id', checklistId)
        .single();
    
    if (checklistError || !checklist) return { data: null, error: checklistError };
    
    const { data: items, error: itemsError } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('checklist_id', checklistId);
    
    return { data: { ...checklist, items: items || [] }, error: itemsError };
};

export const addChecklist = async (checklist: Omit<Checklist, 'id' | 'created_at'>, items: Omit<ChecklistItem, 'id' | 'checklist_id'>[]) => {
    const { data: newChecklist, error: checklistError } = await supabase
        .from('checklists')
        .insert(checklist)
        .select()
        .single();
    
    if (checklistError || !newChecklist) return { data: null, error: checklistError };
    
    const itemsWithChecklistId = items.map(item => ({
        ...item,
        checklist_id: newChecklist.id
    }));
    
    await supabase.from('checklist_items').insert(itemsWithChecklistId);
    
    return { data: newChecklist, error: null };
};

export const updateChecklistItem = async (itemId: string, completed: boolean) => {
    const { error } = await supabase
        .from('checklist_items')
        .update({ completed })
        .eq('id', itemId);
    return { error };
};

export const deleteChecklist = async (id: string) => {
    const { error } = await supabase
        .from('checklists')
        .delete()
        .eq('id', id);
    return { error };
};

// ==================== STAFF ====================

export const getStaff = async () => {
    const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('name', { ascending: true });
    return { data: data || [], error };
};

export const addStaff = async (person: Omit<Staff, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
        .from('staff')
        .insert(person)
        .select()
        .single();
    return { data, error };
};

export const updateStaff = async (id: string, person: Partial<Staff>) => {
    const { data, error } = await supabase
        .from('staff')
        .update(person)
        .eq('id', id)
        .select()
        .single();
    return { data, error };
};

export const deleteStaff = async (id: string) => {
    const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id);
    return { error };
};

// ==================== UTILS ====================

export const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(value);
};

export const formatDate = (dateString: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
};

export const generateId = (): string => {
    return crypto.randomUUID();
};

export const downloadCSV = (csvContent: string, filename: string): void => {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
};
