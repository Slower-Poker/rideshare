import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Search, MapPin, X, Loader2 } from 'lucide-react';
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
} from '../utils/maplibreUtils';
import { toast } from '../utils/toast';

// Nominatim API endpoint for OSM geocoding
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';

interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

// MapLibre marker types
type MapLibreMap = any; // MapLibre Map instance
type MapLibreMarker = any; // MapLibre Marker instance

export function BookaRide({ setCurrentView }: SharedProps) {
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<Location | null>(null);
  const [pickupSearch, setPickupSearch] = useState('');
  const [dropoffSearch, setDropoffSearch] = useState('');
  const [pickupResults, setPickupResults] = useState<GeocodeResult[]>([]);
  const [dropoffResults, setDropoffResults] = useState<GeocodeResult[]>([]);
  const [searchingPickup, setSearchingPickup] = useState(false);
  const [searchingDropoff, setSearchingDropoff] = useState(false);
  
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
  
  // Use refs to track current locations for map click handler
  const pickupLocationRef = useRef<Location | null>(null);
  const dropoffLocationRef = useRef<Location | null>(null);
  const isMountedRef = useRef(true);
  const fetchAbortControllerRef = useRef<AbortController | null>(null);
  
  // Keep refs in sync with state
  useEffect(() => {
    pickupLocationRef.current = pickupLocation;
  }, [pickupLocation]);
  
  useEffect(() => {
    dropoffLocationRef.current = dropoffLocation;
  }, [dropoffLocation]);

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

  // Handle pickup search
  const handlePickupSearch = async (query: string) => {
    setPickupSearch(query);
    setSearchingPickup(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      if (query.trim()) {
        const results = await geocodeAddress(query);
        setPickupResults(results);
      } else {
        setPickupResults([]);
      }
      setSearchingPickup(false);
    }, 500);
  };

  // Handle dropoff search
  const handleDropoffSearch = async (query: string) => {
    setDropoffSearch(query);
    setSearchingDropoff(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      if (query.trim()) {
        const results = await geocodeAddress(query);
        setDropoffResults(results);
      } else {
        setDropoffResults([]);
      }
      setSearchingDropoff(false);
    }, 500);
  };

  // Select pickup location
  const selectPickup = (result: GeocodeResult) => {
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
    setPickupLocation(location);
    setPickupSearch(result.display_name);
    setPickupResults([]);
  };

  // Select dropoff location
  const selectDropoff = (result: GeocodeResult) => {
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
    setDropoffLocation(location);
    setDropoffSearch(result.display_name);
    setDropoffResults([]);
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
        
        const currentPickup = pickupLocationRef.current;
        const currentDropoff = dropoffLocationRef.current;
        
        if (!currentPickup) {
          setPickupLocation(locationWithAddress);
          setPickupSearch(locationWithAddress.address || 'Selected location');
        } else if (!currentDropoff) {
          setDropoffLocation(locationWithAddress);
          setDropoffSearch(locationWithAddress.address || 'Selected location');
        } else {
          const distToPickup = Math.sqrt(
            Math.pow(locationWithAddress.latitude - currentPickup.latitude, 2) +
            Math.pow(locationWithAddress.longitude - currentPickup.longitude, 2)
          );
          const distToDropoff = Math.sqrt(
            Math.pow(locationWithAddress.latitude - currentDropoff.latitude, 2) +
            Math.pow(locationWithAddress.longitude - currentDropoff.longitude, 2)
          );
          
          if (distToPickup < distToDropoff) {
            setPickupLocation(locationWithAddress);
            setPickupSearch(locationWithAddress.address || 'Selected location');
          } else {
            setDropoffLocation(locationWithAddress);
            setDropoffSearch(locationWithAddress.address || 'Selected location');
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
        
        const currentPickup = pickupLocationRef.current;
        const currentDropoff = dropoffLocationRef.current;
        
        if (!currentPickup) {
          setPickupLocation(locationWithoutAddress);
          setPickupSearch('Selected location');
        } else if (!currentDropoff) {
          setDropoffLocation(locationWithoutAddress);
          setDropoffSearch('Selected location');
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
    // Always load when component mounts (currentView check removed - component only renders when view is active)
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

      // Add pickup marker (draggable)
      if (pickupLocation) {
        const el = document.createElement('div');
        el.className = 'pickup-marker';
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
            cursor: move;
          ">P</div>
        `;
        
        const marker = new maplibregl.Marker({ 
          element: el,
          draggable: true,
        })
          .setLngLat(locationToCoordinates(pickupLocation))
          .setPopup(
            new maplibregl.Popup({ offset: 25 })
              .setHTML(`
                <div style="text-align: center;">
                  <p style="font-weight: 600; color: #10b981; margin: 0;">Pickup</p>
                  ${pickupLocation.address ? `<p style="font-size: 12px; color: #666; margin: 4px 0 0 0;">${pickupLocation.address}</p>` : ''}
                  <p style="font-size: 10px; color: #999; margin: 4px 0 0 0;">Drag to adjust</p>
                </div>
              `)
          )
          .addTo(map);
        
        // Handle drag end to update location
        marker.on('dragend', () => {
          if (!isMountedRef.current) {
            return;
          }
          
          const lngLat = marker.getLngLat();
          const newLocation: Location = {
            latitude: lngLat.lat,
            longitude: lngLat.lng,
            address: pickupLocation.address || 'Selected location', // Keep existing address temporarily
          };
          
          // Validate location is in Manitoba
          if (!isInManitobaBounds(newLocation.latitude, newLocation.longitude)) {
            toast.error('Location must be within Manitoba, Canada');
            // Reset marker to original position
            marker.setLngLat(locationToCoordinates(pickupLocation));
            return;
          }
          
          // Reverse geocode the new location
          const abortController = new AbortController();
          fetchAbortControllerRef.current = abortController;
          
          fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLocation.latitude}&lon=${newLocation.longitude}&countrycodes=ca`,
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
              
              const resultLat = parseFloat(data.lat || newLocation.latitude.toString());
              const resultLon = parseFloat(data.lon || newLocation.longitude.toString());
              
              if (!isInManitobaBounds(resultLat, resultLon)) {
                toast.error('Selected location is outside Manitoba, Canada');
                marker.setLngLat(locationToCoordinates(pickupLocation));
                return;
              }
              
              const locationWithAddress: Location = {
                latitude: resultLat,
                longitude: resultLon,
                address: data.display_name || 'Selected location',
              };
              
              if (!isMountedRef.current) {
                return;
              }
              
              setPickupLocation(locationWithAddress);
              setPickupSearch(locationWithAddress.address || 'Selected location');
              
              // Update popup with new address
              marker.getPopup()?.setHTML(`
                <div style="text-align: center;">
                  <p style="font-weight: 600; color: #10b981; margin: 0;">Pickup</p>
                  ${locationWithAddress.address ? `<p style="font-size: 12px; color: #666; margin: 4px 0 0 0;">${locationWithAddress.address}</p>` : ''}
                  <p style="font-size: 10px; color: #999; margin: 4px 0 0 0;">Drag to adjust</p>
                </div>
              `);
            })
            .catch((error) => {
              if (error.name === 'AbortError') {
                return;
              }
              
              if (!isMountedRef.current) {
                return;
              }
              
              // If reverse geocoding fails, still update location but keep "Selected location" as address
              setPickupLocation(newLocation);
              setPickupSearch('Selected location');
            });
        });
        
        markersRef.current.push(marker);
      }

      // Add dropoff marker (draggable)
      if (dropoffLocation) {
        const el = document.createElement('div');
        el.className = 'dropoff-marker';
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
            cursor: move;
          ">D</div>
        `;
        
        const marker = new maplibregl.Marker({ 
          element: el,
          draggable: true,
        })
          .setLngLat(locationToCoordinates(dropoffLocation))
          .setPopup(
            new maplibregl.Popup({ offset: 25 })
              .setHTML(`
                <div style="text-align: center;">
                  <p style="font-weight: 600; color: #ef4444; margin: 0;">Dropoff</p>
                  ${dropoffLocation.address ? `<p style="font-size: 12px; color: #666; margin: 4px 0 0 0;">${dropoffLocation.address}</p>` : ''}
                  <p style="font-size: 10px; color: #999; margin: 4px 0 0 0;">Drag to adjust</p>
                </div>
              `)
          )
          .addTo(map);
        
        // Handle drag end to update location
        marker.on('dragend', () => {
          if (!isMountedRef.current) {
            return;
          }
          
          const lngLat = marker.getLngLat();
          const newLocation: Location = {
            latitude: lngLat.lat,
            longitude: lngLat.lng,
            address: dropoffLocation.address || 'Selected location', // Keep existing address temporarily
          };
          
          // Validate location is in Manitoba
          if (!isInManitobaBounds(newLocation.latitude, newLocation.longitude)) {
            toast.error('Location must be within Manitoba, Canada');
            // Reset marker to original position
            marker.setLngLat(locationToCoordinates(dropoffLocation));
            return;
          }
          
          // Reverse geocode the new location
          const abortController = new AbortController();
          fetchAbortControllerRef.current = abortController;
          
          fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLocation.latitude}&lon=${newLocation.longitude}&countrycodes=ca`,
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
              
              const resultLat = parseFloat(data.lat || newLocation.latitude.toString());
              const resultLon = parseFloat(data.lon || newLocation.longitude.toString());
              
              if (!isInManitobaBounds(resultLat, resultLon)) {
                toast.error('Selected location is outside Manitoba, Canada');
                marker.setLngLat(locationToCoordinates(dropoffLocation));
                return;
              }
              
              const locationWithAddress: Location = {
                latitude: resultLat,
                longitude: resultLon,
                address: data.display_name || 'Selected location',
              };
              
              if (!isMountedRef.current) {
                return;
              }
              
              setDropoffLocation(locationWithAddress);
              setDropoffSearch(locationWithAddress.address || 'Selected location');
              
              // Update popup with new address
              marker.getPopup()?.setHTML(`
                <div style="text-align: center;">
                  <p style="font-weight: 600; color: #ef4444; margin: 0;">Dropoff</p>
                  ${locationWithAddress.address ? `<p style="font-size: 12px; color: #666; margin: 4px 0 0 0;">${locationWithAddress.address}</p>` : ''}
                  <p style="font-size: 10px; color: #999; margin: 4px 0 0 0;">Drag to adjust</p>
                </div>
              `);
            })
            .catch((error) => {
              if (error.name === 'AbortError') {
                return;
              }
              
              if (!isMountedRef.current) {
                return;
              }
              
              // If reverse geocoding fails, still update location but keep "Selected location" as address
              setDropoffLocation(newLocation);
              setDropoffSearch('Selected location');
            });
        });
        
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
        pickupLocation,
        dropoffLocation,
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
        } else if (pickupLocation) {
          const [lng, lat] = locationToCoordinates(pickupLocation);
          map.setCenter([lng, lat]);
        } else if (dropoffLocation) {
          const [lng, lat] = locationToCoordinates(dropoffLocation);
          map.setCenter([lng, lat]);
        }
      }
    }, 150);

    return () => {
      clearTimeout(updateTimeout);
    };
  }, [pickupLocation, dropoffLocation, userLocation, isMapLoaded]);

  // Clear locations
  const clearPickup = () => {
    setPickupLocation(null);
    setPickupSearch('');
    setPickupResults([]);
  };

  const clearDropoff = () => {
    setDropoffLocation(null);
    setDropoffSearch('');
    setDropoffResults([]);
  };

  // Handle Next button click
  const handleNext = () => {
    if (!pickupLocation || !dropoffLocation) {
      toast.error('Please select both pickup and dropoff locations');
      return;
    }

    // Store booking data in sessionStorage
    const bookingData = {
      pickup: pickupLocation,
      dropoff: dropoffLocation,
    };
    sessionStorage.setItem('rideshare_booking_data', JSON.stringify(bookingData));
    
    // Navigate to confirmation page
    setCurrentView('bookRideConfirm');
  };

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
          <h1 className="text-xl font-bold text-gray-900">Book a Ride</h1>
        </div>
      </header>

      {/* Search and Map Container */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left Panel - Search */}
        <div className="w-full md:w-96 bg-white border-r border-gray-200 p-4 overflow-y-auto">
          <div className="space-y-4">
            {/* Pickup Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pickup Location
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={pickupSearch}
                  onChange={(e) => handlePickupSearch(e.target.value)}
                  placeholder="Search or click on map"
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                {pickupLocation && (
                  <button
                    onClick={clearPickup}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    aria-label="Clear pickup location"
                  >
                    <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
              
              {/* Search Results */}
              {pickupResults.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                  {pickupResults.map((result) => (
                    <button
                      key={result.place_id}
                      onClick={() => selectPickup(result)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <MapPin className="w-4 h-4 text-primary-600 inline mr-2" />
                      <span className="text-sm text-gray-700">{result.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
              
              {searchingPickup && (
                <p className="mt-2 text-sm text-gray-500">Searching...</p>
              )}

              {/* Selected Location */}
              {pickupLocation && (
                <div className="mt-2 p-3 bg-primary-50 rounded-lg">
                  <p className="text-sm font-medium text-primary-900">Selected:</p>
                  <p className="text-sm text-primary-700">{pickupLocation.address || 'Location selected'}</p>
                </div>
              )}
            </div>

            {/* Dropoff Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dropoff Location
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={dropoffSearch}
                  onChange={(e) => handleDropoffSearch(e.target.value)}
                  placeholder="Search or click on map"
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                {dropoffLocation && (
                  <button
                    onClick={clearDropoff}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    aria-label="Clear dropoff location"
                  >
                    <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
              
              {/* Search Results */}
              {dropoffResults.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                  {dropoffResults.map((result) => (
                    <button
                      key={result.place_id}
                      onClick={() => selectDropoff(result)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <MapPin className="w-4 h-4 text-red-600 inline mr-2" />
                      <span className="text-sm text-gray-700">{result.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
              
              {searchingDropoff && (
                <p className="mt-2 text-sm text-gray-500">Searching...</p>
              )}

              {/* Selected Location */}
              {dropoffLocation && (
                <div className="mt-2 p-3 bg-red-50 rounded-lg">
                  <p className="text-sm font-medium text-red-900">Selected:</p>
                  <p className="text-sm text-red-700">{dropoffLocation.address || 'Location selected'}</p>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="mt-4 space-y-2">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Tip:</strong> You can search for addresses, click on the map, or drag the pins to select precise locations.
                </p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> All searches are limited to Manitoba, Canada.
                </p>
              </div>
            </div>

            {/* Next Button - Only show when both locations are selected */}
            {pickupLocation && dropoffLocation && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={handleNext}
                  className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <span>Next</span>
                  <ArrowLeft className="w-5 h-5 rotate-180" />
                </button>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Review and confirm your ride details
                </p>
              </div>
            )}
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
            id="booka-ride-map-container"
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
