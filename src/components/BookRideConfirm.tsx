import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Calendar, Clock, Users, CheckCircle } from 'lucide-react';
import type { SharedProps, Location } from '../types';
import { toast } from '../utils/toast';

const BOOKING_DATA_KEY = 'rideshare_booking_data';

interface BookingData {
  pickup: Location;
  dropoff: Location;
}

export function BookRideConfirm({ setCurrentView }: SharedProps) {
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleConfirm = () => {
    // TODO: Implement actual booking logic
    toast.success('Ride booking confirmed! (Feature coming soon)');
    // Clear booking data
    sessionStorage.removeItem(BOOKING_DATA_KEY);
    // Redirect to home
    setCurrentView('home');
  };

  const handleBack = () => {
    setCurrentView('bookRide');
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

            {/* Additional Information (Placeholder) */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3 text-gray-600">
                <Calendar className="w-5 h-5" />
                <span className="text-sm">Date & Time: To be selected</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <Users className="w-5 h-5" />
                <span className="text-sm">Seats: To be selected</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <Clock className="w-5 h-5" />
                <span className="text-sm">Estimated duration: Calculating...</span>
              </div>
            </div>

            {/* Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This is a confirmation page. Additional features like date/time selection, 
                seat preferences, and ride matching will be available soon.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-gray-50 px-6 py-4 flex gap-3">
            <button
              onClick={handleBack}
              className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Back to Edit
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Confirm Booking
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


