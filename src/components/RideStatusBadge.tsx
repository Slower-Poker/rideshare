/**
 * RideStatusBadge Component
 * 
 * Displays a color-coded badge for ride status
 * - open: green
 * - scheduled: blue
 * - in_progress: yellow
 * - completed: gray
 * - cancelled: red
 * - expired: gray (faded)
 */

import type { RideStatus } from '../types';

interface RideStatusBadgeProps {
  status: RideStatus | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const STATUS_CONFIG: Record<RideStatus, { label: string; classes: string }> = {
  open: {
    label: 'Open',
    classes: 'bg-green-100 text-green-800 border-green-200',
  },
  scheduled: {
    label: 'Scheduled',
    classes: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  in_progress: {
    label: 'In Progress',
    classes: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  completed: {
    label: 'Completed',
    classes: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  cancelled: {
    label: 'Cancelled',
    classes: 'bg-red-100 text-red-800 border-red-200',
  },
  expired: {
    label: 'Expired',
    classes: 'bg-gray-50 text-gray-500 border-gray-200',
  },
};

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

export function RideStatusBadge({ status, size = 'sm', className = '' }: RideStatusBadgeProps) {
  if (!status) return null;

  const config = STATUS_CONFIG[status];
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.classes} ${SIZE_CLASSES[size]} ${className}`}
      role="status"
      aria-label={`Ride status: ${config.label}`}
    >
      {config.label}
    </span>
  );
}

/**
 * RideTypeBadge Component
 * 
 * Displays whether this is an offer or request
 */
interface RideTypeBadgeProps {
  rideType: 'offer' | 'request' | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const RIDE_TYPE_CONFIG = {
  offer: {
    label: 'Offering',
    classes: 'bg-primary-100 text-primary-800 border-primary-200',
  },
  request: {
    label: 'Seeking',
    classes: 'bg-purple-100 text-purple-800 border-purple-200',
  },
};

export function RideTypeBadge({ rideType, size = 'sm', className = '' }: RideTypeBadgeProps) {
  if (!rideType) return null;

  const config = RIDE_TYPE_CONFIG[rideType];
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.classes} ${SIZE_CLASSES[size]} ${className}`}
      aria-label={`Ride type: ${config.label}`}
    >
      {config.label}
    </span>
  );
}

/**
 * RoundTripBadge Component
 * 
 * Indicates this ride is part of a round-trip
 */
interface RoundTripBadgeProps {
  isReturn?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function RoundTripBadge({ isReturn = false, size = 'sm', className = '' }: RoundTripBadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200 ${SIZE_CLASSES[size]} ${className}`}
      aria-label={isReturn ? 'Return trip' : 'Round trip'}
    >
      {isReturn ? '↩ Return' : '↔ Round Trip'}
    </span>
  );
}
