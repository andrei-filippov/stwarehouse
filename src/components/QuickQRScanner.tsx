import { useState, useCallback, useRef } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { QRScanner } from './QRScanner';
import { toast } from 'sonner';
import { ScanLine, Package, ClipboardCheck, User, Check, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ChecklistV2 } from '../types/checklist';

interface Props {
  companyId?: string;
  checklists: ChecklistV2[];
}

type Mode = 'issue' | 'checklist' | null;

export function QuickQRScanner({ companyId, checklists }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [scanning, setScanning] = useState(false);
  const [items, setItems] = useState<Map<string, { name: string; count: number }>>(new Map());
  const [recipient, setRecipient] = useState('');
  const [showForm, setShowForm] = useState(false);
  const counterRef = useRef<Record<string, number>>({});

  const reset = () => {
    setMode(null);
    setScanning(false);
    setItems(new Map());
    setRecipient('');
    setShowForm(false);
    counterRef.current = {};
  };

  const handleIssueScan = useCallback(async (qr: string) => {
    if (!companyId) return;
    const searchCode = qr.toUpperCase();
    let { data } = await supabase.from('cable_inventory').select('id, name').eq('qr_code', searchCode).eq('company_id', companyId).single();
    if (!data) {
      const { data: eqData } = await supabase.from('equipment').select('id, name').eq('qr_code', searchCode).eq('company_id', companyId).single();
      if (eqData) data = eqData;
    }
    if (!data) { toast.error('Оборудование не найдено'); return; }
    const c = (counterRef.current[data.id] || 0) + 1;
    counterRef.current[data.id] = c;
    setItems(prev => new Map(prev).set(data.id, { name: data.name, count: c }));
    toast.success(`${data.name}: ${c} шт`);
  }, [companyId]);

  const onScan = useCallback((qr: string) => {
    if (mode === 'issue') handleIssueScan(qr);
  }, [mode, handleIssueScan]);

  const issue = async () => {
    if (!recipient.trim() || items.size === 0) return;
    toast.success('Оборудование выдано', { description: recipient });
    reset();
    setIsOpen(false);
  };

  return (
    <>
      <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setIsOpen(true)}>
        <ScanLine className="w-4 h-4" />
        <span>QR Сканер</span>
      </Button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>QR Сканер</DialogTitle></DialogHeader>
          
          {!mode ? (
            <div className="grid gap-4 py-4">
              <p className="text-sm text-muted-foreground text-center">Выберите режим</p>
              <Button variant="outline" className="h-auto py-6 flex flex-col gap-2" onClick={() => setMode('issue')}>
                <Package className="w-8 h-8 text-blue-500" />
                <div className="text-center">
                  <div className="font-medium">Выдача оборудования</div>
                  <div className="text-xs text-muted-foreground">Сканируйте и выдавайте</div>
                </div>
              </Button>
              <Button variant="outline" className="h-auto py-6 flex flex-col gap-2" onClick={() => setMode('checklist')}>
                <ClipboardCheck className="w-8 h-8 text-green-500" />
                <div className="text-center">
                  <div className="font-medium">Чек-лист</div>
                  <div className="text-xs text-muted-foreground">Погрузка / разгрузка</div>
                </div>
              </Button>
            </div>
          ) : mode === 'issue' ? (
            <div className="space-y-4">
              {!showForm ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setMode(null)}>
                    <ArrowLeft className="w-4 h-4 mr-1"/> Назад
                  </Button>
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-sm font-medium mb-2">Отсканировано:</p>
                    {items.size === 0 ? (
                      <p className="text-sm text-muted-foreground">Нет оборудования</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-auto">
                        {Array.from(items.entries()).map(([id, it]) => (
                          <div key={id} className="flex justify-between bg-background rounded p-2">
                            <span className="text-sm">{it.name}</span>
                            <span className="text-sm font-medium">{it.count} шт</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button className="w-full" onClick={() => setScanning(true)}>
                    <ScanLine className="w-4 h-4 mr-2"/> Сканировать QR
                  </Button>
                  {items.size > 0 && (
                    <Button variant="secondary" className="w-full" onClick={() => setShowForm(true)}>
                      <Check className="w-4 h-4 mr-2"/> Выдать ({items.size})
                    </Button>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                    <ArrowLeft className="w-4 h-4 mr-1"/> Назад
                  </Button>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Кому выдается:</label>
                    <Input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="ФИО получателя" />
                  </div>
                  <Button className="w-full" onClick={issue} disabled={!recipient.trim()}>
                    <User className="w-4 h-4 mr-2"/> Выдать оборудование
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      
      <QRScanner isOpen={scanning} onClose={() => setScanning(false)} onScan={onScan} title="Сканируйте QR оборудования" keepOpen={true} />
    </>
  );
}
