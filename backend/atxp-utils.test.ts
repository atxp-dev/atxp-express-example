import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request } from 'express';

// Mock the ATXP client module
vi.mock('@atxp/client', () => ({
  ATXPAccount: vi.fn().mockImplementation(() => ({ accountId: 'test-account' }))
}));

import { getATXPConnectionString, createATXPAccount } from './atxp-utils';
import { ATXPAccount } from '@atxp/client';

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

  describe('createATXPAccount', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should call ATXPAccount constructor with correct parameters', () => {
      const connectionString = 'test-connection-string';
      
      const result = createATXPAccount(connectionString);
      
      expect(ATXPAccount).toHaveBeenCalledWith(connectionString, { network: 'base' });
      expect(result).toEqual({ accountId: 'test-account' });
    });

    it('should return the ATXPAccount instance', () => {
      const connectionString = 'any-connection-string';
      
      const result = createATXPAccount(connectionString);
      
      expect(result).toEqual({ accountId: 'test-account' });
    });
  });
});