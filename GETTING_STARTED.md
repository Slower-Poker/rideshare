# Getting Started with RideShare.Click

This guide will walk you through setting up the RideShare.Click development environment step by step.

## Prerequisites

Before you begin, ensure you have:

1. **Node.js 18+** installed ([Download](https://nodejs.org/))
2. **AWS Account** with appropriate permissions
3. **AWS CLI** installed and configured ([Setup Guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html))
4. **Git** installed

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/rideshare.click.git
cd rideshare.click
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- React, TypeScript, Vite
- AWS Amplify Gen 2
- Tailwind CSS
- Leaflet maps
- React Toastify
- Zod validation

### 3. Configure AWS Credentials

Ensure your AWS CLI is configured with credentials:

```bash
aws configure
```

You'll need:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (recommend: `ca-central-1` for Manitoba)
- Default output format: `json`

### 4. Set Up Google OAuth (Optional for Development)

To enable Google Sign-In, you need to:

1. **Create a Google OAuth App**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Navigate to "APIs & Services" > "Credentials"
   - Create OAuth 2.0 Client ID
   - Add authorized redirect URIs:
     - `http://localhost:5173`
     - Your production domain

2. **Store Credentials in AWS Parameter Store** (for development):
   ```bash
   aws ssm put-parameter \
     --name /amplify/GOOGLE_CLIENT_ID \
     --value "your-google-client-id" \
     --type SecureString \
     --region ca-central-1

   aws ssm put-parameter \
     --name /amplify/GOOGLE_CLIENT_SECRET \
     --value "your-google-client-secret" \
     --type SecureString \
     --region ca-central-1
   ```

3. **For Production**: Set these as Amplify Console Secrets (not Parameter Store)

### 5. Start the Amplify Sandbox

In one terminal, start the Amplify backend:

```bash
npm run amplify:sandbox
```

This command will:
- Deploy your backend to AWS
- Create DynamoDB tables
- Set up GraphQL API
- Configure authentication
- Generate `amplify_outputs.json`

**Note**: The sandbox will stay running and watch for changes. Keep this terminal open.

### 6. Start the Development Server

In a **new terminal**, start the frontend:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 7. Test the Application

Open your browser and navigate to `http://localhost:5173`. You should see the RideShare.Click homepage.

## Common Setup Issues

### Issue: "Command not found: ampx"

**Solution**: Make sure @aws-amplify/backend-cli is installed:
```bash
npm install --save-dev @aws-amplify/backend-cli
```

### Issue: "AWS credentials not found"

**Solution**: Configure AWS CLI:
```bash
aws configure
```

### Issue: Google OAuth not working

**Solution**: 
1. Verify credentials in Parameter Store
2. Check redirect URIs in Google Console
3. Ensure you've uncommented Google provider in auth config

### Issue: Map not displaying

**Solution**: 
1. Check browser console for errors
2. Verify Leaflet CSS is loading
3. Ensure map container has height set

### Issue: TypeScript errors

**Solution**: Run type check to see all errors:
```bash
npm run type-check
```

## Development Workflow

### Daily Development

1. **Start Amplify sandbox** (if not already running):
   ```bash
   npm run amplify:sandbox
   ```

2. **Start dev server** (new terminal):
   ```bash
   npm run dev
   ```

3. **Make changes** to your code

4. **Test your changes** in the browser

5. **Run type check** before committing:
   ```bash
   npm run type-check
   ```

### Making Backend Changes

When you modify files in `amplify/`:

1. The sandbox will automatically detect changes
2. It will redeploy the affected resources
3. Wait for deployment to complete
4. Frontend will automatically connect to updated backend

### Testing

Run E2E tests:
```bash
npm run test:e2e
```

## Next Steps

Now that your development environment is set up:

1. **Read the full [README.md](./README.md)** for project overview
2. **Review [MBRIDESHARE_COOP_PLAN.md](./MBRIDESHARE_COOP_PLAN.md)** for architecture details
3. **Check the [Project Structure](#project-structure)** in README.md
4. **Start building features!**

### Suggested First Tasks

- [ ] Familiarize yourself with the codebase
- [ ] Try signing in with Google OAuth
- [ ] Navigate between different views
- [ ] Check the browser console for any errors
- [ ] Review the data models in `amplify/data/resource.ts`
- [ ] Explore the map view functionality

## Getting Help

If you run into issues:

1. **Check the browser console** for error messages
2. **Check the Amplify sandbox terminal** for backend errors
3. **Review AWS Amplify Gen 2 docs**: https://docs.amplify.aws/gen2/
4. **Open an issue** on GitHub with details

## Quick Reference

### Key Commands

```bash
npm run dev              # Start dev server
npm run amplify:sandbox  # Start Amplify backend
npm run type-check       # Check TypeScript
npm run build           # Build for production
npm run preview         # Preview production build
npm run test:e2e        # Run E2E tests
```

### Important Files

- `amplify/` - Backend configuration
- `src/components/` - React components
- `src/utils/` - Utility functions
- `src/types/index.ts` - TypeScript types
- `src/App.tsx` - Main application component

### Key Constraints to Remember

1. ⚠️ **localStorage**: ONLY use `activeRideStorage.ts`
2. 🎨 **Styling**: Tailwind core utilities only (no custom classes)
3. 🔔 **Notifications**: Use toast functions (NEVER alert())
4. 📡 **Backend**: Always use Amplify Gen 2 patterns
5. 🧭 **Routing**: View-based (no React Router)

---

Happy coding! 🚗💨
