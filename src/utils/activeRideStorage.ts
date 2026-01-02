import type { ActiveRideData } from '../types';

/**
 * Active Ride Storage
 * 
 * CRITICAL: This is the ONLY allowed use of localStorage in the entire app.
 * Used to persist active ride information across page refreshes.
 * 
 * Similar to PokerRide's activeRideStorage.ts pattern.
 */

const ACTIVE_RIDE_KEY = 'rideshare_active_ride';

/**
 * Get active ride data from localStorage
 */
export function getActiveRide(): ActiveRideData | null {
  try {
    const stored = localStorage.getItem(ACTIVE_RIDE_KEY);
    if (!stored) return null;
    
    const data = JSON.parse(stored) as ActiveRideData;
    
    // Validate data has required fields
    if (!data.rideOfferId || !data.role) {
      if (import.meta.env.DEV) {
        console.warn('Invalid active ride data in localStorage');
      }
      clearActiveRide();
      return null;
    }
    
    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error reading active ride from localStorage:', error);
    }
    clearActiveRide();
    return null;
  }
}

/**
 * Save active ride data to localStorage
 */
export function setActiveRide(data: ActiveRideData): void {
  try {
    const dataToStore: ActiveRideData = {
      ...data,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(ACTIVE_RIDE_KEY, JSON.stringify(dataToStore));
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error saving active ride to localStorage:', error);
    }
  }
}

/**
 * Clear active ride data from localStorage
 */
export function clearActiveRide(): void {
  try {
    localStorage.removeItem(ACTIVE_RIDE_KEY);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error clearing active ride from localStorage:', error);
    }
  }
}

/**
 * Check if user has an active ride
 */
export function hasActiveRide(): boolean {
  return getActiveRide() !== null;
}
