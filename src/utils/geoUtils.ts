import type { Location } from '../types';

/**
 * Geo Utilities
 * Functions for GPS calculations and location handling
 */

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Format distance for display
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Get user's current position using browser geolocation API
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Convert GeolocationPosition to Location type
 */
export function positionToLocation(position: GeolocationPosition): Location {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

/**
 * Check if a location is within a certain radius of another location
 */
export function isWithinRadius(
  location1: Location,
  location2: Location,
  radiusKm: number
): boolean {
  const distance = calculateDistance(
    location1.latitude,
    location1.longitude,
    location2.latitude,
    location2.longitude
  );
  return distance <= radiusKm;
}

/**
 * Estimate travel time based on distance (rough estimate: 60 km/h average)
 */
export function estimateTravelTime(distanceKm: number): string {
  const hours = distanceKm / 60;
  const minutes = Math.round(hours * 60);
  
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}
