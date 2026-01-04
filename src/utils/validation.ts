import { z } from 'zod';

/**
 * Validation schemas using Zod
 */

// Location validation
export const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().optional(),
});

// Ride offer form validation
export const rideOfferSchema = z.object({
  origin: locationSchema,
  destination: locationSchema,
  departureTime: z.string().refine((val) => {
    const date = new Date(val);
    return date > new Date();
  }, 'Departure time must be in the future'),
  availableSeats: z.number().min(1).max(7),
  vehicleInfo: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

// Join ride form validation
export const joinRideSchema = z.object({
  pickup: locationSchema.optional(),
  dropoff: locationSchema.optional(),
  message: z.string().max(300).optional(),
});

// Coop member number validation
// Must be an integer between 1 and 9,999,999 (inclusive)
export const coopMemberNumberSchema = z
  .number()
  .int('Coop member number must be an integer')
  .min(1, 'Coop member number must be at least 1')
  .max(9999999, 'Coop member number must be less than 10,000,000')
  .nullable()
  .optional();

// User profile validation
export const userProfileSchema = z.object({
  username: z.string().min(3).max(30),
  givenName: z.string().min(1).max(50).optional(),
  familyName: z.string().min(1).max(50).optional(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  coopMemberNumber: coopMemberNumberSchema,
});

// Rating validation
export const ratingSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().max(500).optional(),
});

/**
 * Validate data against a schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { 
  success: true; 
  data: T 
} | { 
  success: false; 
  errors: string[] 
} {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
  };
}
