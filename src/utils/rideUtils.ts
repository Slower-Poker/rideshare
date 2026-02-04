/**
 * Ride Utilities
 * 
 * Helper functions for the unified Ride model including:
 * - Display name generation
 * - Expiry calculation and checking
 * - Status helpers
 * - Cancellation tracking
 * - Round-trip helpers
 */

import type { Ride, RideStatus, UserProfile } from '../types';

// Ride status type (matches schema enum)
export type { RideStatus };

// Status display configuration
export const RIDE_STATUS_CONFIG: Record<RideStatus, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Open', color: 'text-green-700', bgColor: 'bg-green-100' },
  scheduled: { label: 'Scheduled', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  in_progress: { label: 'In Progress', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  completed: { label: 'Completed', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100' },
  expired: { label: 'Expired', color: 'text-gray-500', bgColor: 'bg-gray-50' },
};

/**
 * Format a date relative to today (Today, Tomorrow, or date)
 */
export function formatRelativeDate(dateStr: string | Date): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateOnly.getTime() === today.getTime()) {
    return `Today ${formatTime(date)}`;
  } else if (dateOnly.getTime() === tomorrow.getTime()) {
    return `Tomorrow ${formatTime(date)}`;
  } else {
    return formatDateShort(date);
  }
}

/**
 * Format time as HH:MM AM/PM
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

/**
 * Format date as "Mon Feb 10"
 */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
}

/**
 * Generate display name for a ride
 * Uses user-provided name if available, otherwise auto-generates
 */
export function getDisplayName(ride: Partial<Ride>): string {
  if (ride.name) {
    return ride.name;
  }

  const origin = ride.originRegion || ride.originAddress?.split(',')[0] || 'Origin';
  const dest = ride.destinationRegion || ride.destinationAddress?.split(',')[0] || 'Destination';
  
  let dateStr = '';
  if (ride.departureTime) {
    dateStr = ` • ${formatRelativeDate(ride.departureTime)}`;
  }

  const suffix = ride.linkedRideId ? ' (Round Trip)' : '';
  
  return `${origin} → ${dest}${dateStr}${suffix}`;
}

/**
 * Generate a short display name (no date)
 */
export function getShortDisplayName(ride: Partial<Ride>): string {
  if (ride.name) {
    return ride.name;
  }

  const origin = ride.originRegion || ride.originAddress?.split(',')[0] || 'Origin';
  const dest = ride.destinationRegion || ride.destinationAddress?.split(',')[0] || 'Destination';
  
  return `${origin} → ${dest}`;
}

/**
 * Calculate expiry datetime based on departure time and grace period
 */
export function calculateExpiresAt(departureTime: string | Date, graceMinutes: number = 60): Date {
  const departure = new Date(departureTime);
  return new Date(departure.getTime() + graceMinutes * 60 * 1000);
}

/**
 * Calculate expiry as ISO string
 */
export function calculateExpiresAtISO(departureTime: string | Date, graceMinutes: number = 60): string {
  return calculateExpiresAt(departureTime, graceMinutes).toISOString();
}

/**
 * Check if a ride has expired based on current time
 */
export function isRideExpired(ride: Partial<Ride>): boolean {
  if (!ride.expiresAt) return false;
  if (ride.status === 'completed' || ride.status === 'cancelled') return false;
  
  const now = new Date();
  const expiresAt = new Date(ride.expiresAt);
  return now > expiresAt;
}

/**
 * Check if a ride should be marked as expired (status update needed)
 */
export function shouldExpireRide(ride: Partial<Ride>): boolean {
  if (ride.status !== 'open' && ride.status !== 'scheduled') return false;
  return isRideExpired(ride);
}

/**
 * Get time until departure or expiry
 */
export function getTimeUntil(dateStr: string | Date): { value: number; unit: 'minutes' | 'hours' | 'days' } {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes < 60) {
    return { value: Math.max(0, diffMinutes), unit: 'minutes' };
  } else if (diffMinutes < 60 * 24) {
    return { value: Math.floor(diffMinutes / 60), unit: 'hours' };
  } else {
    return { value: Math.floor(diffMinutes / (60 * 24)), unit: 'days' };
  }
}

/**
 * Format time until as human readable string
 */
export function formatTimeUntil(dateStr: string | Date): string {
  const { value, unit } = getTimeUntil(dateStr);
  if (value === 0 && unit === 'minutes') {
    return 'Now';
  }
  return `${value} ${unit}`;
}

/**
 * Check if departure time is in the past
 */
export function isDeparturePast(departureTime: string | Date): boolean {
  const departure = new Date(departureTime);
  const now = new Date();
  return departure < now;
}

/**
 * Calculate user's cancellation rate
 */
export function getCancellationRate(profile: Partial<UserProfile>): number {
  const total = profile.totalRidesCreated || 0;
  const cancelled = profile.cancellationCount || 0;
  
  if (total === 0) return 0;
  return cancelled / total;
}

/**
 * Get reliability percentage (inverse of cancellation rate)
 */
export function getReliabilityPercentage(profile: Partial<UserProfile>): number {
  const rate = getCancellationRate(profile);
  return Math.round((1 - rate) * 100);
}

/**
 * Format reliability for display
 */
export function formatReliability(profile: Partial<UserProfile>): string {
  const total = profile.totalRidesCreated || 0;
  if (total === 0) return 'New';
  
  const percentage = getReliabilityPercentage(profile);
  return `${percentage}% reliable`;
}

/**
 * Generate a 6-character join code
 */
export function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars: I, O, 0, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Check if a ride can be started (by host)
 */
export function canStartRide(ride: Partial<Ride>): boolean {
  return ride.status === 'scheduled';
}

/**
 * Check if a ride can be completed (by host)
 */
export function canCompleteRide(ride: Partial<Ride>): boolean {
  return ride.status === 'in_progress';
}

/**
 * Check if a ride can be cancelled
 */
export function canCancelRide(ride: Partial<Ride>): boolean {
  return ride.status === 'open' || ride.status === 'scheduled' || ride.status === 'in_progress';
}

/**
 * Check if a ride can accept new participants
 */
export function canJoinRide(ride: Partial<Ride>): boolean {
  if (ride.status !== 'open' && ride.status !== 'scheduled') return false;
  const available = (ride.totalSeats || 0) - (ride.seatsBooked || 0);
  return available > 0;
}

/**
 * Get available seats count
 */
export function getAvailableSeats(ride: Partial<Ride>): number {
  return (ride.totalSeats || 0) - (ride.seatsBooked || 0);
}

/**
 * Format price for display
 */
export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return 'Free';
  if (price === 0) return 'Free';
  return `$${price.toFixed(2)}`;
}

/**
 * Check if this ride is part of a round-trip
 */
export function isRoundTrip(ride: Partial<Ride>): boolean {
  return !!ride.linkedRideId;
}

/**
 * Get ride type label
 */
export function getRideTypeLabel(rideType: 'offer' | 'request' | null | undefined): string {
  if (rideType === 'offer') return 'Offering';
  if (rideType === 'request') return 'Seeking';
  return 'Ride';
}

/**
 * Parse days of week from JSON string
 */
export function parseDaysOfWeek(daysOfWeekStr: string | null | undefined): number[] {
  if (!daysOfWeekStr) return [];
  try {
    return JSON.parse(daysOfWeekStr);
  } catch {
    return [];
  }
}

/**
 * Stringify days of week for storage
 */
export function stringifyDaysOfWeek(days: number[]): string {
  return JSON.stringify(days);
}

/**
 * Parse skip dates from JSON string
 */
export function parseSkipDates(skipDatesStr: string | null | undefined): string[] {
  if (!skipDatesStr) return [];
  try {
    return JSON.parse(skipDatesStr);
  } catch {
    return [];
  }
}

/**
 * Stringify skip dates for storage
 */
export function stringifySkipDates(dates: string[]): string {
  return JSON.stringify(dates);
}

/**
 * Get day name from day of week number
 */
export function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] || '';
}

/**
 * Get short day name from day of week number
 */
export function getShortDayName(dayOfWeek: number): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[dayOfWeek] || '';
}

/**
 * Format days of week as readable string
 */
export function formatDaysOfWeek(days: number[]): string {
  if (days.length === 0) return '';
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
  
  return days.map(d => getShortDayName(d)).join(', ');
}
