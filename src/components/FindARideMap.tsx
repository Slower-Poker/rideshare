import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, MapPin, Clock, DollarSign, Users } from 'lucide-react';
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

function formatOfferDeparture(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function FindARideMap({ setCurrentView, user }: SharedProps) {
  const [tab, setTab] = useState<ListTab>('requests');
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
  
  // MapLibre loading states
  const [isScriptLoading, setIsScriptLoading] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [containerReady, setContainerReady] = useState(false);
  
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<RideRequestMarker[]>([]);
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
          // Remove all markers, dropoff markers, and routes
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

  return (
    <main id="main-content" className="h-screen flex flex-col">
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
          <h1 className="text-xl font-bold text-gray-900">
            {tab === 'requests' ? 'Ride requests' : 'Ride offers'}
          </h1>
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
          {tab === 'requests' && (
            <button
              type="button"
              onClick={() => setCurrentView('bookaRideRequest')}
              className="px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors border border-primary-200"
              aria-label="Go to ride list"
            >
              Ride List
            </button>
          )}
          <div className="ml-auto flex items-center gap-2 text-sm text-gray-600">
            {tab === 'requests' ? (
              <>
                <MapPin className="w-4 h-4" />
                <span>{rideRequests.length} request{rideRequests.length !== 1 ? 's' : ''} available</span>
              </>
            ) : (
              <>
                <Users className="w-4 h-4" />
                <span>{rideOffers.length} offer{rideOffers.length !== 1 ? 's' : ''} available</span>
              </>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 px-4 pb-2 -mt-1">
          {tab === 'requests'
            ? "See who's looking for a ride; offer a seat or post your own request."
            : "Browse available rides. Request to join or share a link with others."}
        </p>
      </header>

      {/* Ride offers list (when tab is offers) */}
      {tab === 'offers' && (
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
            <ul className="space-y-3 max-w-3xl mx-auto" role="list">
              {rideOffers.map((offer) => {
                const seatsLeft = (offer.availableSeats ?? 0) - (offer.seatsBooked ?? 0);
                const hasJoinCode = Boolean(offer.joinCode?.trim());
                return (
                  <li key={offer.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">
                          {offer.originAddress || offer.originRegion || 'Origin'} → {offer.destinationAddress || offer.destinationRegion || 'Destination'}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatOfferDeparture(offer.departureTime)}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            ${offer.price}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {seatsLeft} seat{seatsLeft !== 1 ? 's' : ''} left
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {hasJoinCode ? (
                          <Link
                            to={`/join/${offer.joinCode}`}
                            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                          >
                            Request to join
                          </Link>
                        ) : (
                          <span className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-500 text-sm rounded-lg cursor-not-allowed">
                            No share link
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Map Container (when tab is requests) */}
      {tab === 'requests' && (
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

        {/* Data Loading State */}
        {loading && (
          <div className="absolute inset-0 bg-gray-100 bg-opacity-50 flex items-center justify-center z-30 pointer-events-none">
            <div className="text-center bg-white rounded-lg shadow-lg p-6">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Loading ride requests...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && rideRequests.length === 0 && (
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
