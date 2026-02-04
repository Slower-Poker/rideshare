/**
 * RideCard Component
 * 
 * Unified card component for displaying rides (both offers and requests)
 * Shows: status badge, name, route, time, seats, price, round-trip indicator
 */

import { MapPin, Clock, Users, DollarSign, ArrowRight } from 'lucide-react';
import type { Ride } from '../types';
import { RideStatusBadge, RideTypeBadge, RoundTripBadge } from './RideStatusBadge';
import { 
  getDisplayName, 
  formatRelativeDate, 
  formatPrice, 
  getAvailableSeats,
  formatTimeUntil,
  isDeparturePast,
  canJoinRide
} from '../utils/rideUtils';

interface RideCardProps {
  ride: Ride;
  onClick?: () => void;
  onJoin?: () => void;
  onCancel?: () => void;
  onStart?: () => void;
  onComplete?: () => void;
  showActions?: boolean;
  isOwner?: boolean;
  compact?: boolean;
  className?: string;
}

export function RideCard({
  ride,
  onClick,
  onJoin,
  onCancel,
  onStart,
  onComplete,
  showActions = false,
  isOwner = false,
  compact = false,
  className = '',
}: RideCardProps) {
  const displayName = getDisplayName(ride);
  const availableSeats = getAvailableSeats(ride);
  const canJoin = canJoinRide(ride);
  const departurePast = isDeparturePast(ride.departureTime);
  const isRoundTrip = !!ride.linkedRideId;

  // Determine origin/destination display
  const origin = ride.originRegion || ride.originAddress?.split(',')[0] || 'Origin';
  const destination = ride.destinationRegion || ride.destinationAddress?.split(',')[0] || 'Destination';

  if (compact) {
    return (
      <div
        className={`bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer ${className}`}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
        aria-label={`View details for ${displayName}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <RideTypeBadge rideType={ride.rideType} size="sm" />
            <span className="text-sm font-medium text-gray-900 truncate">
              {origin} → {destination}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-gray-600">
              {formatRelativeDate(ride.departureTime)}
            </span>
            <RideStatusBadge status={ride.status} size="sm" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <article
      className={`bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow ${className}`}
      aria-label={displayName}
    >
      {/* Header with badges */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <RideTypeBadge rideType={ride.rideType} />
            <RideStatusBadge status={ride.status} />
            {isRoundTrip && <RoundTripBadge isReturn={ride.isReturnTrip || false} />}
          </div>
          {ride.joinCode && (
            <span className="text-xs text-gray-500 font-mono">
              Code: {ride.joinCode}
            </span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div 
        className={`p-4 ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      >
        {/* Ride name */}
        {ride.name && (
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {ride.name}
          </h3>
        )}

        {/* Route */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1 text-gray-700 flex-1 min-w-0">
            <MapPin className="w-4 h-4 text-green-600 shrink-0" aria-hidden />
            <span className="truncate">{origin}</span>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
          <div className="flex items-center gap-1 text-gray-700 flex-1 min-w-0">
            <MapPin className="w-4 h-4 text-red-600 shrink-0" aria-hidden />
            <span className="truncate">{destination}</span>
          </div>
        </div>

        {/* Details row */}
        <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
          {/* Time */}
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 shrink-0" aria-hidden />
            <span>
              {formatRelativeDate(ride.departureTime)}
              {!departurePast && ride.status !== 'completed' && ride.status !== 'cancelled' && (
                <span className="text-gray-400 ml-1">
                  ({formatTimeUntil(ride.departureTime)})
                </span>
              )}
            </span>
          </div>

          {/* Seats */}
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4 shrink-0" aria-hidden />
            <span>
              {ride.rideType === 'offer' 
                ? `${availableSeats} of ${ride.totalSeats} seats`
                : `${ride.totalSeats} seat${ride.totalSeats !== 1 ? 's' : ''} needed`
              }
            </span>
          </div>

          {/* Price */}
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4 shrink-0" aria-hidden />
            <span>
              {ride.rideType === 'offer'
                ? formatPrice(ride.pricePerSeat)
                : `Max ${formatPrice(ride.maximumAmount)}`
              }
              {ride.rideType === 'offer' && '/seat'}
            </span>
          </div>
        </div>

        {/* Notes preview */}
        {ride.notes && (
          <p className="mt-2 text-sm text-gray-500 line-clamp-2">
            {ride.notes}
          </p>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-2 flex-wrap">
          {isOwner ? (
            <>
              {ride.status === 'scheduled' && onStart && (
                <button
                  onClick={onStart}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors min-h-[44px]"
                >
                  Start Ride
                </button>
              )}
              {ride.status === 'in_progress' && onComplete && (
                <button
                  onClick={onComplete}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors min-h-[44px]"
                >
                  Complete Ride
                </button>
              )}
              {(ride.status === 'open' || ride.status === 'scheduled' || ride.status === 'in_progress') && onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
              )}
            </>
          ) : (
            <>
              {canJoin && onJoin && (
                <button
                  onClick={onJoin}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors min-h-[44px]"
                >
                  {ride.rideType === 'offer' ? 'Join Ride' : 'Offer to Help'}
                </button>
              )}
            </>
          )}
          {onClick && (
            <button
              onClick={onClick}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors min-h-[44px] ml-auto"
            >
              View Details
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * RideCardSkeleton - Loading placeholder
 */
export function RideCardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-3 animate-pulse">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-16 h-5 bg-gray-200 rounded-full" />
            <div className="w-32 h-4 bg-gray-200 rounded" />
          </div>
          <div className="w-20 h-5 bg-gray-200 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-16 h-5 bg-gray-200 rounded-full" />
          <div className="w-20 h-5 bg-gray-200 rounded-full" />
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-24 h-4 bg-gray-200 rounded" />
          <div className="w-4 h-4 bg-gray-200 rounded" />
          <div className="w-24 h-4 bg-gray-200 rounded" />
        </div>
        <div className="flex items-center gap-4">
          <div className="w-32 h-4 bg-gray-200 rounded" />
          <div className="w-20 h-4 bg-gray-200 rounded" />
          <div className="w-16 h-4 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}
