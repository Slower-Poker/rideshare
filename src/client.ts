import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';

/**
 * Singleton Amplify Data Client
 * 
 * IMPORTANT: All components should import this client instead of creating
 * new instances with generateClient(). This ensures:
 * - Single source of truth for configuration
 * - Better performance (no duplicate clients)
 * - Consistent auth mode across the app
 */
export const client = generateClient<Schema>({ 
  authMode: 'userPool' 
});

// Re-export Schema type for convenience
export type { Schema };
