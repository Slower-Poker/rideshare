import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import type { Handler } from 'aws-lambda';

const ssmClient = new SSMClient({ region: 'ca-central-1' });
const secretsClient = new SecretsManagerClient({ region: 'ca-central-1' });

// AppSync resolver event format (when called from Amplify Data)
interface AppSyncResolverEvent {
  arguments: {
    message: string;
    conversationId?: string;
  };
  identity?: {
    sub: string; // User ID
  };
}

// Direct Lambda invocation format (for testing)
interface NovaAgentRequest {
  message: string;
  conversationId?: string;
  userId?: string;
}

interface NovaAgentResponse {
  statusCode?: number;
  body?: string;
  response?: string;
  conversationId?: string;
  error?: string;
}

/**
 * Retrieves Nova API key from Parameter Store or Secrets Manager
 */
async function getNovaApiKey(): Promise<string> {
  try {
    // Try Secrets Manager first (production)
    try {
      const command = new GetSecretValueCommand({
        SecretId: 'amplify/NOVA_API_KEY',
      });
      const response = await secretsClient.send(command);
      return response.SecretString || '';
    } catch {
      // Fall back to Parameter Store (development)
      const command = new GetParameterCommand({
        Name: '/amplify/NOVA_API_KEY',
        WithDecryption: true,
      });
      const response = await ssmClient.send(command);
      return response.Parameter?.Value || '';
    }
  } catch (error) {
    console.error('Failed to retrieve Nova API key:', error);
    throw new Error('Nova API key not configured');
  }
}

/**
 * Calls Nova Agent API
 * 
 * Based on Nova API documentation: https://nova.amazon.com/dev/documentation
 */
async function callNovaAgent(
  apiKey: string,
  agentId: string,
  message: string,
  conversationId?: string
): Promise<{ response: string; conversationId: string; streaming?: boolean }> {
  const novaApiUrl = `https://api.nova.amazon.com/v1/agents/${agentId}/conversations`;
  
  const requestBody: {
    message: string;
    conversation_id?: string;
    stream?: boolean;
  } = {
    message,
    stream: false, // Set to true for streaming responses
  };

  if (conversationId) {
    requestBody.conversation_id = conversationId;
  }

  try {
    const response = await fetch(novaApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Key': apiKey, // Use whichever header format Nova requires
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Nova API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    return {
      response: data.response || data.message || '',
      conversationId: data.conversation_id || conversationId || '',
      streaming: data.streaming || false,
    };
  } catch (error) {
    console.error('Nova API call failed:', error);
    throw error;
  }
}

export const handler: Handler<AppSyncResolverEvent | NovaAgentRequest, NovaAgentResponse> = async (event) => {
  console.log('Lambda handler invoked with event:', JSON.stringify(event, null, 2));
  
  try {
    // Get Nova API key
    console.log('Retrieving Nova API key...');
    const apiKey = await getNovaApiKey();
    
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Nova API key is not configured. Please set it in AWS Parameter Store or Secrets Manager.');
    }
    
    const agentId = process.env.NOVA_AGENT_ID || 'AGENT-9014179c0b5e400ba277c1f5f74c91fe';
    console.log(`Using Agent ID: ${agentId}`);

    // Handle AppSync resolver event format (from Amplify Data)
    let message: string;
    let conversationId: string | undefined;

    if ('arguments' in event) {
      // AppSync resolver event
      message = event.arguments.message;
      conversationId = event.arguments.conversationId;
      console.log(`AppSync event - Message: "${message}", ConversationId: ${conversationId || 'none'}`);
    } else {
      // Direct Lambda invocation
      message = event.message;
      conversationId = event.conversationId;
      console.log(`Direct invocation - Message: "${message}", ConversationId: ${conversationId || 'none'}`);
    }

    if (!message || message.trim() === '') {
      throw new Error('Message is required');
    }

    // Call Nova Agent
    console.log('Calling Nova Agent API...');
    const result = await callNovaAgent(
      apiKey,
      agentId,
      message,
      conversationId
    );
    
    console.log('Nova Agent response received:', JSON.stringify(result, null, 2));

    // Validate response
    if (!result.response || result.response.trim() === '') {
      throw new Error('Nova Agent returned an empty response. Please check the API configuration and agent status.');
    }

    // Return format for AppSync resolver (from Amplify Data)
    if ('arguments' in event) {
      return {
        response: result.response,
        conversationId: result.conversationId || conversationId || '',
      };
    }

    // Return format for direct Lambda invocation
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('Lambda handler error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error message:', errorMessage);
    
    // Return format for AppSync resolver (from Amplify Data)
    if ('arguments' in event) {
      // Return error in response field so frontend can display it
      return {
        response: '',
        conversationId: '',
        error: errorMessage,
      };
    }

    // Return format for direct Lambda invocation
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: errorMessage,
      }),
    };
  }
};
