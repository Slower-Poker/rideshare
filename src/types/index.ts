import type { Schema } from '../../amplify/data/resource';

// Amplify generated types - Core entities
export type UserProfile = Schema['UserProfile']['type'];
export type Ride = Schema['Ride']['type'];
export type RideParticipant = Schema['RideParticipant']['type'];
export type RideRating = Schema['RideRating']['type'];
export type Notification = Schema['Notification']['type'];
export type Connection = Schema['Connection']['type'];
export type HostPool = Schema['HostPool']['type'];
export type RiderPool = Schema['RiderPool']['type'];
export type HostPoolMember = Schema['HostPoolMember']['type'];
export type RiderPoolMember = Schema['RiderPoolMember']['type'];
export type HostPoolReview = Schema['HostPoolReview']['type'];
export type RiderPoolReview = Schema['RiderPoolReview']['type'];
export type RecurringRideTemplate = Schema['RecurringRideTemplate']['type'];
export type RideAlert = Schema['RideAlert']['type'];

// View types for routing
export type ViewType = 
  | 'home' 
  | 'findARideMap' 
  | 'account' 
  | 'terms' 
  | 'license' 
  | 'bookRide' 
  | 'bookRideDetails' 
  | 'bookRideConfirm' 
  | 'bookaRideRequest' 
  | 'offerRide' 
  | 'ridePlannerChat' 
  | 'pools' 
  | 'connections' 
  | 'recurringRides'
  | 'notifications'
  | 'rideDetail';

// User types
export type UserType = 'host' | 'rider' | 'both';

// Ride type (offer vs request)
export type RideType = 'offer' | 'request';

// Ride status types (new unified status)
export type RideStatus = 'open' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
export type ParticipantStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

// Notification types
export type NotificationType = 
  | 'ride_booked'
  | 'ride_cancelled'
  | 'ride_started'
  | 'ride_completed'
  | 'participant_joined'
  | 'participant_cancelled'
  | 'ride_expiring';

// Recurring pattern types
export type PatternType = 'weekly' | 'biweekly' | 'custom';

// Location type
export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  region?: string;
}

// Form data types for creating rides
export interface RideFormData {
  // Core
  name?: string;
  rideType: RideType;
  
  // Locations
  origin: Location;
  destination: Location;
  
  // Timing
  departureTime: string;
  graceMinutes?: number;
  
  // Capacity & Pricing
  totalSeats: number;
  pricePerSeat: number;
  maximumAmount?: number; // For requests
  
  // Zones
  pickupRadius?: number;
  dropoffRadius?: number;
  
  // Metadata
  vehicleInfo?: string;
  notes?: string;
  
  // Round-trip
  isRoundTrip?: boolean;
  returnDepartureTime?: string;
}

// Legacy alias for backward compatibility
export type RideOfferFormData = RideFormData;

// Distance unit type
export type DistanceUnit = 'km' | 'miles';

export interface JoinRideFormData {
  pickup?: Location;
  dropoff?: Location;
  seatsRequested?: number;
  message?: string;
}

// Active ride data (stored in localStorage)
export interface ActiveRideData {
  rideId: string;
  role: 'host' | 'rider';
  lastUpdated: string;
}

// Map marker type
export interface RideMarker {
  id: string;
  position: [number, number];
  ride: Ride;
  rideType: RideType;
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

// Recurring ride generation options
export interface RecurringGenerationOptions {
  weeksAhead: number;
  skipExisting?: boolean;
}
