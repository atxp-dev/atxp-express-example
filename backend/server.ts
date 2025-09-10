import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESM __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { sendSSEUpdate, addSSEClient, removeSSEClient, sendStageUpdate, sendPaymentUpdate } from './stage.js';

// ATXP client SDK imports (will be dynamically imported due to ES module compatibility)

// Import ATXP utility functions
import { getATXPConnectionString, findATXPAccount, validateATXPConnectionString } from './atxp-utils.js';

// Load environment variables
// In production, __dirname points to dist/, but .env is in the parent directory
const envPath = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, '../.env')
  : path.join(__dirname, '.env');
dotenv.config({ path: envPath });

// Create the Express app
const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_PORT = process.env.FRONTEND_PORT || 3000;

// Set up CORS and body parsing middleware
app.use(cors({
  origin: [`http://localhost:${FRONTEND_PORT}`, `http://localhost:${PORT}`],
  credentials: true,
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

// In-memory storage for texts (in production, use a database)
let texts: Text[] = [];

// Helper config object for the ATXP Image MCP Server
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

// Helper config object for the ATXP Filestore MCP Server
const filestoreService = {
  mcpServer: 'https://filestore.mcp.atxp.ai',
  toolName: 'filestore_write',
  description: 'ATXP Filestore MCP server',
  getArguments: (sourceUrl: string) => ({ sourceUrl, makePublic: true }),
  getResult: (result: any) => {
    // Parse the JSON string from the result
    const jsonString = result.content[0].text;
    return JSON.parse(jsonString);
  }
};

// Handle OPTIONS for SSE endpoint
app.options('/api/progress', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Access-Control-Allow-Origin': `http://localhost:${FRONTEND_PORT}`,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Cache-Control, Content-Type, x-atxp-connection-string',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  });
  res.end();
});

// SSE endpoint for progress updates
app.get('/api/progress', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': `http://localhost:${FRONTEND_PORT}`,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Cache-Control, Content-Type, x-atxp-connection-string',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  });

  console.log('SSE connection established');
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`);

  // Add client to the set
  addSSEClient(res);

  // Remove client when connection closes
  req.on('close', () => {
    removeSSEClient(res);
  });
});

// Background polling function for async image generation
async function pollForTaskCompletion(
  imageClient: any, 
  taskId: string, 
  textId: number, 
  requestId: string,
  account: any
) {
  console.log(`Starting polling for task ${taskId}`);
  let completed = false;
  let attempts = 0;
  const maxAttempts = 120; // Poll for up to 10 minutes (5 seconds * 120)

  while (!completed && attempts < maxAttempts) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    try {
      const statusResult = await imageClient.callTool({
        name: imageService.getImageAsyncToolName,
        arguments: { taskId },
      });
      const { status, url } = imageService.getAsyncStatusResult(statusResult);
      
      console.log(`Task ${taskId} status (attempt ${attempts}):`, status);
      
      // Find the text in our array and update it
      const textIndex = texts.findIndex(text => text.id === textId);
      if (textIndex === -1) {
        console.error(`Text with ID ${textId} not found`);
        completed = true;
        continue;
      }

      if (status === 'completed' && url) {
        console.log(`Task ${taskId} completed successfully. URL:`, url);
        
        // Send stage update for completion
        sendStageUpdate(requestId, 'image-completed', 'Image generation completed!', 'completed');
        
        // Update the text with the completed image
        texts[textIndex].status = 'completed';
        texts[textIndex].imageUrl = url;

        // Now try to store in filestore
        try {
          // Send stage update for file storage
          sendStageUpdate(requestId, 'storing-file', 'Storing image in ATXP Filestore...', 'in-progress');

          // Create filestore client with dynamic import
          const { atxpClient: filestoreAtxpClient } = await import('@atxp/client');
          const filestoreClient = await filestoreAtxpClient({
            mcpServer: filestoreService.mcpServer,
            account: account,
            onPayment: async ({ payment }: { payment: any }) => {
              console.log('Payment made to filestore:', payment);
              sendPaymentUpdate({
                accountId: payment.accountId,
                resourceUrl: payment.resourceUrl,
                resourceName: payment.resourceName,
                network: payment.network,
                currency: payment.currency,
                amount: payment.amount.toString(),
                iss: payment.iss
              });
            },
          });

          const filestoreResult = await filestoreClient.callTool({
            name: filestoreService.toolName,
            arguments: filestoreService.getArguments(url),
          });
          
          const fileResult = filestoreService.getResult(filestoreResult);
          texts[textIndex].fileName = fileResult.filename;
          texts[textIndex].imageUrl = fileResult.url; // Use filestore URL instead
          texts[textIndex].fileId = fileResult.fileId || fileResult.filename;

          console.log('Filestore result:', fileResult);

          // Send final completion stage update
          sendStageUpdate(requestId, 'completed', 'Image stored successfully! Process completed.', 'final');
          
        } catch (filestoreError) {
          console.error('Error with filestore, using direct image URL:', filestoreError);
          
          // Send stage update for filestore error but continue
          sendSSEUpdate({
            id: requestId,
            type: 'stage-update',
            stage: 'filestore-warning',
            message: 'Image ready! Filestore unavailable, using direct URL.',
            timestamp: new Date().toISOString(),
            status: 'completed'
          });

          // Send final completion stage update
          sendStageUpdate(requestId, 'completed', 'Image generation completed!', 'final');
        }

        completed = true;
        
      } else if (status === 'failed') {
        console.error(`Task ${taskId} failed`);
        
        // Send stage update for failure
        sendStageUpdate(requestId, 'generation-failed', 'Image generation failed.', 'error');
        
        // Update the text status
        texts[textIndex].status = 'failed';
        completed = true;
        
      } else if (status === 'processing') {
        // Send periodic progress updates
        if (attempts % 2 === 0) { // Every 10 seconds
          sendStageUpdate(requestId, 'processing', `Image generation in progress... (${Math.floor(attempts * 5 / 60)}m ${(attempts * 5) % 60}s)`, 'in-progress');
        }
      }
      
    } catch (error) {
      console.error(`Error checking status for task ${taskId}:`, error);
      
      // On error, wait a bit longer before next attempt
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  if (attempts >= maxAttempts) {
    console.error(`Task ${taskId} timed out after ${maxAttempts} attempts`);
    
    // Find and update the text status to failed
    const textIndex = texts.findIndex(text => text.id === textId);
    if (textIndex !== -1) {
      texts[textIndex].status = 'failed';
    }
    
    // Send timeout error stage update
    sendStageUpdate(requestId, 'timeout', 'Image generation timed out.', 'error');
  }
}

// Routes
app.get('/api/texts', (req: Request, res: Response) => {
  res.json({ texts });
});

app.post('/api/texts', async (req: Request, res: Response) => {
  const { text } = req.body;

  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'Text is required' });
  }

  // Get ATXP connection string from header or environment variable
  let connectionString: string;
  let account: any;

  try {
    connectionString = getATXPConnectionString(req);
    account = await findATXPAccount(connectionString);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get ATXP connection string';
    return res.status(400).json({ error: errorMessage });
  }

  const requestId = Date.now().toString();
  const textId = Date.now();

  // Send initial stage update
  sendStageUpdate(requestId, 'initializing', 'Starting async image generation process...', 'in-progress');

  let newText: Text = {
    id: textId,
    text: text.trim(),
    timestamp: new Date().toISOString(),
    imageUrl: '',
    fileName: '',
    status: 'pending',
    taskId: undefined
  };

  try {
    // Send stage update for client creation
    sendStageUpdate(requestId, 'creating-clients', 'Initializing ATXP clients...', 'in-progress');

    // Dynamically import ATXP modules
    const { atxpClient } = await import('@atxp/client');
    const { ConsoleLogger, LogLevel } = await import('@atxp/common');

    // Create a client using the `atxpClient` function for the ATXP Image MCP Server
    const imageClient = await atxpClient({
      mcpServer: imageService.mcpServer,
      account: account,
      allowedAuthorizationServers: [`http://localhost:${PORT}`, 'https://auth.atxp.ai', 'https://atxp-accounts-staging.onrender.com/'],
      logger: new ConsoleLogger({level: LogLevel.DEBUG}),
      onPayment: async ({ payment }: { payment: any }) => {
        console.log('Payment made to image service:', payment);
        sendPaymentUpdate({
          accountId: payment.accountId,
          resourceUrl: payment.resourceUrl,
          resourceName: payment.resourceName,
          network: payment.network,
          currency: payment.currency,
          amount: payment.amount.toString(),
          iss: payment.iss
        });
      },
    });

    // Send stage update for starting async image generation
    sendStageUpdate(requestId, 'starting-async-generation', 'Starting async image generation...', 'in-progress');

    // Start async image generation
    const asyncResult = await imageClient.callTool({
      name: imageService.createImageAsyncToolName,
      arguments: imageService.getArguments(text),
    });
    
    const { taskId } = imageService.getAsyncCreateResult(asyncResult);
    console.log('Async image generation started with task ID:', taskId);

    // Update the text with task information
    newText.taskId = taskId;
    newText.status = 'processing';

    // Send stage update for task started
    sendStageUpdate(requestId, 'task-started', `Async image generation started (Task ID: ${taskId})`, 'in-progress');

    // Add to texts array immediately with pending status
    texts.push(newText);

    // Start background polling for this task
    pollForTaskCompletion(imageClient, taskId, textId, requestId, account);

    // Return immediately with pending status
    res.status(201).json(newText);

  } catch (error) {
    console.error(`Error starting async image generation:`, error);

    // Send stage update for error
    sendSSEUpdate({
      id: requestId,
      type: 'stage-update',
      stage: 'initialization-error',
      message: 'Failed to start image generation.',
      timestamp: new Date().toISOString(),
      status: 'error'
    });

    // Return an error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ error: 'Failed to start image generation', details: errorMessage });
  }
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Connection validation endpoint
app.get('/api/validate-connection', async (req: Request, res: Response) => {
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

// Helper to resolve static path for frontend build
function getStaticPath() {
  // Try ./frontend/build first (works when running from project root in development)
  let candidate = path.join(__dirname, './frontend/build');
  if (fs.existsSync(candidate)) {
    return candidate;
  }
  // Try ../frontend/build (works when running from backend/ directory)
  candidate = path.join(__dirname, '../frontend/build');
  if (fs.existsSync(candidate)) {
    return candidate;
  }
  // Try ../../frontend/build (works when running from backend/dist/ in production)
  candidate = path.join(__dirname, '../../frontend/build');
  if (fs.existsSync(candidate)) {
    return candidate;
  }
  // Fallback: throw error
  throw new Error('No frontend build directory found. Make sure to run "npm run build" first.');
}

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Add static file serving middleware
  app.use(express.static(getStaticPath()));

  // Handle client-side routing by serving index.html for non-API routes
  app.get('*', (req: Request, res: Response) => {
    // Only serve index.html for non-API routes
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(getStaticPath(), 'index.html'));
    } else {
      res.status(404).json({ error: 'API endpoint not found' });
    }
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
