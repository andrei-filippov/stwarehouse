// ==================== TYPES ====================

export type Equipment = {
    id: string;
    name: string;
    category: string;
    quantity: number;
    price: number;
    description: string;
    created_at?: string;
};

export type Category = {
    id: string;
    name: string;
};

export type EstimateItem = {
    id?: string;
    estimate_id?: string;
    equipment_id: string;
    name: string;
    description: string;
    quantity: number;
    price: number;
};

export type Estimate = {
    id: string;
    user_id?: string;
    event_name: string;
    venue: string;
    event_date: string;
    total: number;
    created_at?: string;
    items?: EstimateItem[];
};

export type TemplateItem = {
    id?: string;
    template_id?: string;
    category: string;
    equipment_name: string;
    default_quantity: number;
};

export type Template = {
    id: string;
    user_id?: string;
    name: string;
    description: string;
    items?: TemplateItem[];
    created_at?: string;
};

export type ChecklistItem = {
    id?: string;
    checklist_id?: string;
    text: string;
    completed: boolean;
    category: string;
};

export type Checklist = {
    id: string;
    user_id?: string;
    name: string;
    estimate_id?: string;
    estimate_name?: string;
    items?: ChecklistItem[];
    created_at?: string;
};

export type RuleItem = {
    id?: string;
    rule_id?: string;
    item_name: string;
};

export type Rule = {
    id: string;
    user_id?: string;
    equipment_name: string;
    description: string;
    items?: RuleItem[];
    created_at?: string;
};

export type Staff = {
    id: string;
    name: string;
    position: string;
    phone: string;
    email: string;
    created_at?: string;
};

export type Profile = {
    id: string;
    name: string;
    role: 'admin' | 'manager' | 'warehouse' | 'accountant';
    created_at?: string;
};

export type PDFSettings = {
    logo: string | null;
    companyName: string;
    companyDetails: string;
    position: string;
    personName: string;
    signature: string | null;
    stamp: string | null;
};
