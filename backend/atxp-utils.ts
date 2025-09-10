import { Request } from 'express';

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
 * Find ATXPAccount object from connection string
 */
export async function findATXPAccount(connectionString: string): Promise<any> {
  const { ATXPAccount } = await import('@atxp/client');
  return new ATXPAccount(connectionString, {network: 'base'});
}

/**
 * Validate if an ATXP account connection string is valid
 * Returns true if the connection string can be used to create a valid ATXPAccount
 */
export async function validateATXPConnectionString(req: Request): Promise<{ isValid: boolean; error?: string }> {
  try {
    const connectionString = getATXPConnectionString(req);
    const account = await findATXPAccount(connectionString);
    
    // Basic validation - if we can create an account without throwing, it's valid
    // Additional validation could be added here if needed (e.g., checking account properties)
    if (account != null && account !== undefined) {
      return { isValid: true };
    } else {
      return { isValid: false, error: 'Invalid ATXP connection string' };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { isValid: false, error: errorMessage };
  }
}