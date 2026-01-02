import { useState, useEffect } from 'react';
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
import 'react-toastify/dist/ReactToastify.css';
import './index.css';

// Configure Amplify
Amplify.configure(outputs);

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const { termsAccepted, loading: termsLoading, acceptTerms } = useTermsGate(user);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
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
  };

  // Show terms page if user hasn't accepted current version
  useEffect(() => {
    if (user && !termsLoading && !termsAccepted) {
      setCurrentView('terms');
    }
  }, [user, termsAccepted, termsLoading]);

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
