import { useState, useEffect, useMemo } from 'react';
import { Search, FileText, Package, Calendar, Users, Building2, Layout, ClipboardCheck, Target, Settings, Shield } from 'lucide-react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from './ui/command';
import type { TabId } from '../lib/permissions';
import type { Equipment, Estimate, Customer } from '../types';

interface CommandMenuProps {
  equipment: Equipment[];
  estimates: Estimate[];
  customers: Customer[];
  availableTabs: { id: TabId; label: string; icon: React.ElementType }[];
  onTabChange: (tab: TabId) => void;
  onOpenEstimate?: (estimate: Estimate) => void;
  onOpenEquipment?: (equipment: Equipment) => void;
}

export function CommandMenu({ 
  equipment, 
  estimates, 
  customers,
  availableTabs, 
  onTabChange,
  onOpenEstimate,
  onOpenEquipment 
}: CommandMenuProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const navigationItems = useMemo(() => {
    const iconMap: Record<string, React.ElementType> = {
      equipment: Package,
      estimates: FileText,
      calendar: Calendar,
      customers: Building2,
      templates: Layout,
      checklists: ClipboardCheck,
      staff: Users,
      goals: Target,
      finance: Search,
      settings: Settings,
      admin: Shield,
    };

    return availableTabs.map(tab => ({
      ...tab,
      icon: iconMap[tab.id] || Search,
    }));
  }, [availableTabs]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Поиск по всему приложению..." />
      <CommandList>
        <CommandEmpty>Ничего не найдено</CommandEmpty>
        
        <CommandGroup heading="Навигация">
          {navigationItems.map((tab) => {
            const Icon = tab.icon;
            return (
              <CommandItem
                key={tab.id}
                onSelect={() => {
                  onTabChange(tab.id);
                  setOpen(false);
                }}
              >
                <Icon className="mr-2 h-4 w-4" />
                {tab.label}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        {estimates.length > 0 && (
          <CommandGroup heading="Сметы">
            {estimates.slice(0, 5).map((estimate) => (
              <CommandItem
                key={estimate.id}
                onSelect={() => {
                  onTabChange('estimates');
                  onOpenEstimate?.(estimate);
                  setOpen(false);
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                <span className="truncate">{estimate.event_name}</span>
                <span className="ml-auto text-xs text-gray-500">
                  {new Date(estimate.event_start_date || estimate.event_date).toLocaleDateString('ru-RU')}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {equipment.length > 0 && (
          <CommandGroup heading="Оборудование">
            {equipment.slice(0, 5).map((item) => (
              <CommandItem
                key={item.id}
                onSelect={() => {
                  onTabChange('equipment');
                  onOpenEquipment?.(item);
                  setOpen(false);
                }}
              >
                <Package className="mr-2 h-4 w-4" />
                <span className="truncate">{item.name}</span>
                <span className="ml-auto text-xs text-gray-500">{item.category}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {customers.length > 0 && (
          <CommandGroup heading="Заказчики">
            {customers.slice(0, 5).map((customer) => (
              <CommandItem
                key={customer.id}
                onSelect={() => {
                  onTabChange('customers');
                  setOpen(false);
                }}
              >
                <Building2 className="mr-2 h-4 w-4" />
                <span className="truncate">{customer.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
