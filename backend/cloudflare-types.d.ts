// Type definitions for Cloudflare Workers Node.js compatibility
declare module 'cloudflare:node' {
  export function httpServerHandler(options: { port: number }): any;
}