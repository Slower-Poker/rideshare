import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda function to proxy requests to Nova Agent API
 * 
 * This function:
 * - Retrieves Nova API key and agent ID from Parameter Store
 * - Makes authenticated requests to Nova Agent API
 * - Handles streaming responses
 * - Manages conversation state
 * 
 * Note: IAM permissions for SSM and Secrets Manager are configured in backend.ts
 */
export const novaAgentProxy = defineFunction({
  name: 'novaAgentProxy',
  entry: './handler.ts',
  environment: {
    NOVA_AGENT_ID: 'AGENT-9014179c0b5e400ba277c1f5f74c91fe',
  },
  timeoutSeconds: 60, // Nova allows up to 60 minutes, but 60s is reasonable for chat
  memoryMB: 512,
});
