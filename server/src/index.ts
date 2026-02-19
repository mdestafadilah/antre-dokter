import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import 'dotenv/config';

import { sequelize } from './models/index.ts';
import authRoutes from './routes/authRoutes.ts';
import queueRoutes from './routes/queueRoutes.ts';
import adminRoutes from './routes/adminRoutes.ts';
import emergencyRoutes from './routes/emergencyRoutes.ts';
import notificationRoutes from './routes/notificationRoutes.ts';

const app = new Hono();

// CORS configuration
app.use('/*', cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Security headers
app.use('/*', async (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  await next();
});

// Rate limiting middleware (simplified for Bun/Hono)
const rateLimitMap = new Map();
app.use('/api/*', async (c, next) => {
  if (process.env.NODE_ENV === 'production') {
    const ip = c.req.header('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 1000;

    if (!rateLimitMap.has(ip)) {
      rateLimitMap.set(ip, []);
    }

    const requests = rateLimitMap.get(ip)!.filter((time: number) => now - time < windowMs);
    
    if (requests.length >= maxRequests) {
      return c.json({
        success: false,
        message: 'Terlalu banyak request. Coba lagi nanti.'
      }, 429);
    }

    requests.push(now);
    rateLimitMap.set(ip, requests);
  }
  await next();
});

// Health check
app.get('/api/health', (c) => {
  return c.json({
    success: true,
    message: 'AntreDokter API is running',
    timestamp: new Date().toISOString()
  });
});

// Mount routes
app.route('/api/auth', authRoutes);
app.route('/api/queue', queueRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/emergency', emergencyRoutes);
app.route('/api/notifications', notificationRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    message: 'Endpoint tidak ditemukan'
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Terjadi kesalahan pada server'
  }, 500);
});

const PORT = parseInt(process.env.PORT || '3000');

// Create a single HTTP server — pipe Hono requests through it
// so Socket.IO can share the same server without double-binding the port.
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Convert Node.js req/res to Web Request/Response for Hono
  const url = `http://${req.headers.host || 'localhost'}${req.url}`;
  const chunks: Buffer[] = [];

  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', async () => {
    const body = chunks.length ? Buffer.concat(chunks) : undefined;

    const webReq = new Request(url, {
      method: req.method ?? 'GET',
      headers: Object.fromEntries(
        Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v ?? ''])
      ),
      body: body?.length ? body : undefined,
    });

    try {
      const webRes = await app.fetch(webReq);
      res.statusCode = webRes.status;
      webRes.headers.forEach((value, key) => res.setHeader(key, value));
      const buffer = Buffer.from(await webRes.arrayBuffer());
      res.end(buffer);
    } catch (err) {
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });
});

// Setup Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io available globally for controllers
(global as any).io = io;

// Start server
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Database ready. Use migrations for schema changes.');
    }

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
export { io };
