import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Plus, Edit, Trash2, FileText } from 'lucide-react';
import { Estimate, PDFSettings } from '../types';
import { EstimateBuilder } from './EstimateBuilder';

interface EstimateManagerProps {
  estimates: Estimate[];
  equipment: any[];
  pdfSettings: PDFSettings;
  onCreate: (estimate: any, items: any[]) => Promise<void>;
  onUpdate: (id: string, estimate: any, items: any[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function EstimateManager({
  estimates,
  equipment,
  pdfSettings,
  onCreate,
  onUpdate,
  onDelete
}: EstimateManagerProps) {
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);

  const handleEdit = (estimate: Estimate) => {
    setEditingEstimate(estimate);
    setIsBuilderOpen(true);
  };

  const handleClose = () => {
    setIsBuilderOpen(false);
    setEditingEstimate(null);
  };

  const handleSave = async (estimateData: any, items: any[]) => {
    if (editingEstimate) {
      await onUpdate(editingEstimate.id, estimateData, items);
    } else {
      await onCreate(estimateData, items);
    }
    handleClose();
  };

  if (isBuilderOpen) {
    return (
      <EstimateBuilder
        equipment={equipment}
        estimate={editingEstimate}
        pdfSettings={pdfSettings}
        onSave={handleSave}
        onClose={handleClose}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Сметы</CardTitle>
            <Button onClick={() => setIsBuilderOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Новая смета
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Мероприятие</TableHead>
                <TableHead>Площадка</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Позиций</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estimates.map((estimate) => (
                <TableRow key={estimate.id}>
                  <TableCell className="font-medium">{estimate.event_name}</TableCell>
                  <TableCell>{estimate.venue || '-'}</TableCell>
                  <TableCell>{estimate.event_date}</TableCell>
                  <TableCell>{estimate.items?.length || 0}</TableCell>
                  <TableCell>{estimate.total.toLocaleString('ru-RU')} ₽</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEdit(estimate)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onDelete(estimate.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}