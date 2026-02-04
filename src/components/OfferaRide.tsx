import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, X, Loader2, AlertCircle, CheckCircle2, Copy, RefreshCw } from 'lucide-react';
import { client } from '../client';
import type { SharedProps, Location } from '../types';
import { loadMapLibre, isMapLibreLoaded, getMapLibreInstance } from '../utils/maplibreLoader';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MANITOBA_BOUNDS,
  createRasterTileStyle,
  locationToCoordinates,
  isInManitoba,
  constrainToManitoba,
  calculateBounds,
  createCircleGeoJSON,
  convertToKm,
} from '../utils/maplibreUtils';
import { toast } from '../utils/toast';
import type { MapLibreMap, MapLibreMarker } from '../types/maplibre';

// Nominatim API endpoint for OSM geocoding
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';

// Form validation constants
const PRICE_MIN = 10;
const PRICE_MAX = 200;
const PRICE_STEP = 1;
const RADIUS_MIN = 0;
const RADIUS_MAX = 100;
const RADIUS_STEP = 0.5;
const DEFAULT_DISTANCE_UNIT: 'km' | 'miles' = 'km';
const VALID_DISTANCE_UNITS: ('km' | 'miles')[] = ['km', 'miles'];

interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

/** Extract region (e.g. city name) from full address string; used for discovery filters. */
function extractRegionFromAddress(address: string | null | undefined): string {
  if (!address || !address.trim()) return '';
  const part = address.split(',')[0]?.trim();
  return part || '';
}

/** Generate a short alphanumeric join code for shareable ride links. */
function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 6; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export function OfferaRide({ setCurrentView, user }: SharedProps) {
  const [originLocation, setOriginLocation] = useState<Location | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<Location | null>(null);
  const [originSearch, setOriginSearch] = useState('');
  const [destinationSearch, setDestinationSearch] = useState('');
  const [originResults, setOriginResults] = useState<GeocodeResult[]>([]);
  const [destinationResults, setDestinationResults] = useState<GeocodeResult[]>([]);
  const [searchingOrigin, setSearchingOrigin] = useState(false);
  const [searchingDestination, setSearchingDestination] = useState(false);
  
  // Form fields
  const [rideName, setRideName] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureTimeOnly, setDepartureTimeOnly] = useState('');
  const [availableSeats, setAvailableSeats] = useState<number>(1);
  const [vehicleInfo, setVehicleInfo] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Round-trip options
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [returnTimeOnly, setReturnTimeOnly] = useState('');
  const [graceMinutes, setGraceMinutes] = useState(60);
  
  // Recurring ride options
  type RecurrenceType = 'none' | 'weekly' | 'hourly';
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [selectedDays, setSelectedDays] = useState<number[]>([]); // 0=Sun, 1=Mon, ..., 6=Sat
  const [weeksToGenerate, setWeeksToGenerate] = useState<number>(4); // Number of weeks to generate
  const [hourlyCount, setHourlyCount] = useState<number>(4); // For hourly recurrence
  
  // Radius and price fields
  const [pickupRadius, setPickupRadius] = useState<number>(RADIUS_MIN);
  const [dropoffRadius, setDropoffRadius] = useState<number>(RADIUS_MIN);
  const [price, setPrice] = useState<number>(PRICE_MIN);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'miles'>(DEFAULT_DISTANCE_UNIT);
  
  // Verification state
  const [isVerified, setIsVerified] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(true);
  const [createdOfferWithCode, setCreatedOfferWithCode] = useState<{ joinCode: string } | null>(null);
  
  // MapLibre loading states
  const [isScriptLoading, setIsScriptLoading] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [containerReady, setContainerReady] = useState(false);
  
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerRetryCountRef = useRef(0);
  const maxRetries = 20;
  const mapResizeHandlerRef = useRef<(() => void) | null>(null);
  
  // Refs for circle layers
  const pickupCircleSourceRef = useRef<string | null>(null);
  const dropoffCircleSourceRef = useRef<string | null>(null);
  
  // Use refs to track current locations for map click handler
  const originLocationRef = useRef<Location | null>(null);
  const destinationLocationRef = useRef<Location | null>(null);
  const isMountedRef = useRef(true);
  const fetchAbortControllerRef = useRef<AbortController | null>(null);

  // Check verification status and fetch user preferences
  useEffect(() => {
    if (!user) {
      setCheckingVerification(false);
      setIsVerified(false);
      return;
    }

    const checkVerification = async () => {
      try {
        const { data: profiles, errors } = await client.models.UserProfile.list({
          filter: { userId: { eq: user.userId } },
          limit: 1,
        });

        if (errors) {
          if (import.meta.env.DEV) {
            console.error('Error fetching user profile:', errors);
          }
          setIsVerified(false);
          setCheckingVerification(false);
          return;
        }

        const profile = profiles?.[0];
        // Check if user has a coop member number (required for offering rides)
        setIsVerified(profile?.coopMemberNumber !== null && profile?.coopMemberNumber !== undefined);
        
        // Set distance unit from profile with validation, default to 'km'
        if (profile?.distanceUnit) {
          const unit = profile.distanceUnit as string;
          const validUnit = VALID_DISTANCE_UNITS.includes(unit as 'km' | 'miles') 
            ? (unit as 'km' | 'miles') 
            : DEFAULT_DISTANCE_UNIT;
          setDistanceUnit(validUnit);
        } else {
          setDistanceUnit(DEFAULT_DISTANCE_UNIT);
        }
        
        setCheckingVerification(false);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error checking verification:', error);
        }
        setIsVerified(false);
        setCheckingVerification(false);
      }
    };

    checkVerification();
  }, [user]);
  
  // Keep refs in sync with state
  useEffect(() => {
    originLocationRef.current = originLocation;
  }, [originLocation]);
  
  useEffect(() => {
    destinationLocationRef.current = destinationLocation;
  }, [destinationLocation]);

  // Container ref setter
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setContainerReady(!!node);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      // Cancel any pending fetch requests
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
        fetchAbortControllerRef.current = null;
      }
      
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      // Cleanup resize handler
      if (mapResizeHandlerRef.current) {
        window.removeEventListener('resize', mapResizeHandlerRef.current);
        mapResizeHandlerRef.current = null;
      }
      
      // Cleanup map and markers
      if (mapRef.current) {
        try {
          // Remove circle layers and sources (border layers must be removed before sources)
          const map = mapRef.current;
          try {
            if (map.getLayer('pickup-circle-border')) map.removeLayer('pickup-circle-border');
            if (map.getLayer('pickup-circle')) map.removeLayer('pickup-circle');
            if (map.getSource('pickup-circle')) map.removeSource('pickup-circle');
            if (map.getLayer('dropoff-circle-border')) map.removeLayer('dropoff-circle-border');
            if (map.getLayer('dropoff-circle')) map.removeLayer('dropoff-circle');
            if (map.getSource('dropoff-circle')) map.removeSource('dropoff-circle');
          } catch (e) {
            // Ignore errors
          }
          
          // Remove all markers
          markersRef.current.forEach(marker => {
            try {
              marker.remove();
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

  // Manitoba, Canada bounding box
  const MANITOBA_BBOX = '-102.0,48.9,-95.0,60.0';

  // Check if location is within Manitoba bounds
  const isInManitobaBounds = (lat: number, lon: number): boolean => {
    return isInManitoba(lat, lon);
  };

  // Geocode address using Nominatim, limited to Manitoba, Canada
  const geocodeAddress = async (query: string): Promise<GeocodeResult[]> => {
    if (!query.trim()) return [];

    try {
      const enhancedQuery = `${query}, Manitoba, Canada`;
      const response = await fetch(
        `${NOMINATIM_API}?format=json&q=${encodeURIComponent(enhancedQuery)}&limit=10&addressdetails=1&countrycodes=ca&bounded=1&viewbox=${MANITOBA_BBOX}`,
        {
          headers: {
            'User-Agent': 'RideShare.Click/1.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Geocoding failed');
      }

      const data = await response.json();
      const filteredResults = (data as GeocodeResult[]).filter((result) => {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        return isInManitobaBounds(lat, lon);
      });
      
      return filteredResults.slice(0, 5);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Geocoding error:', error);
      }
      toast.error('Failed to search address');
      return [];
    }
  };

  // Handle origin search
  const handleOriginSearch = async (query: string) => {
    setOriginSearch(query);
    setSearchingOrigin(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      if (query.trim()) {
        const results = await geocodeAddress(query);
        setOriginResults(results);
      } else {
        setOriginResults([]);
      }
      setSearchingOrigin(false);
    }, 500);
  };

  // Handle destination search
  const handleDestinationSearch = async (query: string) => {
    setDestinationSearch(query);
    setSearchingDestination(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      if (query.trim()) {
        const results = await geocodeAddress(query);
        setDestinationResults(results);
      } else {
        setDestinationResults([]);
      }
      setSearchingDestination(false);
    }, 500);
  };

  // Select origin location
  const selectOrigin = (result: GeocodeResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    
    if (!isInManitobaBounds(lat, lon)) {
      toast.error('Selected location is outside Manitoba, Canada');
      return;
    }
    
    const location: Location = {
      latitude: lat,
      longitude: lon,
      address: result.display_name,
    };
    setOriginLocation(location);
    setOriginSearch(result.display_name);
    setOriginResults([]);
  };

  // Select destination location
  const selectDestination = (result: GeocodeResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    
    if (!isInManitobaBounds(lat, lon)) {
      toast.error('Selected location is outside Manitoba, Canada');
      return;
    }
    
    const location: Location = {
      latitude: lat,
      longitude: lon,
      address: result.display_name,
    };
    setDestinationLocation(location);
    setDestinationSearch(result.display_name);
    setDestinationResults([]);
  };

  // Handle map click for location selection
  const handleMapClick = useCallback((e: { lngLat: { lng: number; lat: number } }) => {
    if (!isMountedRef.current) {
      return;
    }

    const clickedLocation: Location = {
      latitude: e.lngLat.lat,
      longitude: e.lngLat.lng,
    };

    if (!isInManitobaBounds(clickedLocation.latitude, clickedLocation.longitude)) {
      toast.error('Please select a location within Manitoba, Canada');
      return;
    }

    // Cancel any previous fetch request
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    fetchAbortControllerRef.current = abortController;

    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${clickedLocation.latitude}&lon=${clickedLocation.longitude}&countrycodes=ca`,
      {
        headers: {
          'User-Agent': 'RideShare.Click/1.0',
        },
        signal: abortController.signal,
      }
    )
      .then((res) => {
        if (!isMountedRef.current || abortController.signal.aborted) {
          return null;
        }
        if (!res.ok) {
          throw new Error('Reverse geocoding failed');
        }
        return res.json();
      })
      .then((data) => {
        if (!isMountedRef.current || abortController.signal.aborted || !data) {
          return;
        }

        const resultLat = parseFloat(data.lat || clickedLocation.latitude.toString());
        const resultLon = parseFloat(data.lon || clickedLocation.longitude.toString());
        
        if (!isInManitobaBounds(resultLat, resultLon)) {
          toast.error('Selected location is outside Manitoba, Canada');
          return;
        }

        const locationWithAddress: Location = {
          ...clickedLocation,
          address: data.display_name || 'Selected location',
        };
        
        if (!isMountedRef.current) {
          return;
        }
        
        const currentOrigin = originLocationRef.current;
        const currentDestination = destinationLocationRef.current;
        
        if (!currentOrigin) {
          setOriginLocation(locationWithAddress);
          setOriginSearch(locationWithAddress.address || 'Selected location');
        } else if (!currentDestination) {
          setDestinationLocation(locationWithAddress);
          setDestinationSearch(locationWithAddress.address || 'Selected location');
        } else {
          const distToOrigin = Math.sqrt(
            Math.pow(locationWithAddress.latitude - currentOrigin.latitude, 2) +
            Math.pow(locationWithAddress.longitude - currentOrigin.longitude, 2)
          );
          const distToDestination = Math.sqrt(
            Math.pow(locationWithAddress.latitude - currentDestination.latitude, 2) +
            Math.pow(locationWithAddress.longitude - currentDestination.longitude, 2)
          );
          
          if (distToOrigin < distToDestination) {
            setOriginLocation(locationWithAddress);
            setOriginSearch(locationWithAddress.address || 'Selected location');
          } else {
            setDestinationLocation(locationWithAddress);
            setDestinationSearch(locationWithAddress.address || 'Selected location');
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
          console.error('Reverse geocoding error:', error);
        }
        
        const locationWithoutAddress: Location = {
          ...clickedLocation,
          address: 'Selected location',
        };
        
        if (!isMountedRef.current) {
          return;
        }
        
        const currentOrigin = originLocationRef.current;
        const currentDestination = destinationLocationRef.current;
        
        if (!currentOrigin) {
          setOriginLocation(locationWithoutAddress);
          setOriginSearch('Selected location');
        } else if (!currentDestination) {
          setDestinationLocation(locationWithoutAddress);
          setDestinationSearch('Selected location');
        }
      });
  }, []);

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
      if (import.meta.env.DEV) {
        console.log('Map initialization skipped:', {
          isMounted: isMountedRef.current,
          hasContainer: !!containerRef.current,
          hasMap: !!mapRef.current,
        });
      }
      return;
    }

    // Validate container dimensions
    if (!validateContainerDimensions()) {
      containerRetryCountRef.current++;
      
      if (import.meta.env.DEV) {
        console.log(`Container validation failed, retry ${containerRetryCountRef.current}/${maxRetries}`);
      }
      
      if (containerRetryCountRef.current < maxRetries) {
        // Exponential backoff: 200ms * 2^retryCount (capped at 2s)
        const delay = Math.min(200 * Math.pow(2, containerRetryCountRef.current - 1), 2000);
        setTimeout(() => {
          if (isMountedRef.current) {
            initializeMap(maplibregl);
          }
        }, delay);
      } else {
        const errorMsg = 'Map container has no dimensions. Please refresh the page.';
        setMapError(errorMsg);
        if (import.meta.env.DEV) {
          console.error(errorMsg);
        }
      }
      return;
    }

    if (import.meta.env.DEV) {
      console.log('Initializing MapLibre map...', {
        container: containerRef.current,
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
      });
    }

    try {
      // Create map style with raster tiles
      const style = createRasterTileStyle('osm');
      
      // Initialize map
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: style,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        minZoom: 7,
        maxZoom: 18,
        maxBounds: MANITOBA_BOUNDS,
      });

      // Add navigation controls
      map.addControl(new maplibregl.NavigationControl(), 'top-right');

      // Handle map load
      map.on('load', () => {
        if (!isMountedRef.current || mapRef.current !== map) {
          return;
        }
        
        if (import.meta.env.DEV) {
          console.log('Map loaded successfully');
        }
        
        setIsMapLoaded(true);
        mapRef.current = map;
        
        // Trigger resize to ensure proper rendering
        setTimeout(() => {
          if (isMountedRef.current && mapRef.current === map) {
            map.resize();
          }
        }, 100);
      });

      // Handle map errors
      map.on('error', (e: any) => {
        if (import.meta.env.DEV) {
          console.error('Map error:', e);
        }
        if (e.error && e.error.message) {
          setMapError(`Map error: ${e.error.message}`);
        }
      });

      // Handle map click
      map.on('click', (e: any) => {
        if (isMountedRef.current) {
          handleMapClick(e);
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

      // Handle resize
      const resizeHandler = () => {
        if (isMountedRef.current && mapRef.current === map) {
          map.resize();
        }
      };
      window.addEventListener('resize', resizeHandler);
      mapResizeHandlerRef.current = resizeHandler;

      // Get user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!isMountedRef.current || mapRef.current !== map) {
              return;
            }
            const { latitude, longitude } = pos.coords;
            const loc: Location = { latitude, longitude, address: 'Your location' };
            setUserLocation(loc);
            
            if (mapRef.current === map) {
              const [lng, lat] = constrainToManitoba(latitude, longitude);
              map.setCenter([lng, lat]);
              map.setZoom(14);
            }
          },
          (err) => {
            if (isMountedRef.current && import.meta.env.DEV) {
              console.error('Geolocation error:', err);
            }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      }

      mapRef.current = map;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Map initialization error:', error);
      }
      setMapError('Failed to initialize map. Please refresh the page.');
    }
  }, [handleMapClick]);

  // Load MapLibre script when component is visible
  useEffect(() => {
    if (isScriptLoading || isMapLibreLoaded()) {
      return;
    }

    if (import.meta.env.DEV) {
      console.log('Loading MapLibre GL JS...');
    }

    setIsScriptLoading(true);
    setMapError(null);

    loadMapLibre({
      onLoad: (maplibregl) => {
        if (!isMountedRef.current) {
          return;
        }
        if (import.meta.env.DEV) {
          console.log('MapLibre GL JS loaded successfully');
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
        if (import.meta.env.DEV) {
          console.error('MapLibre load error:', error);
        }
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

  // Update markers when locations change
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) {
      return;
    }

    const map = mapRef.current;
    const maplibregl = getMapLibreInstance();
    if (!maplibregl) {
      return;
    }

    // Remove existing markers
    markersRef.current.forEach(marker => {
      try {
        marker.remove();
      } catch (e) {
        // Ignore errors
      }
    });
    markersRef.current = [];

    // Debounce marker updates
    const updateTimeout = setTimeout(() => {
      if (!isMountedRef.current || !mapRef.current || mapRef.current !== map) {
        return;
      }

      // Add origin marker
      if (originLocation) {
        const el = document.createElement('div');
        el.className = 'origin-marker';
        el.innerHTML = `
          <div style="
            width: 32px;
            height: 32px;
            background-color: #10b981;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 18px;
          ">O</div>
        `;
        
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(locationToCoordinates(originLocation))
          .setPopup(
            new maplibregl.Popup({ offset: 25 })
              .setHTML(`
                <div style="text-align: center;">
                  <p style="font-weight: 600; color: #10b981; margin: 0;">Origin</p>
                  ${originLocation.address ? `<p style="font-size: 12px; color: #666; margin: 4px 0 0 0;">${originLocation.address}</p>` : ''}
                </div>
              `)
          )
          .addTo(map);
        markersRef.current.push(marker);
      }

      // Add destination marker
      if (destinationLocation) {
        const el = document.createElement('div');
        el.className = 'destination-marker';
        el.innerHTML = `
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
        
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(locationToCoordinates(destinationLocation))
          .setPopup(
            new maplibregl.Popup({ offset: 25 })
              .setHTML(`
                <div style="text-align: center;">
                  <p style="font-weight: 600; color: #ef4444; margin: 0;">Destination</p>
                  ${destinationLocation.address ? `<p style="font-size: 12px; color: #666; margin: 4px 0 0 0;">${destinationLocation.address}</p>` : ''}
                </div>
              `)
          )
          .addTo(map);
        markersRef.current.push(marker);
      }

      // Add user location marker
      if (userLocation) {
        const el = document.createElement('div');
        el.className = 'user-location-marker';
        el.innerHTML = `
          <div style="
            width: 24px;
            height: 24px;
            background-color: #3875d7;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          "></div>
        `;
        
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(locationToCoordinates(userLocation))
          .setPopup(
            new maplibregl.Popup({ offset: 25 })
              .setHTML(`
                <div style="text-align: center;">
                  <p style="font-weight: 600; color: #3875d7; margin: 0;">You are here</p>
                </div>
              `)
          )
          .addTo(map);
        markersRef.current.push(marker);
      }

      // Fit bounds if we have locations
      const allLocations = [
        originLocation,
        destinationLocation,
        userLocation,
      ].filter((loc): loc is Location => loc !== null);

      if (allLocations.length > 0) {
        const bounds = calculateBounds(allLocations);
        if (bounds) {
          try {
            // Constrain bounds to Manitoba
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
        } else if (originLocation) {
          const [lng, lat] = locationToCoordinates(originLocation);
          map.setCenter([lng, lat]);
        } else if (destinationLocation) {
          const [lng, lat] = locationToCoordinates(destinationLocation);
          map.setCenter([lng, lat]);
        }
      }
    }, 150);

    return () => {
      clearTimeout(updateTimeout);
    };
  }, [originLocation, destinationLocation, userLocation, isMapLoaded]);

  // Update circle layers when locations or radii change
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) {
      return;
    }

    const map = mapRef.current;
    const maplibregl = getMapLibreInstance();
    if (!maplibregl) {
      return;
    }

    // Update pickup circle
    if (originLocation && pickupRadius > 0) {
      const radiusKm = convertToKm(pickupRadius, distanceUnit);
      const circleGeoJSON = createCircleGeoJSON(originLocation, radiusKm);
      
      try {
        // Remove existing layers and source (border uses source, so remove border first)
        if (map.getLayer('pickup-circle-border')) {
          map.removeLayer('pickup-circle-border');
        }
        if (map.getLayer('pickup-circle')) {
          map.removeLayer('pickup-circle');
        }
        if (map.getSource('pickup-circle')) {
          map.removeSource('pickup-circle');
        }

        // Add new source and layer
        map.addSource('pickup-circle', {
          type: 'geojson',
          data: circleGeoJSON,
        });

        map.addLayer({
          id: 'pickup-circle',
          type: 'fill',
          source: 'pickup-circle',
          paint: {
            'fill-color': '#10b981',
            'fill-opacity': 0.3,
          },
        });

        map.addLayer({
          id: 'pickup-circle-border',
          type: 'line',
          source: 'pickup-circle',
          paint: {
            'line-color': '#10b981',
            'line-width': 2,
            'line-opacity': 0.8,
          },
        });

        pickupCircleSourceRef.current = 'pickup-circle';
      } catch (error) {
        if (import.meta.env.DEV) {
          console.debug('Error adding pickup circle:', error);
        }
      }
    } else {
      // Remove pickup circle if radius is 0 or location is cleared
      try {
        if (map.getLayer('pickup-circle-border')) {
          map.removeLayer('pickup-circle-border');
        }
        if (map.getLayer('pickup-circle')) {
          map.removeLayer('pickup-circle');
        }
        if (map.getSource('pickup-circle')) {
          map.removeSource('pickup-circle');
        }
        pickupCircleSourceRef.current = null;
      } catch (error) {
        if (import.meta.env.DEV) {
          console.debug('Error removing pickup circle:', error);
        }
      }
    }

    // Update dropoff circle
    if (destinationLocation && dropoffRadius > 0) {
      const radiusKm = convertToKm(dropoffRadius, distanceUnit);
      const circleGeoJSON = createCircleGeoJSON(destinationLocation, radiusKm);
      
      try {
        // Remove existing layers and source (border uses source, so remove border first)
        if (map.getLayer('dropoff-circle-border')) {
          map.removeLayer('dropoff-circle-border');
        }
        if (map.getLayer('dropoff-circle')) {
          map.removeLayer('dropoff-circle');
        }
        if (map.getSource('dropoff-circle')) {
          map.removeSource('dropoff-circle');
        }

        // Add new source and layer
        map.addSource('dropoff-circle', {
          type: 'geojson',
          data: circleGeoJSON,
        });

        map.addLayer({
          id: 'dropoff-circle',
          type: 'fill',
          source: 'dropoff-circle',
          paint: {
            'fill-color': '#ef4444',
            'fill-opacity': 0.3,
          },
        });

        map.addLayer({
          id: 'dropoff-circle-border',
          type: 'line',
          source: 'dropoff-circle',
          paint: {
            'line-color': '#ef4444',
            'line-width': 2,
            'line-opacity': 0.8,
          },
        });

        dropoffCircleSourceRef.current = 'dropoff-circle';
      } catch (error) {
        if (import.meta.env.DEV) {
          console.debug('Error adding dropoff circle:', error);
        }
      }
    } else {
      // Remove dropoff circle if radius is 0 or location is cleared
      try {
        if (map.getLayer('dropoff-circle-border')) {
          map.removeLayer('dropoff-circle-border');
        }
        if (map.getLayer('dropoff-circle')) {
          map.removeLayer('dropoff-circle');
        }
        if (map.getSource('dropoff-circle')) {
          map.removeSource('dropoff-circle');
        }
        dropoffCircleSourceRef.current = null;
      } catch (error) {
        if (import.meta.env.DEV) {
          console.debug('Error removing dropoff circle:', error);
        }
      }
    }
  }, [originLocation, destinationLocation, pickupRadius, dropoffRadius, distanceUnit, isMapLoaded]);

  // Clear locations
  const clearOrigin = () => {
    setOriginLocation(null);
    setOriginSearch('');
    setOriginResults([]);
  };

  const clearDestination = () => {
    setDestinationLocation(null);
    setDestinationSearch('');
    setDestinationResults([]);
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!isVerified) {
      toast.error('You must be a coop member to offer rides. Please add your coop member number in Account settings.');
      return;
    }

    if (!originLocation || !destinationLocation) {
      toast.error('Please select both origin and destination locations');
      return;
    }

    if (!departureDate || !departureTimeOnly) {
      toast.error('Please select both date and time');
      return;
    }
    
    if (recurrence === 'weekly' && selectedDays.length === 0) {
      toast.error('Please select at least one day of the week for recurring rides');
      return;
    }

    if (availableSeats < 1) {
      toast.error('Please specify at least 1 available seat');
      return;
    }

    if (price < PRICE_MIN) {
      toast.error(`Price must be at least $${PRICE_MIN.toFixed(2)}`);
      return;
    }

    if (price > PRICE_MAX) {
      toast.error(`Price cannot exceed $${PRICE_MAX.toFixed(2)}`);
      return;
    }

    if (pickupRadius < RADIUS_MIN || dropoffRadius < RADIUS_MIN) {
      toast.error(`Radius values cannot be less than ${RADIUS_MIN}`);
      return;
    }

    if (!user) {
      toast.error('You must be signed in to offer rides');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get user profile to get the ID
      const { data: profiles, errors: profileErrors } = await client.models.UserProfile.list({
        filter: { userId: { eq: user.userId } },
        limit: 1,
      });

      if (profileErrors) {
        if (import.meta.env.DEV) {
          console.error('Error fetching user profile:', profileErrors);
        }
        const errorMessage = profileErrors[0]?.message || 'Unable to verify your account. Please try again.';
        toast.error(errorMessage);
        setIsSubmitting(false);
        return;
      }

      if (!profiles || profiles.length === 0) {
        toast.error('User profile not found. Please complete your profile in Account settings.');
        setIsSubmitting(false);
        setCurrentView('account');
        return;
      }

      const profile = profiles[0];
      if (!profile || !profile.id) {
        toast.error('User profile is invalid. Please contact support.');
        setIsSubmitting(false);
        return;
      }

      // Coop member number is required for offering rides and assigned automatically
      if (!profile.coopMemberNumber || profile.coopMemberNumber === null || profile.coopMemberNumber === undefined) {
        toast.error('Your coop member number is still being assigned. Please try again in a moment.');
        setIsSubmitting(false);
        setCurrentView('account');
        return;
      }

      // Combine date and time into a full datetime
      const departureDateTime = new Date(`${departureDate}T${departureTimeOnly}`);
      const now = new Date();

      if (departureDateTime <= now) {
        toast.error('Departure time must be in the future');
        setIsSubmitting(false);
        return;
      }

      const originRegionStr = extractRegionFromAddress(originLocation.address);
      const destinationRegionStr = extractRegionFromAddress(destinationLocation.address);
      
      // Convert radii to km for storage
      const pickupRadiusKm = pickupRadius > 0 ? convertToKm(pickupRadius, distanceUnit) : undefined;
      const dropoffRadiusKm = dropoffRadius > 0 ? convertToKm(dropoffRadius, distanceUnit) : undefined;
      
      // Calculate how many ride offers to create based on recurrence
      const ridesToCreate: Date[] = [];
      
      if (recurrence === 'none') {
        // One-time ride
        ridesToCreate.push(departureDateTime);
      } else if (recurrence === 'hourly') {
        // Hourly recurrence - create rides for each hour
        for (let i = 0; i < hourlyCount; i++) {
          const rideDate = new Date(departureDateTime);
          rideDate.setHours(rideDate.getHours() + i);
          if (rideDate > now) {
            ridesToCreate.push(rideDate);
          }
        }
      } else if (recurrence === 'weekly' && selectedDays.length > 0) {
        // Weekly schedule - create rides for selected days over the specified weeks
        const startDate = new Date(departureDate);
        const [hours, minutes] = departureTimeOnly.split(':').map(Number);
        
        for (let week = 0; week < weeksToGenerate; week++) {
          for (const dayOfWeek of selectedDays) {
            const rideDate = new Date(startDate);
            // Find the next occurrence of this day of week
            const daysUntilTarget = (dayOfWeek - startDate.getDay() + 7) % 7;
            rideDate.setDate(startDate.getDate() + daysUntilTarget + (week * 7));
            rideDate.setHours(hours, minutes, 0, 0);
            
            // Only add if it's in the future
            if (rideDate > now) {
              ridesToCreate.push(rideDate);
            }
          }
        }
        
        // Sort rides by date
        ridesToCreate.sort((a, b) => a.getTime() - b.getTime());
      }
      
      if (ridesToCreate.length === 0) {
        toast.error('No valid ride dates found. Please select a future date.');
        setIsSubmitting(false);
        return;
      }
      
      let lastJoinCode = '';
      let createdCount = 0;
      
      for (const rideDateTime of ridesToCreate) {
        const departureDateTimeISO = rideDateTime.toISOString();
        const joinCodeStr = generateJoinCode();
        lastJoinCode = joinCodeStr;
        
        // Calculate expiry time (departure + grace period)
        const expiresAtDate = new Date(rideDateTime.getTime() + graceMinutes * 60 * 1000);
        const expiresAtISO = expiresAtDate.toISOString();
        
        // Create outbound ride
        const result = await client.models.Ride.create({
          hostId: profile.id,
          name: rideName || undefined,
          rideType: 'offer',
          status: 'open',
          originLatitude: originLocation.latitude,
          originLongitude: originLocation.longitude,
          originAddress: originLocation.address || '',
          originRegion: originRegionStr || undefined,
          destinationLatitude: destinationLocation.latitude,
          destinationLongitude: destinationLocation.longitude,
          destinationAddress: destinationLocation.address || '',
          destinationRegion: destinationRegionStr || undefined,
          departureTime: departureDateTimeISO,
          expiresAt: expiresAtISO,
          graceMinutes: graceMinutes,
          totalSeats: availableSeats,
          seatsBooked: 0,
          pricePerSeat: price,
          vehicleInfo: vehicleInfo || undefined,
          notes: notes || undefined,
          pickupRadius: pickupRadiusKm,
          dropoffRadius: dropoffRadiusKm,
          joinCode: joinCodeStr,
          isReturnTrip: false,
          createdAt: new Date().toISOString(),
        }) as { data?: { id: string } | null; errors?: unknown[] };
        
        if (result.errors) {
          if (import.meta.env.DEV) {
            console.error('Error creating ride:', result.errors);
          }
          const firstError = result.errors[0];
          const errorMessage = (firstError && typeof firstError === 'object' && 'message' in firstError && typeof (firstError as { message: unknown }).message === 'string')
            ? (firstError as { message: string }).message
            : 'Failed to create ride. Please try again.';
          toast.error(errorMessage);
          setIsSubmitting(false);
          return;
        }
        
        const outboundRideId = result.data?.id;
        createdCount++;
        
        // Create return trip if round-trip is enabled
        if (isRoundTrip && returnTimeOnly && outboundRideId) {
          const [returnHours, returnMinutes] = returnTimeOnly.split(':').map(Number);
          const returnDateTime = new Date(rideDateTime);
          returnDateTime.setHours(returnHours, returnMinutes, 0, 0);
          
          // If return time is earlier than departure, assume next day
          if (returnDateTime <= rideDateTime) {
            returnDateTime.setDate(returnDateTime.getDate() + 1);
          }
          
          const returnExpiresAt = new Date(returnDateTime.getTime() + graceMinutes * 60 * 1000);
          const returnJoinCode = generateJoinCode();
          
          const returnResult = await client.models.Ride.create({
            hostId: profile.id,
            name: rideName ? `${rideName} (Return)` : undefined,
            rideType: 'offer',
            status: 'open',
            // Swap origin and destination for return trip
            originLatitude: destinationLocation.latitude,
            originLongitude: destinationLocation.longitude,
            originAddress: destinationLocation.address || '',
            originRegion: destinationRegionStr || undefined,
            destinationLatitude: originLocation.latitude,
            destinationLongitude: originLocation.longitude,
            destinationAddress: originLocation.address || '',
            destinationRegion: originRegionStr || undefined,
            departureTime: returnDateTime.toISOString(),
            expiresAt: returnExpiresAt.toISOString(),
            graceMinutes: graceMinutes,
            totalSeats: availableSeats,
            seatsBooked: 0,
            pricePerSeat: price,
            vehicleInfo: vehicleInfo || undefined,
            notes: notes || undefined,
            pickupRadius: dropoffRadiusKm, // Swap radii for return
            dropoffRadius: pickupRadiusKm,
            joinCode: returnJoinCode,
            linkedRideId: outboundRideId,
            isReturnTrip: true,
            createdAt: new Date().toISOString(),
          }) as { data?: { id: string } | null; errors?: unknown[] };
          
          if (!returnResult.errors && returnResult.data?.id) {
            // Update outbound ride to link to return ride
            await client.models.Ride.update({
              id: outboundRideId,
              linkedRideId: returnResult.data.id,
            });
            createdCount++;
          }
        }
      }

      if (createdCount > 0 && lastJoinCode) {
        const successMessage = createdCount > 1 
          ? `${createdCount} rides created successfully!`
          : 'Ride created successfully!';
        toast.success(successMessage);
        setCreatedOfferWithCode({ joinCode: lastJoinCode });
      } else if (createdCount > 0) {
        const successMessage = createdCount > 1 
          ? `${createdCount} rides created successfully!`
          : 'Ride created successfully!';
        toast.success(successMessage);
        setCurrentView('home');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error creating ride:', error);
      }
      toast.error('Failed to create ride. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state while checking verification
  if (checkingVerification) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  // Share ride panel after successful create
  if (createdOfferWithCode) {
    const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${createdOfferWithCode.joinCode}`;
    const handleCopyLink = () => {
      navigator.clipboard.writeText(shareUrl).then(
        () => toast.success('Link copied to clipboard'),
        () => toast.error('Could not copy link')
      );
    };
    return (
      <main id="main-content" className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Share this ride</h2>
          <p className="text-gray-600 mb-4">Anyone with this link can request to join your ride.</p>
          <div className="bg-gray-50 rounded-lg p-3 mb-2 break-all text-sm text-gray-800 font-mono">
            {shareUrl}
          </div>
          <p className="text-sm text-gray-600 mb-2">Join code: <strong>{createdOfferWithCode.joinCode}</strong></p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              aria-label="Copy join link"
            >
              <Copy className="w-5 h-5" />
              Copy link
            </button>
            <button
              type="button"
              onClick={() => {
                setCreatedOfferWithCode(null);
                setCurrentView('home');
              }}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Offer a Ride</h1>
            <p className="text-sm text-gray-600">Share your empty seats with others</p>
          </div>
          {isVerified && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Coop Member</span>
            </div>
          )}
        </div>
      </header>

      {/* Verification Warning Banner */}
      {!isVerified && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">
                  Coop Member Number Required
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  To offer rides on RideShare.Click, you must be a coop member with a valid member number. 
                  You can fill out the form below, but you'll need to add your coop member number before submitting.
                </p>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setCurrentView('account')}
                    className="text-sm text-amber-900 hover:text-amber-950 font-medium underline"
                  >
                    Add coop member number in My Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Map Container */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left Panel - Form */}
        <div className="w-full md:w-96 bg-white border-r border-gray-200 p-4 overflow-y-auto">
          <div className="space-y-4">
            {/* Origin Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Origin Location
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={originSearch}
                  onChange={(e) => handleOriginSearch(e.target.value)}
                  placeholder="Search or click on map"
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                {originLocation && (
                  <button
                    onClick={clearOrigin}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    aria-label="Clear origin location"
                  >
                    <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
              
              {/* Search Results */}
              {originResults.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                  {originResults.map((result) => (
                    <button
                      key={result.place_id}
                      onClick={() => selectOrigin(result)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <MapPin className="w-4 h-4 text-primary-600 inline mr-2" />
                      <span className="text-sm text-gray-700">{result.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
              
              {searchingOrigin && (
                <p className="mt-2 text-sm text-gray-500">Searching...</p>
              )}

              {/* Selected Location */}
              {originLocation && (
                <div className="mt-2 p-3 bg-primary-50 rounded-lg">
                  <p className="text-sm font-medium text-primary-900">Selected:</p>
                  <p className="text-sm text-primary-700">{originLocation.address || 'Location selected'}</p>
                </div>
              )}
            </div>

            {/* Destination Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Destination Location
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={destinationSearch}
                  onChange={(e) => handleDestinationSearch(e.target.value)}
                  placeholder="Search or click on map"
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                {destinationLocation && (
                  <button
                    onClick={clearDestination}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    aria-label="Clear destination location"
                  >
                    <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
              
              {/* Search Results */}
              {destinationResults.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                  {destinationResults.map((result) => (
                    <button
                      key={result.place_id}
                      onClick={() => selectDestination(result)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <MapPin className="w-4 h-4 text-red-600 inline mr-2" />
                      <span className="text-sm text-gray-700">{result.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
              
              {searchingDestination && (
                <p className="mt-2 text-sm text-gray-500">Searching...</p>
              )}

              {/* Selected Location */}
              {destinationLocation && (
                <div className="mt-2 p-3 bg-red-50 rounded-lg">
                  <p className="text-sm font-medium text-red-900">Selected:</p>
                  <p className="text-sm text-red-700">{destinationLocation.address || 'Location selected'}</p>
                </div>
              )}
            </div>

            {/* Ride Name (Optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ride Name (Optional)
              </label>
              <input
                type="text"
                value={rideName}
                onChange={(e) => setRideName(e.target.value)}
                placeholder="e.g., Daily Commute, Weekend Trip"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                {rideName 
                  ? `Preview: ${rideName}`
                  : `Auto-generated: ${originLocation && destinationLocation 
                      ? `${extractRegionFromAddress(originLocation.address) || 'Origin'} → ${extractRegionFromAddress(destinationLocation.address) || 'Destination'}`
                      : 'Select locations first'}`
                }
              </p>
            </div>

            {/* Round-Trip Toggle */}
            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="text-sm font-medium text-indigo-900">Round Trip</label>
                  <p className="text-xs text-indigo-700">Create return trip automatically</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRoundTrip(!isRoundTrip)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                    isRoundTrip ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                  role="switch"
                  aria-checked={isRoundTrip}
                  aria-label="Enable round trip"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isRoundTrip ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              
              {isRoundTrip && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-indigo-700 mb-1">Return Time</label>
                    <input
                      type="time"
                      value={returnTimeOnly}
                      onChange={(e) => setReturnTimeOnly(e.target.value)}
                      className="w-full px-3 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      required={isRoundTrip}
                    />
                  </div>
                  <p className="text-xs text-indigo-600">
                    Return trip: {destinationLocation && originLocation 
                      ? `${extractRegionFromAddress(destinationLocation.address) || 'Destination'} → ${extractRegionFromAddress(originLocation.address) || 'Origin'}`
                      : 'Reverses origin and destination'}
                  </p>
                </div>
              )}
            </div>

            {/* Pickup Radius */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pickup Zone Radius ({distanceUnit === 'km' ? 'km' : 'miles'})
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min={RADIUS_MIN}
                  max={RADIUS_MAX}
                  step={RADIUS_STEP}
                  value={pickupRadius}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || RADIUS_MIN;
                    setPickupRadius(Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, val)));
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{RADIUS_MIN} {distanceUnit === 'km' ? 'km' : 'mi'}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={RADIUS_MIN}
                      max={RADIUS_MAX}
                      step={RADIUS_STEP}
                      value={pickupRadius.toFixed(1)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || RADIUS_MIN;
                        setPickupRadius(Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, val)));
                      }}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <span className="text-sm text-gray-700">{distanceUnit === 'km' ? 'km' : 'mi'}</span>
                  </div>
                  <span className="text-xs text-gray-500">{RADIUS_MAX} {distanceUnit === 'km' ? 'km' : 'mi'}</span>
                </div>
                <p className="text-xs text-gray-500">
                  Areas within this radius from the pickup location are included in the ride price.
                </p>
              </div>
            </div>

            {/* Dropoff Radius */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dropoff Zone Radius ({distanceUnit === 'km' ? 'km' : 'miles'})
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min={RADIUS_MIN}
                  max={RADIUS_MAX}
                  step={RADIUS_STEP}
                  value={dropoffRadius}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || RADIUS_MIN;
                    setDropoffRadius(Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, val)));
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{RADIUS_MIN} {distanceUnit === 'km' ? 'km' : 'mi'}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={RADIUS_MIN}
                      max={RADIUS_MAX}
                      step={RADIUS_STEP}
                      value={dropoffRadius.toFixed(1)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || RADIUS_MIN;
                        setDropoffRadius(Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, val)));
                      }}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <span className="text-sm text-gray-700">{distanceUnit === 'km' ? 'km' : 'mi'}</span>
                  </div>
                  <span className="text-xs text-gray-500">{RADIUS_MAX} {distanceUnit === 'km' ? 'km' : 'mi'}</span>
                </div>
                <p className="text-xs text-gray-500">
                  Areas within this radius from the dropoff location are included in the ride price.
                </p>
              </div>
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ride Price (CAD $)
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min={PRICE_MIN}
                  max={PRICE_MAX}
                  step={PRICE_STEP}
                  value={price}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || PRICE_MIN;
                    const clampedVal = Math.min(PRICE_MAX, Math.max(PRICE_MIN, val));
                    setPrice(clampedVal);
                    setPriceError(null);
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">${PRICE_MIN.toFixed(2)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">$</span>
                    <input
                      type="number"
                      min={PRICE_MIN}
                      max={PRICE_MAX}
                      step={PRICE_STEP}
                      value={price.toFixed(2)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (isNaN(val)) {
                          setPriceError('Please enter a valid number');
                          return;
                        }
                        if (val < PRICE_MIN) {
                          setPriceError(`Minimum price is $${PRICE_MIN.toFixed(2)}`);
                          setPrice(PRICE_MIN);
                        } else if (val > PRICE_MAX) {
                          setPriceError(`Maximum price is $${PRICE_MAX.toFixed(2)}`);
                          setPrice(PRICE_MAX);
                        } else {
                          setPriceError(null);
                          setPrice(val);
                        }
                      }}
                      className={`w-24 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                        priceError ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <span className="text-xs text-gray-500">${PRICE_MAX.toFixed(2)}</span>
                </div>
                {priceError && (
                  <p className="text-xs text-red-600">{priceError}</p>
                )}
                <p className="text-xs text-gray-500">
                  Minimum price is ${PRICE_MIN.toFixed(2)}. Maximum price is ${PRICE_MAX.toFixed(2)}. Price increments in ${PRICE_STEP.toFixed(2)} steps.
                </p>
              </div>
            </div>

            {/* Recurring Ride Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <RefreshCw className="w-4 h-4 inline mr-1" />
                Recurring Ride
              </label>
              <div className="space-y-3">
                <div className="flex rounded-lg overflow-hidden border border-gray-200 p-0.5 bg-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setRecurrence('none');
                      setSelectedDays([]);
                    }}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                      recurrence === 'none'
                        ? 'bg-white text-primary-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    One-time
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecurrence('weekly')}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                      recurrence === 'weekly'
                        ? 'bg-white text-primary-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecurrence('hourly');
                      setSelectedDays([]);
                    }}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                      recurrence === 'hourly'
                        ? 'bg-white text-primary-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Hourly
                  </button>
                </div>
                
                {/* Weekly Schedule - Day Selection */}
                {recurrence === 'weekly' && (
                  <div className="p-3 bg-primary-50 rounded-lg space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-primary-900 mb-2">
                        Select days of the week
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              setSelectedDays(prev => 
                                prev.includes(index) 
                                  ? prev.filter(d => d !== index)
                                  : [...prev, index].sort((a, b) => a - b)
                              );
                            }}
                            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors min-w-[44px] ${
                              selectedDays.includes(index)
                                ? 'bg-primary-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedDays([1, 2, 3, 4, 5])}
                          className="text-xs text-primary-600 hover:text-primary-800 hover:underline"
                        >
                          Weekdays
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedDays([0, 6])}
                          className="text-xs text-primary-600 hover:text-primary-800 hover:underline"
                        >
                          Weekends
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedDays([])}
                          className="text-xs text-primary-600 hover:text-primary-800 hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-primary-900 mb-2">
                        Number of weeks
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={weeksToGenerate}
                        onChange={(e) => setWeeksToGenerate(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                        className="w-full px-3 py-2 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    
                    {selectedDays.length > 0 && (
                      <p className="text-xs text-primary-700">
                        This will create up to {selectedDays.length * weeksToGenerate} ride offers 
                        ({selectedDays.length} day{selectedDays.length > 1 ? 's' : ''}/week × {weeksToGenerate} week{weeksToGenerate > 1 ? 's' : ''}).
                        Rides are created starting from the selected date.
                      </p>
                    )}
                  </div>
                )}
                
                {/* Hourly Recurrence */}
                {recurrence === 'hourly' && (
                  <div className="p-3 bg-primary-50 rounded-lg">
                    <label className="block text-sm font-medium text-primary-900 mb-2">
                      Number of hours
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="24"
                      value={hourlyCount}
                      onChange={(e) => setHourlyCount(Math.max(2, Math.min(24, parseInt(e.target.value) || 2)))}
                      className="w-full px-3 py-2 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="text-xs text-primary-700 mt-2">
                      This will create {hourlyCount} ride offers, one for each hour starting from the selected time.
                      Good for shuttle services or regular routes.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Date and Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date and Time
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Time</label>
                  <input
                    type="time"
                    value={departureTimeOnly}
                    onChange={(e) => setDepartureTimeOnly(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Available Seats */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Available Seats
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={availableSeats}
                onChange={(e) => setAvailableSeats(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            {/* Vehicle Info */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle Info (Optional)
              </label>
              <input
                type="text"
                value={vehicleInfo}
                onChange={(e) => setVehicleInfo(e.target.value)}
                placeholder="e.g., Blue Honda Civic"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional information about your ride..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Submit Button */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              {!isVerified && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>Note:</strong> You must be verified as a ride host to submit this offer. 
                    Please check your account verification status before submitting.
                  </p>
                </div>
              )}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !originLocation || !destinationLocation || !departureDate || !departureTimeOnly || price < PRICE_MIN || price > PRICE_MAX || !isVerified || (recurrence === 'weekly' && selectedDays.length === 0) || (isRoundTrip && !returnTimeOnly)}
                className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Creating Ride{isRoundTrip ? 's' : ''}...</span>
                  </>
                ) : !isVerified ? (
                  <span>Verification Required to Submit</span>
                ) : (
                  <span>Create Ride{isRoundTrip ? ' (Round Trip)' : ''}</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Map */}
        <div className="flex-1 relative bg-white min-h-[600px] overflow-hidden" style={{ position: 'relative', isolation: 'isolate' }}>
          {/* Loading State */}
          {(!isMapLoaded || isScriptLoading) && !mapError && (
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
          
          <div
            id="offera-ride-map-container"
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
      </div>
    </main>
  );
}

