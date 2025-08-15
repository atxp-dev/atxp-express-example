import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import dotenv from 'dotenv';

// Import the ATXP client SDK
// TODO: Use the @atxp/client package instead of @longrun/atxp-client
import { atxpClient } from '@longrun/atxp-client';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

const ATXP_CONNECTION_STRING = process.env.ATXP_CONNECTION_STRING;
if (!ATXP_CONNECTION_STRING) {
  throw new Error('ATXP_CONNECTION_STRING is not set');
}

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
  fileId: string;
}

// In-memory storage for texts (in production, use a database)
let texts: Text[] = [];

// Helper config object for the ATXP Image MCP Server
const imageService = {
  mcpServer: 'https://image.mcp.atxp.ai',
  toolName: 'atxp_image',
  description: 'ATXP Image MCP server',
  getArguments: (query: string) => ({ query }),
  getResult: (result: any) => result.content[0].text
};

// Helper config object for the ATXP Filestore MCP Server
const filestoreService = {
  mcpServer: 'https://filestore.mcp.atxp.ai',
  toolName: 'atxp_filestore',
  description: 'ATXP Filestore MCP server',
  getArguments: (query: string) => ({ query }),
  getResult: (result: any) => result.content[0].text
};

// Helper config object for the ATXP Database MCP Server
const databaseService = {
  mcpServer: 'https://database.mcp.atxp.ai',
  toolName: 'atxp_database',
  description: 'ATXP Database MCP server',
  getArguments: (query: string) => ({ query }),
  getResult: (result: any) => result.content[0].text
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
    fileId: '',
  };

  // Create a client using the `atxpClient` function for the ATXP Image MCP Server
  const imageClient = await atxpClient({
    mcpServer: imageService.mcpServer,
    account: {
      accountId: ATXP_CONNECTION_STRING,
      paymentMakers: {},
    },
  });

  // Create a client using the `atxpClient` function for the ATXP Filestore MCP Server
  const filestoreClient = await atxpClient({
    mcpServer: filestoreService.mcpServer,
    account: {
      accountId: ATXP_CONNECTION_STRING,
      paymentMakers: {},
    },
  });

  // Create a client using the `atxpClient` function for the ATXP Database MCP Server
  const databaseClient = await atxpClient({
    mcpServer: databaseService.mcpServer,
    account: {
      accountId: ATXP_CONNECTION_STRING,
      paymentMakers: {},
    },
  });

  try {
    // Create an image from the text using the ATXP Image MCP Server
    const result = await imageClient.callTool({
        name: imageService.toolName,
        arguments: imageService.getArguments(text),
    });
    console.log(`${imageService.description} result successful!`);
    const imageUrl = imageService.getResult(result);
    newText.imageUrl = imageUrl;
    console.log('Result:', imageUrl);

    // Store the image in the ATXP Filestore MCP Server
    try {
      const result = await filestoreClient.callTool({
          name: filestoreService.toolName,
          arguments: filestoreService.getArguments(imageUrl),
      });
      console.log(`${filestoreService.description} result successful!`);
      const fileId = filestoreService.getResult(result);
      newText.fileId = fileId;
      console.log('Result:', fileId);


      // TODO: Create a new row in the database via the ATXP Database MCP Server
    } catch (error) {
      console.error(`Error with ${filestoreService.description}:`, error);
      // Don't exit the process, just log the error
      console.log('Continuing without filestore service...');
    }
  } catch (error) {
    console.error(`Error with ${imageService.description}:`, error);
    // Don't exit the process, just log the error
    console.log('Continuing without image service...');
  }
 
  texts.push(newText);
  res.status(201).json(newText);
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
