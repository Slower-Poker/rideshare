import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import type { AuthUser } from '../types';

const client = generateClient<Schema>();

const CURRENT_TERMS_VERSION = '1.0.0';

/**
 * Hook to enforce terms of service acceptance
 * Checks if user has accepted current terms version
 */
export function useTermsGate(user: AuthUser | null) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<Schema['UserProfile']['type'] | null>(null);

  const checkTermsAcceptance = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setTermsAccepted(false);
      return;
    }

    try {
      // Fetch user profile with error handling
      const { data: profiles, errors } = await client.models.UserProfile.list({
        filter: { userId: { eq: user.userId } },
        limit: 1, // Only need one profile
      });

      if (errors) {
        console.error('Error fetching user profile:', errors);
        setTermsAccepted(false);
        setLoading(false);
        return;
      }

      if (profiles && profiles.length > 0) {
        const profile = profiles[0];
        if (profile) {
          setUserProfile(profile as Schema['UserProfile']['type']);
          
          // Check if terms are accepted and version is current
          const accepted = 
            profile.termsAccepted === true && 
            profile.termsVersion === CURRENT_TERMS_VERSION;
          
          setTermsAccepted(accepted);
        } else {
          setTermsAccepted(false);
        }
      } else {
        // Create user profile if it doesn't exist
        try {
          const { data: newProfile, errors: createErrors } = await client.models.UserProfile.create({
            userId: user.userId,
            email: user.email,
            username: user.username,
            termsAccepted: false,
          });
          
          if (createErrors) {
            console.error('Error creating user profile:', createErrors);
            setTermsAccepted(false);
          } else if (newProfile) {
            setUserProfile(newProfile);
            setTermsAccepted(false);
          }
        } catch (createError) {
          console.error('Error creating user profile:', createError);
          setTermsAccepted(false);
        }
      }
    } catch (error) {
      console.error('Error checking terms acceptance:', error);
      setTermsAccepted(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkTermsAcceptance();
  }, [checkTermsAcceptance]);

  const acceptTerms = async () => {
    if (!user) return false;

    // If profile doesn't exist, create it first
    if (!userProfile) {
      try {
        const { data: newProfile, errors: createErrors } = await client.models.UserProfile.create({
          userId: user.userId,
          email: user.email,
          username: user.username,
          termsAccepted: true,
          termsVersion: CURRENT_TERMS_VERSION,
          termsAcceptedDate: new Date().toISOString(),
        });

        if (createErrors) {
          console.error('Error creating user profile:', createErrors);
          return false;
        }

        if (newProfile) {
          setUserProfile(newProfile);
          setTermsAccepted(true);
          return true;
        }
      } catch (error) {
        console.error('Error creating user profile:', error);
        return false;
      }
    }

    // Update existing profile
    if (!userProfile) {
      return false;
    }

    try {
      const { data: updatedProfile, errors } = await client.models.UserProfile.update({
        id: userProfile.id,
        termsAccepted: true,
        termsVersion: CURRENT_TERMS_VERSION,
        termsAcceptedDate: new Date().toISOString(),
      });

      if (errors) {
        console.error('Error updating terms acceptance:', errors);
        return false;
      }

      if (updatedProfile) {
        setUserProfile(updatedProfile);
        setTermsAccepted(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error accepting terms:', error);
      return false;
    }
  };

  return {
    termsAccepted,
    loading,
    acceptTerms,
    currentVersion: CURRENT_TERMS_VERSION,
  };
}
