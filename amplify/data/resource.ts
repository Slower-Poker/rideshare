import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { novaAgentProxy } from '../functions/novaAgentProxy/resource';

/*
 * RideShare.Click Data Schema
 * Defines models for cooperative ride sharing platform
 * 
 * Core Entity: Ride (unified model replacing RideOffer + RideRequest)
 * - rideType: 'offer' (host offering seats) or 'request' (rider seeking ride)
 * - status: open → scheduled → in_progress → completed/cancelled/expired
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
      // Coop member number: assigned by the system, unique 8-character code (displayed like 8943-2923)
      coopMemberNumber: a.string(),
      homeRegion: a.string(),
      notifyOnMatch: a.boolean().default(true),
      // Reputation tracking for cancellation rate
      cancellationCount: a.integer().default(0),
      totalRidesCreated: a.integer().default(0),
      // Relationships
      rides: a.hasMany('Ride', 'hostId'),
      joinedRides: a.hasMany('RideParticipant', 'riderId'),
      connectionsFrom: a.hasMany('Connection', 'fromUserId'),
      connectionsTo: a.hasMany('Connection', 'toUserId'),
      createdHostPools: a.hasMany('HostPool', 'creatorId'),
      createdRiderPools: a.hasMany('RiderPool', 'creatorId'),
      hostPoolMemberships: a.hasMany('HostPoolMember', 'userId'),
      riderPoolMemberships: a.hasMany('RiderPoolMember', 'userId'),
      ratingsGiven: a.hasMany('RideRating', 'raterId'),
      ratingsReceived: a.hasMany('RideRating', 'ratedUserId'),
      hostPoolReviews: a.hasMany('HostPoolReview', 'reviewerId'),
      riderPoolReviews: a.hasMany('RiderPoolReview', 'reviewerId'),
      recurringRideTemplates: a.hasMany('RecurringRideTemplate', 'hostId'),
      rideAlerts: a.hasMany('RideAlert', 'userProfileId'),
      notifications: a.hasMany('Notification', 'userId'),
    })
    .authorization((allow) => [
      // Authenticated users can read all profiles and create their own
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
      // Note: Application logic should enforce that users can only update/delete their own profile
      // by checking userId matches authenticated user's ID
    ]),

  // Ride Model - Central entity for all rides (replaces RideOffer + RideRequest)
  Ride: a
    .model({
      // Core identification
      hostId: a.id().required(), // Creator (whether offering or requesting)
      name: a.string(), // Optional user-defined name
      rideType: a.enum(['offer', 'request']), // 'offer' = host offering seats, 'request' = rider seeking ride
      status: a.enum(['open', 'scheduled', 'in_progress', 'completed', 'cancelled', 'expired']),
      
      // Origin location
      originLatitude: a.float().required(),
      originLongitude: a.float().required(),
      originAddress: a.string(),
      originRegion: a.string(),
      
      // Destination location
      destinationLatitude: a.float().required(),
      destinationLongitude: a.float().required(),
      destinationAddress: a.string(),
      destinationRegion: a.string(),
      
      // Timing
      departureTime: a.datetime().required(),
      actualDepartureTime: a.datetime(), // When host actually starts
      actualArrivalTime: a.datetime(), // When host completes
      
      // Expiry (simple: departure + graceMinutes)
      expiresAt: a.datetime().required(),
      graceMinutes: a.integer().default(60),
      
      // Capacity & Pricing
      totalSeats: a.integer().required(),
      seatsBooked: a.integer().default(0),
      pricePerSeat: a.float().required(),
      maximumAmount: a.float(), // For requests - max rider will pay
      
      // Flexibility zones
      pickupRadius: a.float(), // km
      dropoffRadius: a.float(), // km
      
      // Metadata
      vehicleInfo: a.string(),
      notes: a.string(),
      joinCode: a.string(), // 6-char sharing code
      
      // Round-trip linking
      linkedRideId: a.id(), // Paired return trip
      isReturnTrip: a.boolean().default(false),
      
      // Recurring source
      recurringTemplateId: a.id(),
      
      createdAt: a.datetime().required(),
      updatedAt: a.datetime(),
      
      // Relationships
      host: a.belongsTo('UserProfile', 'hostId'),
      participants: a.hasMany('RideParticipant', 'rideId'),
      ratings: a.hasMany('RideRating', 'rideId'),
      notifications: a.hasMany('Notification', 'rideId'),
      // Note: linkedRideId is a plain field - query linked ride manually (self-referential belongsTo not supported)
      recurringTemplate: a.belongsTo('RecurringRideTemplate', 'recurringTemplateId'),
    })
    .authorization((allow) => [
      // Allow guests to read rides (filtering by status should be done in application code)
      allow.guest().to(['read']),
      // Authenticated users can read all rides and create new ones
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
      // Note: Application logic should enforce that only the host can update/delete their own rides
    ]),

  // Notification Model - In-app notifications for ride events
  Notification: a
    .model({
      userId: a.id().required(), // Recipient
      rideId: a.id(), // Optional - related ride
      type: a.enum([
        'ride_booked',
        'ride_cancelled', 
        'ride_started',
        'ride_completed',
        'participant_joined',
        'participant_cancelled',
        'ride_expiring'
      ]),
      title: a.string().required(),
      message: a.string().required(),
      read: a.boolean().default(false),
      createdAt: a.datetime().required(),
      // Relationships
      user: a.belongsTo('UserProfile', 'userId'),
      ride: a.belongsTo('Ride', 'rideId'),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  // Ride Participant Model (Join table for riders in a ride)
  RideParticipant: a
    .model({
      rideId: a.id().required(),
      riderId: a.id().required(),
      status: a.enum(['pending', 'approved', 'declined', 'cancelled']),
      pickupLatitude: a.float(),
      pickupLongitude: a.float(),
      pickupAddress: a.string(),
      dropoffLatitude: a.float(),
      dropoffLongitude: a.float(),
      dropoffAddress: a.string(),
      seatsRequested: a.integer().default(1),
      joinedAt: a.datetime().required(),
      // Relationships
      ride: a.belongsTo('Ride', 'rideId'),
      rider: a.belongsTo('UserProfile', 'riderId'),
      ratingsReceived: a.hasMany('RideRating', 'rideParticipantId'),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  // Ride Rating Model (for feedback after ride completion or know-person)
  RideRating: a
    .model({
      rideId: a.id(), // optional for know_person ratings
      rideParticipantId: a.id(), // optional: link to specific participant for verified_ride
      raterId: a.id().required(),
      ratedUserId: a.id().required(),
      rating: a.integer().required(), // 1-5 stars
      comment: a.string(),
      ratingType: a.enum(['driver', 'rider']),
      ratingSource: a.enum(['verified_ride', 'know_person']),
      createdAt: a.datetime().required(),
      // Relationships
      ride: a.belongsTo('Ride', 'rideId'),
      rideParticipant: a.belongsTo('RideParticipant', 'rideParticipantId'),
      rater: a.belongsTo('UserProfile', 'raterId'),
      ratedUser: a.belongsTo('UserProfile', 'ratedUserId'),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create']),
    ]),

  // Connection (vouch) - required for "know person" ratings
  Connection: a
    .model({
      fromUserId: a.id().required(),
      toUserId: a.id().required(),
      status: a.enum(['pending', 'accepted']),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime(),
      // Relationships (UserProfile id for FK)
      fromUser: a.belongsTo('UserProfile', 'fromUserId'),
      toUser: a.belongsTo('UserProfile', 'toUserId'),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  // Host Pool (Driver Pool) - only verified members may create
  HostPool: a
    .model({
      name: a.string().required(),
      description: a.string(),
      creatorId: a.id().required(),
      createdAt: a.datetime().required(),
      // Relationships
      creator: a.belongsTo('UserProfile', 'creatorId'),
      members: a.hasMany('HostPoolMember', 'hostPoolId'),
      reviews: a.hasMany('HostPoolReview', 'hostPoolId'),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  // Rider Pool - anyone may create
  RiderPool: a
    .model({
      name: a.string().required(),
      description: a.string(),
      creatorId: a.id().required(),
      createdAt: a.datetime().required(),
      // Relationships
      creator: a.belongsTo('UserProfile', 'creatorId'),
      members: a.hasMany('RiderPoolMember', 'riderPoolId'),
      reviews: a.hasMany('RiderPoolReview', 'riderPoolId'),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  // Host Pool membership
  HostPoolMember: a
    .model({
      hostPoolId: a.id().required(),
      userId: a.id().required(),
      role: a.enum(['member', 'admin']),
      joinedAt: a.datetime().required(),
      // Relationships
      hostPool: a.belongsTo('HostPool', 'hostPoolId'),
      user: a.belongsTo('UserProfile', 'userId'),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  // Rider Pool membership
  RiderPoolMember: a
    .model({
      riderPoolId: a.id().required(),
      userId: a.id().required(),
      role: a.enum(['member', 'admin']),
      joinedAt: a.datetime().required(),
      // Relationships
      riderPool: a.belongsTo('RiderPool', 'riderPoolId'),
      user: a.belongsTo('UserProfile', 'userId'),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  // Host Pool review
  HostPoolReview: a
    .model({
      hostPoolId: a.id().required(),
      reviewerId: a.id().required(),
      rating: a.integer().required(), // 1-5
      comment: a.string(),
      createdAt: a.datetime().required(),
      // Relationships
      hostPool: a.belongsTo('HostPool', 'hostPoolId'),
      reviewer: a.belongsTo('UserProfile', 'reviewerId'),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create']),
    ]),

  // Rider Pool review
  RiderPoolReview: a
    .model({
      riderPoolId: a.id().required(),
      reviewerId: a.id().required(),
      rating: a.integer().required(), // 1-5
      comment: a.string(),
      createdAt: a.datetime().required(),
      // Relationships
      riderPool: a.belongsTo('RiderPool', 'riderPoolId'),
      reviewer: a.belongsTo('UserProfile', 'reviewerId'),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create']),
    ]),

  // Recurring Ride Template - Enhanced with advanced patterns, round-trip support
  RecurringRideTemplate: a
    .model({
      hostId: a.id().required(),
      name: a.string(), // Optional name for the template
      rideType: a.enum(['offer', 'request']), // Same as Ride
      
      // Origin location
      originLatitude: a.float().required(),
      originLongitude: a.float().required(),
      originAddress: a.string(),
      originRegion: a.string(),
      
      // Destination location
      destinationLatitude: a.float().required(),
      destinationLongitude: a.float().required(),
      destinationAddress: a.string(),
      destinationRegion: a.string(),
      
      // Schedule Pattern
      patternType: a.enum(['weekly', 'biweekly', 'custom']),
      daysOfWeek: a.string(), // JSON array string e.g. "[1,3,5]" for Mon/Wed/Fri
      departureTime: a.string().required(), // "08:00" or "08:30"
      validFrom: a.string(), // ISO date - pattern start
      validUntil: a.string(), // ISO date - pattern end (optional)
      
      // Exceptions
      skipDates: a.string(), // JSON array string of ISO dates to skip
      
      // Round-trip support
      isRoundTrip: a.boolean().default(false),
      returnDepartureTime: a.string(), // HH:MM for return leg
      
      // Ride defaults
      totalSeats: a.integer().required(),
      pricePerSeat: a.float().required(),
      vehicleInfo: a.string(),
      notes: a.string(),
      pickupRadius: a.float(),
      dropoffRadius: a.float(),
      graceMinutes: a.integer().default(60),
      
      status: a.enum(['active', 'paused', 'cancelled']),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime(),
      
      // Relationships
      host: a.belongsTo('UserProfile', 'hostId'),
      generatedRides: a.hasMany('Ride', 'recurringTemplateId'),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  // Ride Alert - user wants to be notified when a ride matches their route
  RideAlert: a
    .model({
      userProfileId: a.id().required(),
      originRegion: a.string(),
      destinationRegion: a.string(),
      preferredDateFrom: a.string(),
      preferredDateTo: a.string(),
      notify: a.boolean().default(true),
      createdAt: a.datetime().required(),
      // Relationships
      user: a.belongsTo('UserProfile', 'userProfileId'),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  // AI Conversation Route for Nova Agent
  // Custom query that proxies to Nova Agent API via Lambda function
  // Note: The function reference will be resolved in backend.ts
  ChatRidePlannerResponse: a.customType({
    response: a.string(),
    conversationId: a.string(),
  }),

  chatRidePlanner: a
    .query()
    .arguments({
      message: a.string().required(),
      conversationId: a.string(),
    })
    .returns(a.ref('ChatRidePlannerResponse'))
    .handler(a.handler.function(novaAgentProxy))
    .authorization((allow) => allow.authenticated()),
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
