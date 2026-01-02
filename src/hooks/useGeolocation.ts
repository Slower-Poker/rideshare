import { useState, useEffect } from 'react';
import type { Location } from '../types';
import { getCurrentPosition, positionToLocation } from '../utils/geoUtils';
import { handleError } from '../utils/errorHandler';

/**
 * Hook to get user's current geolocation
 * Similar to PokerRide's useGeolocation pattern
 */
export function useGeolocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const position = await getCurrentPosition();
      const loc = positionToLocation(position);
      setLocation(loc);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get location';
      setError(errorMessage);
      handleError(err, 'geolocation');
    } finally {
      setLoading(false);
    }
  };

  return {
    location,
    loading,
    error,
    requestLocation,
  };
}
