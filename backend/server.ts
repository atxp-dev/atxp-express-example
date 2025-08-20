import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import dotenv from 'dotenv';

// Import the ATXP client SDK
import { atxpClient, ATXPAccount } from '@atxp/client';
import { ConsoleLogger, LogLevel } from '@atxp/common';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

const ATXP_CONNECTION_STRING = process.env.ATXP_CONNECTION_STRING;
if (!ATXP_CONNECTION_STRING) {
  throw new Error('ATXP_CONNECTION_STRING is not set');
}
const account = new ATXPAccount(ATXP_CONNECTION_STRING, {network: 'base'});

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control']
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

// Define the Stage interface for progress tracking
interface Stage {
  id: string;
  stage: string;
  message: string;
  timestamp: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
}

// In-memory storage for texts (in production, use a database)
let texts: Text[] = [];

// Store active SSE connections
const clients = new Set<Response>();

// Helper function to send SSE updates to all connected clients
const sendSSEUpdate = (data: any) => {
  console.log('Sending SSE update:', data);
  const sseData = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    client.write(sseData);
  });
};

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
    'Access-Control-Allow-Headers': 'Cache-Control, Content-Type',
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
    'Access-Control-Allow-Headers': 'Cache-Control, Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  });

  console.log('SSE connection established');
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`);

  // Add client to the set
  clients.add(res);

  // Remove client when connection closes
  req.on('close', () => {
    clients.delete(res);
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

  const requestId = Date.now().toString();

  // Send initial stage update
  sendSSEUpdate({
    id: requestId,
    type: 'stage-update',
    stage: 'initializing',
    message: 'Starting image generation process...',
    timestamp: new Date().toISOString(),
    status: 'in-progress'
  });

  let newText: Text = {
    id: Date.now(),
    text: text.trim(),
    timestamp: new Date().toISOString(),
    imageUrl: '',
    fileName: '',
  };

  // Send stage update for client creation
  sendSSEUpdate({
    id: requestId,
    type: 'stage-update',
    stage: 'creating-clients',
    message: 'Initializing ATXP clients...',
    timestamp: new Date().toISOString(),
    status: 'in-progress'
  });

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
  sendSSEUpdate({
    id: requestId,
    type: 'stage-update',
    stage: 'generating-image',
    message: 'Generating image from text using ATXP Image MCP Server...',
    timestamp: new Date().toISOString(),
    status: 'in-progress'
  });

  try {
    // Create an image from the text using the ATXP Image MCP Server
    const result = await imageClient.callTool({
      name: imageService.toolName,
      arguments: imageService.getArguments(text),
    });
    console.log(`${imageService.description} result successful!`);

    // Send stage update for image generation completion
    sendSSEUpdate({
      id: requestId,
      type: 'stage-update',
      stage: 'image-generated',
      message: 'Image generated successfully!',
      timestamp: new Date().toISOString(),
      status: 'completed'
    });

    // Process the image result only on success
    const imageResult = imageService.getResult(result);
    console.log('Result:', imageResult);

    // Send stage update for file storage
    sendSSEUpdate({
      id: requestId,
      type: 'stage-update',
      stage: 'storing-file',
      message: 'Storing image in ATXP Filestore...',
      timestamp: new Date().toISOString(),
      status: 'in-progress'
    });

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
      sendSSEUpdate({
        id: requestId,
        type: 'stage-update',
        stage: 'completed',
        message: 'Image stored successfully! Process completed.',
        timestamp: new Date().toISOString(),
        status: 'final'
      });

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
