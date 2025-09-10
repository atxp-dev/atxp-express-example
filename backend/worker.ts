// Cloudflare Workers adapter for the full Express ATXP server
// Uses Cloudflare's new Node.js HTTP server support to run the actual Express app

import { httpServerHandler } from 'cloudflare:node';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

// Import the ATXP client SDK
import { atxpClient, ATXPAccount } from '@atxp/client';
import { ConsoleLogger, LogLevel } from '@atxp/common';

// Import ATXP utility functions
import { getATXPConnectionString, findATXPAccount, validateATXPConnectionString } from './atxp-utils';

// Import stage management
import { sendSSEUpdate, addSSEClient, removeSSEClient, sendStageUpdate, sendPaymentUpdate } from './stage';

// Initialize environment variables
dotenv.config();

// Create the Express app (same as the main server but adapted for Workers)
const app = express();
const PORT = 3000; // Fixed port for Workers
const FRONTEND_PORT = process.env.FRONTEND_PORT || '3000';

// Set up CORS and body parsing middleware
app.use(cors({
  origin: ['*'], // More permissive for Workers environment
  credentials: false, // Simplified for Workers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'x-atxp-connection-string']
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Define the Text interface
interface Text {
  id: number;
  text: string;
  timestamp: string;
  imageUrl: string;
  fileName: string;
  fileId?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  taskId?: string;
}

// In-memory storage for texts (same as original server)
let texts: Text[] = [];

// Helper config objects (same as original server)
const imageService = {
  mcpServer: 'https://image.mcp.atxp.ai',
  createImageAsyncToolName: 'image_create_image_async',
  getImageAsyncToolName: 'image_get_image_async',
  description: 'ATXP Image MCP server',
  getArguments: (prompt: string) => ({ prompt }),
  getAsyncCreateResult: (result: any) => {
    const jsonString = result.content[0].text;
    const parsed = JSON.parse(jsonString);
    return { taskId: parsed.taskId };
  },
  getAsyncStatusResult: (result: any) => {
    const jsonString = result.content[0].text;
    const parsed = JSON.parse(jsonString);
    return { status: parsed.status, url: parsed.url };
  }
};

const filestoreService = {
  mcpServer: 'https://filestore.mcp.atxp.ai',
  toolName: 'filestore_write',
  description: 'ATXP Filestore MCP server',
  getArguments: (sourceUrl: string) => ({ sourceUrl, makePublic: true }),
  getResult: (result: any) => {
    const jsonString = result.content[0].text;
    return JSON.parse(jsonString);
  }
};

// Add the Express routes (simplified versions of the original server routes)

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    platform: 'cloudflare-workers',
    node: 'enabled'
  });
});

// Connection validation endpoint  
app.get('/api/validate-connection', async (req, res) => {
  try {
    const connectionString = getATXPConnectionString(req);
    const account = findATXPAccount(connectionString);
    res.json({ valid: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid connection string';
    res.status(400).json({ error: errorMessage });
  }
});

// Get all texts
app.get('/api/texts', (req, res) => {
  res.json({ texts });
});

// Submit new text for image generation (simplified version)
app.post('/api/texts', async (req, res) => {
  const { text } = req.body;
  
  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'Text is required' });
  }

  // Get ATXP connection string
  let connectionString: string;
  let account: ATXPAccount;
  
  try {
    connectionString = getATXPConnectionString(req);
    account = findATXPAccount(connectionString);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get ATXP connection string';
    return res.status(400).json({ error: errorMessage });
  }

  const textId = Date.now();
  const newText: Text = {
    id: textId,
    text: text.trim(),
    timestamp: new Date().toISOString(),
    imageUrl: '',
    fileName: '',
    status: 'pending',
    taskId: undefined
  };

  texts.push(newText);

  // Return immediately and process image generation asynchronously
  // (In a full implementation, you'd trigger background processing here)
  res.json(newText);

  // Note: In Workers, background processing is limited. 
  // For full functionality, consider using Durable Objects or external triggers.
});

// SSE endpoint (simplified - Workers have limitations with streaming)
app.get('/api/progress', (req, res) => {
  res.json({
    message: 'Progress tracking available in Cloudflare Workers',
    note: 'SSE streaming has limitations in Workers environment',
    timestamp: new Date().toISOString()
  });
});

// Start the server and export the handler
app.listen(PORT);

export default httpServerHandler({ port: PORT });