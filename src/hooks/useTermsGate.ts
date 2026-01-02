import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setTermsAccepted(false);
      return;
    }

    checkTermsAcceptance();
  }, [user]);

  const checkTermsAcceptance = async () => {
    if (!user) return;

    try {
      // Fetch user profile
      const { data: profiles } = await client.models.UserProfile.list({
        filter: { userId: { eq: user.userId } },
      });

      if (profiles && profiles.length > 0) {
        const profile = profiles[0];
        setUserProfile(profile);
        
        // Check if terms are accepted and version is current
        const accepted = 
          profile.termsAccepted === true && 
          profile.termsVersion === CURRENT_TERMS_VERSION;
        
        setTermsAccepted(accepted);
      } else {
        setTermsAccepted(false);
      }
    } catch (error) {
      console.error('Error checking terms acceptance:', error);
      setTermsAccepted(false);
    } finally {
      setLoading(false);
    }
  };

  const acceptTerms = async () => {
    if (!user || !userProfile) return false;

    try {
      await client.models.UserProfile.update({
        id: userProfile.id,
        termsAccepted: true,
        termsVersion: CURRENT_TERMS_VERSION,
        termsAcceptedDate: new Date().toISOString(),
      });

      setTermsAccepted(true);
      return true;
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
