import { describe, it, expect } from 'vitest';
import {
  canCreateHostPool,
  DEFAULT_TRUST_RATING,
  displayDriverRating,
  displayRiderRating,
} from './trustApi';
import type { Schema } from '../../amplify/data/resource';

type UserProfileType = Schema['UserProfile']['type'];

describe('trustApi', () => {
  describe('canCreateHostPool', () => {
    it('returns false when profile is null', () => {
      expect(canCreateHostPool(null)).toBe(false);
    });
    it('returns false when profile is undefined', () => {
      expect(canCreateHostPool(undefined)).toBe(false);
    });
    it('returns false when verifiedRideHost is false', () => {
      const profile = { verifiedRideHost: false } as UserProfileType;
      expect(canCreateHostPool(profile)).toBe(false);
    });
    it('returns true when verifiedRideHost is true', () => {
      const profile = { verifiedRideHost: true } as UserProfileType;
      expect(canCreateHostPool(profile)).toBe(true);
    });
  });

  describe('DEFAULT_TRUST_RATING', () => {
    it('is 5', () => {
      expect(DEFAULT_TRUST_RATING).toBe(5);
    });
  });

  describe('displayDriverRating', () => {
    it('returns default when profile is null', () => {
      expect(displayDriverRating(null)).toBe(5);
    });
    it('returns default when driverRating is undefined', () => {
      const profile = {} as UserProfileType;
      expect(displayDriverRating(profile)).toBe(5);
    });
    it('returns profile driverRating when finite number', () => {
      const profile = { driverRating: 4.5 } as UserProfileType;
      expect(displayDriverRating(profile)).toBe(4.5);
    });
  });

  describe('displayRiderRating', () => {
    it('returns default when profile is null', () => {
      expect(displayRiderRating(null)).toBe(5);
    });
    it('returns profile riderRating when finite number', () => {
      const profile = { riderRating: 4.2 } as UserProfileType;
      expect(displayRiderRating(profile)).toBe(4.2);
    });
  });
});
