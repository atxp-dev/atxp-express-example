#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const path = require('path');

// Get the backend port from environment variable or default to 3001
const backendPort = process.env.REACT_APP_BACKEND_PORT || '3001';
const packageJsonPath = path.join(__dirname, 'package.json');

console.log(`[configure-proxy] Setting proxy to http://localhost:${backendPort}`);

try {
  // Read the package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Update the proxy configuration
  packageJson.proxy = `http://localhost:${backendPort}`;
  
  // Write back to package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  
  console.log(`[configure-proxy] Successfully updated proxy to http://localhost:${backendPort}`);
} catch (error) {
  console.error('[configure-proxy] Error updating proxy configuration:', error.message);
  process.exit(1);
}