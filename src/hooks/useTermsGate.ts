import { useState, useEffect, useCallback } from 'react';
import { client } from '../client';
import type { Schema } from '../../amplify/data/resource';
import type { AuthUser } from '../types';
import { findUniqueCoopMemberNumber, normalizeCoopMemberNumber } from '../utils/coopMemberNumber';

const CURRENT_TERMS_VERSION = '1.0.0';

/**
 * Hook to enforce terms of service acceptance
 * Checks if user has accepted current terms version
 */
export function useTermsGate(user: AuthUser | null) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<Schema['UserProfile']['type'] | null>(null);

  const getUniqueCoopMemberNumber = useCallback(async () => {
    return findUniqueCoopMemberNumber(async (candidate) => {
      const { data: profiles, errors } = await client.models.UserProfile.list({
        filter: { coopMemberNumber: { eq: candidate } },
        limit: 1,
      });

      if (errors) {
        if (import.meta.env.DEV) {
          console.error('Error checking coop member number uniqueness:', errors);
        }
        throw new Error('Unable to verify coop member number uniqueness.');
      }

      return !profiles || profiles.length === 0;
    });
  }, []);

  const ensureCoopMemberNumber = useCallback(async (profile: Schema['UserProfile']['type']) => {
    const normalized = normalizeCoopMemberNumber(profile.coopMemberNumber);
    if (normalized && normalized.length === 8) {
      if (normalized !== profile.coopMemberNumber) {
        try {
          const { data, errors } = await client.models.UserProfile.update({
            id: profile.id,
            coopMemberNumber: normalized,
          });
          if (!errors && data) {
            return data as Schema['UserProfile']['type'];
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error('Error normalizing coop member number:', error);
          }
        }
      }
      return profile;
    }

    try {
      const newNumber = await getUniqueCoopMemberNumber();
      const { data, errors } = await client.models.UserProfile.update({
        id: profile.id,
        coopMemberNumber: newNumber,
      });

      if (errors) {
        if (import.meta.env.DEV) {
          console.error('Error assigning coop member number:', errors);
        }
        return profile;
      }

      return (data as Schema['UserProfile']['type']) || profile;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error assigning coop member number:', error);
      }
      return profile;
    }
  }, [getUniqueCoopMemberNumber]);

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
        if (import.meta.env.DEV) {
          console.error('Error fetching user profile:', errors);
        }
        setTermsAccepted(false);
        setLoading(false);
        return;
      }

      const profile = profiles?.[0];
      if (profile) {
        const ensuredProfile = await ensureCoopMemberNumber(profile as Schema['UserProfile']['type']);
        setUserProfile(ensuredProfile);
        
        // Check if terms are accepted and version is current
        const accepted = 
          ensuredProfile.termsAccepted === true && 
          ensuredProfile.termsVersion === CURRENT_TERMS_VERSION;
        
        setTermsAccepted(accepted);
      } else {
        // Create user profile if it doesn't exist
        try {
          const coopMemberNumber = await getUniqueCoopMemberNumber();
          const { data: newProfile, errors: createErrors } = await client.models.UserProfile.create({
            userId: user.userId,
            email: user.email,
            username: user.username,
            termsAccepted: false,
            coopMemberNumber,
          });
          
          if (createErrors) {
            if (import.meta.env.DEV) {
              console.error('Error creating user profile:', createErrors);
            }
            setTermsAccepted(false);
          } else if (newProfile) {
            setUserProfile(newProfile);
            setTermsAccepted(false);
          }
        } catch (createError) {
          if (import.meta.env.DEV) {
            console.error('Error creating user profile:', createError);
          }
          setTermsAccepted(false);
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error checking terms acceptance:', error);
      }
      setTermsAccepted(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    const runCheck = async () => {
      if (abortController.signal.aborted || !isMounted) return;
      await checkTermsAcceptance();
    };

    runCheck();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [checkTermsAcceptance]);

  const acceptTerms = async () => {
    if (!user) return false;

    // If profile doesn't exist, create it first
    if (!userProfile) {
      try {
        const coopMemberNumber = await getUniqueCoopMemberNumber();
        const { data: newProfile, errors: createErrors } = await client.models.UserProfile.create({
          userId: user.userId,
          email: user.email,
          username: user.username,
          termsAccepted: true,
          termsVersion: CURRENT_TERMS_VERSION,
          termsAcceptedDate: new Date().toISOString(),
          coopMemberNumber,
        });

        if (createErrors) {
          if (import.meta.env.DEV) {
            console.error('Error creating user profile:', createErrors);
          }
          return false;
        }

        if (newProfile) {
          setUserProfile(newProfile);
          setTermsAccepted(true);
          return true;
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error creating user profile:', error);
        }
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
        if (import.meta.env.DEV) {
          console.error('Error updating terms acceptance:', errors);
        }
        return false;
      }

      if (updatedProfile) {
        setUserProfile(updatedProfile);
        setTermsAccepted(true);
        return true;
      }

      return false;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error accepting terms:', error);
      }
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
