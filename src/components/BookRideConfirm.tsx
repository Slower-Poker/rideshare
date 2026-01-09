import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Clock, Users, DollarSign, FileText, CheckCircle } from 'lucide-react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import type { SharedProps, Location } from '../types';
import { toast } from '../utils/toast';

const BOOKING_DATA_KEY = 'rideshare_booking_data';
const client = generateClient<Schema>();

interface BookingData {
  pickup: Location;
  dropoff: Location;
  requestedTime?: string;
  numberOfSeats?: number;
  maximumAmount?: number;
  notes?: string;
}

export function BookRideConfirm({ setCurrentView, user }: SharedProps) {
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Retrieve booking data from sessionStorage
    const stored = sessionStorage.getItem(BOOKING_DATA_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored) as BookingData;
        setBookingData(data);
      } catch (error) {
        console.error('Failed to parse booking data:', error);
        toast.error('Failed to load booking information');
        setCurrentView('bookRide');
      }
    } else {
      // No booking data, redirect back to book ride
      toast.error('No booking information found');
      setCurrentView('bookRide');
    }
    setLoading(false);
  }, [setCurrentView]);

  const handleConfirm = async () => {
    if (!bookingData) {
      toast.error('No booking data found');
      return;
    }

    if (!bookingData.requestedTime || !bookingData.numberOfSeats || !bookingData.maximumAmount) {
      toast.error('Missing required booking information');
      setCurrentView('bookRideDetails');
      return;
    }

    // Check if user is authenticated
    if (!user) {
      toast.error('Please sign in to create a ride request');
      setCurrentView('account');
      return;
    }

    setSaving(true);

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
        const errorMessage = profileErrors[0]?.message || 'Unable to verify your account. Please try again.';
        toast.error(errorMessage);
        setSaving(false);
        return;
      }

      if (!profiles || profiles.length === 0) {
        toast.error('User profile not found. Please complete your profile in Account settings.');
        setSaving(false);
        setCurrentView('account');
        return;
      }

      const profile = profiles[0];
      if (!profile || !profile.id) {
        toast.error('User profile is invalid. Please contact support.');
        setSaving(false);
        return;
      }
      
      // Check if RideRequest model is available
      if (!client.models.RideRequest) {
        if (import.meta.env.DEV) {
          console.error('RideRequest model not available. Please restart the Amplify sandbox.');
        }
        toast.error('Ride request feature is not available yet. Please restart the Amplify sandbox and try again.');
        setSaving(false);
        return;
      }

      // Validate and convert requestedTime to ISO format
      if (!bookingData.requestedTime) {
        toast.error('Requested time is missing');
        setSaving(false);
        return;
      }

      const requestedDateTime = new Date(bookingData.requestedTime);
      if (isNaN(requestedDateTime.getTime())) {
        toast.error('Invalid requested time format');
        setSaving(false);
        return;
      }

      const requestedTimeISO = requestedDateTime.toISOString();
      
      // Create ride request
      const { data: rideRequest, errors } = await client.models.RideRequest.create({
        requesterId: profile.id,
        pickupLatitude: bookingData.pickup.latitude,
        pickupLongitude: bookingData.pickup.longitude,
        pickupAddress: bookingData.pickup.address || undefined,
        dropoffLatitude: bookingData.dropoff.latitude,
        dropoffLongitude: bookingData.dropoff.longitude,
        dropoffAddress: bookingData.dropoff.address || undefined,
        requestedTime: requestedTimeISO,
        numberOfSeats: bookingData.numberOfSeats!,
        maximumAmount: bookingData.maximumAmount!,
        notes: bookingData.notes || undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      if (errors) {
        console.error('Error creating ride request:', errors);
        toast.error('Failed to create ride request. Please try again.');
        setSaving(false);
        return;
      }

      if (rideRequest) {
        toast.success('Ride request created successfully!');
        // Clear booking data
        sessionStorage.removeItem(BOOKING_DATA_KEY);
        // Redirect to ride requests page
        setCurrentView('bookaRideRequest');
      } else {
        toast.error('Failed to create ride request. Please try again.');
        setSaving(false);
      }
    } catch (error) {
      console.error('Error creating ride request:', error);
      toast.error('An error occurred. Please try again.');
      setSaving(false);
    }
  };

  const handleBack = () => {
    setCurrentView('bookRideDetails');
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!bookingData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to booking"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Confirm Your Ride</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Success Header */}
          <div className="bg-primary-50 border-b border-primary-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-primary-600" />
              <div>
                <h2 className="text-xl font-bold text-primary-900">Review Your Ride Details</h2>
                <p className="text-sm text-primary-700">Please confirm your pickup and dropoff locations</p>
              </div>
            </div>
          </div>

          {/* Booking Details */}
          <div className="p-6 space-y-6">
            {/* Pickup Location */}
            <div className="border-b border-gray-200 pb-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-primary-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Pickup Location</h3>
                  <p className="text-lg font-semibold text-gray-900">
                    {bookingData.pickup.address || 'Selected location'}
                  </p>
                  {bookingData.pickup.address && (
                    <p className="text-sm text-gray-500 mt-1">
                      {bookingData.pickup.latitude.toFixed(6)}, {bookingData.pickup.longitude.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Dropoff Location */}
            <div className="border-b border-gray-200 pb-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-red-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Dropoff Location</h3>
                  <p className="text-lg font-semibold text-gray-900">
                    {bookingData.dropoff.address || 'Selected location'}
                  </p>
                  {bookingData.dropoff.address && (
                    <p className="text-sm text-gray-500 mt-1">
                      {bookingData.dropoff.latitude.toFixed(6)}, {bookingData.dropoff.longitude.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Requested Time */}
            {bookingData.requestedTime && (
              <div className="border-b border-gray-200 pb-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Clock className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Requested Time</h3>
                    <p className="text-lg font-semibold text-gray-900">
                      {new Date(bookingData.requestedTime).toLocaleString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Number of Seats */}
            {bookingData.numberOfSeats !== undefined && (
              <div className="border-b border-gray-200 pb-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Number of Seats</h3>
                    <p className="text-lg font-semibold text-gray-900">
                      {bookingData.numberOfSeats} {bookingData.numberOfSeats === 1 ? 'seat' : 'seats'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Maximum Amount */}
            {bookingData.maximumAmount !== undefined && (
              <div className="border-b border-gray-200 pb-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Maximum Amount</h3>
                    <p className="text-lg font-semibold text-gray-900">
                      ${bookingData.maximumAmount.toFixed(2)} CAD
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {bookingData.notes && (
              <div className="border-b border-gray-200 pb-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                      <FileText className="w-6 h-6 text-amber-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Notes</h3>
                    <p className="text-base text-gray-900 whitespace-pre-wrap">
                      {bookingData.notes}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="bg-gray-50 px-6 py-4 flex gap-3">
            <button
              onClick={handleBack}
              disabled={saving}
              className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back to Edit
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creating...</span>
                </>
              ) : (
                'Confirm Booking'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


