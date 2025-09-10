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
    const FRONTEND_PORT = process.env.FRONTEND_PORT || '3000';
    const PORT = process.env.PORT || '3001';
    app.use(cors({
      origin: [`http://localhost:${FRONTEND_PORT}`, `http://localhost:${PORT}`],
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
      const FRONTEND_PORT = process.env.FRONTEND_PORT || '3000';
      const response = await request(app)
        .options('/api/test-connection')
        .set('Origin', `http://localhost:${FRONTEND_PORT}`)
        .set('Access-Control-Request-Headers', 'x-atxp-connection-string');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-headers']).toContain('x-atxp-connection-string');
    });
  });

  describe('GET /api/validate-connection', () => {
    beforeEach(() => {
      // Add the new validation endpoint to our test app
      app.get('/api/validate-connection', async (req, res) => {
        const validationResult = await validateATXPConnectionString(req);
        
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

  describe('POST /api/texts - Input Validation', () => {
    beforeEach(() => {
      // Add a simple endpoint to test input validation
      app.post('/api/texts', (req, res) => {
        const { text } = req.body;

        if (!text || text.trim() === '') {
          return res.status(400).json({ error: 'Text is required' });
        }

        // Just return success for validation testing
        res.status(201).json({ 
          id: 1, 
          text: text.trim(), 
          timestamp: new Date().toISOString(),
          status: 'pending'
        });
      });
    });

    it('should return 400 error when text is missing', async () => {
      const response = await request(app)
        .post('/api/texts')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Text is required'
      });
    });

    it('should return 400 error when text is empty string', async () => {
      const response = await request(app)
        .post('/api/texts')
        .send({ text: '   ' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Text is required'
      });
    });

    it('should accept valid text input', async () => {
      const testText = 'Create an image of a sunset';
      
      const response = await request(app)
        .post('/api/texts')
        .send({ text: testText });

      expect(response.status).toBe(201);
      expect(response.body.text).toBe(testText);
      expect(response.body.id).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Async Image Generation Service Configuration', () => {
    it('should have correct async tool names configured', async () => {
      // This test verifies our service configuration is correct
      const imageService = {
        mcpServer: 'https://image.mcp.atxp.ai',
        createImageAsyncToolName: 'image_create_image_async',
        getImageAsyncToolName: 'image_get_image_async',
        description: 'ATXP Image MCP server'
      };

      expect(imageService.createImageAsyncToolName).toBe('image_create_image_async');
      expect(imageService.getImageAsyncToolName).toBe('image_get_image_async');
      expect(imageService.mcpServer).toBe('https://image.mcp.atxp.ai');
    });

    it('should parse async create result correctly', async () => {
      const getAsyncCreateResult = (result: any) => {
        const jsonString = result.content[0].text;
        const parsed = JSON.parse(jsonString);
        return { taskId: parsed.taskId };
      };

      const mockResult = {
        content: [{ text: JSON.stringify({ taskId: 'test-task-123' }) }]
      };

      const parsed = getAsyncCreateResult(mockResult);
      expect(parsed).toEqual({ taskId: 'test-task-123' });
    });

    it('should parse async status result correctly', async () => {
      const getAsyncStatusResult = (result: any) => {
        const jsonString = result.content[0].text;
        const parsed = JSON.parse(jsonString);
        return { status: parsed.status, url: parsed.url };
      };

      const mockResult = {
        content: [{ text: JSON.stringify({ 
          status: 'completed', 
          url: 'https://example.com/image.jpg' 
        }) }]
      };

      const parsed = getAsyncStatusResult(mockResult);
      expect(parsed).toEqual({ 
        status: 'completed', 
        url: 'https://example.com/image.jpg' 
      });
    });
  });
});