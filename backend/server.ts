import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import dotenv from 'dotenv';
import { sendSSEUpdate, addSSEClient, removeSSEClient, sendStageUpdate } from './stage';

// Import the ATXP client SDK
import { atxpClient, ATXPAccount } from '@atxp/client';
import { ConsoleLogger, LogLevel } from '@atxp/common';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Create the Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Helper function to get ATXP connection string from header or environment variable
function getATXPConnectionString(req: Request): string {
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

// Helper function to create ATXPAccount object
function createATXPAccount(connectionString: string): ATXPAccount {
  return new ATXPAccount(connectionString, {network: 'base'});
}

// Set up CORS and body parsing middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
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
}

// In-memory storage for texts (in production, use a database)
let texts: Text[] = [];

// Helper config object for the ATXP Image MCP Server
const imageService = {
  mcpServer: 'https://image.mcp.atxp.ai',
  toolName: 'image_create_image',
  description: 'ATXP Image MCP server',
  getArguments: (prompt: string) => ({ prompt }),
  getResult: (result: any) => {
    // Parse the JSON string from the result
    const jsonString = result.content[0].text;
    return JSON.parse(jsonString);
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
    'Access-Control-Allow-Origin': 'http://localhost:3000',
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
    'Access-Control-Allow-Origin': 'http://localhost:3000',
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
  let account: ATXPAccount;

  try {
    connectionString = getATXPConnectionString(req);
    account = createATXPAccount(connectionString);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get ATXP connection string';
    return res.status(400).json({ error: errorMessage });
  }

  const requestId = Date.now().toString();

  // Send initial stage update
  sendStageUpdate(requestId, 'initializing', 'Starting image generation process...', 'in-progress');

  let newText: Text = {
    id: Date.now(),
    text: text.trim(),
    timestamp: new Date().toISOString(),
    imageUrl: '',
    fileName: '',
  };

  // Send stage update for client creation
  sendStageUpdate(requestId, 'creating-clients', 'Initializing ATXP clients...', 'in-progress');

  // Create a client using the `atxpClient` function for the ATXP Image MCP Server
  const imageClient = await atxpClient({
    mcpServer: imageService.mcpServer,
    account: account,
    allowedAuthorizationServers: ['http://localhost:3001', 'https://auth.atxp.ai', 'https://atxp-accounts-staging.onrender.com/'],
    logger: new ConsoleLogger({level: LogLevel.DEBUG}),
  });

  // Create a client using the `atxpClient` function for the ATXP Filestore MCP Server
  const filestoreClient = await atxpClient({
    mcpServer: filestoreService.mcpServer,
    account: account,
  });

  // Send stage update for image generation
  sendStageUpdate(requestId, 'generating-image', 'Generating image from text using ATXP Image MCP Server...', 'in-progress');

  try {
    // Create an image from the text using the ATXP Image MCP Server
    const result = await imageClient.callTool({
      name: imageService.toolName,
      arguments: imageService.getArguments(text),
    });
    console.log(`${imageService.description} result successful!`);

    // Send stage update for image generation completion
    sendStageUpdate(requestId, 'image-generated', 'Image generated successfully!', 'completed');

    // Process the image result only on success
    const imageResult = imageService.getResult(result);
    console.log('Result:', imageResult);

    // Send stage update for file storage
    sendStageUpdate(requestId, 'storing-file', 'Storing image in ATXP Filestore...', 'in-progress');

    // Store the image in the ATXP Filestore MCP Server
    try {
      const result = await filestoreClient.callTool({
        name: filestoreService.toolName,
        arguments: filestoreService.getArguments(imageResult.url),
      });
      console.log(`${filestoreService.description} result successful!`);
      const fileResult = filestoreService.getResult(result);
      newText.fileName = fileResult.filename;
      newText.imageUrl = fileResult.url;

      console.log('Result:', fileResult);

      // Send stage update for completion
      sendStageUpdate(requestId, 'completed', 'Image stored successfully! Process completed.', 'final');

      texts.push(newText);
      res.status(201).json(newText);
    } catch (error) {
      console.error(`Error with ${filestoreService.description}:`, error);
      // Send stage update for filestore error
      sendSSEUpdate({
        id: requestId,
        type: 'stage-update',
        stage: 'filestore-error',
        message: 'Failed to store image, but continuing without filestore service...',
        timestamp: new Date().toISOString(),
        status: 'error'
      });
      // Don't exit the process, just log the error
      console.log('Continuing without filestore service...');

      // Still save the text with the image URL from the image service
      newText.imageUrl = imageResult.url;
      texts.push(newText);
      res.status(201).json(newText);
    }
  } catch (error) {
    console.error(`Error with ${imageService.description}:`, error);

    // Send stage update for image generation error
    sendSSEUpdate({
      id: requestId,
      type: 'stage-update',
      stage: 'image-generation-error',
      message: 'Failed to generate image from text.',
      timestamp: new Date().toISOString(),
      status: 'error'
    });

    // Return an error response if image processing fails
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ error: 'Failed to process image', details: errorMessage });
  }
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));

  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
