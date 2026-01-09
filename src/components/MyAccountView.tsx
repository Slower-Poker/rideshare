import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { signOut } from 'aws-amplify/auth';
import { ArrowLeft, LogOut, User, Settings, Wallet, Activity, Info, FileText, CheckCircle2, Edit2, X, Check } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import type { SharedProps } from '../types';
import { toast } from '../utils/toast';
import { coopMemberNumberSchema } from '../utils/validation';
import '@aws-amplify/ui-react/styles.css';

const client = generateClient<Schema>();

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
  const [isEditingCoopMemberNumber, setIsEditingCoopMemberNumber] = useState(false);
  const [coopMemberNumberInput, setCoopMemberNumberInput] = useState<string>('');
  const [coopMemberNumberError, setCoopMemberNumberError] = useState<string | null>(null);
  const [isSavingCoopMemberNumber, setIsSavingCoopMemberNumber] = useState(false);

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
        // Set coop member number input value
        setCoopMemberNumberInput(profile.coopMemberNumber?.toString() || '');
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

  // Check if coop member number is unique (client-side check)
  const checkCoopMemberNumberUniqueness = useCallback(async (memberNumber: number, currentUserId: string): Promise<boolean> => {
    try {
      const { data: profiles, errors } = await client.models.UserProfile.list({
        filter: { 
          coopMemberNumber: { eq: memberNumber },
        },
        limit: 10,
      });

      if (errors) {
        if (import.meta.env.DEV) {
          console.error('Error checking coop member number uniqueness:', errors);
        }
        // If we can't check, allow it (backend will catch duplicates)
        return true;
      }

      // Check if any profile (other than current user) has this number
      const existingProfile = profiles?.find(p => p.coopMemberNumber === memberNumber && p.userId !== currentUserId);
      return !existingProfile;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error checking coop member number uniqueness:', error);
      }
      // If we can't check, allow it (backend will catch duplicates)
      return true;
    }
  }, []);

  const handleCoopMemberNumberEdit = () => {
    setIsEditingCoopMemberNumber(true);
    setCoopMemberNumberInput(userProfile?.coopMemberNumber?.toString() || '');
    setCoopMemberNumberError(null);
  };

  const handleCoopMemberNumberCancel = () => {
    setIsEditingCoopMemberNumber(false);
    setCoopMemberNumberInput(userProfile?.coopMemberNumber?.toString() || '');
    setCoopMemberNumberError(null);
  };

  const handleCoopMemberNumberSave = async () => {
    if (!userProfile || !userProfile.id || !user) {
      toast.error('Profile not found. Please try again.');
      return;
    }

    setCoopMemberNumberError(null);

    // If input is empty, clear the coop member number
    const trimmedInput = coopMemberNumberInput.trim();
    if (trimmedInput === '') {
      // Clearing coop member number is allowed (optional for riders)
      setIsSavingCoopMemberNumber(true);
      try {
        const { data, errors } = await client.models.UserProfile.update({
          id: userProfile.id,
          coopMemberNumber: null,
        });

        if (errors) {
          if (import.meta.env.DEV) {
            console.error('Error updating coop member number:', errors);
          }
          toast.error('Failed to update coop member number');
          return;
        }

        if (data) {
          setUserProfile(data as Schema['UserProfile']['type']);
          setIsEditingCoopMemberNumber(false);
          toast.success('Coop member number removed');
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error updating coop member number:', error);
        }
        toast.error('Failed to update coop member number');
      } finally {
        setIsSavingCoopMemberNumber(false);
      }
      return;
    }

    // Validate format
    const memberNumber = parseInt(trimmedInput, 10);
    const validationResult = coopMemberNumberSchema.safeParse(memberNumber);

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      setCoopMemberNumberError(firstError?.message || 'Invalid coop member number');
      return;
    }

    // Check uniqueness (only if number has changed)
    if (memberNumber !== userProfile.coopMemberNumber) {
      const isUnique = await checkCoopMemberNumberUniqueness(memberNumber, user.userId);
      if (!isUnique) {
        setCoopMemberNumberError('This coop member number is already in use');
        return;
      }
    }

    // Save the number
    setIsSavingCoopMemberNumber(true);
    try {
      const { data, errors } = await client.models.UserProfile.update({
        id: userProfile.id,
        coopMemberNumber: memberNumber,
      });

      if (errors) {
        if (import.meta.env.DEV) {
          console.error('Error updating coop member number:', errors);
        }
        // Check if it's a uniqueness error
        const errorMessage = errors[0]?.message || 'Failed to update coop member number';
        if (errorMessage.toLowerCase().includes('unique') || errorMessage.toLowerCase().includes('duplicate')) {
          setCoopMemberNumberError('This coop member number is already in use');
        } else {
          toast.error(errorMessage);
        }
        return;
      }

      if (data) {
        setUserProfile(data as Schema['UserProfile']['type']);
        setIsEditingCoopMemberNumber(false);
        toast.success('Coop member number updated');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error updating coop member number:', error);
      }
      toast.error('Failed to update coop member number');
    } finally {
      setIsSavingCoopMemberNumber(false);
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
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold text-gray-900">
                {displayUser?.username || 'User'}
              </h3>
              {isVerified && (
                <div className="flex items-center gap-1 text-green-600" title="Verified Ride Host">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">Verified Ride Host</span>
                </div>
              )}
            </div>
            <p className="text-gray-600">{displayUser?.email || ''}</p>
          </div>
        </div>

        {/* Coop Member Number */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Coop Member Number
            </label>
            {!isEditingCoopMemberNumber && (
              <button
                onClick={handleCoopMemberNumberEdit}
                className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                aria-label="Edit coop member number"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit</span>
              </button>
            )}
          </div>
          {isEditingCoopMemberNumber ? (
            <div className="space-y-3">
              <div>
                <input
                  type="number"
                  min="1"
                  max="9999999"
                  value={coopMemberNumberInput}
                  onChange={(e) => {
                    setCoopMemberNumberInput(e.target.value);
                    setCoopMemberNumberError(null);
                  }}
                  placeholder="Enter coop member number (1-9,999,999)"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    coopMemberNumberError ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={isSavingCoopMemberNumber}
                  aria-label="Coop member number input"
                />
                {coopMemberNumberError && (
                  <p className="mt-1 text-sm text-red-600">{coopMemberNumberError}</p>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Required for users who offer or find rides. Optional for users who only book rides. Must be unique.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCoopMemberNumberSave}
                  disabled={isSavingCoopMemberNumber}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Save coop member number"
                >
                  <Check className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={handleCoopMemberNumberCancel}
                  disabled={isSavingCoopMemberNumber}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Cancel editing coop member number"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
              {isSavingCoopMemberNumber && (
                <p className="text-xs text-gray-500">Saving...</p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-900">
                {userProfile?.coopMemberNumber ? (
                  <span className="font-medium">{userProfile.coopMemberNumber}</span>
                ) : (
                  <span className="text-gray-500 italic">Not set</span>
                )}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Required for offering/finding rides. Optional for booking rides only.
              </p>
            </div>
          )}
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
        <p className="text-gray-600 mb-4">
          Manage your preferences, notifications, and privacy settings.
        </p>
        
        {/* Distance Unit Preference */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Distance Unit
          </label>
          <p className="text-sm text-gray-600 mb-3">
            Choose your preferred unit for displaying distances (kilometers or miles).
          </p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="distanceUnit"
                value="km"
                checked={distanceUnit === 'km'}
                onChange={() => handleDistanceUnitChange('km')}
                disabled={isSavingUnit}
                className="w-4 h-4 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Kilometers (km)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="distanceUnit"
                value="miles"
                checked={distanceUnit === 'miles'}
                onChange={() => handleDistanceUnitChange('miles')}
                disabled={isSavingUnit}
                className="w-4 h-4 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Miles</span>
            </label>
          </div>
          {isSavingUnit && (
            <p className="text-xs text-gray-500 mt-2">Saving...</p>
          )}
        </div>
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('terms')}
              className="text-primary-600 hover:text-primary-700 hover:underline text-left"
            >
              Terms of Service
            </button>
            <span className="text-gray-400">|</span>
            <button
              onClick={() => setCurrentView('license')}
              className="text-primary-600 hover:text-primary-700 hover:underline text-left"
            >
              License
            </button>
          </div>
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
