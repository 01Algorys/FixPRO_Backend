const { prisma } = require('../config/database');

// @desc    Get messages for a reservation
// @route   GET /api/messages/:reservationId
// @access  Private
const getMessages = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // Verify user is part of this reservation
    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(reservationId) }
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // Authorization: allow if user is the client OR if user is the assigned worker
    // Note: reservation.workerId stores the User ID of the worker (from createReservation)
    const isUser = reservation.userId === req.user.id;
    const isWorker = req.user.id === reservation.workerId;

    if (!isUser && !isWorker) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only allow messaging for accepted reservations
    if (reservation.status !== 'ACCEPTED' && reservation.status !== 'IN_PROGRESS' && reservation.status !== 'COMPLETED') {
      return res.status(403).json({
        success: false,
        message: 'Messaging not available for this reservation status'
      });
    }

    const messages = await prisma.message.findMany({
      where: { reservationId: parseInt(reservationId) },
      orderBy: { createdAt: 'asc' },
      skip: skip,
      take: parseInt(limit)
    });

    // Manually fetch sender information for each message
    const messagesWithSender = await Promise.all(messages.map(async (message) => {
      const sender = await prisma.user.findUnique({
        where: { id: message.senderId },
        select: {
          id: true,
          name: true,
          role: true,
          avatar: true
        }
      });
      return {
        ...message,
        sender
      };
    }));

    const total = await prisma.message.count({
      where: { reservationId: parseInt(reservationId) }
    });

    res.status(200).json({
      success: true,
      data: {
        messages: messagesWithSender,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send a message
// @route   POST /api/messages/:reservationId
// @access  Private
const sendMessage = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const { content, type = 'text' } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Verify user is part of this reservation
    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(reservationId) }
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // Authorization: allow if user is the client OR if user is the assigned worker
    // Note: reservation.workerId stores the User ID of the worker (from createReservation)
    const isUser = reservation.userId === req.user.id;
    const isWorker = req.user.id === reservation.workerId;

    if (!isUser && !isWorker) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only allow messaging for accepted reservations
    if (reservation.status !== 'ACCEPTED' && reservation.status !== 'IN_PROGRESS' && reservation.status !== 'COMPLETED') {
      return res.status(403).json({
        success: false,
        message: 'Messaging not available for this reservation status'
      });
    }

    // Create message and update reservation timestamp
    const message = await prisma.message.create({
      data: {
        reservationId: parseInt(reservationId),
        senderId: req.user.id,
        receiverId: isWorker ? reservation.userId : reservation.workerId,
        content: content.trim(),
        type: type
      }
    });

    // Update reservation updatedAt to keep sorting accurate
    await prisma.reservation.update({
      where: { id: parseInt(reservationId) },
      data: { updatedAt: new Date() }
    });

    // Manually fetch sender information
    const sender = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        role: true,
        avatar: true
      }
    });

    const messageWithSender = {
      ...message,
      sender
    };

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      const messageData = {
        reservationId: parseInt(reservationId),
        message: messageWithSender,
        sender: sender,
        timestamp: new Date()
      };
      io.to(`reservation_${reservationId}`).emit('new_message', messageData);
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: messageWithSender
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get conversation list for user
// @route   GET /api/messages
// @access  Private
const getConversations = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Use OR condition to get reservations where user is either the client OR the worker
    // Note: reservation.workerId stores the User ID of the worker (from createReservation)
    const reservations = await prisma.reservation.findMany({
      where: {
        OR: [
          { userId: req.user.id },
          { workerId: req.user.id }
        ]
      },
      orderBy: { updatedAt: 'desc' },
      skip: skip,
      take: parseInt(limit)
    });
    const conversations = await Promise.all(reservations.map(async (reservation) => {
      const lastMessage = await prisma.message.findFirst({
        where: { reservationId: reservation.id },
        orderBy: { createdAt: 'desc' }
      });

      // Fetch sender information if last message exists
      let lastMessageWithSender = null;
      if (lastMessage) {
        const sender = await prisma.user.findUnique({
          where: { id: lastMessage.senderId },
          select: {
            id: true,
            name: true,
            role: true,
            avatar: true
          }
        });
        lastMessageWithSender = {
          ...lastMessage,
          sender
        };
      }

      // Calculate unread count using MessageRead model
      const messageRead = await prisma.messageRead.findUnique({
        where: {
          userId_reservationId: {
            userId: req.user.id,
            reservationId: reservation.id
          }
        }
      });

      const unreadCount = await prisma.message.count({
        where: {
          reservationId: reservation.id,
          senderId: { not: req.user.id },
          createdAt: messageRead ? { gt: messageRead.lastReadAt } : undefined
        }
      });

      // Fetch both user and worker information for the conversation
      // Note: reservation.workerId stores the User ID of the worker
      const [user, assignedWorker] = await Promise.all([
        prisma.user.findUnique({
          where: { id: reservation.userId },
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }),
        prisma.worker.findFirst({
          where: { userId: reservation.workerId },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true
              }
            }
          }
        })
      ]);

      // Fetch service information manually
      let serviceInfo = null;
      try {
        const service = await prisma.service.findUnique({
          where: { id: reservation.serviceId },
          select: { name: true }
        });
        serviceInfo = service;
      } catch (error) {
        console.error('Failed to fetch service info:', error);
      }

      // Create welcome message if no messages exist and reservation is accepted
      if (!lastMessage && (reservation.status?.toUpperCase() === 'ACCEPTED' || reservation.status?.toUpperCase() === 'IN_PROGRESS')) {
        try {
          await prisma.message.create({
            data: {
              reservationId: reservation.id,
              senderId: req.user.id,
              receiverId: req.user.role.toLowerCase() === 'worker' ? reservation.userId : reservation.workerId,
              content: 'Conversation started. You can now exchange messages about this reservation.',
              type: 'system'
            }
          });
        } catch (error) {
          console.error('Failed to create welcome message:', error);
        }
      }

      return {
        id: reservation.id,
        reservationId: reservation.id,
        user: {
          id: user?.id,
          name: user?.name || 'User',
          avatar: user?.avatar
        },
        worker: {
          id: assignedWorker?.id,
          userId: assignedWorker?.userId,
          user: {
            id: assignedWorker?.user?.id,
            name: assignedWorker?.user?.name,
            avatar: assignedWorker?.user?.avatar
          }
        },
        workerName: assignedWorker?.user?.name,
        workerAvatar: assignedWorker?.user?.avatar,
        service: {
          name: serviceInfo?.name || 'Service'
        },
        lastMessage: lastMessageWithSender ? {
          content: lastMessageWithSender.content,
          createdAt: lastMessageWithSender.createdAt,
          senderId: lastMessageWithSender.senderId,
          type: lastMessageWithSender.type
        } : null,
        updatedAt: reservation.updatedAt,
        unreadCount: unreadCount,
        status: reservation.status
      };
    }));

    // Calculate total count with OR condition (same as main query)
    const total = await prisma.reservation.count({
      where: {
        OR: [
          { userId: req.user.id },
          { workerId: req.user.id }
        ]
      }
    });   

    res.status(200).json({
      success: true,
      data: {
        conversations,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all messages for a worker
// @route   GET /api/messages/worker/:workerId
// @access  Private
const getWorkerMessages = async (req, res, next) => {
  try {
    const { workerId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    console.log("workerId", workerId);

    let worker;

    // The parameter is userId, try as user ID first
    worker = await prisma.worker.findFirst({
      where: { userId: parseInt(workerId) }
    });

    // If not found, try as worker table ID
    if (!worker) {
      worker = await prisma.worker.findUnique({
        where: { id: parseInt(workerId) }
      });
    }

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    console.log('getWorkerMessages - req.user.id:', req.user.id);
    console.log('getWorkerMessages - req.user.role:', req.user.role);
    console.log('getWorkerMessages - worker.id:', worker.id);
    console.log('getWorkerMessages - worker.userId:', worker.userId);

    // Check if user is authorized (worker can only view their own messages, admin can view all)
    if (req.user.role !== 'admin' && req.user.id !== worker.userId) {
      console.log('getWorkerMessages - Access denied: user ID does not match worker.userId');
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get all reservations for this worker with accepted/in-progress/completed status
    const reservations = await prisma.reservation.findMany({
      where: {
        workerId: worker.id,
        status: { in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] }
      },
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: parseInt(limit)
    });

    // Debug: check all reservations for this worker regardless of status
    const allReservations = await prisma.reservation.findMany({
      where: { workerId: worker.id },
      select: { id: true, status: true, userId: true }
    });
    console.log('getWorkerMessages - all reservations for worker:', allReservations);

    // Build conversations array like getConversations does
    const conversations = await Promise.all(reservations.map(async (reservation) => {
      const lastMessage = await prisma.message.findFirst({
        where: { reservationId: reservation.id },
        orderBy: { createdAt: 'desc' }
      });

      // Fetch sender information if last message exists
      let lastMessageWithSender = null;
      if (lastMessage) {
        const sender = await prisma.user.findUnique({
          where: { id: lastMessage.senderId },
          select: {
            id: true,
            name: true,
            role: true,
            avatar: true
          }
        });
        lastMessageWithSender = {
          ...lastMessage,
          sender
        };
      }

      const unreadCount = await prisma.message.count({
        where: {
          reservationId: reservation.id,
          senderId: { not: req.user.id },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      // Worker is fetching client info
      const user = await prisma.user.findUnique({
        where: { id: reservation.userId },
        select: {
          id: true,
          name: true,
          avatar: true
        }
      });
      const participantInfo = user;

      // Fetch service information
      let serviceInfo = null;
      try {
        const service = await prisma.service.findUnique({
          where: { id: reservation.serviceId },
          select: { name: true }
        });
        serviceInfo = service;
      } catch (error) {
        console.error('Failed to fetch service info:', error);
      }

      return {
        id: reservation.id,
        reservationId: reservation.id,
        participantName: participantInfo?.name || 'Participant',
        participantAvatar: participantInfo?.avatar,
        participantId: participantInfo?.id,
        serviceName: serviceInfo?.name || 'Service',
        lastMessage: lastMessageWithSender ? lastMessageWithSender.content : 'Conversation started',
        lastMessageAt: lastMessageWithSender ? lastMessageWithSender.createdAt : reservation.createdAt,
        lastMessageType: lastMessageWithSender ? lastMessageWithSender.type : 'system',
        unreadCount: unreadCount,
        status: reservation.status
      };
    }));

    const total = await prisma.reservation.count({
      where: {
        workerId: worker.id,
        status: { in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] }
      }
    });

    console.log('getWorkerMessages - reservations count:', reservations.length);
    console.log('getWorkerMessages - conversations count:', conversations.length);
    console.log('getWorkerMessages - total:', total);

    res.status(200).json({
      success: true,
      data: {
        conversations,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark conversation as read
// @route   PUT /api/messages/:reservationId/read
// @access  Private
const markConversationAsRead = async (req, res, next) => {
  try {
    const { reservationId } = req.params;

    // Verify user is part of this reservation
    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(reservationId) }
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // Authorization: allow if user is the client OR if user is the assigned worker
    // Note: reservation.workerId stores the User ID of the worker (from createReservation)
    const isUser = reservation.userId === req.user.id;
    const isWorker = req.user.id === reservation.workerId;

    if (!isUser && !isWorker) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Upsert MessageRead record
    await prisma.messageRead.upsert({
      where: {
        userId_reservationId: {
          userId: req.user.id,
          reservationId: parseInt(reservationId)
        }
      },
      update: {
        lastReadAt: new Date()
      },
      create: {
        userId: req.user.id,
        reservationId: parseInt(reservationId),
        lastReadAt: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Conversation marked as read'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get total unread count for current user
// @route   GET /api/messages/unread-count
// @access  Private
const getUnreadCount = async (req, res, next) => {
  try {
    const worker = await prisma.worker.findFirst({
      where: { userId: req.user.id }
    });

    let reservations;
    if (worker) {
      // Worker's reservations
      reservations = await prisma.reservation.findMany({
        where: { workerId: worker.id }
      });
    } else {
      // User's reservations
      reservations = await prisma.reservation.findMany({
        where: { userId: req.user.id }
      });
    }

    let totalUnread = 0;
    for (const reservation of reservations) {
      const messageRead = await prisma.messageRead.findUnique({
        where: {
          userId_reservationId: {
            userId: req.user.id,
            reservationId: reservation.id
          }
        }
      });

      const unreadCount = await prisma.message.count({
        where: {
          reservationId: reservation.id,
          senderId: { not: req.user.id },
          createdAt: messageRead ? { gt: messageRead.lastReadAt } : undefined
        }
      });

      totalUnread += unreadCount;
    }

    res.status(200).json({
      success: true,
      data: { unreadCount: totalUnread }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMessages,
  sendMessage,
  getConversations,
  getWorkerMessages,
  markConversationAsRead,
  getUnreadCount
};
