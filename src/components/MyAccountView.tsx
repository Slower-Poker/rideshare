import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { signOut } from 'aws-amplify/auth';
import { ArrowLeft, LogOut, User, Settings, Wallet, Activity, Info, FileText, CheckCircle2, Users, UserPlus } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { client } from '../client';
import type { Schema } from '../../amplify/data/resource';
import type { SharedProps } from '../types';
import { toast } from '../utils/toast';
import { formatCoopMemberNumber } from '../utils/coopMemberNumber';
import { displayDriverRating, displayRiderRating } from '../utils/trustApi';
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
  const [userProfile, setUserProfile] = useState<Schema['UserProfile']['type'] | null>(null);
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'miles'>('km');
  const [isSavingUnit, setIsSavingUnit] = useState(false);

  // Fetch user profile
  const fetchUserProfile = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const { data: profiles, errors } = await client.models.UserProfile.list({
        filter: { userId: { eq: user.userId } },
        limit: 1,
      });

      if (errors) {
        if (import.meta.env.DEV) {
          console.error('Error fetching user profile:', errors);
        }
        return;
      }

      if (profiles && profiles.length > 0) {
        const profile = profiles[0] as Schema['UserProfile']['type'];
        setUserProfile(profile);
        // Set distance unit from profile with validation, default to 'km'
        const validUnits: ('km' | 'miles')[] = ['km', 'miles'];
        const unit = profile.distanceUnit;
        const validUnit = unit && validUnits.includes(unit as 'km' | 'miles') 
          ? (unit as 'km' | 'miles') 
          : 'km';
        setDistanceUnit(validUnit);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching user profile:', error);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

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

  const handleDistanceUnitChange = async (unit: 'km' | 'miles') => {
    if (!userProfile || !userProfile.id) {
      toast.error('Profile not found. Please try again.');
      return;
    }

    setIsSavingUnit(true);
    try {
      const { data, errors } = await client.models.UserProfile.update({
        id: userProfile.id,
        distanceUnit: unit,
      });

      if (errors) {
        if (import.meta.env.DEV) {
          console.error('Error updating distance unit:', errors);
        }
        toast.error('Failed to update distance unit preference');
        return;
      }

      if (data) {
        setDistanceUnit(unit);
        setUserProfile(data as Schema['UserProfile']['type']);
        toast.success('Distance unit preference updated');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error updating distance unit:', error);
      }
      toast.error('Failed to update distance unit preference');
    } finally {
      setIsSavingUnit(false);
    }
  };

  // Get user info from props (when user is already authenticated) or from authUser (when signing in)
  const displayUser = user;
  const isVerified = userProfile?.verifiedRideHost === true;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      {/* Compact profile block */}
      <div className="p-4 sm:p-6 pb-4 border-b border-gray-200 bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 sm:w-7 sm:h-7 text-primary-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                {displayUser?.username || 'User'}
              </h2>
              {isVerified && (
                <span className="flex items-center gap-1 text-green-600 text-xs sm:text-sm font-medium" title="Verified Ride Host">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span>Verified</span>
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 truncate">{displayUser?.email || ''}</p>
          </div>
        </div>
        {/* Coop Member Number - one line with tooltip */}
        <div
          className="mt-3 pt-3 border-t border-gray-200"
          title="Assigned automatically by the system. Required for offering/finding rides."
        >
          <p className="text-sm text-gray-700">
            <span className="font-medium text-gray-900">Coop Member Number </span>
            {userProfile?.coopMemberNumber ? (
              <span className="font-medium text-primary-700">
                {formatCoopMemberNumber(userProfile.coopMemberNumber)}
              </span>
            ) : (
              <span className="text-gray-500 italic">Assigning...</span>
            )}
          </p>
        </div>
      </div>

      {/* Stats - single horizontal row */}
      <div className="flex overflow-x-auto gap-2 sm:gap-4 px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex-shrink-0 w-[72px] sm:w-20 text-center py-2 px-1 rounded-lg bg-gray-50">
          <p className="text-xl sm:text-2xl font-bold text-primary-600 leading-tight">
            {displayDriverRating(userProfile).toFixed(1)}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">Driver</p>
        </div>
        <div className="flex-shrink-0 w-[72px] sm:w-20 text-center py-2 px-1 rounded-lg bg-gray-50">
          <p className="text-xl sm:text-2xl font-bold text-primary-600 leading-tight">
            {displayRiderRating(userProfile).toFixed(1)}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">Rider</p>
        </div>
        <div className="flex-shrink-0 w-[72px] sm:w-20 text-center py-2 px-1 rounded-lg bg-gray-50">
          <p className="text-xl sm:text-2xl font-bold text-primary-600 leading-tight">
            {userProfile?.totalRidesAsHost ?? 0}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">Offered</p>
        </div>
        <div className="flex-shrink-0 w-[72px] sm:w-20 text-center py-2 px-1 rounded-lg bg-gray-50">
          <p className="text-xl sm:text-2xl font-bold text-primary-600 leading-tight">
            {userProfile?.totalRidesAsRider ?? 0}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">Taken</p>
        </div>
      </div>

      {/* Primary actions - Pools & Connections */}
      <div className="p-4 sm:p-6 space-y-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setCurrentView('pools')}
          className="w-full flex items-center gap-3 p-3 min-h-[44px] bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors"
          aria-label="Rider and driver pools"
        >
          <Users className="w-5 h-5 text-primary-600 flex-shrink-0" />
          <span className="font-medium text-gray-900">Pools</span>
          <span className="text-sm text-gray-500 ml-auto hidden sm:inline">Rider & Driver pools</span>
        </button>
        <button
          type="button"
          onClick={() => setCurrentView('connections')}
          className="w-full flex items-center gap-3 p-3 min-h-[44px] bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors"
          aria-label="Connections and know-person ratings"
        >
          <UserPlus className="w-5 h-5 text-primary-600 flex-shrink-0" />
          <span className="font-medium text-gray-900">Connections</span>
          <span className="text-sm text-gray-500 ml-auto hidden sm:inline">Know-person ratings</span>
        </button>
      </div>

      {/* Collapsible: Settings */}
      <details className="group border-t border-gray-200">
        <summary className="flex items-center gap-3 px-4 sm:px-6 py-3 cursor-pointer list-none hover:bg-gray-50 transition-colors [&::-webkit-details-marker]:hidden">
          <Settings className="w-5 h-5 text-primary-600 flex-shrink-0" />
          <span className="text-lg font-semibold text-gray-900">Settings</span>
          <span className="text-sm text-gray-500 ml-auto">Distance: {distanceUnit === 'km' ? 'Km' : 'Miles'}</span>
        </summary>
        <div className="px-4 sm:px-6 pb-4 pt-1 bg-gray-50/50">
          <p className="text-sm text-gray-600 mb-3">Display distances in</p>
          <div className="flex rounded-lg overflow-hidden border border-gray-200 p-0.5 bg-gray-100 w-fit">
            <button
              type="button"
              onClick={() => handleDistanceUnitChange('km')}
              disabled={isSavingUnit}
              className={`px-4 py-2 text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                distanceUnit === 'km'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Km
            </button>
            <button
              type="button"
              onClick={() => handleDistanceUnitChange('miles')}
              disabled={isSavingUnit}
              className={`px-4 py-2 text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                distanceUnit === 'miles'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Miles
            </button>
          </div>
          {isSavingUnit && <p className="text-xs text-gray-500 mt-2">Saving...</p>}
        </div>
      </details>

      {/* Collapsible: Wallet & Activity */}
      <details className="group border-t border-gray-200">
        <summary className="flex items-center gap-3 px-4 sm:px-6 py-3 cursor-pointer list-none hover:bg-gray-50 transition-colors [&::-webkit-details-marker]:hidden">
          <Wallet className="w-5 h-5 text-primary-600 flex-shrink-0" />
          <Activity className="w-5 h-5 text-primary-600 flex-shrink-0" />
          <span className="text-lg font-semibold text-gray-900">Wallet & Activity</span>
        </summary>
        <div className="px-4 sm:px-6 pb-4 pt-1 bg-gray-50/50 space-y-2">
          <p className="text-sm text-gray-600">View payment methods, transaction history, and ride activity.</p>
          <p className="text-sm text-gray-500">Coming soon.</p>
        </div>
      </details>

      {/* Collapsible: About */}
      <details className="group border-t border-gray-200">
        <summary className="flex items-center gap-3 px-4 sm:px-6 py-3 cursor-pointer list-none hover:bg-gray-50 transition-colors [&::-webkit-details-marker]:hidden">
          <Info className="w-5 h-5 text-primary-600 flex-shrink-0" />
          <span className="text-lg font-semibold text-gray-900">About</span>
        </summary>
        <div className="px-4 sm:px-6 pb-4 pt-1 bg-gray-50/50 space-y-2 text-gray-600 text-sm">
          <p>
            RideShare.Click is a community-owned ride sharing platform that connects neighbors
            and helps reduce carbon emissions through shared transportation.
          </p>
          <p>Version 1.0.0</p>
        </div>
      </details>

      {/* Collapsible: Legal */}
      <details className="group border-t border-gray-200">
        <summary className="flex items-center gap-3 px-4 sm:px-6 py-3 cursor-pointer list-none hover:bg-gray-50 transition-colors [&::-webkit-details-marker]:hidden">
          <FileText className="w-5 h-5 text-primary-600 flex-shrink-0" />
          <span className="text-lg font-semibold text-gray-900">Legal</span>
        </summary>
        <div className="px-4 sm:px-6 pb-4 pt-1 bg-gray-50/50 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCurrentView('terms')}
              className="text-primary-600 hover:text-primary-700 hover:underline text-sm font-medium text-left"
            >
              Terms of Service
            </button>
            <span className="text-gray-400">|</span>
            <button
              onClick={() => setCurrentView('license')}
              className="text-primary-600 hover:text-primary-700 hover:underline text-sm font-medium text-left"
            >
              License
            </button>
          </div>
          <p className="text-xs text-gray-500">Privacy policy and other legal documents coming soon.</p>
        </div>
      </details>

      {/* Sign Out - at bottom of page */}
      <div className="p-4 sm:p-6 border-t border-gray-200">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700 transition-colors min-h-[44px]"
          aria-label="Sign out of your account"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
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

  // Use ref pattern to avoid stale closures (compatible with all React versions)
  const onAuthChangeRef = useRef(onAuthChange);
  useEffect(() => {
    onAuthChangeRef.current = onAuthChange;
  }, [onAuthChange]);

  // Trigger auth check when user signs in via Authenticator
  useEffect(() => {
    if (authUser && !user) {
      onAuthChangeRef.current();
    }
  }, [authUser, user]);

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
      {/* Header - sticky on scroll */}
      <header className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => setCurrentView('home')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">My Account</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-4 sm:py-6">
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
