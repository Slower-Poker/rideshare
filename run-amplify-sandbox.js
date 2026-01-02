#!/usr/bin/env node

// Wrapper script to polyfill localStorage before running Amplify CLI
// This fixes the @typescript/vfs localStorage issue

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create require for CommonJS modules
const require = createRequire(import.meta.url);

// Load polyfill first
require('./amplify-polyfill.cjs');

// Get all arguments after the script name (including --profile if provided)
// If 'sandbox' is not in args, add it as the first argument
let args = process.argv.slice(2);
if (args.length === 0 || (args[0] !== 'sandbox' && !args.includes('sandbox'))) {
  args = ['sandbox', ...args];
}
const ampxPath = path.join(__dirname, 'node_modules', '.bin', 'ampx');

// Use the current node executable to run ampx with the polyfill loaded
// Pass --require directly as a node argument to avoid NODE_OPTIONS parsing issues with spaces
const polyfillPath = path.resolve(__dirname, 'amplify-polyfill.cjs');

// Build node arguments: [node, --require polyfill, ampx, ...args]
const nodeArgs = ['--require', polyfillPath, ampxPath, ...args];

const child = spawn(process.execPath, nodeArgs, {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

