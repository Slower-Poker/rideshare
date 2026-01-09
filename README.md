# RideShare.Click 🚗

A cooperative ride-sharing platform for community-based transportation. Built with React, TypeScript, AWS Amplify Gen 2, and Leaflet maps.

## Overview

RideShare.Click is a community-owned ride-sharing platform that connects drivers ("hosts") with riders for shared transportation. Built on cooperative principles, focusing on community benefit rather than profit.

### Key Features

- 🗺️ **Map-Based Interface** - Browse and create ride offers on an interactive map
- 👥 **Cooperative Model** - Community-owned platform with no corporate shareholders
- 🔐 **Secure Authentication** - Google Sign-In with AWS Amplify Auth
- 📱 **Progressive Web App** - Works offline and can be installed on mobile devices
- ♿ **Accessible** - WCAG 2.1 Level AA compliant
- 🌍 **Location-Aware** - Uses device GPS for accurate location picking

## Technology Stack

### Frontend
- **React 18+** with TypeScript (strict mode)
- **Tailwind CSS** for styling (core utilities only)
- **Leaflet** for interactive maps
- **Vite** for blazing fast development
- **React Toastify** for notifications
- **Zod** for validation

### Backend
- **AWS Amplify Gen 2** - Fully serverless backend
- **AWS Cognito** - Authentication with social providers
- **AWS AppSync** - GraphQL API
- **AWS DynamoDB** - NoSQL database

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- AWS Account with appropriate permissions
- AWS CLI configured with your credentials

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

   This will:
   - Deploy the backend to your AWS account
   - Generate the `amplify_outputs.json` file
   - Watch for changes and redeploy automatically

5. **Start the development server** (in a new terminal)
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:5173`

## Project Structure

```
rideshare.click/
├── amplify/                    # AWS Amplify backend
│   ├── auth/
│   │   └── resource.ts        # Auth configuration (SSO)
│   ├── data/
│   │   └── resource.ts        # GraphQL schema & models
│   └── backend.ts             # Backend definition
├── src/
│   ├── components/            # React components
│   │   ├── HomePage.tsx       # Landing page
│   │   ├── RideMapView.tsx    # Map view
│   │   ├── MyAccountView.tsx  # User account
│   │   ├── TermsPage.tsx      # Terms of service
│   │   ├── ErrorBoundary.tsx  # Error handling
│   │   └── LoadingFallback.tsx
│   ├── hooks/                 # Custom React hooks
│   │   ├── useGeolocation.ts  # GPS location
│   │   └── useTermsGate.ts    # Terms enforcement
│   ├── utils/                 # Utility functions
│   │   ├── activeRideStorage.ts # localStorage (ONLY usage)
│   │   ├── geoUtils.ts        # Distance calculations
│   │   ├── mapUtils.ts        # Leaflet helpers
│   │   ├── validation.ts      # Zod schemas
│   │   ├── toast.ts           # Notifications
│   │   └── errorHandler.ts    # Error handling
│   ├── types/
│   │   └── index.ts           # TypeScript types
│   ├── App.tsx                # Main app component
│   ├── main.tsx               # Entry point
│   └── index.css              # Global styles
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

## Development

### Available Scripts

```bash
# Start development server
npm run dev

# Start Amplify sandbox (required for backend)
npm run amplify:sandbox

# Type checking
npm run type-check

# Build for production
npm run build

# Preview production build
npm run preview

# Run E2E tests
npm run test:e2e
```

### Key Constraints

1. **localStorage** - ONLY use `activeRideStorage.ts` for localStorage access
2. **Styling** - Use only Tailwind core utility classes (no custom classes, no @apply)
3. **Amplify** - Always use Gen 2 patterns (never Gen 1)
4. **Routing** - View-based routing through state (no React Router)
5. **Notifications** - Always use toast functions (NEVER use alert())

## Data Models

### UserProfile
- User information, preferences, and stats
- Tracks rides as host and rider
- Stores rating information

### RideOffer
- Created by hosts offering rides
- Contains origin, destination, time, and seats
- Tracks status (available, matched, active, completed)

### RideParticipant
- Join table for riders in a ride
- Tracks approval status
- Optional pickup/dropoff locations

### RideRating
- Ratings and feedback after ride completion
- Builds trust in the community

## Deployment

### Production Deployment to AWS Amplify

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Connect to Amplify Console**
   - Go to AWS Amplify Console
   - Connect your GitHub repository
   - Amplify will automatically detect the configuration

3. **Set Environment Variables** (in Amplify Console)
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

4. **Deploy**
   Amplify will automatically deploy on every push to main branch

## Contributing

We welcome contributions! This is a cooperative project and community input is valued.

### Development Guidelines

1. Follow TypeScript strict mode - no `any` types
2. Use Tailwind CSS only - no custom CSS classes
3. Write accessible code (WCAG 2.1 Level AA)
4. Test on mobile devices
5. Keep components focused and reusable

## License

This project is open source and available under the [GNU General Public License v3.0](LICENSE) (GPL-3.0-or-later).

## Support

For questions or issues:
- Open an issue on GitHub
- Contact: hello@rideshare.click

## Roadmap

### Phase 1: Foundation ✅
- [x] Project setup
- [x] Authentication
- [x] Data models
- [x] Basic UI components

### Phase 2: Core Features (In Progress)
- [ ] Create ride offers
- [ ] Browse rides on map
- [ ] Join ride requests
- [ ] Ride matching

### Phase 3: Active Rides
- [ ] Driver dashboard
- [ ] Rider dashboard
- [ ] Real-time tracking
- [ ] Ride completion

### Phase 4: Community Features
- [ ] Rating system
- [ ] User profiles
- [ ] Ride history
- [ ] Trust score

### Phase 5: Advanced
- [ ] Push notifications
- [ ] Payment integration
- [ ] Advanced matching
- [ ] Analytics dashboard

---

Built with ❤️ by the RideShare.Click community
