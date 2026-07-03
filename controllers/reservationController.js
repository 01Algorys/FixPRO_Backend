const { prisma } = require('../config/database');
const { validationResult } = require('express-validator');
const socketService = require('../services/socketService');

// @desc    Get all reservations
// @route   GET /api/reservations
// @access  Private (Admin only)
const getReservations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }

    const reservations = await prisma.reservation.findMany({
      where: query,
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: parseInt(limit)
    });

    const total = await prisma.reservation.count({ where: query });

    res.status(200).json({
      success: true,
      data: {
        reservations,
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

// @desc    Get reservation by ID
// @route   GET /api/reservations/:id
// @access  Private
const getReservation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(id) }
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // Get worker record to check if user is the assigned worker
    const workerRecord = await prisma.worker.findFirst({
      where: { userId: req.user.id }
    });

    // Authorization: allow if user is the client, the assigned worker, or admin
    // Note: reservation.workerId stores the User ID of the worker (from createReservation)
    const isUser = req.user.id === reservation.userId;
    const isAssignedWorker = req.user.id === reservation.workerId;
    const isAdmin = req.user.role === 'admin';

    if (!isUser && !isAssignedWorker && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: reservation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new reservation
// @route   POST /api/reservations
// @access  Private (User only)
const createReservation = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      workerId,
      service,
      date,
      time,
      duration,
      location,
      description,
      emergency = false,
      images = []
    } = req.body;

    // Verify service exists
    const serviceDoc = await prisma.service.findUnique({
      where: { id: service }
    });
    if (!serviceDoc) {
      return res.status(400).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Verify worker exists and is active
    const worker = await prisma.worker.findFirst({
      where: { userId: workerId, isActive: true }
    });
    if (!worker) {
      return res.status(400).json({
        success: false,
        message: 'Worker not found or not active'
      });
    }

    // Calculate estimated price
    let estimatedPrice = serviceDoc.basePrice || 0;

    // Add emergency charge if applicable
    if (emergency && serviceDoc.emergency?.extraCharge) {
      estimatedPrice += serviceDoc.emergency.extraCharge;
    }

    // Create reservation
    const reservation = await prisma.reservation.create({
      data: {
        userId: req.user.id,
        workerId,
        serviceId: service,
        date: new Date(date),
        time,
        duration,
        location,
        description,
        emergency,
        images,
        estimatedPrice,
        status: 'PENDING'
      }
    });

    // Emit new_reservation event to worker
    socketService.emitToWorker(workerId, 'new_reservation', {
      reservationId: reservation.id,
      serviceType: serviceDoc.name,
      userName: req.user.name,
      location: reservation.location,
      createdAt: reservation.createdAt,
      status: reservation.status
    });

    res.status(201).json({
      success: true,
      message: 'Reservation created successfully',
      data: reservation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update reservation status
// @route   PUT /api/reservations/:id/status
// @access  Private
const updateReservationStatus = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { status, note } = req.body;

    // Get io instance at the top to make it available throughout the function
    const io = req.app.get('io');

    if (!['accepted', 'rejected', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(id) }
    });
    console.log(reservation)
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // Get worker to check if user is the assigned worker
    const worker = await prisma.worker.findFirst({
      where: { userId: req.user.id }
    });

    // Authorization: allow if user is the client, the assigned worker, or admin
    // Note: reservation.workerId stores the User ID of the worker (from createReservation)
    const isUser = req.user.id === reservation.userId;
    const isAssignedWorker = req.user.id === reservation.workerId;
    const isAdmin = req.user.role === 'admin';

    if (!isUser && !isAssignedWorker && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Define who can change to which status
    const allowedStatusChanges = {
      PENDING: {
        accepted: ['worker', 'admin'],
        rejected: ['worker', 'admin'],
        cancelled: ['user', 'admin']
      },
      ACCEPTED: {
        in_progress: ['worker', 'admin'],
        completed: ['worker', 'admin'],
        cancelled: ['user', 'admin']
      },
      IN_PROGRESS: {
        completed: ['worker', 'admin'],
        cancelled: ['user', 'admin']
      },
      COMPLETED: {
        // Cannot change from completed
      },
      CANCELLED: {
        // Cannot change from cancelled
      },
      REJECTED: {
        // Cannot change from rejected
      }
    };

    const currentStatus = reservation.status;
    const allowedRoles = allowedStatusChanges[currentStatus]?.[status];

    const userRole = isAssignedWorker ? 'worker' : isUser ? 'user' : 'admin';

    if (!allowedRoles || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `You cannot change reservation status from ${currentStatus} to ${status}`
      });
    }

    // Update status
    const updateData = { status: status.toUpperCase() };

    // Set timestamps
    if (status === 'in_progress') {
      updateData.startTime = new Date();
    } else if (status === 'completed') {
      updateData.completedAt = new Date();
    } else if (status === 'cancelled') {
      updateData.cancelledBy = req.user.id;
      updateData.cancellationReason = note;
    }

    const updatedReservation = await prisma.reservation.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    // Create system message when reservation is accepted to initialize conversation
    if (status === 'accepted') {
      try {
        // Check if messages already exist for this reservation
        const existingMessages = await prisma.message.findMany({
          where: { reservationId: parseInt(id) }
        });

        // Only create system message if no messages exist yet
        if (existingMessages.length === 0) {
          // Get worker record to fetch the worker's userId
          const workerRecord = await prisma.worker.findUnique({
            where: { id: reservation.workerId },
            select: { userId: true }
          });

          await prisma.message.create({
            data: {
              reservationId: parseInt(id),
              senderId: reservation.userId,
              receiverId: workerRecord?.userId || reservation.workerId,
              content: 'Reservation accepted. You can now chat with each other.',
              type: 'system'
            }
          });
        }

        // Update reservation's updatedAt to bring it to top of conversations list
        await prisma.reservation.update({
          where: { id: parseInt(id) },
          data: { updatedAt: new Date() }
        });

        // Emit conversation_started event to both user and worker
        const [workerUser, serviceData, normalUser] = await Promise.all([
          prisma.user.findUnique({
            where: { id: reservation.workerId },
            select: { name: true, avatar: true }
          }),
          prisma.service.findUnique({
            where: { id: reservation.serviceId },
            select: { name: true }
          }),
          prisma.user.findUnique({
            where: { id: reservation.userId },
            select: { name: true, avatar: true }
          })
        ]);

        const conversationData = {
          reservationId: updatedReservation.id,
          status: updatedReservation.status,
          user: {
            id: reservation.userId,
            name: normalUser?.name || 'User',
            avatar: normalUser?.avatar
          },
          worker: {
            id: reservation.workerId,
            name: workerUser?.name || 'Worker',
            avatar: workerUser?.avatar
          },
          service: {
            name: serviceData?.name || 'Service'
          },
          lastMessage: {
            content: 'Reservation accepted. You can now chat with each other.',
            createdAt: new Date(),
            type: 'system'
          },
          updatedAt: new Date()
        };

        io.to(`user_${reservation.userId}`).emit('conversation_started', conversationData);
        io.to(`worker_${reservation.workerId}`).emit('conversation_started', conversationData);
      } catch (error) {
        console.error('Failed to create system message or emit conversation_started:', error);
        // Don't fail the status update if message creation fails
      }
    }

    // Emit socket event for real-time updates
    if (io) {
      // Fetch worker and user names for the notification
      const [workerUser, serviceData, normalUser] = await Promise.all([
        prisma.user.findUnique({
          where: { id: reservation.workerId },
          select: { name: true, avatar: true }
        }),
        prisma.service.findUnique({
          where: { id: reservation.serviceId },
          select: { name: true }
        }),
        prisma.user.findUnique({
          where: { id: reservation.userId },
          select: { name: true }
        })
      ]);

      const statusChangeData = {
        reservationId: reservation.id,
        newStatus: status.toUpperCase(),
        workerName: workerUser?.name || 'Worker',
        userName: normalUser?.name || 'User',
        serviceType: serviceData?.name || 'Service',
        updatedAt: new Date()
      };

      // Emit reservation_status_changed to both user and worker
      io.to(`user_${reservation.userId}`).emit('reservation_status_changed', statusChangeData);
      io.to(`worker_${reservation.workerId}`).emit('reservation_status_changed', statusChangeData);

      // Emit job_completed event when marked complete
      if (status === 'completed') {
        io.to(`user_${reservation.userId}`).emit('job_completed', {
          reservationId: reservation.id,
          workerId: reservation.workerId,
          workerName: workerUser?.name || 'Worker',
          workerAvatar: workerUser?.avatar,
          serviceType: serviceData?.name || 'Service',
          completedAt: new Date()
        });
      }
    }

    // Fetch related data for response
    const [user, service] = await Promise.all([
      prisma.user.findUnique({
        where: { id: updatedReservation.userId },
        select: {
          name: true,
          email: true,
          phone: true,
          avatar: true
        }
      }),
      prisma.service.findUnique({
        where: { id: updatedReservation.serviceId },
        select: {
          name: true,
          description: true,
          category: true,
          basePrice: true
        }
      })
    ]);

    const responseData = {
      ...updatedReservation,
      user,
      service
    };

    res.status(200).json({
      success: true,
      message: 'Reservation status updated successfully',
      data: responseData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel reservation
// @route   DELETE /api/reservations/:id
// @access  Private
const cancelReservation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(id) }
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // Check permissions
    if (req.user.id !== reservation.userId && req.user.id !== reservation.workerId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Cancel reservation
    const updatedReservation = await prisma.reservation.update({
      where: { id: parseInt(id) },
      data: {
        status: 'CANCELLED',
        cancelledBy: req.user.id,
        cancellationReason: reason
      }
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${reservation.userId}`).emit('reservation_cancelled', {
        reservationId: reservation.id,
        reason,
        cancelledBy: req.user.id,
        timestamp: new Date()
      });

      io.to(`worker_${reservation.workerId}`).emit('reservation_cancelled', {
        reservationId: reservation.id,
        reason,
        cancelledBy: req.user.id,
        timestamp: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Reservation cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add note to reservation
// @route   POST /api/reservations/:id/notes
// @access  Private
const addNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, internal = false } = req.body;

    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(id) }
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // Check permissions
    if (req.user.id !== reservation.userId && req.user.id !== reservation.workerId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Note: Prisma doesn't have a built-in notes array like Mongoose
    // This functionality would need to be implemented with a separate Note model
    // For now, we'll return a success message
    res.status(200).json({
      success: true,
      message: 'Note functionality not yet implemented with Prisma'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get reservations by worker ID
// @route   GET /api/reservations/worker/:workerId
// @access  Private
const getReservationsByWorkerId = async (req, res, next) => {
  try {
    const { workerId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
      console.log("workerId", workerId)

    // Verify worker exists
    const worker = await prisma.worker.findUnique({
      where: { userId: parseInt(workerId) }
    });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Build query
    const where = { workerId: parseInt(workerId) };
    if (status) {
      where.status = status;
    }

    const reservations = await prisma.reservation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: parseInt(limit)
    });

    // Fetch user, service, and review data for each reservation
    const reservationsWithData = await Promise.all(reservations.map(async (reservation) => {
      const [user, service, review] = await Promise.all([
        prisma.user.findUnique({
          where: { id: reservation.userId },
          select: {
            name: true,
            email: true,
            phone: true,
            avatar: true
          }
        }),
        prisma.service.findUnique({
          where: { id: reservation.serviceId },
          select: {
            name: true,
            description: true,
            category: true,
            basePrice: true
          }
        }),
        prisma.review.findFirst({
          where: { reservationId: reservation.id }
        })
      ]);
      return {
        ...reservation,
        user,
        service,
        review: review ? {
          rating: review.rating,
          comment: review.comment,
          wouldHireAgain: review.wouldHireAgain,
          createdAt: review.createdAt
        } : null,
        // The worker's overall/final rating, shown alongside each job
        workerRating: worker.averageRating || 0,
        workerTotalReviews: worker.totalReviews || 0
      };
    }));

    const total = await prisma.reservation.count({ where });

    res.status(200).json({
      success: true,
      data: {
        reservations: reservationsWithData,
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

module.exports = {
  getReservations,
  getReservation,
  createReservation,
  updateReservationStatus,
  cancelReservation,
  addNote,
  getReservationsByWorkerId
};
