import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { novaAgentProxy } from './functions/novaAgentProxy/resource';

/**
 * @see https://docs.amplify.aws/gen2/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  novaAgentProxy,
});

// Grant Lambda function permissions to read secrets from Parameter Store and Secrets Manager
backend.novaAgentProxy.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: [
      'ssm:GetParameter',
      'ssm:GetParameters',
      'secretsmanager:GetSecretValue',
    ],
    resources: [
      'arn:aws:ssm:ca-central-1:*:parameter/amplify/NOVA_API_KEY',
      'arn:aws:ssm:ca-central-1:*:parameter/amplify/NOVA_AGENT_ID',
      'arn:aws:secretsmanager:ca-central-1:*:secret:amplify/NOVA_API_KEY-*',
    ],
  })
);

// Configure the backend for ca-central-1 region (Manitoba)
export default backend;
