import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Users, DollarSign, FileText } from 'lucide-react';
import type { SharedProps, Location } from '../types';
import { toast } from '../utils/toast';

const BOOKING_DATA_KEY = 'rideshare_booking_data';

interface BookingData {
  pickup: Location;
  dropoff: Location;
  requestedTime?: string;
  numberOfSeats?: number;
  maximumAmount?: number;
  notes?: string;
}

export function BookRideDetails({ setCurrentView }: SharedProps) {
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [requestedTime, setRequestedTime] = useState('');
  const [numberOfSeats, setNumberOfSeats] = useState(1);
  const [maximumAmount, setMaximumAmount] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    // Retrieve booking data from sessionStorage
    const stored = sessionStorage.getItem(BOOKING_DATA_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored) as BookingData;
        setBookingData(data);
        
        // Pre-fill form if data exists
        if (data.requestedTime) {
          setRequestedTime(data.requestedTime);
        }
        if (data.numberOfSeats) {
          setNumberOfSeats(data.numberOfSeats);
        }
        if (data.maximumAmount) {
          setMaximumAmount(data.maximumAmount.toString());
        }
        if (data.notes) {
          setNotes(data.notes);
        }
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

  const handleNext = () => {
    if (!requestedTime) {
      toast.error('Please select a requested time');
      return;
    }

    if (numberOfSeats < 1 || numberOfSeats > 7) {
      toast.error('Number of seats must be between 1 and 7');
      return;
    }

    const maxAmount = parseFloat(maximumAmount);
    if (!maximumAmount || isNaN(maxAmount) || maxAmount <= 0) {
      toast.error('Please enter a valid maximum amount');
      return;
    }

    // Validate that requested time is in the future
    const selectedDate = new Date(requestedTime);
    if (selectedDate <= new Date()) {
      toast.error('Requested time must be in the future');
      return;
    }

    // Update booking data with form values
    const updatedData: BookingData = {
      ...bookingData!,
      requestedTime,
      numberOfSeats,
      maximumAmount: maxAmount,
      notes: notes.trim() || undefined,
    };

    // Store updated booking data
    sessionStorage.setItem(BOOKING_DATA_KEY, JSON.stringify(updatedData));
    
    // Navigate to confirmation page
    setCurrentView('bookRideConfirm');
  };

  const handleBack = () => {
    setCurrentView('bookRide');
  };

  // Set default time to 1 hour from now
  useEffect(() => {
    if (!requestedTime && bookingData) {
      const defaultTime = new Date();
      defaultTime.setHours(defaultTime.getHours() + 1);
      defaultTime.setMinutes(0);
      defaultTime.setSeconds(0);
      setRequestedTime(defaultTime.toISOString().slice(0, 16));
    }
  }, [bookingData, requestedTime]);

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
          <h1 className="text-xl font-bold text-gray-900">Ride Details</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Header Section */}
          <div className="bg-primary-50 border-b border-primary-200 px-6 py-4">
            <h2 className="text-xl font-bold text-primary-900">Set Your Ride Preferences</h2>
            <p className="text-sm text-primary-700 mt-1">Provide additional details for your ride request</p>
          </div>

          {/* Form */}
          <div className="p-6 space-y-6">
            {/* Requested Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary-600" />
                  <span>Requested Time</span>
                </div>
              </label>
              <input
                type="datetime-local"
                value={requestedTime}
                onChange={(e) => setRequestedTime(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
                min={new Date().toISOString().slice(0, 16)}
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Select when you need the ride
              </p>
            </div>

            {/* Number of Seats */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary-600" />
                  <span>Number of Seats</span>
                </div>
              </label>
              <input
                type="number"
                min="1"
                max="7"
                value={numberOfSeats}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value >= 1 && value <= 7) {
                    setNumberOfSeats(value);
                  }
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
              <p className="mt-1.5 text-xs text-gray-500">
                How many seats do you need? (1-7)
              </p>
            </div>

            {/* Maximum Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary-600" />
                  <span>Maximum Amount (CAD)</span>
                </div>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={maximumAmount}
                  onChange={(e) => setMaximumAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="0.00"
                  required
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                Maximum amount you're willing to pay for this ride
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary-600" />
                  <span>Notes (Optional)</span>
                </div>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                placeholder="Add any additional notes or special requests..."
                maxLength={500}
              />
              <p className="mt-1.5 text-xs text-gray-500">
                {notes.length}/500 characters
              </p>
            </div>

            {/* Location Summary */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-200">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Trip Summary</p>
              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary-600 mt-1.5 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">Pickup</p>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {bookingData.pickup.address || 'Selected location'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-600 mt-1.5 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">Dropoff</p>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {bookingData.dropoff.address || 'Selected location'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-gray-50 px-6 py-4 flex gap-3">
            <button
              onClick={handleBack}
              className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Continue to Review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
