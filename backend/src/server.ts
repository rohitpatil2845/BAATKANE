import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import fileUpload from 'express-fileupload';
import path from 'path';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.routes';
import chatRoutes from './routes/chat.routes';
import messageRoutes from './routes/message.routes';
import userRoutes from './routes/user.routes';
import profileRoutes from './routes/profile.routes';
import scheduledMessagesRoutes from './routes/scheduled-messages.routes';

// Import socket handler and services
import { initializeSocket } from './socket/socket.handler';
import { startScheduledMessagesCron } from './services/scheduled-messages.service';
import { initializeSmartBot } from './config/init-smartbot';

const app = express();
const httpServer = createServer(app);

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.FRONTEND_URL || 'http://localhost:5173'
  ],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') },
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', message: 'BaatKare API is running' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/scheduled-messages', scheduledMessagesRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: corsOptions,
});

initializeSocket(io);

// Start scheduled messages cron job
startScheduledMessagesCron(io);

// Start server
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize SmartBot for all users
  await initializeSmartBot();
});

export { io };
