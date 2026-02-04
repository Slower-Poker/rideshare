import { describe, it, expect } from 'vitest';
import { validate, trustRideRatingSchema, hostPoolCreateSchema, riderPoolCreateSchema } from './validation';

describe('trust validation schemas', () => {
  describe('trustRideRatingSchema', () => {
    it('accepts valid verified_ride input with rideOfferId', () => {
      const result = validate(trustRideRatingSchema, {
        rideOfferId: 'ride-123',
        ratedUserId: 'user-456',
        rating: 5,
        ratingType: 'driver',
        ratingSource: 'verified_ride',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rideOfferId).toBe('ride-123');
        expect(result.data.ratingSource).toBe('verified_ride');
      }
    });
    it('accepts valid know_person input without rideOfferId', () => {
      const result = validate(trustRideRatingSchema, {
        ratedUserId: 'user-456',
        rating: 4,
        comment: 'Great person',
        ratingType: 'rider',
        ratingSource: 'know_person',
      });
      expect(result.success).toBe(true);
    });
    it('rejects verified_ride without rideOfferId', () => {
      const result = validate(trustRideRatingSchema, {
        ratedUserId: 'user-456',
        rating: 5,
        ratingType: 'driver',
        ratingSource: 'verified_ride',
      });
      expect(result.success).toBe(false);
    });
    it('rejects rating out of range', () => {
      const result = validate(trustRideRatingSchema, {
        ratedUserId: 'user-456',
        rating: 6,
        ratingType: 'driver',
        ratingSource: 'know_person',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('hostPoolCreateSchema', () => {
    it('accepts valid name and optional description', () => {
      const result = validate(hostPoolCreateSchema, { name: 'My Pool', description: 'A pool' });
      expect(result.success).toBe(true);
    });
    it('rejects empty name', () => {
      const result = validate(hostPoolCreateSchema, { name: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('riderPoolCreateSchema', () => {
    it('accepts valid name', () => {
      const result = validate(riderPoolCreateSchema, { name: 'Rider Pool' });
      expect(result.success).toBe(true);
    });
  });
});
