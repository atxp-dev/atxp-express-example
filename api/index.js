// Vercel serverless function entry point
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the compiled Express app
const { default: app } = await import('../backend/dist/server.js');

// Export the handler for Vercel
export default app;