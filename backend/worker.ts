// Simple Cloudflare Workers handler that replicates the Express API functionality
// Note: This is a simplified version. Full Express compatibility would require more complex adaptation.

interface Env {
  ATXP_CONNECTION_STRING?: string;
  NODE_ENV?: string;
  FRONTEND_PORT?: string;
}

// Simple in-memory storage (in production, you'd use Cloudflare KV or D1)
let texts: Array<{
  id: number;
  text: string;
  timestamp: string;
  imageUrl: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}> = [];

let nextId = 1;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-atxp-connection-string',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok', timestamp: new Date().toISOString() }, { headers: corsHeaders });
    }

    // Get texts endpoint
    if (url.pathname === '/api/texts' && request.method === 'GET') {
      return Response.json({ texts }, { headers: corsHeaders });
    }

    // Post text endpoint  
    if (url.pathname === '/api/texts' && request.method === 'POST') {
      try {
        const body = await request.json() as { text: string };
        const connectionString = request.headers.get('x-atxp-connection-string') || env.ATXP_CONNECTION_STRING;
        
        if (!connectionString) {
          return Response.json(
            { error: 'ATXP connection string is required. Please provide it via x-atxp-connection-string header.' },
            { status: 400, headers: corsHeaders }
          );
        }

        const newText = {
          id: nextId++,
          text: body.text,
          timestamp: new Date().toISOString(),
          imageUrl: '', // Would integrate with ATXP client here
          fileName: '',
          status: 'pending' as const
        };

        texts.push(newText);
        return Response.json(newText, { headers: corsHeaders });
      } catch (error) {
        return Response.json(
          { error: 'Invalid JSON body' },
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // Validate connection endpoint
    if (url.pathname === '/api/validate-connection' && request.method === 'GET') {
      const connectionString = request.headers.get('x-atxp-connection-string');
      if (!connectionString) {
        return Response.json(
          { error: 'Connection string header is required' },
          { status: 400, headers: corsHeaders }
        );
      }
      
      // Basic URL validation
      try {
        new URL(connectionString);
        return Response.json({ valid: true }, { headers: corsHeaders });
      } catch {
        return Response.json(
          { error: 'Invalid connection string format' },
          { status: 400, headers: corsHeaders }
        );
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};