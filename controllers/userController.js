const { prisma } = require('../config/database');
const { validationResult } = require('express-validator');
const socketService = require('../services/socketService');

// @desc    Get user reservations
// @route   GET /api/users/reservations
// @access  Private
const getUserReservations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    const where = { userId: req.user.id };
    if (status) {
      where.status = status;
    }

    const reservations = await prisma.reservation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: parseInt(limit)
    });

    // Manually fetch worker, service, and review data for each reservation
    const reservationsWithDetails = await Promise.all(reservations.map(async reservation => {
      let workerDetails = null;
      let serviceDetails = null;
      let userReview = null;

      if (reservation.workerId) {
        // reservation.workerId is the worker's User.id, not the Worker table's own id
        workerDetails = await prisma.worker.findUnique({
          where: { userId: reservation.workerId },
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
                avatar: true
              }
            }
          }
        });
      }

      if (reservation.serviceId) {
        serviceDetails = await prisma.service.findUnique({
          where: { id: reservation.serviceId },
          select: {
            name: true,
            description: true,
            category: true,
            basePrice: true
          }
        });
      }

      // Check if user has already reviewed this reservation
      userReview = await prisma.review.findFirst({
        where: {
          reservationId: reservation.id,
          userId: req.user.id
        }
      });

      return {
        ...reservation,
        worker: workerDetails,
        workerName: workerDetails?.user?.name || null,
        workerAvatar: workerDetails?.user?.avatar || null,
        workerPhone: workerDetails?.user?.phone || null,
        workerRating: workerDetails?.averageRating || 0,
        service: serviceDetails,
        userRating: userReview ? userReview.rating : null,
        review: userReview ? {
          rating: userReview.rating,
          comment: userReview.comment,
          wouldHireAgain: userReview.wouldHireAgain,
          createdAt: userReview.createdAt
        } : null
      };
    }));

    const total = await prisma.reservation.count({ where });

    res.status(200).json({
      success: true,
      data: {
        reservations: reservationsWithDetails,
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

// @desc    Get user reviews
// @route   GET /api/users/reviews
// @access  Private
const getUserReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const reviews = await prisma.review.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: parseInt(limit)
    });

    const total = await prisma.review.count({ where: { userId: req.user.id } });

    res.status(200).json({
      success: true,
      data: {
        reviews,
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

// @desc    Get user profile details
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
        location: true,
        isVerified: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user stats
    const reservations = await prisma.reservation.groupBy({
      by: ['status'],
      where: { userId: user.id },
      _count: { status: true }
    });

    const statusStats = {
      total: 0,
      pending: 0,
      accepted: 0,
      completed: 0,
      cancelled: 0
    };

    reservations.forEach(stat => {
      statusStats[stat.status] = stat._count.status;
      statusStats.total += stat._count.status;
    });

    res.status(200).json({
      success: true,
      data: {
        user: user,
        stats: statusStats
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res, next) => {
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

    const allowedFields = ['name', 'phone', 'location', 'avatar'];
    const updateData = {};

    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
        location: true,
        isVerified: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user account
// @route   DELETE /api/users/account
// @access  Private
const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to delete account'
      });
    }

    // Verify password
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { password: true, role: true }
    });
    
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Check for active reservations
    const activeReservations = await prisma.reservation.count({
      where: {
        userId: req.user.id,
        status: { in: ['pending', 'accepted', 'in_progress'] }
      }
    });

    if (activeReservations > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete account with active reservations'
      });
    }

    // Delete worker profile if exists
    if (user.role === 'worker') {
      await prisma.worker.delete({
        where: { userId: req.user.id }
      });
    }

    // Delete user
    await prisma.user.delete({
      where: { id: req.user.id }
    });

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user dashboard data
// @route   GET /api/users/dashboard
// @access  Private
const getUserDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get recent reservations
    const recentReservations = await prisma.reservation.findMany({
      where: { userId },
      include: {
        worker: {
          select: {
            name: true,
            avatar: true
          }
        },
        service: {
          select: {
            name: true,
            category: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // Get stats
    const reservations = await prisma.reservation.aggregate({
      where: { userId },
      _count: { id: true },
      _sum: { actualPrice: true }
    });

    const completedReservations = await prisma.reservation.count({
      where: { 
        userId,
        status: 'completed'
      }
    });

    // Get pending reviews
    const pendingReviews = await prisma.reservation.findMany({
      where: {
        userId,
        status: 'completed',
        review: null
      },
      include: {
        worker: {
          select: {
            name: true,
            avatar: true
          }
        },
        service: {
          select: {
            name: true
          }
        }
      },
      take: 5
    });

    const dashboardData = {
      stats: {
        totalReservations: reservations._count.id,
        completedReservations: completedReservations,
        totalSpent: reservations._sum.actualPrice || 0
      },
      recentReservations,
      pendingReviews
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get online status for multiple users
// @route   GET /api/users/online-status
// @access  Private
const getUsersOnlineStatus = async (req, res, next) => {
  try {
    const { userIds } = req.query;
    
    if (!userIds) {
      return res.status(400).json({
        success: false,
        message: 'userIds query parameter is required'
      });
    }

    const ids = userIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    
    const result = ids.map(id => ({
      userId: id,
      isOnline: socketService.isUserOnline(id)
    }));

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Save push notification token
// @route   POST /api/users/push-token
// @access  Private
const savePushToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Push token is required'
      });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { expoPushToken: token }
    });

    res.status(200).json({
      success: true,
      message: 'Push token saved successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserReservations,
  getUserReviews,
  getUserProfile,
  updateUserProfile,
  deleteAccount,
  getUserDashboard,
  getUsersOnlineStatus,
  savePushToken
};
