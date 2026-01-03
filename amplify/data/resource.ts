import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/*
 * RideShare.Click Data Schema
 * Defines models for cooperative ride sharing platform
 */
const schema = a.schema({
  // User Profile Model
  UserProfile: a
    .model({
      userId: a.id().required(),
      email: a.email().required(),
      username: a.string().required(),
      givenName: a.string(),
      familyName: a.string(),
      phoneNumber: a.string(),
      userType: a.enum(['host', 'rider', 'both']),
      driverRating: a.float(),
      riderRating: a.float(),
      totalRidesAsHost: a.integer().default(0),
      totalRidesAsRider: a.integer().default(0),
      termsAccepted: a.boolean().default(false),
      termsAcceptedDate: a.datetime(),
      termsVersion: a.string(),
      verifiedRideHost: a.boolean().default(false),
      distanceUnit: a.enum(['km', 'miles']),
      // Relationships
      hostedRides: a.hasMany('RideOffer', 'hostId'),
      joinedRides: a.hasMany('RideParticipant', 'riderId'),
    })
    .authorization((allow) => [
      // Authenticated users can read all profiles and create their own
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
      // Note: Application logic should enforce that users can only update/delete their own profile
      // by checking userId matches authenticated user's ID
    ]),

  // Ride Offer Model
  RideOffer: a
    .model({
      hostId: a.id().required(),
      originLatitude: a.float().required(),
      originLongitude: a.float().required(),
      originAddress: a.string(),
      destinationLatitude: a.float().required(),
      destinationLongitude: a.float().required(),
      destinationAddress: a.string(),
      departureTime: a.datetime().required(),
      availableSeats: a.integer().required(),
      seatsBooked: a.integer().default(0),
      status: a.enum(['available', 'matched', 'active', 'completed', 'cancelled']),
      vehicleInfo: a.string(),
      notes: a.string(),
      pickupRadius: a.float(),
      dropoffRadius: a.float(),
      price: a.float().required(),
      // Relationships
      host: a.belongsTo('UserProfile', 'hostId'),
      participants: a.hasMany('RideParticipant', 'rideOfferId'),
    })
    .authorization((allow) => [
      // Allow guests to read rides (filtering by status should be done in application code)
      allow.guest().to(['read']),
      // Authenticated users can read all rides and create new ones
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
      // Note: Application logic should enforce that only the host can update/delete their own rides
      // by checking hostId matches authenticated user's ID
      // Note: Filtering available rides for guests should be done in application queries
    ]),

  // Ride Participant Model (Join table for riders in a ride)
  RideParticipant: a
    .model({
      rideOfferId: a.id().required(),
      riderId: a.id().required(),
      status: a.enum(['pending', 'approved', 'declined', 'cancelled']),
      pickupLatitude: a.float(),
      pickupLongitude: a.float(),
      pickupAddress: a.string(),
      dropoffLatitude: a.float(),
      dropoffLongitude: a.float(),
      dropoffAddress: a.string(),
      joinedAt: a.datetime().required(),
      // Relationships
      rideOffer: a.belongsTo('RideOffer', 'rideOfferId'),
      rider: a.belongsTo('UserProfile', 'riderId'),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  // Ride Rating Model (for feedback after ride completion)
  RideRating: a
    .model({
      rideOfferId: a.id().required(),
      raterId: a.id().required(),
      ratedUserId: a.id().required(),
      rating: a.integer().required(), // 1-5 stars
      comment: a.string(),
      ratingType: a.enum(['driver', 'rider']),
      createdAt: a.datetime().required(),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create']),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
