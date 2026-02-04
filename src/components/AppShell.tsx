import { Car, Home, MapPin, PlusCircle, User } from 'lucide-react';
import type { SharedProps } from '../types';
import type { ViewType } from '../types';

const MAIN_VIEWS: { view: ViewType; label: string; icon: typeof Home; requireAuth?: boolean }[] = [
  { view: 'home', label: 'Home', icon: Home },
  { view: 'findARideMap', label: 'Find Rides', icon: MapPin },
  { view: 'bookRide', label: 'Book', icon: Car },
  { view: 'offerRide', label: 'Offer', icon: PlusCircle, requireAuth: true },
  { view: 'account', label: 'Account', icon: User },
];

export function AppShell({ currentView, setCurrentView, user, children }: SharedProps & { children: React.ReactNode }) {
  const handleNav = (view: ViewType, requireAuth?: boolean) => {
    if (requireAuth && !user) {
      setCurrentView('account');
      return;
    }
    setCurrentView(view);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-20 bg-white shadow-sm shrink-0">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 flex items-center justify-between gap-2">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setCurrentView('home');
            }}
            className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-bold text-lg sm:text-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded"
            aria-label="RideShare.Click home"
          >
            <Car className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" aria-hidden />
            <span className="hidden sm:inline truncate">RideShare.Click</span>
          </a>

          <nav
            className="flex items-center gap-0.5 sm:gap-1"
            aria-label="Main navigation"
          >
            <ul className="flex items-center gap-0.5 sm:gap-1 list-none m-0 p-0">
              {MAIN_VIEWS.map(({ view, label, icon: Icon, requireAuth }) => {
                const isActive = currentView === view;
                return (
                  <li key={view}>
                    <button
                      type="button"
                      onClick={() => handleNav(view, requireAuth)}
                      className={`
                        flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] sm:min-w-0 sm:px-3 py-2 rounded-lg text-sm font-medium
                        transition-colors
                        ${isActive
                          ? 'bg-primary-100 text-primary-800'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}
                      `}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={view === 'account' && !user ? 'Sign in or account' : label}
                    >
                      <Icon className="w-5 h-5 shrink-0" aria-hidden />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>

      <div className="flex-1 flex flex-col min-h-0">
        {children}
      </div>
    </div>
  );
}
