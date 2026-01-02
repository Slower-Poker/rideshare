import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { signOut } from 'aws-amplify/auth';
import { ArrowLeft, LogOut, User } from 'lucide-react';
import { useEffect } from 'react';
import type { SharedProps } from '../types';
import { toast } from '../utils/toast';
import '@aws-amplify/ui-react/styles.css';

interface MyAccountViewProps extends SharedProps {
  onAuthChange: () => void;
}

function AuthenticatedContent({ 
  setCurrentView, 
  user,
  onAuthChange 
}: MyAccountViewProps) {
  const { user: authUser } = useAuthenticator();

  // Trigger auth check when user signs in via Authenticator
  useEffect(() => {
    if (authUser && !user) {
      onAuthChange();
    }
  }, [authUser, user, onAuthChange]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      onAuthChange();
      setCurrentView('home');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  return (
    <div className="space-y-6">
      {/* User Info */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {user?.username || authUser?.username || 'User'}
            </h2>
            <p className="text-gray-600">{user?.email || authUser?.signInDetails?.loginId || ''}</p>
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
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>

      {/* Profile Settings */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Profile Settings
        </h3>
        <p className="text-gray-600">
          Profile customization coming soon...
        </p>
      </div>
    </div>
  );
}

export function MyAccountView({ 
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
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

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
          <AuthenticatedContent 
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
