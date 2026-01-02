import { Car, Map, User } from 'lucide-react';
import type { SharedProps } from '../types';
import { toast } from '../utils/toast';

export function HomePage({ setCurrentView, user }: SharedProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">RideShare.Click</h1>
          </div>
          
          <nav className="flex items-center gap-4">
            <button
              onClick={() => setCurrentView('map')}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-primary-600 transition-colors"
              aria-label="View map of available rides"
            >
              <Map className="w-5 h-5" />
              <span className="hidden sm:inline">Map</span>
            </button>
            
            <button
              onClick={() => setCurrentView('account')}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-primary-600 transition-colors"
              aria-label="View my account settings"
            >
              <User className="w-5 h-5" />
              <span className="hidden sm:inline">Account</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Community Ride Sharing
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Connect with your community. Share rides. Save money. Reduce carbon emissions.
          </p>
        </div>

        {/* Auth Status */}
        {!user && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 text-center">
            <p className="text-blue-900 mb-4">
              Sign in to create ride offers and join rides
            </p>
            <button
              onClick={() => setCurrentView('account')}
              className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Sign In
            </button>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition-shadow">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Book a Ride
            </h3>
            <p id="book-ride-description" className="text-gray-600 mb-6">
              Select your pickup and dropoff locations on the map. Search for addresses or click directly on the map to choose your route.
            </p>
            <button
              onClick={() => setCurrentView('bookRide')}
              className="w-full bg-primary-600 text-white py-3 px-6 rounded-lg hover:bg-primary-700 transition-colors"
              aria-label="Book a ride by selecting pickup and dropoff locations"
              aria-describedby="book-ride-description"
            >
              Book a Ride
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition-shadow">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Offer a Ride
            </h3>
            <p id="offer-ride-description" className="text-gray-600 mb-6">
              Share your empty seats with others heading the same way. Earn karma and help your community.
            </p>
            <button
              onClick={() => {
                if (user) {
                  setCurrentView('offerRide');
                } else {
                  setCurrentView('account');
                }
              }}
              className="w-full bg-primary-600 text-white py-3 px-6 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!user}
              aria-label={user ? 'Create a new ride offer' : 'Sign in to create a ride offer'}
              aria-describedby="offer-ride-description"
            >
              {user ? 'Create Ride Offer' : 'Sign In to Offer'}
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition-shadow">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Find a Ride
            </h3>
            <p className="text-gray-600 mb-6">
              Browse available rides on the map or list view. Request to join rides that match your route.
            </p>
            <button
              onClick={() => setCurrentView('map')}
              className="w-full bg-gray-200 text-gray-900 py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors"
              aria-label="View available rides on the map"
            >
              View Available Rides
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Why RideShare.Click?
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Car className="w-8 h-8 text-primary-600" />
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Community-Owned</h4>
              <p className="text-gray-600">
                A cooperative platform owned by and for the community
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Map className="w-8 h-8 text-primary-600" />
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Easy to Use</h4>
              <p className="text-gray-600">
                Simple map-based interface for finding and offering rides
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-primary-600" />
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Trust-Based</h4>
              <p className="text-gray-600">
                Rating system builds trust within the community
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-600">
          <p className="mb-2">
            RideShare.Click - Community Ride Sharing Platform
          </p>
          <button
            onClick={() => setCurrentView('terms')}
            className="text-primary-600 hover:underline"
          >
            Terms of Service
          </button>
        </div>
      </footer>
    </div>
  );
}
