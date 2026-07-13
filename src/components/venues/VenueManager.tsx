import { useState } from 'react';
import { useVenues } from '../../hooks/useVenues';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, MapPin } from 'lucide-react';
import { VenueForm } from './VenueForm';
import { VenueDetail } from './VenueDetail';
import type { VenueDetails } from '../../types/venues';

interface VenueManagerProps {
  companyId: string | undefined;
}

export function VenueManager({ companyId }: VenueManagerProps) {
  const { venues, loading, createVenue, updateVenue, deleteVenue } = useVenues(companyId);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<VenueDetails | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<VenueDetails | null>(null);

  const filteredVenues = venues.filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = async (venue: Partial<VenueDetails>) => {
    if (editingVenue) {
      await updateVenue(editingVenue.id, venue);
    } else {
      await createVenue(venue);
    }
    setIsFormOpen(false);
    setEditingVenue(null);
  };

  const handleEdit = (venue: VenueDetails) => {
    setEditingVenue(venue);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    const result = await deleteVenue(id);
    if (!result.error) {
      setSelectedVenue(null);
    }
  };

  if (selectedVenue) {
    return (
      <>
        <VenueDetail
          venue={selectedVenue}
          onBack={() => setSelectedVenue(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
        {isFormOpen && (
          <VenueForm
            venue={editingVenue}
            onSave={handleSave}
            onCancel={() => { setIsFormOpen(false); setEditingVenue(null); }}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Площадки</h2>
        <Button onClick={() => { setEditingVenue(null); setIsFormOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Добавить площадку
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию, городу, адресу..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
      ) : filteredVenues.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchQuery ? 'Ничего не найдено' : 'Нет площадок. Создайте первую площадку!'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVenues.map((venue) => (
            <Card
              key={venue.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedVenue(venue)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  {venue.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {venue.city && <div>{venue.city}</div>}
                  {venue.address && <div>{venue.address}</div>}
                  <div className="flex gap-2 pt-2 flex-wrap">
                    {venue.has_380v && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">380В</span>
                    )}
                    {venue.guest_capacity && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{venue.guest_capacity} чел.</span>
                    )}
                    {venue.light_rig_type && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">{venue.light_rig_type}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isFormOpen && (
        <VenueForm
          venue={editingVenue}
          onSave={handleSave}
          onCancel={() => { setIsFormOpen(false); setEditingVenue(null); }}
        />
      )}
    </div>
  );
}
