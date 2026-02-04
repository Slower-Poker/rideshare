# RideShare.Click

A cooperative ride-sharing platform for community-based transportation. Built with React 19, TypeScript, AWS Amplify Gen 2, Vite 7, and Leaflet maps.

## Overview

RideShare.Click is a community-owned ride-sharing platform that connects drivers ("hosts") with riders for shared transportation. Built on cooperative principles, with a **trust rating system** and **pools** (rider/driver groups) to support social credit and community trust.

### Key Features

- **Map-Based Interface** – Browse and create ride offers on an interactive map
- **Cooperative Model** – Community-owned platform with no corporate shareholders
- **Trust Rating System** – Driver and rider ratings (5/5 default); verified-ride and know-person ratings
- **Pools** – Rider pools (anyone can create) and driver pools (verified members only); pool reviews
- **Connections** – Vouch/connection system for “know person” ratings
- **Secure Authentication** – Google/Apple Sign-In with AWS Amplify Auth
- **Progressive Web App** – Works offline and can be installed on mobile devices
- **Accessible** – WCAG 2.1 Level AA compliant
- **Location-Aware** – Uses device GPS for accurate location picking

## Technology Stack

### Frontend

- **React 19.2** with TypeScript (strict mode)
- **Vite 7.3** – ESM-only, build target `baseline-widely-available`
- **Tailwind CSS** for styling
- **Leaflet** / **react-leaflet** for interactive maps
- **React Toastify** for notifications
- **Zod** for validation
- **Vitest** for unit tests; **Playwright** for E2E

### Backend

- **AWS Amplify Gen 2** – Serverless backend
- **AWS Cognito** – Authentication (social providers)
- **AWS AppSync** – GraphQL API
- **AWS DynamoDB** – NoSQL database

### Requirements

- **Node.js** 20.19+ or 22.12+ (Node 18 EOL)
- **npm** (or compatible package manager)

## Getting Started

### Prerequisites

- Node.js 20.19+ and npm
- AWS account with appropriate permissions
- AWS CLI configured (for sandbox and secrets)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/rideshare.click.git
   cd rideshare.click
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up AWS Amplify**

   Create AWS Parameter Store secrets for Google OAuth (optional for local dev):
   ```bash
   aws ssm put-parameter --name /amplify/GOOGLE_CLIENT_ID --value "your-client-id" --type SecureString --region ca-central-1
   aws ssm put-parameter --name /amplify/GOOGLE_CLIENT_SECRET --value "your-client-secret" --type SecureString --region ca-central-1
   ```

4. **Start the Amplify sandbox**
   ```bash
   npm run amplify:sandbox
   ```
   This deploys the backend, generates `amplify_outputs.json`, and watches for changes.

5. **Start the development server** (in a new terminal)
   ```bash
   npm run dev
   ```

6. **Open your browser**  
   Navigate to `http://localhost:5173`

## Project Structure

```
rideshare.click/
├── amplify/
│   ├── auth/
│   │   └── resource.ts          # Auth (SSO)
│   ├── data/
│   │   └── resource.ts          # GraphQL schema & models
│   ├── functions/
│   │   └── novaAgentProxy/      # AI ride planner
│   └── backend.ts               # Backend definition
├── src/
│   ├── components/
│   │   ├── HomePage.tsx
│   │   ├── RideMapView.tsx
│   │   ├── FindARideMap.tsx
│   │   ├── MyAccountView.tsx    # Profile, trust ratings, Pools/Connections links
│   │   ├── PoolsView.tsx        # Rider & driver pools
│   │   ├── ConnectionsView.tsx  # Connections, know-person ratings
│   │   ├── RateUserModal.tsx    # Rate user (verified_ride or know_person)
│   │   ├── BookaRide.tsx, BookRideDetails.tsx, BookRideConfirm.tsx
│   │   ├── BookaRideRequest.tsx
│   │   ├── OfferaRide.tsx
│   │   ├── RidePlannerChat.tsx
│   │   ├── TermsPage.tsx, LicensePage.tsx
│   │   ├── ErrorBoundary.tsx, LoadingFallback.tsx
│   │   └── sharedProps.ts
│   ├── hooks/
│   │   ├── useGeolocation.ts
│   │   └── useTermsGate.ts      # Terms + profile create (5/5 default ratings)
│   ├── utils/
│   │   ├── activeRideStorage.ts # localStorage (ONLY usage)
│   │   ├── trustApi.ts          # canCreateHostPool, displayDriverRating, etc.
│   │   ├── coopMemberNumber.ts
│   │   ├── geoUtils.ts, mapUtils.ts, maplibreLoader.ts, maplibreUtils.ts
│   │   ├── validation.ts       # Zod schemas (incl. trust rating, pools)
│   │   ├── toast.ts, errorHandler.ts
│   │   └── ...
│   ├── types/
│   │   └── index.ts             # Schema types, ViewType, SharedProps
│   ├── client.ts                # Amplify generateClient singleton
│   ├── App.tsx, main.tsx, index.css
│   └── vite-env.d.ts
├── tests/
│   └── smoke.spec.ts            # Playwright E2E
├── package.json
├── vite.config.ts               # Vite 7 + Vitest config
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

## Development

### Available Scripts

```bash
npm run dev              # Start Vite dev server
npm run amplify:sandbox  # Start Amplify sandbox (backend)
npm run type-check       # TypeScript check (tsc --noEmit)
npm run build            # tsc && vite build
npm run preview          # Preview production build
npm run test             # Vitest unit tests
npm run test:e2e         # Playwright E2E tests
```

### Key Constraints

1. **localStorage** – Use only `activeRideStorage.ts` for localStorage access
2. **Styling** – Tailwind utility classes only (no custom classes, no `@apply`)
3. **Amplify** – Gen 2 patterns only; use `client` from `src/client.ts` (singleton)
4. **Routing** – View-based routing via state (no React Router)
5. **Notifications** – Use toast helpers only (no `alert()`)
6. **React 19** – Use ref as prop (no `forwardRef`); consider `useEffectEvent` and `<Activity />` where appropriate

## Data Models

### UserProfile

- User info, preferences, coop member number
- **driverRating** / **riderRating** (default 5/5); **verifiedRideHost** (gates driver pool creation)
- **totalRidesAsHost** / **totalRidesAsRider**
- Relationships: hostedRides, joinedRides, rideRequests, connectionsFrom/To, createdHostPools/RiderPools, pool memberships, **ratingsGiven**, **ratingsReceived**

### RideOffer

- Origin, destination, time, seats, price, status
- Relationships: host, participants, **ratings**

### RideParticipant

- Rider on a ride; status (pending, approved, declined, cancelled)
- Relationships: rideOffer, rider, **ratingsReceived**

### RideRating

- **rating** (1–5), **comment**, **ratingType** (driver/rider), **ratingSource** (verified_ride | know_person)
- **rideOfferId** optional (required for verified_ride); **rideParticipantId** optional (links to specific trip)
- Relationships: ride, rideParticipant, rater, ratedUser

### Connection

- **fromUserId** / **toUserId**, **status** (pending | accepted), **createdAt**, **updatedAt**
- Required for “know person” ratings; relationships: fromUser, toUser

### HostPool (Driver Pool)

- **name**, **description**, **creatorId** (verified members only to create)
- Relationships: creator, members, reviews

### RiderPool

- Same shape; anyone can create; relationships: creator, members, reviews

### HostPoolMember / RiderPoolMember

- **poolId**, **userId**, **role** (member | admin), **joinedAt**

### HostPoolReview / RiderPoolReview

- **poolId**, **reviewerId**, **rating** (1–5), **comment**, **createdAt**

## Deployment

### Production (AWS Amplify)

1. Push to GitHub and connect the repo in AWS Amplify Console.
2. Set environment variables (e.g. Google OAuth) in the Amplify app.
3. Amplify builds and deploys on push to the connected branch.

## Contributing

Contributions are welcome. Please follow TypeScript strict mode, Tailwind-only styling, and WCAG 2.1 Level AA where applicable.

## License

[GNU General Public License v3.0](LICENSE) (GPL-3.0-or-later).

## Support

- Open an issue on GitHub
---

## Roadmap & Todo Checklist

### Done

- [x] Project setup (React 19, Vite 7, Amplify Gen 2)
- [x] Authentication (Google/Apple SSO)
- [x] Core data models (UserProfile, RideOffer, RideParticipant, RideRequest)
- [x] Trust rating schema (RideRating with ratingSource; UserProfile driverRating/riderRating default 5/5)
- [x] Pools schema (HostPool, RiderPool, members, pool reviews)
- [x] Connections schema (vouch for know-person ratings)
- [x] Profile trust ratings display (driver/rider 5/5 default)
- [x] Pools view (list rider/driver pools; create rider pool; create driver pool when verified)
- [x] Connections view (list pending/accepted; accept request; rate accepted connections)
- [x] RateUserModal (know_person and verified_ride; ratingSource, optional rideOfferId)
- [x] Unit tests (Vitest) for trustApi and validation
- [x] Map-based browse/offer flows, book ride, offer ride, ride planner chat

### In progress / Next

- [ ] **Post-ride rating flow** – After ride completion, prompt host/rider to rate (verified_ride + rideOfferId / rideParticipantId)
- [ ] **Send connection request** – UI to send a connection request (e.g. by coop member number or profile)
- [ ] **Pool join/leave** – Join or leave a pool; show member list
- [ ] **Pool reviews** – Submit and display pool reviews; show aggregate pool rating
- [ ] **UserProfile rating aggregation** – Recompute driverRating/riderRating from RideRating (Lambda or on read)

### Later

- [ ] **Server-side enforcement** – Lambda/custom mutations for createHostPool (verified only) and createRideRating (validate ride/connection)
- [ ] **Driver dashboard** – Active ride, riders, completion
- [ ] **Rider dashboard** – Active ride, completion
- [ ] **Real-time tracking** – Optional live position during ride
- [ ] **Push notifications** – Ride updates, connection requests
- [ ] **Payment integration** – Optional cost sharing
- [ ] **Analytics** – Usage and trust metrics

---

Built with care by the RideShare.Click community
