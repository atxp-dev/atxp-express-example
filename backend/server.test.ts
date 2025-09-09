import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

// Mock the ATXP client to avoid real API calls in tests
vi.mock('@atxp/client', () => ({
  atxpClient: vi.fn(),
  ATXPAccount: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@atxp/common', () => ({
  ConsoleLogger: vi.fn(),
  LogLevel: { DEBUG: 'debug' },
}));

// Mock the stage module
vi.mock('./stage', () => ({
  sendSSEUpdate: vi.fn(),
  addSSEClient: vi.fn(),
  removeSSEClient: vi.fn(),
  sendStageUpdate: vi.fn(),
}));

// Import after mocking
import { getATXPConnectionString, validateATXPConnectionString } from './atxp-utils';

describe('API Endpoints', () => {
  let app: express.Application;

  beforeEach(() => {
    // Create minimal app for testing connection string logic
    app = express();
    app.use(cors({
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'x-atxp-connection-string']
    }));
    app.use(bodyParser.json());

    // Simple test endpoint that uses our connection string logic
    app.post('/api/test-connection', (req, res) => {
      try {
        const connectionString = getATXPConnectionString(req);
        res.json({ success: true, hasConnectionString: !!connectionString });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(400).json({ error: errorMessage });
      }
    });

    // Clear environment variables
    delete process.env.ATXP_CONNECTION_STRING;
  });

  afterEach(() => {
    delete process.env.ATXP_CONNECTION_STRING;
  });

  describe('POST /api/test-connection', () => {
    it('should accept connection string from header', async () => {
      const response = await request(app)
        .post('/api/test-connection')
        .set('x-atxp-connection-string', 'test-header-connection')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        hasConnectionString: true
      });
    });

    it('should accept connection string from environment variable', async () => {
      process.env.ATXP_CONNECTION_STRING = 'test-env-connection';

      const response = await request(app)
        .post('/api/test-connection')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        hasConnectionString: true
      });
    });

    it('should prioritize header over environment variable', async () => {
      process.env.ATXP_CONNECTION_STRING = 'env-connection';

      const response = await request(app)
        .post('/api/test-connection')
        .set('x-atxp-connection-string', 'header-connection')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        hasConnectionString: true
      });
    });

    it('should return 400 error when no connection string is provided', async () => {
      const response = await request(app)
        .post('/api/test-connection')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'ATXP connection string not found. Provide either x-atxp-connection-string header or ATXP_CONNECTION_STRING environment variable'
      });
    });

    it('should return 400 error when header is empty and env var is not set', async () => {
      const response = await request(app)
        .post('/api/test-connection')
        .set('x-atxp-connection-string', '')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'ATXP connection string not found. Provide either x-atxp-connection-string header or ATXP_CONNECTION_STRING environment variable'
      });
    });
  });

  describe('CORS Configuration', () => {
    it('should allow x-atxp-connection-string header in CORS', async () => {
      const response = await request(app)
        .options('/api/test-connection')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Headers', 'x-atxp-connection-string');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-headers']).toContain('x-atxp-connection-string');
    });
  });

  describe('GET /api/validate-connection', () => {
    beforeEach(() => {
      // Add the new validation endpoint to our test app
      app.get('/api/validate-connection', (req, res) => {
        const validationResult = validateATXPConnectionString(req);
        
        if (validationResult.isValid) {
          res.json({ 
            valid: true, 
            message: 'Valid ATXP account connection string found' 
          });
        } else {
          res.status(400).json({ 
            valid: false, 
            error: validationResult.error 
          });
        }
      });
    });

    it('should return valid true with connection string in header', async () => {
      const response = await request(app)
        .get('/api/validate-connection')
        .set('x-atxp-connection-string', 'valid-connection-string');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        valid: true,
        message: 'Valid ATXP account connection string found'
      });
    });

    it('should return valid true with connection string in environment variable', async () => {
      process.env.ATXP_CONNECTION_STRING = 'env-connection-string';

      const response = await request(app)
        .get('/api/validate-connection');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        valid: true,
        message: 'Valid ATXP account connection string found'
      });
    });

    it('should return 400 error when no connection string is provided', async () => {
      const response = await request(app)
        .get('/api/validate-connection');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        valid: false,
        error: 'ATXP connection string not found. Provide either x-atxp-connection-string header or ATXP_CONNECTION_STRING environment variable'
      });
    });

    it('should prioritize header over environment variable', async () => {
      process.env.ATXP_CONNECTION_STRING = 'env-connection';

      const response = await request(app)
        .get('/api/validate-connection')
        .set('x-atxp-connection-string', 'header-connection');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        valid: true,
        message: 'Valid ATXP account connection string found'
      });
    });

    it('should return 400 error when header is empty and env var is not set', async () => {
      const response = await request(app)
        .get('/api/validate-connection')
        .set('x-atxp-connection-string', '');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        valid: false,
        error: 'ATXP connection string not found. Provide either x-atxp-connection-string header or ATXP_CONNECTION_STRING environment variable'
      });
    });
  });
});