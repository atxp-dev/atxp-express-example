# Agent Demo

This project demonstrates how to build a website agent using [ATXP](https://docs.atxp.ai). It uses a TypeScript Express backend and TypeScript React frontend.

When a user navigates to the running web app, they are presented with a text input field and a list of all previously submitted texts. When they submit text, that text is sent to the Express backend and added to the list of texts.

## Project Structure

```
agent-demo/
├── backend/                # Express server
│   ├── server.ts           # Main server file (TypeScript)
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
   ```bash
   npm run dev
   ```

   This will start:
   - Backend server on `http://localhost:3001`
   - Frontend development server on `http://localhost:3000`

2. Open your browser and navigate to `http://localhost:3000`

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

Create a `.env` file in the `backend/` directory:

```env
PORT=3001
NODE_ENV=development
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