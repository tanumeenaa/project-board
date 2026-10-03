import express from 'express';
import cors from 'cors';
import http from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env, validateProductionConfig } from './config/env.js';
import errorHandler from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import boardRoutes from './routes/boardRoutes.js';
import listRoutes from './routes/listRoutes.js';
import cardRoutes from './routes/cardRoutes.js';
import User from './models/User.js';
import Board from './models/Board.js';
import { getBoardMemberRole } from './middleware/permissions.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.clientUrls,
    credentials: true
  }
});

const boardPresence = new Map();

app.use(cors({ origin: env.clientUrls, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_, res) => {
  res.json({ ok: true, service: 'project-board-server' });
});

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/boards/:boardId', listRoutes);
app.use('/api/boards/:boardId', cardRoutes);

app.use(errorHandler);

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers.authorization || '';
  const normalizedToken = token.startsWith('Bearer ') ? token.slice(7) : token;

  if (!normalizedToken) {
    return next(new Error('Authentication required'));
  }

  try {
    const payload = jwt.verify(normalizedToken, env.jwtSecret);
    const user = await User.findById(payload.id);

    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});

globalThis.io = io;

let isShuttingDown = false;

async function shutdown() {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  io.close(async () => {
    try {
      await disconnectDatabase();
      process.exit(0);
    } catch (error) {
      console.error('Failed to shut down cleanly', error);
      process.exit(1);
    }
  });
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

io.on('connection', (socket) => {
  socket.on('board:join', async ({ boardId }) => {
    if (!boardId) {
      socket.emit('board:error', { message: 'Board id is required' });
      return;
    }

    const board = await Board.findById(boardId).populate('members.user', 'name email avatarColor');
    if (!board) {
      socket.emit('board:error', { message: 'Board not found' });
      return;
    }

    const role = getBoardMemberRole(board, socket.user._id);
    if (!role) {
      socket.emit('board:error', { message: 'You are not a member of this board' });
      return;
    }

    socket.join(boardId);

    if (!boardPresence.has(boardId)) {
      boardPresence.set(boardId, new Map());
    }

    boardPresence.get(boardId).set(String(socket.user._id), {
      _id: socket.user._id,
      name: socket.user.name,
      email: socket.user.email,
      avatarColor: socket.user.avatarColor
    });

    io.to(boardId).emit('presence:update', Array.from(boardPresence.get(boardId).values()));
    socket.emit('board:joined', { boardId, role });
  });

  socket.on('board:leave', ({ boardId }) => {
    if (!boardId) {
      return;
    }

    socket.leave(boardId);
    if (boardPresence.has(boardId)) {
      boardPresence.get(boardId).delete(String(socket.user._id));
      io.to(boardId).emit('presence:update', Array.from(boardPresence.get(boardId).values()));
    }
  });

  socket.on('disconnect', () => {
    for (const [boardId, members] of boardPresence.entries()) {
      if (members.has(String(socket.user?._id))) {
        members.delete(String(socket.user._id));
        io.to(boardId).emit('presence:update', Array.from(members.values()));
      }
    }
  });
});

const startServer = async () => {
  try {
    validateProductionConfig();
    await connectDatabase();
    server.listen(env.port, () => {
      console.log(`Server running on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
};

startServer();
