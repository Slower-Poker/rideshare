import { useState, useEffect, useCallback, useRef } from 'react';
import { Amplify } from 'aws-amplify';
import { getCurrentUser } from 'aws-amplify/auth';
import { ToastContainer } from 'react-toastify';
import outputs from '../amplify_outputs.json';
import type { ViewType, AuthUser } from './types';
import { useTermsGate } from './hooks/useTermsGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingFallback } from './components/LoadingFallback';
import { HomePage } from './components/HomePage';
import { RideMapView } from './components/RideMapView';
import { MyAccountView } from './components/MyAccountView';
import { TermsPage } from './components/TermsPage';
import { LicensePage } from './components/LicensePage';
import { BookaRide } from './components/BookaRide';
import { BookRideDetails } from './components/BookRideDetails';
import { BookRideConfirm } from './components/BookRideConfirm';
import { BookaRideRequest } from './components/BookaRideRequest';
import { FindARideMap } from './components/FindARideMap';
import { OfferaRide } from './components/OfferaRide';
import { RidePlannerChat } from './components/RidePlannerChat';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';

// Configure Amplify
Amplify.configure(outputs);

const VIEW_STORAGE_KEY = 'rideshare_current_view';

function App() {
  // Track if we restored a view from sessionStorage (page refresh) vs fresh start
  const wasRestored = useRef(false);
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    const isErrorRecovery = sessionStorage.getItem('errorRecovery') === 'true';
    if (isErrorRecovery) {
      sessionStorage.removeItem('errorRecovery');
      wasRestored.current = false; // Error recovery = fresh start
      return 'home';
    }
    const stored = sessionStorage.getItem(VIEW_STORAGE_KEY);
    // Don't restore 'terms' or 'license' view - always start at home to avoid auto-redirect loop
    if (stored && ['home', 'map', 'findARideMap', 'account', 'activeRide', 'bookRide', 'bookRideDetails', 'bookRideConfirm', 'bookaRideRequest', 'offerRide', 'ridePlannerChat'].includes(stored)) {
      wasRestored.current = true; // We restored from storage = page refresh
      return stored as ViewType;
    }
    // If stored is 'terms' or 'license' or doesn't exist, default to home
    wasRestored.current = (stored === 'terms' || stored === 'license') ? false : (stored !== null);
    return 'home';
  });
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const { termsAccepted, loading: termsLoading, acceptTerms } = useTermsGate(user);

  // Track previous view to distinguish auto-redirects from user-initiated navigation
  const previousViewRef = useRef<ViewType | null>(null);
  
  // Persist current view to sessionStorage whenever it changes
  // Store previous view before navigating to terms for proper back navigation
  useEffect(() => {
    // Only persist if not terms/license, or if user explicitly navigated to them
    if (currentView !== 'terms' && currentView !== 'license') {
      // Normal view - persist it
      sessionStorage.setItem(VIEW_STORAGE_KEY, currentView);
      previousViewRef.current = currentView;
    } else {
      // Navigating to terms or license - preserve the previous view in a separate key for back navigation
      const stored = sessionStorage.getItem(VIEW_STORAGE_KEY);
      if (stored && stored !== 'terms' && stored !== 'license') {
        // Store previous view for back navigation
        sessionStorage.setItem('rideshare_previous_view', stored);
        previousViewRef.current = stored as ViewType;
      }
      // For user-initiated navigation to terms/license, the previous view is already stored above
      if (currentView === 'terms' && (!user || termsAccepted)) {
        // User is viewing terms voluntarily, previous view already stored
      }
    }
  }, [currentView, user, termsAccepted]);

  const checkAuthStatus = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser({
        userId: currentUser.userId,
        email: currentUser.signInDetails?.loginId || '',
        username: currentUser.username,
      });
    } catch (error) {
      // User not authenticated or error occurred
      // Only log in development to avoid console noise in production
      if (import.meta.env.DEV) {
        console.debug('User not authenticated or auth check failed:', error);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Only clear 'terms' or 'license' from sessionStorage on mount if it was likely an auto-redirect
  // This prevents auto-redirect loops while allowing explicit navigation
  useEffect(() => {
    const stored = sessionStorage.getItem(VIEW_STORAGE_KEY);
    // Don't clear on initial mount if we're restoring from storage
    // The initial state handler already handles this
    if ((stored === 'terms' || stored === 'license') && !wasRestored.current) {
      // Fresh start with 'terms' or 'license' stored - likely leftover from previous session
      // Clear it to start fresh
      sessionStorage.removeItem(VIEW_STORAGE_KEY);
    }
  }, []);

  // Handle authentication redirects for protected views
  useEffect(() => {
    if (currentView === 'ridePlannerChat' && !user) {
      setCurrentView('account');
    }
  }, [currentView, user, setCurrentView]);

  // Show terms page if user hasn't accepted current version
  // Only redirect on fresh navigation, not on page refresh
  // IMPORTANT: Don't auto-redirect to terms - let user see home page
  // Terms will be shown when user tries to do something that requires acceptance
  useEffect(() => {
    // Don't redirect if loading
    if (termsLoading) {
      return;
    }
    
    // REMOVED: Auto-redirect to terms on home page
    // This was causing issues where users would always be redirected to terms
    // Instead, terms should only be shown when user tries to perform an action
    // that requires terms acceptance (e.g., creating a ride offer)
    
    // If user is on terms page and has accepted terms, redirect to home
    if (currentView === 'terms' && user && termsAccepted) {
      setCurrentView('home');
    }
  }, [user, termsAccepted, termsLoading, currentView]);

  // Show loading state
  if (loading || termsLoading) {
    return <LoadingFallback />;
  }

  // Render current view
  const renderView = () => {
    const sharedProps = { currentView, setCurrentView, user };

    switch (currentView) {
      case 'home':
        return <HomePage {...sharedProps} />;
      case 'map':
        return <RideMapView {...sharedProps} />;
      case 'findARideMap':
        return <FindARideMap {...sharedProps} />;
      case 'bookRide':
        return <BookaRide {...sharedProps} />;
      case 'bookRideDetails':
        return <BookRideDetails {...sharedProps} />;
      case 'bookRideConfirm':
        return <BookRideConfirm {...sharedProps} />;
      case 'bookaRideRequest':
        return <BookaRideRequest {...sharedProps} />;
      case 'offerRide':
        return <OfferaRide {...sharedProps} />;
      case 'ridePlannerChat':
        return <RidePlannerChat {...sharedProps} />;
      case 'account':
        return <MyAccountView {...sharedProps} onAuthChange={checkAuthStatus} />;
      case 'terms':
        return (
          <TermsPage
            {...sharedProps}
            onAcceptTerms={acceptTerms}
            requireAcceptance={user !== null && !termsAccepted}
          />
        );
      case 'license':
        return <LicensePage {...sharedProps} />;
      default:
        return <HomePage {...sharedProps} />;
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {renderView()}
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
}

export default App;
