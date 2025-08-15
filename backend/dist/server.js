"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Import the ATXP client SDK
//import { atxpClient } from '@atxp/client';
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
const ATXP_CONNECTION_STRING = process.env.ATXP_CONNECTION_STRING;
// ATXP_CONNECTION_STRING is optional for demo mode
if (!ATXP_CONNECTION_STRING) {
    console.log('ATXP_CONNECTION_STRING not set - running in demo mode without ATXP services');
}
// Middleware
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: true }));
// In-memory storage for texts (in production, use a database)
let texts = [];
/*
// Helper config object for the ATXP Image MCP Server
const imageService = {
  mcpServer: 'https://image.corp.novellum.ai',
  toolName: 'atxp_image',
  description: 'ATXP Image MCP server',
  getArguments: (query: string) => ({ query }),
  getResult: (result: any) => result.content[0].text
};

// Helper config object for the ATXP Filestore MCP Server
const filestoreService = {
  mcpServer: 'https://filestore.corp.novellum.ai',
  toolName: 'atxp_filestore',
  description: 'ATXP Filestore MCP server',
  getArguments: (query: string) => ({ query }),
  getResult: (result: any) => result.content[0].text
};

// Helper config object for the ATXP Database MCP Server

const databaseService = {
  mcpServer: 'https://database.corp.novellum.ai',
  toolName: 'atxp_database',
  description: 'ATXP Database MCP server',
  getArguments: (query: string) => ({ query }),
  getResult: (result: any) => result.content[0].text
};
*/
// Routes
app.get('/api/texts', (req, res) => {
    res.json({ texts });
});
app.post('/api/texts', async (req, res) => {
    const { text } = req.body;
    if (!text || text.trim() === '') {
        return res.status(400).json({ error: 'Text is required' });
    }
    let newText = {
        id: Date.now(),
        text: text.trim(),
        timestamp: new Date().toISOString(),
        imageUrl: '',
        fileId: '',
    };
    /*
    // Create a client using the `atxpClient` function for the ATXP Image MCP Server
    const imageClient = atxpClient({
      mcpServer: imageService.mcpServer,
      account: new Account(ATXP_CONNECTION_STRING),
    });
  
    // Create a client using the `atxpClient` function for the ATXP Filestore MCP Server
    const filestoreClient = atxpClient({
      mcpServer: filestoreService.mcpServer,
      account: new Account(ATXP_CONNECTION_STRING),
    });
  
    // Create a client using the `atxpClient` function for the ATXP Database MCP Server
    const databaseClient = atxpClient({
      mcpServer: databaseService.mcpServer,
      account: new Account(ATXP_CONNECTION_STRING),
    });
  
    // TODO: Create an image from the text using the ATXP Image MCP Server
    try {
      const result = await imageClient.callTool({
          name: imageService.toolName,
          arguments: imageService.getArguments(text),
      });
      console.log(`${imageService.description} result successful!`);
      const imageUrl = imageService.getResult(result);
      newText.imageUrl = imageUrl;
      console.log('Result:', imageUrl);
  
      // Store the image in via the ATXP Filestore MCP Server
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
    */
    texts.push(newText);
    res.status(201).json(newText);
});
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});
// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express_1.default.static(path_1.default.join(__dirname, '../frontend/build')));
    app.get('*', (req, res) => {
        res.sendFile(path_1.default.join(__dirname, '../frontend/build', 'index.html'));
    });
}
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
//# sourceMappingURL=server.js.map