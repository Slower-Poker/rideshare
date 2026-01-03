/**
 * MapLibre GL JS Type Definitions
 * Minimal type definitions for dynamically loaded MapLibre library
 */

export interface MapLibrePopupInstance {
  setHTML(html: string): MapLibrePopupInstance;
}

export interface MapLibreMarkerInstance {
  setLngLat(coords: [number, number]): MapLibreMarkerInstance;
  setPopup(popup: MapLibrePopupInstance): MapLibreMarkerInstance;
  addTo(map: MapLibreMapInstance): MapLibreMarkerInstance;
  remove(): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  getLngLat(): { lat: number; lng: number };
  getPopup(): MapLibrePopupInstance | null;
}

export interface MapLibreMapInstance {
  on(event: string, handler: (...args: unknown[]) => void): void;
  remove(): void;
  getCenter(): { lat: number; lng: number };
  setCenter(center: [number, number]): void;
  setZoom(zoom: number): void;
  resize(): void;
  fitBounds(
    bounds: [[number, number], [number, number]],
    options?: { padding?: number; animate?: boolean }
  ): void;
  getLayer(id: string): unknown | undefined;
  removeLayer(id: string): void;
  getSource(id: string): unknown | undefined;
  removeSource(id: string): void;
  addSource(id: string, source: unknown): void;
  addLayer(layer: unknown): void;
}

export type MapLibreMap = MapLibreMapInstance;
export type MapLibreMarker = MapLibreMarkerInstance;

