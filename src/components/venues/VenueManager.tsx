import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, MapPin } from 'lucide-react';
import type { VenueDetails } from '../../types/venues';

interface VenueManagerProps {
  companyId: string | undefined;
}

// Моковые данные для тестирования
const mockVenues: VenueDetails[] = [
  {
    id: '1',
    company_id: 'test',
    name: 'ДК Краза',
    city: 'Красноярск',
    address: 'ул. Ленина 15',
    has_380v: true,
    power_capacity_kw: 150,
    guest_capacity: 800,
    light_rig_type: 'ферма',
    light_rig_height_m: 6.5,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    company_id: 'test',
    name: 'СК Олимпийский',
    city: 'Москва',
    address: 'Олимпийский просп.',
    has_380v: true,
    power_capacity_kw: 500,
    guest_capacity: 35000,
    light_rig_type: 'ферма',
    light_rig_height_m: 12,
    created_at: new Date().toISOString(),
  },
];

export function VenueManager({ companyId }: VenueManagerProps) {
  const [venues] = useState<VenueDetails[]>(mockVenues);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVenue, setSelectedVenue] = useState<VenueDetails | null>(null);

  const filteredVenues = venues.filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedVenue) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedVenue(null)}>
            ← Назад
          </Button>
          <h2 className="text-2xl font-bold">{selectedVenue.name}</h2>
        </div>
        <div className="text-muted-foreground">
          {selectedVenue.city && <div>{selectedVenue.city}</div>}
          {selectedVenue.address && <div>{selectedVenue.address}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Площадки</h2>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Добавить
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Поиск..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

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
                <div className="flex gap-3 pt-2">
                  {venue.has_380v && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">380В</span>}
                  {venue.guest_capacity && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{venue.guest_capacity} чел.</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
