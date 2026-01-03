/**
 * MapLibre GL JS Utilities
 * Helper functions for MapLibre map integration
 */

import type { Location } from '../types';

// Default map center (Winnipeg, Manitoba)
export const DEFAULT_CENTER: [number, number] = [-97.1384, 49.8951]; // [lng, lat] for MapLibre
export const DEFAULT_ZOOM = 10;

// Manitoba bounds for MapLibre (as bounding box: [west, south, east, north])
export const MANITOBA_BOUNDS: [number, number, number, number] = [-102.0, 48.9, -95.0, 60.0];

// Raster tile sources for OSM
export const OSM_TILE_SOURCES = {
  cyclosm: {
    tiles: [
      'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
      'https://b.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
      'https://c.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    ],
    attribution: '© <a href="https://www.cyclosm.org">CyclOSM</a> | © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  osm: {
    tiles: [
      'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ],
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
} as const;

/**
 * Create MapLibre style configuration with raster tiles
 */
export function createRasterTileStyle(tileSource: keyof typeof OSM_TILE_SOURCES = 'osm') {
  const source = OSM_TILE_SOURCES[tileSource];
  
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster' as const,
        tiles: source.tiles,
        tileSize: 256,
        attribution: source.attribution,
      },
    },
    layers: [
      {
        id: 'osm',
        type: 'raster' as const,
        source: 'osm',
      },
    ],
    // Note: glyphs and sprite are not needed for raster tiles
    // They're only required for vector tiles with text labels and icons
  };
}

/**
 * Convert Location to MapLibre coordinates [lng, lat]
 */
export function locationToCoordinates(location: Location): [number, number] {
  return [location.longitude, location.latitude];
}

/**
 * Convert MapLibre coordinates to Location
 */
export function coordinatesToLocation(coords: [number, number]): Location {
  return {
    latitude: coords[1],
    longitude: coords[0],
  };
}

/**
 * Check if location is within Manitoba bounds
 */
export function isInManitoba(lat: number, lng: number): boolean {
  return lat >= 48.9 && lat <= 60.0 && lng >= -102.0 && lng <= -95.0;
}

/**
 * Constrain coordinates to Manitoba bounds
 */
export function constrainToManitoba(lat: number, lng: number): [number, number] {
  const constrainedLat = Math.max(48.9, Math.min(60.0, lat));
  const constrainedLng = Math.max(-102.0, Math.min(-95.0, lng));
  return [constrainedLng, constrainedLat]; // Return as [lng, lat] for MapLibre
}

/**
 * Calculate bounds for multiple locations
 */
export function calculateBounds(locations: Location[]): [[number, number], [number, number]] | null {
  if (locations.length === 0) return null;
  
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  
  locations.forEach(loc => {
    minLng = Math.min(minLng, loc.longitude);
    maxLng = Math.max(maxLng, loc.longitude);
    minLat = Math.min(minLat, loc.latitude);
    maxLat = Math.max(maxLat, loc.latitude);
  });
  
  return [[minLng, minLat], [maxLng, maxLat]];
}

/**
 * Convert distance from miles to kilometers
 */
export function milesToKm(miles: number): number {
  return miles * 1.60934;
}

/**
 * Convert distance from kilometers to miles
 */
export function kmToMiles(km: number): number {
  return km * 0.621371;
}

/**
 * Convert radius from user's preferred unit to kilometers
 */
export function convertToKm(value: number, unit: 'km' | 'miles'): number {
  return unit === 'miles' ? milesToKm(value) : value;
}

/**
 * Convert radius from kilometers to user's preferred unit
 */
export function convertFromKm(value: number, unit: 'km' | 'miles'): number {
  return unit === 'miles' ? kmToMiles(value) : value;
}

/**
 * GeoJSON Feature type for circle geometry
 */
export interface CircleGeoJSON {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: [[number, number][]];
  };
  properties: {
    radius: number;
    center: [number, number];
  };
}

/**
 * Create a circle GeoJSON feature for a given center and radius (in kilometers)
 * @param center - The center location of the circle
 * @param radiusKm - The radius of the circle in kilometers
 * @returns A GeoJSON Feature representing the circle
 */
export function createCircleGeoJSON(center: Location, radiusKm: number): CircleGeoJSON {
  if (radiusKm <= 0) {
    // Return empty polygon if radius is 0 or negative
    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[]],
      },
      properties: {
        radius: 0,
        center: [center.longitude, center.latitude],
      },
    };
  }

  const points = 64; // Number of points to approximate the circle
  const coordinates: [number, number][] = [];
  
  // Earth's radius in kilometers
  const earthRadiusKm = 6371;
  
  // Store first coordinate to close the polygon
  let firstCoordinate: [number, number] | null = null;
  
  for (let i = 0; i <= points; i++) {
    const angle = (i * 360) / points;
    const latRad = (center.latitude * Math.PI) / 180;
    const lngRad = (center.longitude * Math.PI) / 180;
    const angleRad = (angle * Math.PI) / 180;
    
    // Calculate point on circle using haversine formula
    const lat = Math.asin(
      Math.sin(latRad) * Math.cos(radiusKm / earthRadiusKm) +
      Math.cos(latRad) * Math.sin(radiusKm / earthRadiusKm) * Math.cos(angleRad)
    );
    
    const lng = lngRad + Math.atan2(
      Math.sin(angleRad) * Math.sin(radiusKm / earthRadiusKm) * Math.cos(latRad),
      Math.cos(radiusKm / earthRadiusKm) - Math.sin(latRad) * Math.sin(lat)
    );
    
    const coord: [number, number] = [
      (lng * 180) / Math.PI,
      (lat * 180) / Math.PI,
    ];
    
    if (i === 0) {
      firstCoordinate = coord;
    }
    
    coordinates.push(coord);
  }
  
  // Close the polygon by adding the first coordinate at the end
  if (firstCoordinate) {
    coordinates.push(firstCoordinate);
  }
  
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
    properties: {
      radius: radiusKm,
      center: [center.longitude, center.latitude],
    },
  };
}

