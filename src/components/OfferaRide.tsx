import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Search, MapPin, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { generateClient } from 'aws-amplify/data';
import type { SharedProps, Location } from '../types';
import type { Schema } from '../../amplify/data/resource';
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
} from '../utils/maplibreUtils';
import { toast } from '../utils/toast';
import type { MapLibreMap, MapLibreMarker } from '../types/maplibre';

const client = generateClient<Schema>();

// Nominatim API endpoint for OSM geocoding
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';

interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
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
  const [departureTime, setDepartureTime] = useState('');
  const [availableSeats, setAvailableSeats] = useState<number>(1);
  const [vehicleInfo, setVehicleInfo] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Verification state
  const [isVerified, setIsVerified] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(true);
  
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
  
  // Use refs to track current locations for map click handler
  const originLocationRef = useRef<Location | null>(null);
  const destinationLocationRef = useRef<Location | null>(null);
  const isMountedRef = useRef(true);
  const fetchAbortControllerRef = useRef<AbortController | null>(null);

  // Check verification status
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
        setIsVerified(profile?.verifiedRideHost === true);
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
      console.error('Geocoding error:', error);
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
        console.error(errorMsg);
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
        console.error('Map error:', e);
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
      console.error('Map initialization error:', error);
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
      toast.error('You must be a verified ride host to offer rides');
      return;
    }

    if (!originLocation || !destinationLocation) {
      toast.error('Please select both origin and destination locations');
      return;
    }

    if (!departureTime) {
      toast.error('Please select a departure time');
      return;
    }

    if (availableSeats < 1) {
      toast.error('Please specify at least 1 available seat');
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
        toast.error('Unable to verify your account. Please try again.');
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

      // Validate departure time is in the future
      const departureDateTime = new Date(departureTime);
      const now = new Date();

      if (departureDateTime <= now) {
        toast.error('Departure time must be in the future');
        setIsSubmitting(false);
        return;
      }

      const departureDateTimeISO = departureDateTime.toISOString();
      
      const { data: rideOffer, errors } = await client.models.RideOffer.create({
        hostId: profile.id,
        originLatitude: originLocation.latitude,
        originLongitude: originLocation.longitude,
        originAddress: originLocation.address || '',
        destinationLatitude: destinationLocation.latitude,
        destinationLongitude: destinationLocation.longitude,
        destinationAddress: destinationLocation.address || '',
        departureTime: departureDateTimeISO,
        availableSeats: availableSeats,
        seatsBooked: 0,
        status: 'available',
        vehicleInfo: vehicleInfo || undefined,
        notes: notes || undefined,
      });

      if (errors) {
        if (import.meta.env.DEV) {
          console.error('Error creating ride offer:', errors);
        }
        toast.error('Failed to create ride offer. Please try again.');
        setIsSubmitting(false);
        return;
      }

      if (rideOffer) {
        toast.success('Ride offer created successfully!');
        setCurrentView('home');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error creating ride offer:', error);
      }
      toast.error('Failed to create ride offer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show verification warning if not verified
  if (checkingVerification) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="h-screen flex flex-col">
        <header className="bg-white shadow-sm z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
            <button
              onClick={() => setCurrentView('home')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Back to home"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Offer a Ride</h1>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Verification Required
            </h2>
            <p className="text-gray-600 mb-6">
              To offer rides on RideShare.Click, you must be verified as a ride host by RideShare.Click.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Please contact RideShare.Click to get verified, or check your account profile for verification status.
            </p>
            <button
              onClick={() => setCurrentView('account')}
              className="w-full bg-primary-600 text-white py-3 px-6 rounded-lg hover:bg-primary-700 transition-colors"
            >
              View My Account
            </button>
            <button
              onClick={() => setCurrentView('home')}
              className="w-full mt-3 bg-gray-200 text-gray-900 py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </main>
      </div>
    );
  }

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
          <h1 className="text-xl font-bold text-gray-900">Offer a Ride</h1>
          <div className="ml-auto flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Verified Ride Host</span>
          </div>
        </div>
      </header>

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

            {/* Departure Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Departure Time
              </label>
              <input
                type="datetime-local"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
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
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !originLocation || !destinationLocation || !departureTime}
                className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Creating Ride Offer...</span>
                  </>
                ) : (
                  <span>Create Ride Offer</span>
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
    </div>
  );
}

