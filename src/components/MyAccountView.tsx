import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { signOut } from 'aws-amplify/auth';
import { ArrowLeft, LogOut, User, Settings, Wallet, Activity, Info, FileText } from 'lucide-react';
import { useEffect, useEffectEvent } from 'react';
import type { SharedProps } from '../types';
import { toast } from '../utils/toast';
import '@aws-amplify/ui-react/styles.css';

interface MyAccountViewProps extends SharedProps {
  onAuthChange: () => void;
}

// Account content that doesn't require Authenticator context
function AccountContent({ 
  currentView: _currentView,
  setCurrentView, 
  user,
  onAuthChange 
}: MyAccountViewProps) {
  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      onAuthChange();
      setCurrentView('home');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error signing out:', error);
      }
      toast.error('Failed to sign out');
    }
  };

  // Get user info from props (when user is already authenticated) or from authUser (when signing in)
  const displayUser = user;

  return (
    <div className="space-y-6">
      {/* Profile and Account Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-6 h-6 text-primary-600" />
          <h2 className="text-2xl font-bold text-gray-900">Profile and Account</h2>
        </div>
        
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              {displayUser?.username || 'User'}
            </h3>
            <p className="text-gray-600">{displayUser?.email || ''}</p>
          </div>
        </div>

        {/* User Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-primary-600">0</p>
            <p className="text-sm text-gray-600">Rides Offered</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-primary-600">0</p>
            <p className="text-sm text-gray-600">Rides Taken</p>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700 transition-colors"
          aria-label="Sign out of your account"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>

      {/* Settings Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-6 h-6 text-primary-600" />
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        </div>
        <p className="text-gray-600">
          Manage your preferences, notifications, and privacy settings.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Settings customization coming soon...
        </p>
      </div>

      {/* Wallet & Activity Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary-600" />
            <Activity className="w-6 h-6 text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Wallet & Activity</h2>
        </div>
        <p className="text-gray-600">
          View your payment methods, transaction history, and ride activity.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Wallet and activity features coming soon...
        </p>
      </div>

      {/* About Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <Info className="w-6 h-6 text-primary-600" />
          <h2 className="text-2xl font-bold text-gray-900">About</h2>
        </div>
        <div className="space-y-3 text-gray-600">
          <p>
            RideShare.Click is a community-owned ride sharing platform that connects neighbors 
            and helps reduce carbon emissions through shared transportation.
          </p>
          <p className="text-sm">
            Version 1.0.0
          </p>
        </div>
      </div>

      {/* Legal Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-6 h-6 text-primary-600" />
          <h2 className="text-2xl font-bold text-gray-900">Legal</h2>
        </div>
        <div className="space-y-3">
          <button
            onClick={() => setCurrentView('terms')}
            className="text-primary-600 hover:text-primary-700 hover:underline text-left"
          >
            Terms of Service
          </button>
          <p className="text-sm text-gray-500">
            Privacy policy and other legal documents coming soon...
          </p>
        </div>
      </div>
    </div>
  );
}

// AuthenticatedContent that uses useAuthenticator (only used inside Authenticator)
function AuthenticatedContent({ 
  currentView,
  setCurrentView, 
  user,
  onAuthChange 
}: MyAccountViewProps) {
  const { user: authUser } = useAuthenticator();

  // Use useEffectEvent to avoid dependency issues (React 19.2)
  const handleAuthChange = useEffectEvent(() => {
    onAuthChange();
  });

  // Trigger auth check when user signs in via Authenticator
  useEffect(() => {
    if (authUser && !user) {
      handleAuthChange();
    }
  }, [authUser, user]); // onAuthChange not needed in deps due to useEffectEvent

  // Use authUser data when available, otherwise use user prop
  const displayUser = user || {
    userId: authUser?.userId || '',
    email: authUser?.signInDetails?.loginId || '',
    username: authUser?.username || '',
  };

  return (
    <AccountContent
      currentView={currentView}
      setCurrentView={setCurrentView}
      user={displayUser}
      onAuthChange={onAuthChange}
    />
  );
}

export function MyAccountView({ 
  currentView,
  setCurrentView, 
  user,
  onAuthChange 
}: MyAccountViewProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => setCurrentView('home')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">My Account</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        {user ? (
          <AccountContent 
            currentView={currentView}
            setCurrentView={setCurrentView}
            user={user}
            onAuthChange={onAuthChange}
          />
        ) : (
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              Sign In or Create Account
            </h2>
            <Authenticator
              signUpAttributes={['given_name', 'family_name', 'phone_number']}
            >
              <AuthenticatedContent 
                currentView={currentView}
                setCurrentView={setCurrentView}
                user={null}
                onAuthChange={onAuthChange}
              />
            </Authenticator>
          </div>
        )}
      </main>
    </div>
  );
}
