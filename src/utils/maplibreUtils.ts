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
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf', // Required but not used for raster
    sprite: 'https://demotiles.maplibre.org/sprites/sprites', // Required but not used for raster
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

