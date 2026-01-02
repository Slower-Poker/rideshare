import { toast } from './toast';

/**
 * Error Handler Utility
 * Centralized error handling with user-friendly messages
 */

export interface AppError {
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * Handle errors and show appropriate user messages
 * Never expose sensitive error details to users
 */
export function handleError(error: unknown, context?: string): void {
  // Always log errors in error handler (critical for debugging)
  if (import.meta.env.DEV || import.meta.env.PROD) {
    console.error(`Error in ${context || 'app'}:`, error);
  }
  
  let userMessage = 'An unexpected error occurred. Please try again.';
  
  // Handle known error types
  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes('Network')) {
      userMessage = 'Network error. Please check your connection.';
    } else if (error.message.includes('Unauthorized')) {
      userMessage = 'You need to be signed in to perform this action.';
    } else if (error.message.includes('Not found')) {
      userMessage = 'The requested item could not be found.';
    }
  }
  
  toast.error(userMessage);
}

/**
 * Handle Amplify API errors
 */
export function handleApiError(error: unknown, operation: string): void {
  // Always log API errors (critical for debugging)
  if (import.meta.env.DEV || import.meta.env.PROD) {
    console.error(`API error during ${operation}:`, error);
  }
  
  // Generic message for users - detailed error logged
  toast.error(`Failed to ${operation}. Please try again.`);
}

/**
 * Handle validation errors
 */
export function handleValidationErrors(errors: string[]): void {
  errors.forEach(error => toast.error(error));
}

/**
 * Create an app error object
 */
export function createError(message: string, code?: string, details?: unknown): AppError {
  return {
    message,
    code,
    details,
  };
}
