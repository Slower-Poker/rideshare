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
import { BookaRide } from './components/BookaRide';
import { BookRideConfirm } from './components/BookRideConfirm';
import { OfferaRide } from './components/OfferaRide';
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
    // Don't restore 'terms' view - always start at home to avoid auto-redirect loop
    if (stored && ['home', 'map', 'account', 'activeRide', 'bookRide', 'offerRide'].includes(stored)) {
      wasRestored.current = true; // We restored from storage = page refresh
      return stored as ViewType;
    }
    // If stored is 'terms' or doesn't exist, default to home
    wasRestored.current = stored === 'terms' ? false : (stored !== null);
    return 'home';
  });
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const { termsAccepted, loading: termsLoading, acceptTerms } = useTermsGate(user);

  // Persist current view to sessionStorage whenever it changes
  // BUT: Don't persist 'terms' view if it was auto-redirected (to prevent it from persisting)
  useEffect(() => {
    // Only persist if not terms, or if user explicitly navigated to terms
    // We'll track if terms was auto-redirected vs user-initiated
    if (currentView !== 'terms') {
      sessionStorage.setItem(VIEW_STORAGE_KEY, currentView);
    } else {
      // Check if this is an auto-redirect by checking if previous view was home
      const previousView = sessionStorage.getItem(VIEW_STORAGE_KEY);
      if (previousView && previousView !== 'terms') {
        // User was on another page, don't persist terms (it's an auto-redirect)
        // This allows refresh to go back to the previous page
      } else {
        // User explicitly navigated to terms, persist it
        sessionStorage.setItem(VIEW_STORAGE_KEY, currentView);
      }
    }
  }, [currentView]);

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

  // Clear 'terms' from sessionStorage on mount to prevent auto-redirect loop
  useEffect(() => {
    const stored = sessionStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === 'terms') {
      sessionStorage.removeItem(VIEW_STORAGE_KEY);
    }
  }, []);

  // Show terms page if user hasn't accepted current version
  // Only redirect on fresh navigation, not on page refresh
  // IMPORTANT: Don't auto-redirect to terms - let user see home page
  // Terms will be shown when user tries to do something that requires acceptance
  useEffect(() => {
    // Don't redirect if we're already on terms page or if loading
    if (termsLoading || currentView === 'terms') {
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
      case 'bookRide':
        return <BookaRide {...sharedProps} />;
      case 'bookRideConfirm':
        return <BookRideConfirm {...sharedProps} />;
      case 'offerRide':
        return <OfferaRide {...sharedProps} />;
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
