import { Car, Map, User } from 'lucide-react';
import type { SharedProps } from '../types';

export function HomePage({ setCurrentView, user }: SharedProps) {
  return (
    <>
      <main id="main-content" className="max-w-7xl mx-auto px-4 py-6 sm:py-8 flex-1">
        {/* Hero */}
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Community Ride Sharing
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
            Connect with your community. Share rides. Save money. Reduce carbon emissions.
          </p>
        </div>

        {/* Sign-in prompt for guests */}
        {!user && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6 mb-6 text-center">
            <p className="text-blue-900 mb-3">
              Sign in to create ride offers and join rides
            </p>
            <button
              onClick={() => setCurrentView('account')}
              className="bg-primary-600 text-white px-5 py-2.5 rounded-lg hover:bg-primary-700 transition-colors min-h-[44px] min-w-[44px]"
              aria-label="Sign in to your account"
            >
              Sign In
            </button>
          </div>
        )}

        {/* Primary actions - 3 clear options */}
        <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 mb-10">
          <section className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Map className="w-6 h-6 text-primary-600 shrink-0" aria-hidden />
              Find Rides
            </h3>
            <p id="find-rides-description" className="text-gray-600 mb-4 text-sm">
              See who&apos;s looking for a ride or browse offers. Post a request or offer a seat.
            </p>
            <button
              onClick={() => setCurrentView('findARideMap')}
              className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors min-h-[44px] font-medium"
              aria-label="View ride requests and offers on the map"
              aria-describedby="find-rides-description"
            >
              View map
            </button>
          </section>

          <section className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Car className="w-6 h-6 text-primary-600 shrink-0" aria-hidden />
              Book a Ride
            </h3>
            <p id="book-ride-description" className="text-gray-600 mb-4 text-sm">
              Pick your pickup and dropoff on the map. Search for addresses or tap the map.
            </p>
            <button
              onClick={() => setCurrentView('bookRide')}
              className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors min-h-[44px] font-medium"
              aria-label="Book a ride by selecting pickup and dropoff"
              aria-describedby="book-ride-description"
            >
              Book a ride
            </button>
          </section>

          <section className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-6 h-6 text-primary-600 shrink-0" aria-hidden />
              Offer a Ride
            </h3>
            <p id="offer-ride-description" className="text-gray-600 mb-4 text-sm">
              Share your empty seats. Set route, time, and price. Help your community.
            </p>
            <button
              onClick={() => {
                if (user) setCurrentView('offerRide');
                else setCurrentView('account');
              }}
              className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors min-h-[44px] font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={!user}
              aria-label={user ? 'Create a ride offer' : 'Sign in to create a ride offer'}
              aria-describedby="offer-ride-description"
            >
              {user ? 'Offer a ride' : 'Sign in to offer'}
            </button>
          </section>
        </div>

        {/* Short value prop */}
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-600 text-sm">
            RideShare.Click is a cooperative platform — community-owned, easy to use, and trust-based.
          </p>
        </div>
      </main>

      {/* Footer - legal only */}
      <footer className="bg-white border-t mt-auto shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-600 text-sm">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setCurrentView('terms')}
              className="text-primary-600 hover:underline"
            >
              Terms of Service
            </button>
            <span className="text-gray-400" aria-hidden>|</span>
            <button
              onClick={() => setCurrentView('license')}
              className="text-primary-600 hover:underline"
            >
              License
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}
