const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socket.id
    this.userSockets = new Map(); // socket.id -> userId
  }

  initialize(io) {
    this.io = io;

    // Authentication middleware for Socket.IO
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          console.error('Socket auth error: No token provided');
          return next(new Error('Authentication error: No token provided'));
        }

        if (typeof token !== 'string' || token.trim() === '') {
          console.error('Socket auth error: Invalid token format');
          return next(new Error('Authentication error: Invalid token format'));
        }

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtError) {
          console.error('Socket auth error: JWT verification failed', jwtError);
          if (jwtError.name === 'TokenExpiredError') {
            return next(new Error('Authentication error: Token expired'));
          } else if (jwtError.name === 'JsonWebTokenError') {
            return next(new Error('Authentication error: Malformed token'));
          }
          return next(new Error('Authentication error: Invalid token'));
        }

        let user;
        try {
          user = await prisma.user.findUnique({
            where: { id: decoded.id }
          });
        } catch (prismaError) {
          console.error('Socket auth error: Database query failed', prismaError);
          return next(new Error('Authentication error: Database error'));
        }

        if (!user) {
          console.error('Socket auth error: User not found for ID:', decoded.id);
          return next(new Error('Authentication error: User not found'));
        }

        socket.user = user;
        console.log('Socket auth success for user:', user.id, user.email);
        next();
      } catch (error) {
        console.error('Socket auth middleware error:', error);
        next(new Error('Authentication error: Server error'));
      }
    });

    this.io.on('connection', (socket) => {
      // Store user connection
      this.connectedUsers.set(socket.user.id.toString(), socket.id);
      this.userSockets.set(socket.id, socket.user.id.toString());

      // Emit user online event to all connected clients
      socket.broadcast.emit('user_online', { userId: socket.user.id });

      // Send current online users list to the newly connected user
      socket.emit('online_users_list', { onlineUsers: Array.from(this.connectedUsers.keys()).map(id => parseInt(id)) });

      // Join user-specific rooms
      socket.join(`user_${socket.user.id}`);
      
      // Join role-specific rooms
      socket.join(`role_${socket.user.role}`);

      // Join worker-specific room if user is a worker
      if (socket.user.role === 'worker') {
        socket.join(`worker_${socket.user.id}`);
      }

      // Handle joining reservation-specific room
      socket.on('join_reservation', (reservationId) => {
        socket.join(`reservation_${reservationId}`);
      });

      // Handle leaving reservation-specific room
      socket.on('leave_reservation', (reservationId) => {
        socket.leave(`reservation_${reservationId}`);
      });

      // Handle location updates (for real-time tracking)
      socket.on('update_location', async (data) => {
        try {
          const { reservationId, location, status } = data;

          if (!reservationId || !location) {
            socket.emit('error', { message: 'Reservation ID and location are required' });
            return;
          }

          // Verify user is part of this reservation
          const reservation = await prisma.reservation.findUnique({
            where: { id: reservationId }
          });

          if (!reservation) {
            socket.emit('error', { message: 'Reservation not found' });
            return;
          }

          // Check if user is the worker for this reservation
          if (reservation.workerId !== socket.user.id) {
            socket.emit('error', { message: 'Only workers can update location' });
            return;
          }

          // Broadcast location to user
          socket.to(`user_${reservation.userId}`).emit('worker_location_update', {
            reservationId,
            location,
            timestamp: new Date(),
            status: status || 'en_route'
          });

          // Add tracking update to reservation
          await prisma.tracking.create({
            data: {
              reservationId: reservationId,
              status: status || 'en_route',
              message: 'Worker location updated',
              location: location
            }
          });

        } catch (error) {
          console.error('Socket update_location error:', error);
          socket.emit('error', { message: 'Failed to update location', error: error.message });
        }
      });

      // Handle status updates
      socket.on('update_status', async (data) => {
        try {
          const { reservationId, status, note } = data;

          if (!reservationId || !status) {
            socket.emit('error', { message: 'Reservation ID and status are required' });
            return;
          }

          const reservation = await prisma.reservation.findUnique({
            where: { id: reservationId }
          });

          if (!reservation) {
            socket.emit('error', { message: 'Reservation not found' });
            return;
          }

          // Check permissions
          const isWorker = reservation.workerId === socket.user.id;
          const isUser = reservation.userId === socket.user.id;

          if (!isWorker && !isUser) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          // Update reservation status and tracking
          const reservationUpdateData = {
            status: status
          };

          // Set timestamps
          if (status === 'in_progress') {
            reservationUpdateData.startTime = new Date();
          } else if (status === 'completed') {
            reservationUpdateData.completedAt = new Date();
          }

          await prisma.reservation.update({
            where: { id: reservationId },
            data: reservationUpdateData
          });

          await prisma.tracking.create({
            data: {
              reservationId: reservationId,
              status: status,
              message: note || `Status updated to ${status}`
            }
          });

          // Broadcast status update
          const updateData = {
            reservationId,
            status,
            note,
            timestamp: new Date(),
            updatedBy: socket.user.id,
            updatedByRole: socket.user.role
          };

          // Emit to all participants
          this.io.to(`reservation_${reservationId}`).emit('status_update', updateData);

          // Also emit to user-specific rooms
          this.io.to(`user_${reservation.userId}`).emit('reservation_update', updateData);
          this.io.to(`worker_${reservation.workerId}`).emit('reservation_update', updateData);

        } catch (error) {
          console.error('Socket update_status error:', error);
          socket.emit('error', { message: 'Failed to update status', error: error.message });
        }
      });

      // Handle chat messages
      socket.on('send_message', async (data) => {
        try {
          const { reservationId, message, type = 'text' } = data;

          if (!reservationId || !message) {
            socket.emit('error', { message: 'Reservation ID and message are required' });
            return;
          }

          const reservation = await prisma.reservation.findUnique({
            where: { id: reservationId }
          });

          if (!reservation) {
            socket.emit('error', { message: 'Reservation not found' });
            return;
          }

          // Check if user is part of this reservation
          const isWorker = reservation.workerId === socket.user.id;
          const isUser = reservation.userId === socket.user.id;

          if (!isWorker && !isUser) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          // Add message using Prisma
          await prisma.message.create({
            data: {
              reservationId: reservationId,
              senderId: socket.user.id,
              content: message,
              type: type
            }
          });

          // Broadcast message
          const messageData = {
            reservationId,
            message,
            type,
            sender: {
              id: socket.user.id,
              name: socket.user.name,
              role: socket.user.role,
              avatar: socket.user.avatar
            },
            timestamp: new Date()
          };

          // Emit to reservation room
          this.io.to(`reservation_${reservationId}`).emit('new_message', messageData);

        } catch (error) {
          console.error('Socket send_message error:', error);
          socket.emit('error', { message: 'Failed to send message', error: error.message });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data) => {
        const { reservationId } = data;
        socket.to(`reservation_${reservationId}`).emit('user_typing', {
          userId: socket.user.id,
          userName: socket.user.name,
          isTyping: true
        });
      });

      socket.on('typing_stop', (data) => {
        const { reservationId } = data;
        socket.to(`reservation_${reservationId}`).emit('user_typing', {
          userId: socket.user.id,
          userName: socket.user.name,
          isTyping: false
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        // Remove from connection maps
        this.connectedUsers.delete(socket.user.id.toString());
        this.userSockets.delete(socket.id);

        // Emit user offline event to all connected clients
        socket.broadcast.emit('user_offline', { userId: socket.user.id });
      });
    });

  }

  // Method to emit events to specific users
  emitToUser(userId, event, data) {
    this.io.to(`user_${userId}`).emit(event, data);
  }

  // Method to emit events to specific workers
  emitToWorker(workerId, event, data) {
    this.io.to(`worker_${workerId}`).emit(event, data);
  }

  // Method to emit events to all users in a role
  emitToRole(role, event, data) {
    this.io.to(`role_${role}`).emit(event, data);
  }

  // Method to emit events to reservation participants
  emitToReservation(reservationId, event, data) {
    this.io.to(`reservation_${reservationId}`).emit(event, data);
  }

  // Method to check if user is online
  isUserOnline(userId) {
    return this.connectedUsers.has(userId.toString());
  }

  // Method to get online user count
  getOnlineUserCount() {
    return this.connectedUsers.size;
  }

  // Method to get online users by role
  getOnlineUsersByRole(role) {
    const users = [];
    for (const [userId, socketId] of this.connectedUsers) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket && socket.user && socket.user.role === role) {
        users.push({
          id: userId,
          name: socket.user.name,
          email: socket.user.email
        });
      }
    }
    return users;
  }

  // Method to get all online users
  getOnlineUsers() {
    return Array.from(this.connectedUsers.keys()).map(id => parseInt(id));
  }
}

module.exports = new SocketService();
