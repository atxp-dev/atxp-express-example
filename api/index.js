// Vercel serverless function entry point
// Use dynamic import to handle ES modules in Vercel's runtime

module.exports = async (req, res) => {
  // Dynamically import the ES module Express app
  const { default: app } = await import('../backend/dist/server.js');
  
  // Call the Express app as a handler
  return app(req, res);
};