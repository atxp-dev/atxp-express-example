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
app.use(cors());
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
  getArguments: (sourceUrl : string) => ({ sourceUrl, makePublic: true }),
  getResult: (result: any) => {
    // Parse the JSON string from the result
    const jsonString = result.content[0].text;
    return JSON.parse(jsonString);
  }
};

// Routes
app.get('/api/texts', (req: Request, res: Response) => {
  res.json({ texts });
});

app.post('/api/texts', async (req: Request, res: Response) => {
  const { text } = req.body;
  
  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'Text is required' });
  }

  let newText: Text = {
    id: Date.now(),
    text: text.trim(),
    timestamp: new Date().toISOString(),
    imageUrl: '',
    fileName: '',
  };

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

  try {
    // Create an image from the text using the ATXP Image MCP Server
    const result = await imageClient.callTool({
        name: imageService.toolName,
        arguments: imageService.getArguments(text),
    });
    console.log(`${imageService.description} result successful!`);
    
    // Process the image result only on success
    const imageResult = imageService.getResult(result);
    console.log('Result:', imageResult);

    
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

      texts.push(newText);
      res.status(201).json(newText);
    } catch (error) {
      console.error(`Error with ${filestoreService.description}:`, error);
      // Don't exit the process, just log the error
      console.log('Continuing without filestore service...');
    }
  } catch (error) {
    console.error(`Error with ${imageService.description}:`, error);
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
