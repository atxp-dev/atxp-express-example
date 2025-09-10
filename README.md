# Agent Demo

This project demonstrates how to build a website agent using [ATXP](https://docs.atxp.ai). It uses a TypeScript Express backend and TypeScript React frontend.

When a user navigates to the running web app, they are presented with a text input field and a list of all previously submitted texts. When they submit text, that text is sent to the Express backend and added to the list of texts.

## Project Structure

```
agent-demo/
├── backend/                # Express server
│   ├── server.ts           # Main server file (TypeScript)
│   ├── stage.ts            # Progress tracking utilities (TypeScript)
│   ├── tsconfig.json       # TypeScript configuration
│   ├── package.json        # Backend dependencies
│   └── env.example         # Environment variables template
├── frontend/               # React application
│   ├── public/             # Static files
│   ├── src/                # React source code
│   │   ├── App.tsx         # Main React component (TypeScript)
│   │   ├── App.css         # Component styles
│   │   ├── index.tsx       # React entry point (TypeScript)
│   │   └── index.css       # Global styles
│   ├── tsconfig.json       # TypeScript configuration
│   └── package.json        # Frontend dependencies
├── package.json            # Root package.json with scripts
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## Features

- **Express Backend**: RESTful API with endpoints for text submission and retrieval
- **React Frontend**: Modern, responsive UI with real-time updates
- **Development Mode**: Hot reloading for both frontend and backend
- **Production Ready**: Build system for deployment
- **CORS Enabled**: Cross-origin requests supported
- **Error Handling**: Comprehensive error handling and user feedback

## API Endpoints

- `GET /api/texts` - Retrieve all submitted texts
- `POST /api/texts` - Submit new text
- `GET /api/health` - Health check endpoint

## Quick Deploy

Deploy this ATXP Express example to your preferred cloud platform with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fatxp-dev%2Fatxp-express-example)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/atxp-dev/atxp-express-example)

[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/atxp-dev/atxp-express-example)

After deploying, you'll need to provide your ATXP connection string through the app's setup screen.

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd agent-demo
   ```

2. Install all dependencies:
   ```bash
   npm run install-all
   ```

### Development

1. Start both frontend and backend in development mode:
   ```bash
   npm run dev
   ```

   This will start:
   - Backend server on `http://localhost:3001`
   - Frontend development server on `http://localhost:3000`

2. Open your browser and navigate to `http://localhost:3000`

   **Note**: Development mode uses React StrictMode, which may cause the browser to open twice. For single browser opening behavior, use production mode instead.

### Production Mode

To run in production mode (with optimized builds and single browser opening):
```bash
npm run start
```

This runs the built backend and frontend in production mode without React StrictMode's double-mounting behavior.

### Running Separately

- **Backend only**: `npm run server`
- **Frontend only**: `npm run client`

### Production Build

1. Build both frontend and backend for production:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

## Environment Variables

### Backend Configuration

Create a `.env` file in the `backend/` directory:

```env
# Server port configuration
PORT=3001

# Frontend port (for CORS configuration)
FRONTEND_PORT=3000

NODE_ENV=development

# Optional: ATXP connection string for image generation and storage
# If not provided, connection string must be sent via x-atxp-connection-string header
#ATXP_CONNECTION_STRING=your_connection_string_here
```

### Frontend Configuration

Create a `.env` file in the `frontend/` directory:

```env
# Frontend development server port
PORT=3000

# Backend server port (for API calls)
REACT_APP_BACKEND_PORT=3001
```

### Custom Port Configuration

By default, the application runs on:
- Backend: `http://localhost:3001`  
- Frontend: `http://localhost:3000`

For custom ports, run the servers separately:

#### Using separate terminals:
```bash
# Terminal 1: Backend on custom port
cd backend && PORT=4001 FRONTEND_PORT=4000 npm run dev

# Terminal 2: Frontend on custom port  
cd frontend && PORT=4000 REACT_APP_BACKEND_PORT=4001 npm start
```

#### Using .env files:
Create `.env` files in each directory with your desired ports:

**Backend `.env`:**
```env
PORT=4001
FRONTEND_PORT=4000
```

**Frontend `.env`:**
```env
PORT=4000
REACT_APP_BACKEND_PORT=4001
```

Then run: `npm run server` and `npm run client` in separate terminals.

## ATXP Configuration

This application supports two ways to provide your ATXP connection string for image generation and storage:

### Option 1: Environment Variable (Recommended for Development)
Set the `ATXP_CONNECTION_STRING` environment variable in your `.env` file. This connection string will be used for all requests.

### Option 2: HTTP Header (Recommended for Production/Multi-tenant)
Send the connection string with each request using the `x-atxp-connection-string` HTTP header. This allows different users to use their own ATXP accounts.

### Priority Order
1. If `x-atxp-connection-string` header is present, it will be used
2. If no header is provided, falls back to `ATXP_CONNECTION_STRING` environment variable
3. If neither is available, the API will return a 400 error

**Example using curl with header:**
```bash
curl -X POST http://localhost:3001/api/texts \
  -H "Content-Type: application/json" \
  -H "x-atxp-connection-string: your_connection_string_here" \
  -d '{"text": "Generate an image of a sunset"}'
```

## Development Scripts

- `npm run dev` - Start both frontend and backend in development mode (with hot reloading)
- `npm run start` - Start both frontend and backend in production mode (single browser opening)
- `npm run server` - Start only the backend server (TypeScript with hot reload)
- `npm run server:prod` - Start only the backend server in production mode
- `npm run client` - Start only the frontend development server
- `npm run client:prod` - Start only the frontend in production mode
- `npm run build` - Build both frontend and backend for production
- `npm run build:backend` - Build only the backend TypeScript code
- `npm run build:frontend` - Build only the frontend for production
- `npm run install-all` - Install dependencies for all packages and build backend

## Technologies Used

### Backend
- **Express.js** - Web framework
- **TypeScript** - Type-safe JavaScript development
- **CORS** - Cross-origin resource sharing
- **Body Parser** - Request body parsing
- **Nodemon** - Development server with auto-reload
- **ts-node** - TypeScript execution for development

### Frontend
- **React** - UI library
- **TypeScript** - Type-safe JavaScript development
- **Axios** - HTTP client for API calls
- **CSS3** - Modern styling with responsive design

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT