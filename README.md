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
   
   **Default ports (3001 backend, 3000 frontend):**
   ```bash
   npm run dev
   ```

   **Custom ports (you'll need to run backend and frontend separately):**
   
   For custom ports, it's easier to run the servers separately:
   ```bash
   # Terminal 1: Start backend on port 4001
   cd backend && PORT=4001 FRONTEND_PORT=4000 npm run dev
   
   # Terminal 2: Start frontend on port 4000  
   cd frontend && PORT=4000 REACT_APP_BACKEND_PORT=4001 npm start
   ```
   
   Or use the convenience script with environment variables:
   ```bash
   # Set environment variables then run
   export PORT=4001
   export FRONTEND_PORT=4000  
   export REACT_APP_BACKEND_PORT=4001
   npm run dev
   ```

   This will start:
   - Backend server on `http://localhost:3001` (or your configured `PORT`)
   - Frontend development server on `http://localhost:3000` (or your configured frontend `PORT`)

2. Open your browser and navigate to `http://localhost:3000` (or your configured frontend port)

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

### Port Configuration

The application supports configurable ports for both frontend and backend. You can configure ports in two ways:

#### Method 1: Using export commands (No .env files needed)
```bash
# Set environment variables for the session
export PORT=4001                     # Backend server port
export FRONTEND_PORT=4000            # Frontend port (for backend CORS config)  
export REACT_APP_BACKEND_PORT=4001   # Backend port (for frontend API calls)

# Then run normally
npm run dev
```

#### Alternative: Run servers separately with inline variables
```bash
# Terminal 1: Backend
cd backend && PORT=4001 FRONTEND_PORT=4000 npm run dev

# Terminal 2: Frontend  
cd frontend && PORT=4000 REACT_APP_BACKEND_PORT=4001 npm start
```

#### Method 2: Using .env files
- **Backend Port**: Set `PORT` in backend `.env` file (default: 3001)
- **Frontend Port**: Set `PORT` in frontend `.env` file (default: 3000) 
- **Backend Port for Frontend**: Set `REACT_APP_BACKEND_PORT` in frontend `.env` file to match your backend port
- **Frontend Port for Backend**: Set `FRONTEND_PORT` in backend `.env` file to match your frontend port (used for CORS)

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

# Or use your configured backend port:
curl -X POST http://localhost:${YOUR_BACKEND_PORT}/api/texts \
  -H "Content-Type: application/json" \
  -H "x-atxp-connection-string: your_connection_string_here" \
  -d '{"text": "Generate an image of a sunset"}'
```

## Development Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run server` - Start only the backend server (TypeScript with hot reload)
- `npm run client` - Start only the frontend development server
- `npm run build` - Build both frontend and backend for production
- `npm run build:backend` - Build only the backend TypeScript code
- `npm run build:frontend` - Build only the frontend for production
- `npm run install-all` - Install dependencies for all packages and build backend
- `npm start` - Start the production server

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