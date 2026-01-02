import type { Schema } from '../../amplify/data/resource';

// Amplify generated types
export type UserProfile = Schema['UserProfile']['type'];
export type RideOffer = Schema['RideOffer']['type'];
export type RideParticipant = Schema['RideParticipant']['type'];
export type RideRating = Schema['RideRating']['type'];

// View types for routing
export type ViewType = 'home' | 'map' | 'activeRide' | 'account' | 'terms' | 'bookRide';

// User types
export type UserType = 'host' | 'rider' | 'both';

// Ride status types
export type RideStatus = 'available' | 'matched' | 'active' | 'completed' | 'cancelled';
export type ParticipantStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

// Location type
export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

// Form data types
export interface RideOfferFormData {
  origin: Location;
  destination: Location;
  departureTime: string;
  availableSeats: number;
  vehicleInfo?: string;
  notes?: string;
}

export interface JoinRideFormData {
  pickup?: Location;
  dropoff?: Location;
  message?: string;
}

// Active ride data (stored in localStorage)
export interface ActiveRideData {
  rideOfferId: string;
  role: 'host' | 'rider';
  lastUpdated: string;
}

// Map marker type
export interface RideMarker {
  id: string;
  position: [number, number];
  rideOffer: RideOffer;
}

// Props types for components
export interface SharedProps {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  user: AuthUser | null;
}

export interface AuthUser {
  userId: string;
  email: string;
  username: string;
}
