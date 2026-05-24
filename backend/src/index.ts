import * as dotenv from 'dotenv';
// Load environments
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import * as path from 'path';

import apiRouter from './routes/api.routes';
import { registerSocketHandlers } from './sockets/room.socket';
import { SimulationEngine } from './services/simulation.service';

const app = express();
const PORT = process.env.PORT || 3001;

// Global Middlewares
app.use(cors({
  origin: '*', // In local development allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Mount REST API endpoints
app.use('/api/v1', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Production Setup: Serve React frontend static files
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// Fallback to React Router client index in production
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io')) {
    return next();
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      // In development, dist might not exist yet, so send a friendly notice
      res.status(200).send('⚡ Liquidity Crisis Escape Room Backend Running. Start frontend via Vite dev server.');
    }
  });
});

// Create HTTP and WebSocket Server
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Initialize simulation and socket configurations
SimulationEngine.init(io);
registerSocketHandlers(io);

// Launch Server
httpServer.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`☣️  LIQUIDITY CRISIS SERVER LOADED ☣️`);
  console.log(`🚀 REST APIs: http://localhost:${PORT}/api/v1`);
  console.log(`🔌 WebSockets: ws://localhost:${PORT}`);
  console.log(`⚙️  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=========================================`);
});
