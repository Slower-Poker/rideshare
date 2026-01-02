import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { SharedProps } from '../types';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  TILE_LAYER_URL,
  TILE_LAYER_ATTRIBUTION,
  createRideMarkerIcon,
} from '../utils/mapUtils';

export function RideMapView({ setCurrentView }: SharedProps) {
  // TODO: Fetch actual rides from database
  // This is a work-in-progress feature. Ride fetching will be implemented
  // using Amplify Data subscriptions for real-time updates.
  const rides: never[] = [];
  const loading = false;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => setCurrentView('home')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Available Rides</h1>
        </div>
      </header>

      {/* Map Container - Temporarily disabled */}
      <div className="flex-1 relative bg-gray-100 border-2 border-dashed border-gray-300">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
          <Loader2 className="w-16 h-16 text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Map Temporarily Disabled</h3>
          <p className="text-gray-600">
            The map feature is currently being fixed. This page will show available rides once the map is restored.
          </p>
        </div>
        
        {/* Map code commented out temporarily */}
        {/*
        {loading && (
          <div className="absolute inset-0 bg-gray-50 bg-opacity-90 flex items-center justify-center z-20">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading rides...</p>
            </div>
          </div>
        )}

        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          className="h-full w-full"
          zoomControl={true}
        >
          <TileLayer
            attribution={TILE_LAYER_ATTRIBUTION}
            url={TILE_LAYER_URL}
          />
          
          {rides.map(() => (
            <Marker
              key={`ride-marker-placeholder`}
              position={[0, 0]}
              icon={createRideMarkerIcon(true)}
            >
              <Popup>
                Ride details will appear here
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {!loading && rides.length === 0 && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-8 max-w-md z-10 text-center pointer-events-none">
            <p className="text-gray-600">
              No rides available at the moment. Check back soon or create your own ride offer!
            </p>
          </div>
        )}
        */}
      </div>
    </div>
  );
}
