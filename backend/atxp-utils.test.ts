import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request } from 'express';

// Mock the ATXP client module
vi.mock('@atxp/client', () => ({
  ATXPAccount: vi.fn().mockImplementation(() => ({ accountId: 'test-account' }))
}));

import { getATXPConnectionString, findATXPAccount, validateATXPConnectionString } from './atxp-utils.js';

describe('ATXP Utils', () => {
  beforeEach(() => {
    // Clear environment variables before each test
    delete process.env.ATXP_CONNECTION_STRING;
  });

  describe('getATXPConnectionString', () => {
    it('should return connection string from header when present', () => {
      const mockReq = {
        headers: {
          'x-atxp-connection-string': 'header-connection-string'
        }
      } as Partial<Request> as Request;

      process.env.ATXP_CONNECTION_STRING = 'env-connection-string';

      const result = getATXPConnectionString(mockReq);
      expect(result).toBe('header-connection-string');
    });

    it('should return connection string from environment variable when header is not present', () => {
      const mockReq = {
        headers: {}
      } as Partial<Request> as Request;

      process.env.ATXP_CONNECTION_STRING = 'env-connection-string';

      const result = getATXPConnectionString(mockReq);
      expect(result).toBe('env-connection-string');
    });

    it('should return connection string from environment variable when header is empty', () => {
      const mockReq = {
        headers: {
          'x-atxp-connection-string': ''
        }
      } as Partial<Request> as Request;

      process.env.ATXP_CONNECTION_STRING = 'env-connection-string';

      const result = getATXPConnectionString(mockReq);
      expect(result).toBe('env-connection-string');
    });

    it('should throw error when neither header nor environment variable is present', () => {
      const mockReq = {
        headers: {}
      } as Partial<Request> as Request;

      expect(() => getATXPConnectionString(mockReq)).toThrow(
        'ATXP connection string not found. Provide either x-atxp-connection-string header or ATXP_CONNECTION_STRING environment variable'
      );
    });

    it('should throw error when header is empty and environment variable is not set', () => {
      const mockReq = {
        headers: {
          'x-atxp-connection-string': ''
        }
      } as Partial<Request> as Request;

      expect(() => getATXPConnectionString(mockReq)).toThrow(
        'ATXP connection string not found. Provide either x-atxp-connection-string header or ATXP_CONNECTION_STRING environment variable'
      );
    });

    it('should handle undefined header values', () => {
      const mockReq = {
        headers: {
          'x-atxp-connection-string': undefined
        }
      } as Partial<Request> as Request;

      process.env.ATXP_CONNECTION_STRING = 'env-connection-string';

      const result = getATXPConnectionString(mockReq);
      expect(result).toBe('env-connection-string');
    });

    it('should prioritize header over environment variable even when both are set', () => {
      const mockReq = {
        headers: {
          'x-atxp-connection-string': 'header-wins'
        }
      } as Partial<Request> as Request;

      process.env.ATXP_CONNECTION_STRING = 'env-loses';

      const result = getATXPConnectionString(mockReq);
      expect(result).toBe('header-wins');
    });
  });

  describe('findATXPAccount', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should call ATXPAccount constructor with correct parameters', async () => {
      const connectionString = 'test-connection-string';
      
      const result = await findATXPAccount(connectionString);
      
      expect(result).toEqual({ accountId: 'test-account' });
    });

    it('should return the ATXPAccount instance', async () => {
      const connectionString = 'any-connection-string';
      
      const result = await findATXPAccount(connectionString);
      
      expect(result).toEqual({ accountId: 'test-account' });
    });
  });

  describe('validateATXPConnectionString', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      delete process.env.ATXP_CONNECTION_STRING;
    });

    it('should return valid true when connection string is available and account creation succeeds', async () => {
      const mockReq = {
        headers: {
          'x-atxp-connection-string': 'valid-connection-string'
        }
      } as Partial<Request> as Request;

      const result = await validateATXPConnectionString(mockReq);

      expect(result).toEqual({
        isValid: true
      });
    });

    it('should return valid true when using environment variable', async () => {
      process.env.ATXP_CONNECTION_STRING = 'env-connection-string';
      
      const mockReq = {
        headers: {}
      } as Partial<Request> as Request;

      const result = await validateATXPConnectionString(mockReq);

      expect(result).toEqual({
        isValid: true
      });
    });

    it('should return valid false when no connection string is available', async () => {
      const mockReq = {
        headers: {}
      } as Partial<Request> as Request;

      const result = await validateATXPConnectionString(mockReq);

      expect(result).toEqual({
        isValid: false,
        error: 'ATXP connection string not found. Provide either x-atxp-connection-string header or ATXP_CONNECTION_STRING environment variable'
      });
    });

    it('should return valid false when ATXPAccount constructor throws an error', async () => {
      const mockReq = {
        headers: {
          'x-atxp-connection-string': 'invalid-connection-string'
        }
      } as Partial<Request> as Request;

      // Mock the dynamic import to throw an error
      vi.doMock('@atxp/client', () => ({
        ATXPAccount: vi.fn().mockImplementation(() => {
          throw new Error('Invalid connection string format');
        })
      }));

      const result = await validateATXPConnectionString(mockReq);

      expect(result).toEqual({
        isValid: false,
        error: 'Invalid connection string format'
      });
    });
  });
});