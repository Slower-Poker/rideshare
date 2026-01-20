import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Clock, Users, DollarSign, FileText, Loader2 } from 'lucide-react';
import { client } from '../client';
import type { Schema } from '../../amplify/data/resource';
import type { SharedProps } from '../types';
import { toast } from '../utils/toast';

type RideRequest = Schema['RideRequest']['type'];

export function BookaRideRequest({ setCurrentView }: SharedProps) {
  const [rideRequests, setRideRequests] = useState<RideRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRideRequests();
  }, []);

  const loadRideRequests = async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if RideRequest model is available
      if (!client.models.RideRequest) {
        const errorMsg = 'RideRequest model not available. Please restart the Amplify sandbox.';
        setError(errorMsg);
        toast.error('Ride request feature is not available yet. Please restart the Amplify sandbox.');
        setLoading(false);
        return;
      }

      const { data, errors } = await client.models.RideRequest.list({
        limit: 100, // Adjust as needed
      });

      if (errors) {
        console.error('Error loading ride requests:', errors);
        setError('Failed to load ride requests');
        toast.error('Failed to load ride requests');
      } else {
        // Sort by creation date, newest first
        const sorted = (data || []).sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });
        setRideRequests(sorted);
      }
    } catch (err) {
      console.error('Error loading ride requests:', err);
      setError('An error occurred while loading ride requests');
      toast.error('Failed to load ride requests');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusBadgeColor = (status: string | null | undefined): string => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'matched':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
          <h1 className="text-xl font-bold text-gray-900">Ride Requests</h1>
          <button
            onClick={loadRideRequests}
            className="ml-auto px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading ride requests...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 font-medium mb-2">Error</p>
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={loadRideRequests}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : rideRequests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Ride Requests</h2>
            <p className="text-gray-600 mb-6">There are no ride requests yet.</p>
            <button
              onClick={() => setCurrentView('bookRide')}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Create a Ride Request
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <p className="text-sm text-gray-600">
                Showing <span className="font-semibold">{rideRequests.length}</span> ride request{rideRequests.length !== 1 ? 's' : ''}
              </p>
            </div>

            {rideRequests.map((request) => (
              <div
                key={request.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="p-6">
                  {/* Header with Status */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">Ride Request</h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(
                            request.status
                          )}`}
                        >
                          {request.status || 'pending'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Created: {formatDate(request.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Locations */}
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    {/* Pickup */}
                    <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-primary-700 uppercase tracking-wide mb-1">
                            Pickup
                          </p>
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {request.pickupAddress || 'Location selected'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {request.pickupLatitude?.toFixed(6)}, {request.pickupLongitude?.toFixed(6)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Dropoff */}
                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-red-700 uppercase tracking-wide mb-1">
                            Dropoff
                          </p>
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {request.dropoffAddress || 'Location selected'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {request.dropoffLatitude?.toFixed(6)}, {request.dropoffLongitude?.toFixed(6)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    {/* Requested Time */}
                    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                      <Clock className="w-5 h-5 text-gray-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 mb-0.5">Requested Time</p>
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {formatDate(request.requestedTime)}
                        </p>
                      </div>
                    </div>

                    {/* Number of Seats */}
                    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                      <Users className="w-5 h-5 text-gray-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 mb-0.5">Seats Needed</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {request.numberOfSeats} {request.numberOfSeats === 1 ? 'seat' : 'seats'}
                        </p>
                      </div>
                    </div>

                    {/* Maximum Amount */}
                    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                      <DollarSign className="w-5 h-5 text-gray-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 mb-0.5">Max Amount</p>
                        <p className="text-sm font-semibold text-gray-900">
                          ${request.maximumAmount?.toFixed(2)} CAD
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {request.notes && (
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                      <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1">
                            Notes
                          </p>
                          <p className="text-sm text-gray-900 whitespace-pre-wrap">{request.notes}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
