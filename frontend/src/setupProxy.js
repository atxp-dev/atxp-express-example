const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  const backendPort = process.env.REACT_APP_BACKEND_PORT || '3001';
  
  app.use(
    '/api',
    createProxyMiddleware({
      target: `http://localhost:${backendPort}`,
      changeOrigin: true,
    })
  );
};