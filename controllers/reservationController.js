const { prisma } = require('../config/database');
const { validationResult } = require('express-validator');

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

    // Check if user has access to this reservation
    if (
      req.user.id !== reservation.userId &&
      req.user.id !== reservation.workerId &&
      req.user.role !== 'admin'
    ) {
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

    if (!['accepted', 'rejected', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(id) }
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // Check permissions - user can only access their own reservations
    if (req.user.id !== reservation.userId && req.user.id !== reservation.workerId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get worker to check if user is the worker
    const worker = await prisma.worker.findFirst({
      where: { userId: req.user.id }
    });

    const isWorker = worker && worker.id === reservation.workerId;
    const isUser = req.user.id === reservation.userId;
    const isAdmin = req.user.role === 'admin';

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

    const userRole = isWorker ? 'worker' : isUser ? 'user' : 'admin';

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

    // Create welcome messages when reservation is accepted
    if (status === 'accepted') {
      try {
        // Check if messages already exist for this reservation
        const existingMessages = await prisma.message.findMany({
          where: { reservationId: parseInt(id) }
        });

        // Only create welcome messages if no messages exist yet
        if (existingMessages.length === 0) {
          // Create welcome message from worker to user
          await prisma.message.create({
            data: {
              reservationId: parseInt(id),
              senderId: reservation.workerId,
              receiverId: reservation.userId,
              content: 'Bonjour ! J\'ai accepté votre demande. N\'hésitez pas à me contacter si vous avez des questions.',
              type: 'text'
            }
          });

          // Create welcome message from user to worker (system-generated)
          await prisma.message.create({
            data: {
              reservationId: parseInt(id),
              senderId: reservation.userId,
              receiverId: reservation.workerId,
              content: 'Merci d\'avoir accepté ma demande. Je suis disponible pour échanger sur les détails.',
              type: 'text'
            }
          });
        }
      } catch (error) {
        console.error('Failed to create welcome messages:', error);
        // Don't fail the status update if message creation fails
      }
    }

    // Emit socket event for real-time updates (if socket.io is configured)
    const io = req.app.get('io');
    if (io) {
      const updateData = {
        reservationId: reservation.id,
        status,
        note,
        timestamp: new Date(),
        updatedBy: req.user.id,
        updatedByRole: req.user.role
      };

      io.to(`user_${reservation.userId}`).emit('reservation_update', updateData);
      io.to(`worker_${reservation.workerId}`).emit('reservation_update', updateData);

      // Special notification when job is completed - notify user to review
      if (status === 'completed') {
        io.to(`user_${reservation.userId}`).emit('job_completed_for_review', {
          reservationId: reservation.id,
          workerId: reservation.workerId,
          message: 'Le travail est terminé. Veuillez évaluer le travailleur.',
          timestamp: new Date()
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

    // Fetch user and service data for each reservation
    const reservationsWithData = await Promise.all(reservations.map(async (reservation) => {
      const [user, service] = await Promise.all([
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
        })
      ]);
      return {
        ...reservation,
        user,
        service
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
