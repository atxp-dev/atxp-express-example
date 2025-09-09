import { Request } from 'express';
import { ATXPAccount } from '@atxp/client';

/**
 * Get ATXP connection string from header or environment variable
 * Priority: 1. x-atxp-connection-string header, 2. ATXP_CONNECTION_STRING env var
 */
export function getATXPConnectionString(req: Request): string {
  const headerConnectionString = req.headers['x-atxp-connection-string'] as string;
  const envConnectionString = process.env.ATXP_CONNECTION_STRING;
  
  if (headerConnectionString) {
    return headerConnectionString;
  }
  
  if (envConnectionString) {
    return envConnectionString;
  }
  
  throw new Error('ATXP connection string not found. Provide either x-atxp-connection-string header or ATXP_CONNECTION_STRING environment variable');
}

/**
 * Create ATXPAccount object from connection string
 */
export function createATXPAccount(connectionString: string): ATXPAccount {
  return new ATXPAccount(connectionString, {network: 'base'});
}