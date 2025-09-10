// Vercel serverless function entry point (ES Module)
// Import the compiled Express app
const { default: app } = await import('../backend/dist/server.js');

// Export the Express app for Vercel
export default app;