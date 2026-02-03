import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MapPin, Clock, DollarSign, Users, Trash2, Map as MapIcon } from 'lucide-react';
import { client } from '../client';
import type { SharedProps, Location, RideRequest, RideOffer } from '../types';
import { loadMapLibre, isMapLibreLoaded, getMapLibreInstance } from '../utils/maplibreLoader';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MANITOBA_BOUNDS,
  createRasterTileStyle,
  locationToCoordinates,
  constrainToManitoba,
  calculateBounds,
} from '../utils/maplibreUtils';
import { toast } from '../utils/toast';

/**
 * MapPreview component - renders a simple visual representation of the route
 */
function MapPreviewPlaceholder({ 
  originLat, 
  originLng, 
  destLat, 
  destLng 
}: { 
  originLat: number; 
  originLng: number; 
  destLat: number; 
  destLng: number;
}) {
  // Calculate relative positions for the markers (0-100%)
  // Normalize to show direction of travel
  const minLat = Math.min(originLat, destLat);
  const maxLat = Math.max(originLat, destLat);
  const minLng = Math.min(originLng, destLng);
  const maxLng = Math.max(originLng, destLng);
  
  const latRange = maxLat - minLat || 0.01;
  const lngRange = maxLng - minLng || 0.01;
  
  // Add padding (10%)
  const padding = 15;
  const scale = 100 - padding * 2;
  
  const originX = padding + ((originLng - minLng) / lngRange) * scale;
  const originY = padding + ((maxLat - originLat) / latRange) * scale; // Flip Y axis
  const destX = padding + ((destLng - minLng) / lngRange) * scale;
  const destY = padding + ((maxLat - destLat) / latRange) * scale;
  
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      {/* Background gradient */}
      <defs>
        <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e0f2f1" />
          <stop offset="100%" stopColor="#f0f9ff" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#routeGradient)" />
      
      {/* Route line */}
      <line 
        x1={originX} 
        y1={originY} 
        x2={destX} 
        y2={destY} 
        stroke="#10b981" 
        strokeWidth="3" 
        strokeLinecap="round"
        strokeDasharray="4,2"
      />
      
      {/* Origin marker */}
      <circle cx={originX} cy={originY} r="6" fill="#10b981" stroke="white" strokeWidth="2" />
      
      {/* Destination marker */}
      <circle cx={destX} cy={destY} r="6" fill="#ef4444" stroke="white" strokeWidth="2" />
    </svg>
  );
}

/**
 * Truncate address to a reasonable length for compact display
 */
function truncateAddress(address: string | null | undefined, maxLength = 25): string {
  if (!address) return 'Location';
  if (address.length <= maxLength) return address;
  return address.slice(0, maxLength - 3) + '...';
}

// MapLibre marker types
type MapLibreMap = any;
type MapLibreMarker = any;
type MapLibreCircle = any;

interface RideRequestMarker {
  rideRequest: RideRequest;
  actualPickupLocation: Location;
  displayPickupLocation: Location; // Random position within 700m circle
  actualDropoffLocation: Location | null;
  displayDropoffLocation: Location | null; // Random position within 700m circle
  circle: MapLibreCircle | null;
  marker: MapLibreMarker | null;
  dropoffMarker: MapLibreMarker | null;
  routeSourceId: string | null;
  routeLayerId: string | null;
}

/**
 * Extract street name from full address by removing house numbers
 * Example: "345 Main Street, Winnipeg, MB" -> "Main Street, Winnipeg, MB"
 */
function extractStreetName(address: string | null | undefined): string {
  if (!address) return 'Location selected';
  
  // Remove leading numbers and spaces (e.g., "345 ", "1234 ")
  // Also handle common patterns like "345-", "123A ", etc.
  const streetName = address.replace(/^\d+[A-Za-z]?\s*[-,\s]*\s*/, '').trim();
  
  return streetName || 'Location selected';
}

/**
 * Generate a random point within a circle of given radius (in km)
 * Returns a location offset from the center
 */
function randomPointInCircle(centerLat: number, centerLng: number, radiusKm: number): Location {
  // Generate random angle (0 to 2π)
  const angle = Math.random() * 2 * Math.PI;
  
  // Generate random distance from center (0 to radius)
  // Using square root for uniform distribution
  const distance = Math.sqrt(Math.random()) * radiusKm;
  
  // Earth's radius in km
  const earthRadiusKm = 6371;
  
  // Convert to radians
  const latRad = (centerLat * Math.PI) / 180;
  const lngRad = (centerLng * Math.PI) / 180;
  const distanceRad = distance / earthRadiusKm;
  
  // Calculate new position
  const newLat = Math.asin(
    Math.sin(latRad) * Math.cos(distanceRad) +
    Math.cos(latRad) * Math.sin(distanceRad) * Math.cos(angle)
  );
  
  const newLng = lngRad + Math.atan2(
    Math.sin(angle) * Math.sin(distanceRad) * Math.cos(latRad),
    Math.cos(distanceRad) - Math.sin(latRad) * Math.sin(newLat)
  );
  
  return {
    latitude: (newLat * 180) / Math.PI,
    longitude: (newLng * 180) / Math.PI,
  };
}

type ListTab = 'requests' | 'offers';
type ViewMode = 'list' | 'map';

function formatOfferDeparture(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function FindARideMap({ setCurrentView, user }: SharedProps) {
  const [tab, setTab] = useState<ListTab>('requests');
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [rideRequests, setRideRequests] = useState<RideRequest[]>([]);
  const [rideOffers, setRideOffers] = useState<RideOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userProfileId, setUserProfileId] = useState<string | null>(null);
  const [showNotifyForm, setShowNotifyForm] = useState(false);
  const [notifyOrigin, setNotifyOrigin] = useState('');
  const [notifyDest, setNotifyDest] = useState('');
  const [savingAlert, setSavingAlert] = useState(false);
  const [deletingOfferId, setDeletingOfferId] = useState<string | null>(null);
  const [highlightedOfferId, setHighlightedOfferId] = useState<string | null>(null);
  
  // MapLibre loading states
  const [isScriptLoading, setIsScriptLoading] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [containerReady, setContainerReady] = useState(false);
  
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<RideRequestMarker[]>([]);
  const offerMarkersRef = useRef<MapLibreMarker[]>([]); // Separate ref for offer markers
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerRetryCountRef = useRef(0);
  const maxRetries = 20;
  const isMountedRef = useRef(true);
  const selectedRequestIdRef = useRef<string | null>(null);
  const routeAbortControllerRef = useRef<AbortController | null>(null);

  // Container ref setter
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setContainerReady(!!node);
  }, []);

  // Handle cancel ride request
  const handleCancelRide = useCallback(async (requestId: string, map: any) => {
    if (!user) {
      toast.error('Please sign in to cancel ride requests');
      return;
    }

    if (!confirm('Are you sure you want to cancel this ride request?')) {
      return;
    }

    try {
      const { data, errors } = await client.models.RideRequest.update({
        id: requestId,
        status: 'cancelled',
      });

      if (errors) {
        console.error('Error cancelling ride request:', errors);
        toast.error('Failed to cancel ride request. Please try again.');
        return;
      }

      if (data) {
        toast.success('Ride request cancelled successfully');
        
        // Remove marker and route from map
        const markerData = markersRef.current.find(m => m.rideRequest.id === requestId);
        if (markerData) {
          try {
            if (markerData.marker) {
              markerData.marker.remove();
            }
            if (markerData.dropoffMarker) {
              markerData.dropoffMarker.remove();
            }
            if (markerData.routeLayerId && map && map.getLayer(markerData.routeLayerId)) {
              map.removeLayer(markerData.routeLayerId);
            }
            if (markerData.routeSourceId && map && map.getSource(markerData.routeSourceId)) {
              map.removeSource(markerData.routeSourceId);
            }
          } catch (e) {
            // Ignore errors
          }
        }
        
        // Remove from markers array
        markersRef.current = markersRef.current.filter(m => m.rideRequest.id !== requestId);
        
        if (selectedRequestIdRef.current === requestId) {
          selectedRequestIdRef.current = null;
        }
        
        // Reload ride requests
        const { data: updatedRequests, errors: listErrors } = await client.models.RideRequest.list({
          filter: {
            status: { eq: 'pending' },
          },
          limit: 100,
        });

        if (!listErrors && updatedRequests) {
          const sorted = updatedRequests.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateB - dateA;
          });
          setRideRequests(sorted);
        }
      }
    } catch (err) {
      console.error('Error cancelling ride request:', err);
      toast.error('An error occurred. Please try again.');
    }
  }, [user]);

  // Handle delete ride offer
  const handleDeleteOffer = useCallback(async (offerId: string) => {
    if (!user) {
      toast.error('Please sign in to delete ride offers');
      return;
    }

    if (!confirm('Are you sure you want to delete this ride offer? This cannot be undone.')) {
      return;
    }

    setDeletingOfferId(offerId);
    try {
      const { errors } = await client.models.RideOffer.delete({ id: offerId });
      if (errors?.length) {
        console.error('Error deleting ride offer:', errors);
        toast.error('Failed to delete ride offer');
      } else {
        toast.success('Ride offer deleted');
        setRideOffers((prev) => prev.filter((o) => o.id !== offerId));
      }
    } catch (e) {
      console.error('Error deleting ride offer:', e);
      toast.error('Failed to delete ride offer');
    } finally {
      setDeletingOfferId(null);
    }
  }, [user]);

  // Handle viewing offer on map
  const handleViewOnMap = useCallback((offerId: string) => {
    setHighlightedOfferId(offerId);
    setViewMode('map');
  }, []);

  // Handle marker click to show route and dropoff
  const handleMarkerClick = useCallback((requestId: string, map: any, maplibregl: any) => {
    // Cancel any previous route request
    if (routeAbortControllerRef.current) {
      routeAbortControllerRef.current.abort();
    }

    // Find the marker data
    const markerData = markersRef.current.find(m => m.rideRequest.id === requestId);
    if (!markerData || !markerData.actualDropoffLocation || !markerData.displayDropoffLocation) {
      return;
    }

    // Type guard: ensure displayDropoffLocation is not null
    const displayDropoffLocation = markerData.displayDropoffLocation;
    if (!displayDropoffLocation) {
      return;
    }

    // Remove previous route and dropoff marker if different request
    if (selectedRequestIdRef.current && selectedRequestIdRef.current !== requestId) {
      const previousMarker = markersRef.current.find(m => m.rideRequest.id === selectedRequestIdRef.current);
      if (previousMarker) {
        try {
          if (previousMarker.dropoffMarker) {
            previousMarker.dropoffMarker.remove();
            previousMarker.dropoffMarker = null;
          }
          if (previousMarker.routeLayerId && map.getLayer(previousMarker.routeLayerId)) {
            map.removeLayer(previousMarker.routeLayerId);
          }
          if (previousMarker.routeSourceId && map.getSource(previousMarker.routeSourceId)) {
            map.removeSource(previousMarker.routeSourceId);
          }
        } catch (e) {
          // Ignore errors
        }
      }
    }

    // If clicking the same marker, toggle off
    if (selectedRequestIdRef.current === requestId) {
      try {
        if (markerData.dropoffMarker) {
          markerData.dropoffMarker.remove();
          markerData.dropoffMarker = null;
        }
        if (markerData.routeLayerId && map.getLayer(markerData.routeLayerId)) {
          map.removeLayer(markerData.routeLayerId);
        }
        if (markerData.routeSourceId && map.getSource(markerData.routeSourceId)) {
          map.removeSource(markerData.routeSourceId);
        }
        selectedRequestIdRef.current = null;
      } catch (e) {
        // Ignore errors
      }
      return;
    }

    selectedRequestIdRef.current = requestId;

    // Add dropoff marker
    const dropoffEl = document.createElement('div');
    dropoffEl.className = 'dropoff-marker';
    dropoffEl.innerHTML = `
      <div style="
        width: 32px;
        height: 32px;
        background-color: #ef4444;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 18px;
      ">D</div>
    `;

    const dropoffMarker = new maplibregl.Marker({ element: dropoffEl })
      .setLngLat(locationToCoordinates(displayDropoffLocation))
      .setPopup(
        new maplibregl.Popup({ offset: 25 })
          .setHTML(`
            <div style="text-align: left; min-width: 200px;">
              <p style="font-weight: 600; color: #ef4444; margin: 0 0 8px 0;">Dropoff</p>
              <p style="font-size: 12px; color: #666; margin: 4px 0;">${extractStreetName(markerData.actualDropoffLocation.address)}</p>
              <p style="font-size: 10px; color: #999; margin: 8px 0 0 0;">Approximate location</p>
            </div>
          `)
      )
      .addTo(map);

    markerData.dropoffMarker = dropoffMarker;

    // Fetch route from OSRM
    const abortController = new AbortController();
    routeAbortControllerRef.current = abortController;

    const pickupCoords = locationToCoordinates(markerData.displayPickupLocation);
    const dropoffCoords = locationToCoordinates(displayDropoffLocation);
    
    const coordinates = `${pickupCoords[0]},${pickupCoords[1]};${dropoffCoords[0]},${dropoffCoords[1]}`;
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;

    fetch(osrmUrl, {
      signal: abortController.signal,
      headers: {
        'User-Agent': 'RideShare.Click/1.0',
      },
    })
      .then((res) => {
        if (!isMountedRef.current || abortController.signal.aborted) {
          return null;
        }
        if (!res.ok) {
          throw new Error('Route request failed');
        }
        return res.json();
      })
      .then((data) => {
        if (!isMountedRef.current || abortController.signal.aborted || !data) {
          return;
        }

        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
          if (import.meta.env.DEV) {
            console.debug('OSRM route not found:', data);
          }
          return;
        }

        const route = data.routes[0];
        const routeGeometry = route.geometry;

        if (!isMountedRef.current || !mapRef.current || mapRef.current !== map) {
          return;
        }

        // Remove existing route if it exists
        try {
          if (map.getLayer(markerData.routeLayerId)) {
            map.removeLayer(markerData.routeLayerId);
          }
          if (map.getSource(markerData.routeSourceId)) {
            map.removeSource(markerData.routeSourceId);
          }
        } catch (error) {
          // Ignore errors
        }

        // Add route as GeoJSON source
        try {
          map.addSource(markerData.routeSourceId, {
            type: 'geojson',
            data: routeGeometry,
          });

          // Add route layer
          map.addLayer({
            id: markerData.routeLayerId,
            type: 'line',
            source: markerData.routeSourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 4,
              'line-opacity': 0.8,
            },
          });

          // Fit bounds to show both pickup and dropoff
          const bounds = calculateBounds([markerData.displayPickupLocation, displayDropoffLocation]);
          if (bounds) {
            try {
              const [[minLng, minLat], [maxLng, maxLat]] = bounds;
              map.fitBounds(
                [[minLng, minLat], [maxLng, maxLat]],
                { padding: 100, animate: true, duration: 1000 }
              );
            } catch (error) {
              // Ignore errors
            }
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.debug('Error adding route to map:', error);
          }
        }
      })
      .catch((error) => {
        if (error.name === 'AbortError') {
          return;
        }
        
        if (!isMountedRef.current) {
          return;
        }

        if (import.meta.env.DEV) {
          console.debug('Route fetch error:', error);
        }
      });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      // Cancel any pending route requests
      if (routeAbortControllerRef.current) {
        routeAbortControllerRef.current.abort();
      }
      
      // Cleanup map and markers
      if (mapRef.current) {
        try {
          const map = mapRef.current;
          // Remove all request markers, dropoff markers, and routes
          markersRef.current.forEach(({ marker, dropoffMarker, routeSourceId, routeLayerId }) => {
            try {
              if (marker) marker.remove();
              if (dropoffMarker) dropoffMarker.remove();
              
              if (routeLayerId && map.getLayer(routeLayerId)) {
                map.removeLayer(routeLayerId);
              }
              if (routeSourceId && map.getSource(routeSourceId)) {
                map.removeSource(routeSourceId);
              }
            } catch (e) {
              // Ignore errors
            }
          });
          markersRef.current = [];
          
          // Remove all offer markers
          offerMarkersRef.current.forEach((marker) => {
            try {
              if (marker) marker.remove();
            } catch (e) {
              // Ignore errors
            }
          });
          offerMarkersRef.current = [];
          
          // Remove map
          mapRef.current.remove();
          mapRef.current = null;
        } catch (error) {
          if (import.meta.env.DEV) {
            console.debug('Map cleanup error (ignored):', error);
          }
        }
      }
    };
  }, []);

  // Load user profile ID to check ownership
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) {
        setUserProfileId(null);
        return;
      }

      try {
        const { data: profiles, errors } = await client.models.UserProfile.list({
          filter: { userId: { eq: user.userId } },
          limit: 1,
        });

        if (errors) {
          if (import.meta.env.DEV) {
            console.error('Error fetching user profile:', errors);
          }
          return;
        }

        if (profiles && profiles.length > 0 && profiles[0]) {
          setUserProfileId(profiles[0].id);
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('Error loading user profile:', err);
        }
      }
    };

    loadUserProfile();
  }, [user]);

  // Load ride requests
  useEffect(() => {
    const loadRideRequests = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!client.models.RideRequest) {
          const errorMsg = 'RideRequest model not available. Please restart the Amplify sandbox.';
          setError(errorMsg);
          toast.error('Ride request feature is not available yet.');
          setLoading(false);
          return;
        }

        const { data, errors } = await client.models.RideRequest.list({
          filter: {
            status: { eq: 'pending' }, // Only show pending requests
          },
          limit: 100,
        });

        if (errors) {
          console.error('Error loading ride requests:', errors);
          setError('Failed to load ride requests');
          toast.error('Failed to load ride requests');
        } else {
          const sorted = (data || []).sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateB - dateA;
          });
          setRideRequests(sorted);
        }
      } catch (err) {
        console.error('Error loading ride requests:', err);
        setError('An error occurred while loading ride requests');
        toast.error('Failed to load ride requests');
      } finally {
        setLoading(false);
      }
    };

    loadRideRequests();
  }, []);

  // Load ride offers when tab is offers
  useEffect(() => {
    if (tab !== 'offers') return;
    let cancelled = false;
    async function loadOffers() {
      setLoadingOffers(true);
      try {
        // @ts-expect-error TS2590 - Amplify list return type is too complex
        const raw: { data?: RideOffer[]; errors?: unknown[] } = await client.models.RideOffer.list({
          filter: { status: { eq: 'available' } },
          limit: 50,
        });
        const data = raw.data;
        const errors = raw.errors;
        if (cancelled) return;
        if (errors?.length) {
          if (import.meta.env.DEV) console.error('Error loading ride offers:', errors);
          setRideOffers([]);
        } else {
          const sorted = (data || []).sort((a, b) => {
            const tA = new Date(a.departureTime ?? 0).getTime();
            const tB = new Date(b.departureTime ?? 0).getTime();
            return tA - tB;
          });
          setRideOffers(sorted as RideOffer[]);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error loading ride offers:', err);
        if (!cancelled) setRideOffers([]);
      } finally {
        if (!cancelled) setLoadingOffers(false);
      }
    }
    loadOffers();
    return () => { cancelled = true; };
  }, [tab]);

  // Validate container dimensions
  const validateContainerDimensions = (): boolean => {
    if (!containerRef.current) {
      return false;
    }
    
    const width = containerRef.current.offsetWidth;
    const height = containerRef.current.offsetHeight;
    
    if (width === 0 || height === 0) {
      return false;
    }
    
    return true;
  };

  // Initialize map with retry logic
  const initializeMap = useCallback(async (maplibregl: any) => {
    if (!isMountedRef.current || !containerRef.current || mapRef.current) {
      return;
    }

    // Validate container dimensions
    if (!validateContainerDimensions()) {
      containerRetryCountRef.current++;
      
      if (containerRetryCountRef.current < maxRetries) {
        const delay = Math.min(200 * Math.pow(2, containerRetryCountRef.current - 1), 2000);
        setTimeout(() => {
          if (isMountedRef.current) {
            initializeMap(maplibregl);
          }
        }, delay);
      } else {
        const errorMsg = 'Map container has no dimensions. Please refresh the page.';
        setMapError(errorMsg);
        console.error(errorMsg);
      }
      return;
    }

    try {
      const style = createRasterTileStyle('osm');
      
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: style,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        minZoom: 7,
        maxZoom: 18,
        maxBounds: MANITOBA_BOUNDS,
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');

      map.on('load', () => {
        if (!isMountedRef.current || mapRef.current !== map) {
          return;
        }
        
        setIsMapLoaded(true);
        mapRef.current = map;
        
        setTimeout(() => {
          if (isMountedRef.current && mapRef.current === map) {
            map.resize();
          }
        }, 100);
      });

      map.on('error', (e: any) => {
        console.error('Map error:', e);
        if (e.error && e.error.message) {
          setMapError(`Map error: ${e.error.message}`);
        }
      });

      // Enforce bounds on move
      let isEnforcingBounds = false;
      map.on('moveend', () => {
        if (isEnforcingBounds || !isMountedRef.current || mapRef.current !== map) {
          return;
        }
        
        const center = map.getCenter();
        const tolerance = 0.1;
        const isOutside = 
          center.lat < MANITOBA_BOUNDS[1] - tolerance ||
          center.lat > MANITOBA_BOUNDS[3] + tolerance ||
          center.lng < MANITOBA_BOUNDS[0] - tolerance ||
          center.lng > MANITOBA_BOUNDS[2] + tolerance;
        
        if (isOutside) {
          isEnforcingBounds = true;
          const [lng, lat] = constrainToManitoba(center.lat, center.lng);
          map.setCenter([lng, lat]);
          setTimeout(() => {
            isEnforcingBounds = false;
          }, 100);
        }
      });

      mapRef.current = map;
    } catch (error) {
      console.error('Map initialization error:', error);
      setMapError('Failed to initialize map. Please refresh the page.');
    }
  }, []);

  // Load MapLibre script
  useEffect(() => {
    if (isScriptLoading || isMapLibreLoaded()) {
      return;
    }

    setIsScriptLoading(true);
    setMapError(null);

    loadMapLibre({
      onLoad: (maplibregl) => {
        if (!isMountedRef.current) {
          return;
        }
        setIsScriptLoading(false);
        initializeMap(maplibregl);
      },
      onError: (error) => {
        if (!isMountedRef.current) {
          return;
        }
        setIsScriptLoading(false);
        const errorMsg = `Failed to load map library: ${error.message}. Please refresh the page.`;
        setMapError(errorMsg);
        console.error('MapLibre load error:', error);
      },
    });
  }, [isScriptLoading, initializeMap]);

  // Initialize map when script is loaded and container is ready
  useEffect(() => {
    if (!isMapLibreLoaded() || !containerReady || mapRef.current || isScriptLoading) {
      return;
    }

    const maplibregl = getMapLibreInstance();
    if (maplibregl) {
      initializeMap(maplibregl);
    }
  }, [isMapLibreLoaded, containerReady, isScriptLoading, initializeMap]);

  // Update markers when ride requests change
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || rideRequests.length === 0) {
      return;
    }

    const map = mapRef.current;
    const maplibregl = getMapLibreInstance();
    if (!maplibregl) {
      return;
    }

      // Remove existing markers, dropoff markers, and routes
      markersRef.current.forEach(({ marker, dropoffMarker, routeSourceId, routeLayerId }) => {
        try {
          if (marker) marker.remove();
          if (dropoffMarker) dropoffMarker.remove();
          
          // Remove route layers
          if (routeLayerId && map.getLayer(routeLayerId)) {
            map.removeLayer(routeLayerId);
          }
          if (routeSourceId && map.getSource(routeSourceId)) {
            map.removeSource(routeSourceId);
          }
        } catch (e) {
          // Ignore errors
        }
      });
      markersRef.current = [];
      selectedRequestIdRef.current = null;

    // Debounce marker updates
    const updateTimeout = setTimeout(() => {
      if (!isMountedRef.current || !mapRef.current || mapRef.current !== map) {
        return;
      }

      const RADIUS_KM = 0.7; // 700 meters = 0.7 km

      rideRequests.forEach((rideRequest) => {
        if (!rideRequest.pickupLatitude || !rideRequest.pickupLongitude) {
          return;
        }

        const actualPickupLocation: Location = {
          latitude: rideRequest.pickupLatitude,
          longitude: rideRequest.pickupLongitude,
          address: rideRequest.pickupAddress || undefined,
        };

        // Generate random position within 700m circle for pickup
        const displayPickupLocation = randomPointInCircle(
          actualPickupLocation.latitude,
          actualPickupLocation.longitude,
          RADIUS_KM
        );

        // Get dropoff location if available
        let actualDropoffLocation: Location | null = null;
        let displayDropoffLocation: Location | null = null;
        
        if (rideRequest.dropoffLatitude && rideRequest.dropoffLongitude) {
          actualDropoffLocation = {
            latitude: rideRequest.dropoffLatitude,
            longitude: rideRequest.dropoffLongitude,
            address: rideRequest.dropoffAddress || undefined,
          };
          
          // Generate random position within 700m circle for dropoff
          displayDropoffLocation = randomPointInCircle(
            actualDropoffLocation.latitude,
            actualDropoffLocation.longitude,
            RADIUS_KM
          );
        }

        // Extract street names (without house numbers) for display
        const pickupStreetName = extractStreetName(actualPickupLocation.address);
        const dropoffStreetName = actualDropoffLocation 
          ? extractStreetName(actualDropoffLocation.address)
          : null;

        try {
          // Create marker at random position within 700m circle
          const el = document.createElement('div');
          el.className = 'ride-request-marker';
          el.innerHTML = `
            <div style="
              width: 32px;
              height: 32px;
              background-color: #3b82f6;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 18px;
              cursor: pointer;
            ">B</div>
          `;

          const routeSourceId = `route-${rideRequest.id}`;
          const routeLayerId = `route-layer-${rideRequest.id}`;
          
          // Check if current user is the requester
          const isOwner = userProfileId && rideRequest.requesterId === userProfileId;

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(locationToCoordinates(displayPickupLocation))
            .setPopup(
              new maplibregl.Popup({ offset: 25, closeOnClick: false })
                .setHTML(`
                  <div style="text-align: left; min-width: 200px;">
                    <p style="font-weight: 600; color: #3b82f6; margin: 0 0 8px 0;">Ride Request</p>
                    <p style="font-size: 12px; color: #666; margin: 4px 0;"><strong>Pickup:</strong> ${pickupStreetName}</p>
                    ${dropoffStreetName ? `<p style="font-size: 12px; color: #666; margin: 4px 0;"><strong>Dropoff:</strong> ${dropoffStreetName}</p>` : ''}
                    <p style="font-size: 12px; color: #666; margin: 4px 0;"><strong>Seats:</strong> ${rideRequest.numberOfSeats}</p>
                    <p style="font-size: 12px; color: #666; margin: 4px 0;"><strong>Max:</strong> $${rideRequest.maximumAmount?.toFixed(2)} CAD</p>
                    <p style="font-size: 10px; color: #999; margin: 8px 0 0 0;">Click marker to see route</p>
                    ${isOwner ? `
                      <button 
                        id="cancel-ride-${rideRequest.id}" 
                        style="
                          width: 100%;
                          margin-top: 12px;
                          padding: 8px 16px;
                          background-color: #ef4444;
                          color: white;
                          border: none;
                          border-radius: 6px;
                          font-weight: 600;
                          font-size: 14px;
                          cursor: pointer;
                          transition: background-color 0.2s;
                        "
                        onmouseover="this.style.backgroundColor='#dc2626'"
                        onmouseout="this.style.backgroundColor='#ef4444'"
                      >
                        Cancel Ride
                      </button>
                    ` : ''}
                  </div>
                `)
            )
            .addTo(map);
          
          // Add click handler for cancel button if user is owner
          if (isOwner) {
            // Wait for popup to be added, then attach event listener
            marker.getPopup().once('open', () => {
              const cancelButton = document.getElementById(`cancel-ride-${rideRequest.id}`);
              if (cancelButton) {
                cancelButton.addEventListener('click', (e) => {
                  e.stopPropagation();
                  handleCancelRide(rideRequest.id, map);
                });
              }
            });
          }

          // Handle marker click to show route
          marker.getElement().addEventListener('click', () => {
            handleMarkerClick(rideRequest.id, map, maplibregl);
          });

          markersRef.current.push({
            rideRequest,
            actualPickupLocation,
            displayPickupLocation,
            actualDropoffLocation,
            displayDropoffLocation,
            circle: null,
            marker,
            dropoffMarker: null,
            routeSourceId,
            routeLayerId,
          });
        } catch (error) {
          if (import.meta.env.DEV) {
            console.debug('Error adding marker:', error);
          }
        }
      });

      // Fit bounds to show all markers
      const allLocations = markersRef.current
        .map(m => [m.actualPickupLocation, m.actualDropoffLocation])
        .flat()
        .filter((loc): loc is Location => loc !== null);
      if (allLocations.length > 0) {
        const bounds = calculateBounds(allLocations);
        if (bounds) {
          try {
            const [[minLng, minLat], [maxLng, maxLat]] = bounds;
            const constrainedMinLng = Math.max(MANITOBA_BOUNDS[0], minLng);
            const constrainedMinLat = Math.max(MANITOBA_BOUNDS[1], minLat);
            const constrainedMaxLng = Math.min(MANITOBA_BOUNDS[2], maxLng);
            const constrainedMaxLat = Math.min(MANITOBA_BOUNDS[3], maxLat);
            
            if (constrainedMinLng < constrainedMaxLng && constrainedMinLat < constrainedMaxLat) {
              map.fitBounds(
                [[constrainedMinLng, constrainedMinLat], [constrainedMaxLng, constrainedMaxLat]],
                { padding: 50, animate: false }
              );
            }
          } catch (error) {
            if (import.meta.env.DEV) {
              console.debug('Error fitting map bounds:', error);
            }
          }
        }
      }
    }, 150);

    return () => {
      clearTimeout(updateTimeout);
    };
  }, [rideRequests, isMapLoaded]);

  // Update offer markers when ride offers change and tab is offers
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || tab !== 'offers') {
      // Clear offer markers when switching away from offers tab
      offerMarkersRef.current.forEach((marker) => {
        try {
          if (marker) marker.remove();
        } catch (e) {
          // Ignore errors
        }
      });
      offerMarkersRef.current = [];
      return;
    }

    const map = mapRef.current;
    const maplibregl = getMapLibreInstance();
    if (!maplibregl) {
      return;
    }

    // Remove existing offer markers and route layers
    offerMarkersRef.current.forEach((marker) => {
      try {
        if (marker) marker.remove();
      } catch (e) {
        // Ignore errors
      }
    });
    offerMarkersRef.current = [];
    
    // Clean up any existing offer route layers
    rideOffers.forEach((offer) => {
      if (!offer.id) return;
      const routeId = `offer-route-${offer.id}`;
      const layerId = `offer-route-layer-${offer.id}`;
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(routeId)) map.removeSource(routeId);
      } catch (e) { /* ignore */ }
    });

    // Also clear request markers when viewing offers
    markersRef.current.forEach(({ marker, dropoffMarker, routeSourceId, routeLayerId }) => {
      try {
        if (marker) marker.remove();
        if (dropoffMarker) dropoffMarker.remove();
        if (routeLayerId && map.getLayer(routeLayerId)) {
          map.removeLayer(routeLayerId);
        }
        if (routeSourceId && map.getSource(routeSourceId)) {
          map.removeSource(routeSourceId);
        }
      } catch (e) {
        // Ignore errors
      }
    });
    markersRef.current = [];

    if (rideOffers.length === 0) {
      return;
    }

    // Debounce marker updates
    const updateTimeout = setTimeout(() => {
      if (!isMountedRef.current || !mapRef.current || mapRef.current !== map) {
        return;
      }

      const allLocations: Location[] = [];

      // Track if we need to focus on a highlighted offer
      let highlightedOfferLocation: { origin: Location; destination: Location | null } | null = null;

      rideOffers.forEach((offer) => {
        if (!offer.originLatitude || !offer.originLongitude) {
          return;
        }

        const originLocation: Location = {
          latitude: offer.originLatitude,
          longitude: offer.originLongitude,
          address: offer.originAddress || offer.originRegion || undefined,
        };

        allLocations.push(originLocation);

        // Also add destination for bounds calculation
        let destinationLocation: Location | null = null;
        if (offer.destinationLatitude && offer.destinationLongitude) {
          destinationLocation = {
            latitude: offer.destinationLatitude,
            longitude: offer.destinationLongitude,
            address: offer.destinationAddress || offer.destinationRegion || undefined,
          };
          allLocations.push(destinationLocation);
        }

        // Track highlighted offer for focusing
        if (highlightedOfferId && offer.id === highlightedOfferId) {
          highlightedOfferLocation = { origin: originLocation, destination: destinationLocation };
        }

        const isOwner = userProfileId && offer.hostId === userProfileId;
        const seatsLeft = (offer.availableSeats ?? 0) - (offer.seatsBooked ?? 0);
        const hasJoinCode = Boolean(offer.joinCode?.trim());
        const isHighlighted = highlightedOfferId === offer.id;

        try {
          // Create marker at origin - larger and highlighted if selected
          const el = document.createElement('div');
          el.className = 'ride-offer-marker';
          el.innerHTML = `
            <div style="
              width: ${isHighlighted ? '40px' : '32px'};
              height: ${isHighlighted ? '40px' : '32px'};
              background-color: #10b981;
              border: ${isHighlighted ? '4px solid #059669' : '3px solid white'};
              border-radius: 50%;
              box-shadow: ${isHighlighted ? '0 4px 12px rgba(16,185,129,0.5)' : '0 2px 4px rgba(0,0,0,0.3)'};
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: ${isHighlighted ? '20px' : '18px'};
              cursor: pointer;
              transition: all 0.2s ease;
            ">O</div>
          `;

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(locationToCoordinates(originLocation))
            .setPopup(
              new maplibregl.Popup({ offset: 25, closeOnClick: false })
                .setHTML(`
                  <div style="text-align: left; min-width: 220px;">
                    <p style="font-weight: 600; color: #10b981; margin: 0 0 8px 0;">Ride Offer ${isOwner ? '<span style="background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:4px;font-size:11px;margin-left:4px;">Your offer</span>' : ''}</p>
                    <p style="font-size: 12px; color: #666; margin: 4px 0;"><strong>From:</strong> ${offer.originAddress || offer.originRegion || 'Origin'}</p>
                    <p style="font-size: 12px; color: #666; margin: 4px 0;"><strong>To:</strong> ${offer.destinationAddress || offer.destinationRegion || 'Destination'}</p>
                    <p style="font-size: 12px; color: #666; margin: 4px 0;"><strong>When:</strong> ${formatOfferDeparture(offer.departureTime)}</p>
                    <p style="font-size: 12px; color: #666; margin: 4px 0;"><strong>Price:</strong> $${offer.price} CAD</p>
                    <p style="font-size: 12px; color: #666; margin: 4px 0;"><strong>Seats:</strong> ${seatsLeft} available</p>
                    ${hasJoinCode ? `
                      <a 
                        href="/join/${offer.joinCode}" 
                        style="
                          display: block;
                          width: 100%;
                          margin-top: 12px;
                          padding: 8px 16px;
                          background-color: ${isOwner ? '#d1fae5' : '#10b981'};
                          color: ${isOwner ? '#065f46' : 'white'};
                          border: none;
                          border-radius: 6px;
                          font-weight: 600;
                          font-size: 14px;
                          text-align: center;
                          text-decoration: none;
                          cursor: pointer;
                        "
                      >
                        ${isOwner ? 'View & share' : 'Request to join'}
                      </a>
                    ` : ''}
                  </div>
                `)
            )
            .addTo(map);

          offerMarkersRef.current.push(marker);

          // If this offer is highlighted, add destination marker and route line
          if (isHighlighted && destinationLocation) {
            // Create destination marker
            const destEl = document.createElement('div');
            destEl.className = 'ride-offer-destination-marker';
            destEl.innerHTML = `
              <div style="
                width: 36px;
                height: 36px;
                background-color: #ef4444;
                border: 4px solid #dc2626;
                border-radius: 50%;
                box-shadow: 0 4px 12px rgba(239,68,68,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 16px;
              ">D</div>
            `;

            const destMarker = new maplibregl.Marker({ element: destEl })
              .setLngLat(locationToCoordinates(destinationLocation))
              .setPopup(
                new maplibregl.Popup({ offset: 25 })
                  .setHTML(`
                    <div style="text-align: left; min-width: 180px;">
                      <p style="font-weight: 600; color: #ef4444; margin: 0 0 4px 0;">Destination</p>
                      <p style="font-size: 12px; color: #666; margin: 0;">${destinationLocation.address || 'Destination'}</p>
                    </div>
                  `)
              )
              .addTo(map);

            offerMarkersRef.current.push(destMarker);

            // Fetch and display route between origin and destination
            const pickupCoords = locationToCoordinates(originLocation);
            const dropoffCoords = locationToCoordinates(destinationLocation);
            const coordinates = `${pickupCoords[0]},${pickupCoords[1]};${dropoffCoords[0]},${dropoffCoords[1]}`;
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;

            fetch(osrmUrl, {
              headers: { 'User-Agent': 'RideShare.Click/1.0' },
            })
              .then((res) => res.ok ? res.json() : null)
              .then((data) => {
                if (!data || data.code !== 'Ok' || !data.routes?.[0]?.geometry) return;
                if (!isMountedRef.current || !mapRef.current) return;

                const routeId = `offer-route-${offer.id}`;
                const layerId = `offer-route-layer-${offer.id}`;

                // Remove existing route if any
                try {
                  if (map.getLayer(layerId)) map.removeLayer(layerId);
                  if (map.getSource(routeId)) map.removeSource(routeId);
                } catch (e) { /* ignore */ }

                // Add route
                try {
                  map.addSource(routeId, {
                    type: 'geojson',
                    data: data.routes[0].geometry,
                  });
                  map.addLayer({
                    id: layerId,
                    type: 'line',
                    source: routeId,
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: {
                      'line-color': '#10b981',
                      'line-width': 5,
                      'line-opacity': 0.8,
                    },
                  });
                } catch (e) {
                  if (import.meta.env.DEV) console.debug('Error adding offer route:', e);
                }
              })
              .catch(() => { /* ignore route errors */ });
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.debug('Error adding offer marker:', error);
          }
        }
      });

      // If we have a highlighted offer, fit bounds to show just that route
      // Otherwise show all offer markers
      if (highlightedOfferLocation) {
        const focusLocations = [highlightedOfferLocation.origin];
        if (highlightedOfferLocation.destination) {
          focusLocations.push(highlightedOfferLocation.destination);
        }
        const bounds = calculateBounds(focusLocations);
        if (bounds) {
          try {
            const [[minLng, minLat], [maxLng, maxLat]] = bounds;
            const constrainedMinLng = Math.max(MANITOBA_BOUNDS[0], minLng);
            const constrainedMinLat = Math.max(MANITOBA_BOUNDS[1], minLat);
            const constrainedMaxLng = Math.min(MANITOBA_BOUNDS[2], maxLng);
            const constrainedMaxLat = Math.min(MANITOBA_BOUNDS[3], maxLat);
            
            if (constrainedMinLng < constrainedMaxLng && constrainedMinLat < constrainedMaxLat) {
              map.fitBounds(
                [[constrainedMinLng, constrainedMinLat], [constrainedMaxLng, constrainedMaxLat]],
                { padding: 80, animate: true, duration: 500 }
              );
            }
          } catch (error) {
            if (import.meta.env.DEV) {
              console.debug('Error fitting map bounds:', error);
            }
          }
        }
        // Clear the highlight after focusing (so future map views show all)
        setTimeout(() => {
          if (isMountedRef.current) {
            setHighlightedOfferId(null);
          }
        }, 2000);
      } else if (allLocations.length > 0) {
        const bounds = calculateBounds(allLocations);
        if (bounds) {
          try {
            const [[minLng, minLat], [maxLng, maxLat]] = bounds;
            const constrainedMinLng = Math.max(MANITOBA_BOUNDS[0], minLng);
            const constrainedMinLat = Math.max(MANITOBA_BOUNDS[1], minLat);
            const constrainedMaxLng = Math.min(MANITOBA_BOUNDS[2], maxLng);
            const constrainedMaxLat = Math.min(MANITOBA_BOUNDS[3], maxLat);
            
            if (constrainedMinLng < constrainedMaxLng && constrainedMinLat < constrainedMaxLat) {
              map.fitBounds(
                [[constrainedMinLng, constrainedMinLat], [constrainedMaxLng, constrainedMaxLat]],
                { padding: 50, animate: false }
              );
            }
          } catch (error) {
            if (import.meta.env.DEV) {
              console.debug('Error fitting map bounds:', error);
            }
          }
        }
      }
    }, 150);

    return () => {
      clearTimeout(updateTimeout);
    };
  }, [rideOffers, isMapLoaded, tab, userProfileId, highlightedOfferId]);

  // Clear request markers when switching to offers tab
  useEffect(() => {
    if (tab === 'offers' && mapRef.current) {
      const map = mapRef.current;
      markersRef.current.forEach(({ marker, dropoffMarker, routeSourceId, routeLayerId }) => {
        try {
          if (marker) marker.remove();
          if (dropoffMarker) dropoffMarker.remove();
          if (routeLayerId && map.getLayer(routeLayerId)) {
            map.removeLayer(routeLayerId);
          }
          if (routeSourceId && map.getSource(routeSourceId)) {
            map.removeSource(routeSourceId);
          }
        } catch (e) {
          // Ignore errors
        }
      });
      markersRef.current = [];
      selectedRequestIdRef.current = null;
    }
  }, [tab]);

  // Clear offer markers when switching to requests tab
  useEffect(() => {
    if (tab === 'requests') {
      const map = mapRef.current;
      offerMarkersRef.current.forEach((marker) => {
        try {
          if (marker) marker.remove();
        } catch (e) {
          // Ignore errors
        }
      });
      offerMarkersRef.current = [];
      
      // Clean up any offer route layers
      if (map) {
        rideOffers.forEach((offer) => {
          if (!offer.id) return;
          const routeId = `offer-route-${offer.id}`;
          const layerId = `offer-route-layer-${offer.id}`;
          try {
            if (map.getLayer(layerId)) map.removeLayer(layerId);
            if (map.getSource(routeId)) map.removeSource(routeId);
          } catch (e) { /* ignore */ }
        });
      }
      
      // Clear highlighted offer
      setHighlightedOfferId(null);
    }
  }, [tab, rideOffers]);

  // Resize map when switching to map view (container may have been hidden)
  useEffect(() => {
    if (viewMode === 'map' && mapRef.current) {
      // Use multiple resize attempts to ensure the container has proper dimensions
      const resizeMap = () => {
        if (mapRef.current && isMountedRef.current) {
          try {
            mapRef.current.resize();
          } catch (e) {
            // Ignore errors
          }
        }
      };
      
      // Immediate resize
      resizeMap();
      // Resize after a short delay (for CSS transitions)
      const timer1 = setTimeout(resizeMap, 50);
      const timer2 = setTimeout(resizeMap, 150);
      const timer3 = setTimeout(resizeMap, 300);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [viewMode]);

  return (
    <main id="main-content" className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-100">
            <button
              type="button"
              onClick={() => setTab('requests')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'requests' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
              aria-pressed={tab === 'requests'}
            >
              Requests
            </button>
            <button
              type="button"
              onClick={() => setTab('offers')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'offers' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
              aria-pressed={tab === 'offers'}
            >
              Offers
            </button>
          </div>
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-100">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
              aria-pressed={viewMode === 'list'}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'map' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
              aria-pressed={viewMode === 'map'}
            >
              Map
            </button>
          </div>
          <div className="ml-auto text-sm text-gray-600">
            {tab === 'requests' ? (
              <span>{rideRequests.length} request{rideRequests.length !== 1 ? 's' : ''} available</span>
            ) : (
              <span>{rideOffers.length} offer{rideOffers.length !== 1 ? 's' : ''} available</span>
            )}
          </div>
        </div>
      </header>

      {/* Ride offers list (when tab is offers and viewMode is list) */}
      {tab === 'offers' && viewMode === 'list' && (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          {user && (
            <div className="max-w-3xl mx-auto mb-4">
              {!showNotifyForm ? (
                <button
                  type="button"
                  onClick={() => setShowNotifyForm(true)}
                  className="text-sm text-primary-600 hover:underline"
                >
                  Notify me when a ride matches my route
                </button>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Notify me when a ride matches</h3>
                  <div className="flex flex-col sm:flex-row gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="From (e.g. Winnipeg)"
                      value={notifyOrigin}
                      onChange={(e) => setNotifyOrigin(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      placeholder="To (e.g. Brandon)"
                      value={notifyDest}
                      onChange={(e) => setNotifyDest(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!user) return;
                        setSavingAlert(true);
                        try {
                          const profileRes = (await client.models.UserProfile.list({
                            filter: { userId: { eq: user.userId } },
                            limit: 1,
                          })) as { data?: { id: string }[] };
                          const profile = profileRes.data?.[0];
                          if (!profile?.id) {
                            toast.error('Profile not found.');
                            setSavingAlert(false);
                            return;
                          }
                          const model = client.models.RideAlert;
                          if (!model) {
                            toast.error('Alerts not available yet.');
                            setSavingAlert(false);
                            return;
                          }
                          const alertPayload = {
                            userProfileId: profile.id,
                            originRegion: notifyOrigin || undefined,
                            destinationRegion: notifyDest || undefined,
                            notify: true,
                            createdAt: new Date().toISOString(),
                          };
                          // @ts-expect-error TS2590 - Amplify create return type is too complex
                          await model.create(alertPayload);
                          toast.success('You’ll be notified when a matching ride is posted.');
                          setShowNotifyForm(false);
                          setNotifyOrigin('');
                          setNotifyDest('');
                        } catch (e) {
                          if (import.meta.env.DEV) console.error('Create alert:', e);
                          toast.error('Failed to save alert.');
                        } finally {
                          setSavingAlert(false);
                        }
                      }}
                      disabled={savingAlert}
                      className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      {savingAlert ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowNotifyForm(false); setNotifyOrigin(''); setNotifyDest(''); }}
                      className="px-3 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {loadingOffers ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
          ) : rideOffers.length === 0 ? (
            <div className="max-w-md mx-auto text-center py-12 bg-white rounded-lg shadow p-6">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-700 mb-2">No ride offers yet</h2>
              <p className="text-gray-600 mb-6">Be the first to offer a ride and share the link with others.</p>
              <button
                onClick={() => user ? setCurrentView('offerRide') : setCurrentView('account')}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                {user ? 'Offer a ride' : 'Sign in to offer a ride'}
              </button>
            </div>
          ) : (
            <ul className="space-y-2 max-w-3xl mx-auto" role="list">
              {rideOffers.map((offer) => {
                const seatsLeft = (offer.availableSeats ?? 0) - (offer.seatsBooked ?? 0);
                const hasJoinCode = Boolean(offer.joinCode?.trim());
                const isOwner = userProfileId && offer.hostId === userProfileId;
                const hasCoordinates = offer.originLatitude && offer.originLongitude && 
                                       offer.destinationLatitude && offer.destinationLongitude;
                
                return (
                  <li key={offer.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="flex">
                      {/* Map Preview Thumbnail */}
                      <button
                        type="button"
                        onClick={() => offer.id && handleViewOnMap(offer.id)}
                        className="w-20 sm:w-24 h-16 sm:h-20 flex-shrink-0 bg-gray-50 relative group hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset rounded-l-lg overflow-hidden"
                        aria-label={`View route on map: ${offer.originAddress || 'Origin'} to ${offer.destinationAddress || 'Destination'}`}
                      >
                        {hasCoordinates ? (
                          <MapPreviewPlaceholder
                            originLat={offer.originLatitude!}
                            originLng={offer.originLongitude!}
                            destLat={offer.destinationLatitude!}
                            destLng={offer.destinationLongitude!}
                          />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                            <MapIcon className="w-6 h-6" />
                          </div>
                        )}
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-primary-600 bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                          <div className="bg-white bg-opacity-90 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                            <MapIcon className="w-4 h-4 text-primary-600" />
                          </div>
                        </div>
                      </button>

                      {/* Ride Info - Compact */}
                      <div className="flex-1 p-3 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {/* Route with truncation */}
                            <div className="flex items-center gap-1 text-sm font-medium text-gray-900">
                              <span className="truncate" title={offer.originAddress || offer.originRegion || 'Origin'}>
                                {truncateAddress(offer.originAddress || offer.originRegion, 20)}
                              </span>
                              <span className="text-gray-400 flex-shrink-0">→</span>
                              <span className="truncate" title={offer.destinationAddress || offer.destinationRegion || 'Destination'}>
                                {truncateAddress(offer.destinationAddress || offer.destinationRegion, 20)}
                              </span>
                              {isOwner && (
                                <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-100 text-primary-700 flex-shrink-0">
                                  Yours
                                </span>
                              )}
                            </div>
                            
                            {/* Key details on one line */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                              <span className="flex items-center gap-0.5">
                                <Clock className="w-3.5 h-3.5" />
                                {formatOfferDeparture(offer.departureTime)}
                              </span>
                              <span className="flex items-center gap-0.5 font-medium text-gray-700">
                                <DollarSign className="w-3.5 h-3.5" />
                                {offer.price}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Users className="w-3.5 h-3.5" />
                                {seatsLeft} seat{seatsLeft !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>

                          {/* Actions - Compact */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {isOwner ? (
                              <>
                                {hasJoinCode && (
                                  <Link
                                    to={`/join/${offer.joinCode}`}
                                    className="px-2.5 py-1.5 bg-primary-50 text-primary-700 text-xs font-medium rounded-md hover:bg-primary-100 transition-colors"
                                  >
                                    Share
                                  </Link>
                                )}
                                <button
                                  type="button"
                                  onClick={() => offer.id && handleDeleteOffer(offer.id)}
                                  disabled={deletingOfferId === offer.id}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                                  aria-label="Delete this ride offer"
                                >
                                  {deletingOfferId === offer.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </button>
                              </>
                            ) : hasJoinCode ? (
                              <Link
                                to={`/join/${offer.joinCode}`}
                                className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-md hover:bg-primary-700 transition-colors"
                              >
                                Join
                              </Link>
                            ) : (
                              <span className="px-2 py-1 bg-gray-100 text-gray-400 text-xs rounded-md">
                                N/A
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Requests List View (when tab is requests and viewMode is list) */}
      {tab === 'requests' && viewMode === 'list' && (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
          ) : error ? (
            <div className="max-w-md mx-auto text-center py-12 bg-white rounded-lg shadow p-6">
              <p className="text-red-600 font-semibold mb-2">Error</p>
              <p className="text-gray-700 text-sm mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Reload Page
              </button>
            </div>
          ) : rideRequests.length === 0 ? (
            <div className="max-w-md mx-auto text-center py-12 bg-white rounded-lg shadow p-6">
              <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-700 mb-2">No ride requests yet</h2>
              <p className="text-gray-600 mb-6">
                Be the first to request a ride, or offer a seat to others.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setCurrentView('bookRide')}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  Request a ride
                </button>
                <button
                  onClick={() => user ? setCurrentView('offerRide') : setCurrentView('account')}
                  className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  {user ? 'Offer a ride' : 'Sign in to offer a ride'}
                </button>
              </div>
            </div>
          ) : (
            <ul className="space-y-3 max-w-3xl mx-auto" role="list">
              {rideRequests.map((request) => {
                const isOwner = userProfileId && request.requesterId === userProfileId;
                return (
                  <li key={request.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-900 truncate">
                              {extractStreetName(request.pickupAddress)} → {extractStreetName(request.dropoffAddress)}
                            </p>
                            {isOwner && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700 shrink-0">
                                Your request
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {request.numberOfSeats} seat{request.numberOfSeats !== 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              Max ${request.maximumAmount?.toFixed(2)} CAD
                            </span>
                            {request.preferredTime && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {new Date(request.preferredTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                              </span>
                            )}
                          </div>
                          {request.notes && (
                            <p className="text-sm text-gray-500 mt-2 italic">{request.notes}</p>
                          )}
                        </div>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => request.id && handleCancelRide(request.id, mapRef.current)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                            aria-label="Cancel this ride request"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      {!isOwner && user && (
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => setCurrentView('offerRide')}
                            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                          >
                            Offer a ride
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            )}
        </div>
      )}

      {/* Map Container (when viewMode is map) */}
      {viewMode === 'map' && (
      <div className="flex-1 relative bg-white min-h-[600px] overflow-hidden" style={{ position: 'relative', isolation: 'isolate' }}>
        {/* Loading State */}
        {((!isMapLoaded || isScriptLoading) && !mapError) && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-20 pointer-events-none">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Loading map...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {mapError && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-20">
            <div className="text-center p-6 bg-white rounded-lg shadow-lg max-w-md">
              <p className="text-red-600 font-semibold mb-2">Map Error</p>
              <p className="text-gray-700 text-sm mb-4">{mapError}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        )}

        {/* Data Loading State - Requests */}
        {tab === 'requests' && loading && (
          <div className="absolute inset-0 bg-gray-100 bg-opacity-50 flex items-center justify-center z-30 pointer-events-none">
            <div className="text-center bg-white rounded-lg shadow-lg p-6">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Loading ride requests...</p>
            </div>
          </div>
        )}

        {/* Data Loading State - Offers */}
        {tab === 'offers' && loadingOffers && (
          <div className="absolute inset-0 bg-gray-100 bg-opacity-50 flex items-center justify-center z-30 pointer-events-none">
            <div className="text-center bg-white rounded-lg shadow-lg p-6">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Loading ride offers...</p>
            </div>
          </div>
        )}

        {/* Empty State - Requests */}
        {tab === 'requests' && !loading && !error && rideRequests.length === 0 && viewMode === 'map' && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-20">
            <div className="text-center p-6 bg-white rounded-lg shadow-lg max-w-md">
              <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-700 mb-2">No ride requests yet</h2>
              <p className="text-gray-600 mb-6">
                Be the first to request a ride, or offer a seat to others.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setCurrentView('bookRide')}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  Request a ride
                </button>
                <button
                  onClick={() => user ? setCurrentView('offerRide') : setCurrentView('account')}
                  className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  {user ? 'Offer a ride' : 'Sign in to offer a ride'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State - Offers */}
        {tab === 'offers' && !loadingOffers && rideOffers.length === 0 && viewMode === 'map' && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-20">
            <div className="text-center p-6 bg-white rounded-lg shadow-lg max-w-md">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-700 mb-2">No ride offers yet</h2>
              <p className="text-gray-600 mb-6">
                Be the first to offer a ride and share the link with others.
              </p>
              <button
                onClick={() => user ? setCurrentView('offerRide') : setCurrentView('account')}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                {user ? 'Offer a ride' : 'Sign in to offer a ride'}
              </button>
            </div>
          </div>
        )}

        <div
          id="find-ride-map-container"
          ref={setContainerRef}
          className="absolute inset-0"
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1,
            isolation: 'isolate',
            contain: 'layout style paint'
          }}
        />
      </div>
      )}
    </main>
  );
}
