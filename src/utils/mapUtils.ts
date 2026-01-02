import L from 'leaflet';
import type { Location } from '../types';

/**
 * Map Utilities
 * Helper functions for Leaflet map integration
 */

// Default map center (Winnipeg, Manitoba)
export const DEFAULT_CENTER: [number, number] = [49.8951, -97.1384];
export const DEFAULT_ZOOM = 12;

// Map tile layer URL (OpenStreetMap)
export const TILE_LAYER_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_LAYER_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Create custom marker icon for ride offers
 */
export function createRideMarkerIcon(isAvailable: boolean): L.Icon {
  return L.icon({
    iconUrl: isAvailable 
      ? 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNCIgZmlsbD0iIzEwYjk4MSIvPjxjaXJjbGUgY3g9IjE2IiBjeT0iMTYiIHI9IjEwIiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg=='
      : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNCIgZmlsbD0iIzk5OTk5OSIvPjxjaXJjbGUgY3g9IjE2IiBjeT0iMTYiIHI9IjEwIiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

/**
 * Create custom marker icon for current location
 */
export function createCurrentLocationIcon(): L.Icon {
  return L.icon({
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgZmlsbD0iIzM4NzVkNyIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjYiIGZpbGw9IndoaXRlIi8+PC9zdmc+',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

/**
 * Calculate bounds for multiple locations
 */
export function calculateBounds(locations: Location[]): L.LatLngBounds | null {
  if (locations.length === 0) return null;
  
  const latLngs = locations.map(loc => 
    L.latLng(loc.latitude, loc.longitude)
  );
  
  return L.latLngBounds(latLngs);
}

/**
 * Fit map to show all markers with padding
 */
export function fitMapToBounds(
  map: L.Map,
  bounds: L.LatLngBounds,
  padding: [number, number] = [50, 50]
): void {
  map.fitBounds(bounds, { padding });
}

/**
 * Convert Location to LatLng
 */
export function locationToLatLng(location: Location): L.LatLng {
  return L.latLng(location.latitude, location.longitude);
}

/**
 * Convert LatLng to Location
 */
export function latLngToLocation(latLng: L.LatLng): Location {
  return {
    latitude: latLng.lat,
    longitude: latLng.lng,
  };
}
