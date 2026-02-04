import type { Schema } from '../../amplify/data/resource';

/**
 * Trust rating and pool API utilities.
 * Business rules enforced client-side; server-side Lambdas can be added for strict enforcement.
 */

export type UserProfileType = Schema['UserProfile']['type'];

/** Whether the current user can create a Host (Driver) Pool. Only verified members may create. */
export function canCreateHostPool(profile: UserProfileType | null | undefined): boolean {
  return profile?.verifiedRideHost === true;
}

/** Default trust rating for new users (5 out of 5). */
export const DEFAULT_TRUST_RATING = 5;

/** Display driver rating with fallback to default. */
export function displayDriverRating(profile: UserProfileType | null | undefined): number {
  const value = profile?.driverRating;
  return typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_TRUST_RATING;
}

/** Display rider rating with fallback to default. */
export function displayRiderRating(profile: UserProfileType | null | undefined): number {
  const value = profile?.riderRating;
  return typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_TRUST_RATING;
}
