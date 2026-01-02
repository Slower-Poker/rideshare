/**
 * MapLibre GL JS Dynamic Loader
 * Loads MapLibre GL JS from CDN dynamically (not bundled)
 * Implements version fallback strategy for reliability
 */

// MapLibre is loaded from CDN, so we use a generic type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapLibreGlobal = any;

const VERSIONS = ['3.6.2', '3.0.0', '2.4.0'] as const;
const CDN_BASE_JS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@';
const CDN_BASE_CSS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@';
const FALLBACK_CDN_JS = 'https://unpkg.com/maplibre-gl@';
const FALLBACK_CDN_CSS = 'https://unpkg.com/maplibre-gl@';

interface LoadOptions {
  onLoad?: (maplibregl: MapLibreGlobal) => void;
  onError?: (error: Error) => void;
  versionIndex?: number;
  cdnIndex?: number; // 0 = jsdelivr, 1 = unpkg
}

let isLoading = false;
let loadedVersion: string | null = null;
let maplibreglInstance: MapLibreGlobal | null = null;
const loadCallbacks: Array<{ onLoad: (maplibregl: MapLibreGlobal) => void; onError: (error: Error) => void }> = [];

/**
 * Check if MapLibre GL JS is already loaded
 */
export function isMapLibreLoaded(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  // Check if global is available
  const hasGlobal = typeof (window as any).maplibregl !== 'undefined';
  // Check if we have cached instance
  const hasInstance = maplibreglInstance !== null;
  return hasGlobal || hasInstance;
}

/**
 * Get the loaded MapLibre instance
 */
export function getMapLibreInstance(): MapLibreGlobal | null {
  if (isMapLibreLoaded() && maplibreglInstance) {
    return maplibreglInstance;
  }
  if (typeof window !== 'undefined' && (window as any).maplibregl) {
    maplibreglInstance = (window as any).maplibregl;
    return maplibreglInstance;
  }
  return null;
}

/**
 * Load CSS for MapLibre GL JS
 */
function loadCSS(version: string, cdnIndex: number = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if CSS is already loaded
    const existingCSS = document.getElementById('maplibre-gl-css');
    if (existingCSS) {
      resolve();
      return;
    }

    const cssLink = document.createElement('link');
    cssLink.id = 'maplibre-gl-css';
    cssLink.rel = 'stylesheet';
    cssLink.href = cdnIndex === 0
      ? `${CDN_BASE_CSS}${version}/dist/maplibre-gl.css`
      : `${FALLBACK_CDN_CSS}${version}/dist/maplibre-gl.css`;
    
    cssLink.onload = () => resolve();
    cssLink.onerror = () => reject(new Error(`Failed to load MapLibre CSS from ${cdnIndex === 0 ? 'jsdelivr' : 'unpkg'}`));
    
    document.head.appendChild(cssLink);
  });
}

/**
 * Load JavaScript for MapLibre GL JS
 */
function loadJS(version: string, cdnIndex: number = 0): Promise<MapLibreGlobal> {
  return new Promise((resolve, reject) => {
    // Check if script is already loaded
    const existingScript = document.getElementById('maplibre-gl-js');
    if (existingScript && isMapLibreLoaded()) {
      const instance = getMapLibreInstance();
      if (instance) {
        resolve(instance);
        return;
      }
    }

    const script = document.createElement('script');
    script.id = 'maplibre-gl-js';
    script.src = cdnIndex === 0
      ? `${CDN_BASE_JS}${version}/dist/maplibre-gl.js`
      : `${FALLBACK_CDN_JS}${version}/dist/maplibre-gl.js`;
    script.async = true;
    script.crossOrigin = 'anonymous';
    
    script.onload = () => {
      // Wait a bit for the global to be available
      setTimeout(() => {
        if (typeof window !== 'undefined' && (window as any).maplibregl) {
          maplibreglInstance = (window as any).maplibregl;
          loadedVersion = version;
          resolve(maplibreglInstance);
        } else {
          reject(new Error('MapLibre GL JS loaded but global object not found'));
        }
      }, 100);
    };
    
    script.onerror = () => {
      reject(new Error(`Failed to load MapLibre JS from ${cdnIndex === 0 ? 'jsdelivr' : 'unpkg'}`));
    };
    
    document.head.appendChild(script);
  });
}

/**
 * Load MapLibre GL JS with version and CDN fallback
 */
export function loadMapLibre(options: LoadOptions = {}): Promise<MapLibreGlobal> {
  const { onLoad, onError, versionIndex = 0, cdnIndex = 0 } = options;

  // If already loaded, return immediately
  if (isMapLibreLoaded()) {
    const instance = getMapLibreInstance();
    if (instance) {
      onLoad?.(instance);
      return Promise.resolve(instance);
    }
  }

  // If already loading, queue the callback
  if (isLoading) {
    return new Promise((resolve, reject) => {
      loadCallbacks.push({
        onLoad: (maplibregl) => {
          onLoad?.(maplibregl);
          resolve(maplibregl);
        },
        onError: (error) => {
          onError?.(error);
          reject(error);
        },
      });
    });
  }

  isLoading = true;

  const tryLoadVersion = async (vIndex: number, cIndex: number): Promise<MapLibreGlobal> => {
    if (vIndex >= VERSIONS.length) {
      throw new Error('All MapLibre GL JS versions failed to load');
    }

    const version = VERSIONS[vIndex];
    if (!version) {
      throw new Error('Invalid version index');
    }

    try {
      // Load CSS first
      await loadCSS(version, cIndex);
      
      // Then load JS
      const maplibregl = await loadJS(version, cIndex);
      
      isLoading = false;
      loadedVersion = version;
      
      // Notify all queued callbacks
      loadCallbacks.forEach(cb => cb.onLoad(maplibregl));
      loadCallbacks.length = 0;
      
      onLoad?.(maplibregl);
      return maplibregl;
    } catch (error) {
      // Try next CDN if available
      if (cIndex === 0) {
        return tryLoadVersion(vIndex, 1);
      }
      
      // Try next version
      return tryLoadVersion(vIndex + 1, 0);
    }
  };

  return tryLoadVersion(versionIndex, cdnIndex).catch((error) => {
    isLoading = false;
    
    // Notify all queued callbacks
    loadCallbacks.forEach(cb => cb.onError(error));
    loadCallbacks.length = 0;
    
    onError?.(error);
    throw error;
  });
}

/**
 * Cleanup MapLibre GL JS resources
 */
export function cleanupMapLibre(): void {
  const css = document.getElementById('maplibre-gl-css');
  if (css) {
    css.remove();
  }
  
  const script = document.getElementById('maplibre-gl-js');
  if (script) {
    script.remove();
  }
  
  maplibreglInstance = null;
  loadedVersion = null;
}

/**
 * Get the loaded version
 */
export function getLoadedVersion(): string | null {
  return loadedVersion;
}

