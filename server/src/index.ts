/**
 * Greedy Multiplayer Server
 * Express + Socket.IO backend for real-time multiplayer gameplay
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';

// Import services
import { cosmosService } from './services/cosmos.js';

// Import routes
import authRoutes from './routes/auth.js';
import gamesRoutes, { setSocketIO } from './routes/games.js';
import leaderboardRoutes from './routes/leaderboard.js';

// Import socket handlers
import { setupSocketHandlers } from './socket/index.js';

// Initialize Cosmos DB
cosmosService.initialize().catch((err) => {
  console.error('Failed to initialize Cosmos DB:', err);
});

const app = express();
const httpServer = createServer(app);

// Allowed origins for CORS (support multiple dev ports and production domains)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'https://getgreedy.io',
  'https://www.getgreedy.io',
  'https://jolly-moss-0adeb2b10.1.azurestaticapps.net',
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

// Configure Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Set up Socket.IO handlers
setupSocketHandlers(io);

// Give routes access to Socket.IO for broadcasting
setSocketIO(io);

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO ready for connections`);
});

export { io };
