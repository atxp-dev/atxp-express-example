// Cloudflare Workers adapter for Express backend
import { Request, Response } from 'express';
import app from './server';

// Cloudflare Workers fetch handler
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    // Convert Cloudflare Request to Express-compatible format
    const url = new URL(request.url);
    const method = request.method;
    const headers = Object.fromEntries(request.headers.entries());
    
    // Set environment variables from Cloudflare environment
    if (env.ATXP_CONNECTION_STRING) {
      process.env.ATXP_CONNECTION_STRING = env.ATXP_CONNECTION_STRING;
    }
    if (env.NODE_ENV) {
      process.env.NODE_ENV = env.NODE_ENV;
    }
    if (env.FRONTEND_PORT) {
      process.env.FRONTEND_PORT = env.FRONTEND_PORT;
    }
    
    // Create a mock Express request/response for compatibility
    const mockReq = {
      url: url.pathname + url.search,
      method,
      headers,
      body: method !== 'GET' && method !== 'HEAD' ? await request.text() : undefined,
    };
    
    return new Promise((resolve) => {
      const mockRes = {
        status: 200,
        headers: new Headers({
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-atxp-connection-string',
        }),
        body: '',
        statusCode: 200,
        setHeader: function(name: string, value: string) {
          this.headers.set(name, value);
        },
        json: function(data: any) {
          this.body = JSON.stringify(data);
          this.headers.set('Content-Type', 'application/json');
          resolve(new Response(this.body, {
            status: this.statusCode,
            headers: this.headers,
          }));
        },
        send: function(data: any) {
          this.body = typeof data === 'string' ? data : JSON.stringify(data);
          resolve(new Response(this.body, {
            status: this.statusCode,
            headers: this.headers,
          }));
        },
        status: function(code: number) {
          this.statusCode = code;
          return this;
        },
      };
      
      // Route through Express app
      app(mockReq as any, mockRes as any, () => {
        // Fallback for unhandled routes
        resolve(new Response('Not Found', { status: 404 }));
      });
    });
  },
};