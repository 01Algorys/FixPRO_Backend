const { prisma } = require('../config/database');
const { validationResult } = require('express-validator');

// @desc    Get worker reviews
// @route   GET /api/reviews/worker/:workerId
// @access  Public
const getWorkerReviews = async (req, res, next) => {
  try {
    const { workerId } = req.params;
    const { page = 1, limit = 10, rating } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    const query = { workerId, isVerified: true };
    if (rating) {
      query.rating = parseInt(rating);
    }

    const reviews = await Review.find(query)
      .populate('userId', 'name avatar')
      .populate('reservationId', 'date service')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(query);

    // Get rating breakdown
    const ratingBreakdown = await Review.getWorkerRatingBreakdown(workerId);

    // Get aspect averages
    const aspectAverages = await Review.getWorkerAspectAverages(workerId);

    res.status(200).json({
      success: true,
      data: {
        reviews,
        ratingBreakdown,
        aspectAverages,
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

// @desc    Get user's reviews
// @route   GET /api/reviews/user/my-reviews
// @access  Private
const getUserReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ userId: req.user._id })
      .populate('workerId', 'name avatar')
      .populate('reservationId', 'date service')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments({ userId: req.user._id });

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

// @desc    Get worker stats
// @route   GET /api/reviews/stats/:workerId
// @access  Public
const getWorkerStats = async (req, res, next) => {
  try {
    const { workerId } = req.params;

    const worker = await Worker.findOne({ userId: workerId });
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Get rating breakdown
    const ratingBreakdown = await Review.getWorkerRatingBreakdown(workerId);

    // Get aspect averages
    const aspectAverages = await Review.getWorkerAspectAverages(workerId);

    // Get recent reviews
    const recentReviews = await Review.getRecentReviews(workerId, 5);

    const stats = {
      ...worker.stats,
      ratingBreakdown,
      aspectAverages,
      recentReviews
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create review
// @route   POST /api/reviews
// @access  Private (User only)
const createReview = async (req, res, next) => {
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
      reservationId,
      rating,
      comment,
      wouldHireAgain
    } = req.body;

    // Verify reservation exists and belongs to user
    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(reservationId) }
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // Check if reservation belongs to user
    if (reservation.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only review your own reservations'
      });
    }

    // Check if reservation is completed
    if (reservation.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'You can only review completed reservations'
      });
    }

    // Check if review already exists
    const existingReview = await prisma.review.findFirst({
      where: { reservationId: parseInt(reservationId) }
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Review already exists for this reservation'
      });
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        userId: req.user.id,
        workerId: reservation.workerId,
        reservationId: parseInt(reservationId),
        rating: parseInt(rating),
        comment: comment || '',
        wouldHireAgain: wouldHireAgain || false
      }
    });

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update review
// @route   PATCH /api/reviews/:id
// @access  Private (Review author only)
const updateReview = async (req, res, next) => {
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

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns the review
    if (review.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own reviews'
      });
    }

    // Check if review is older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (review.createdAt < sevenDaysAgo) {
      return res.status(400).json({
        success: false,
        message: 'Reviews can only be updated within 7 days of creation'
      });
    }

    // Allowed fields to update
    const allowedFields = ['rating', 'comment', 'aspects', 'wouldHireAgain', 'images'];
    const updateData = {};

    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    const updatedReview = await Review.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('userId', 'name avatar')
      .populate('workerId', 'name avatar')
      .populate('reservationId', 'date service');

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: updatedReview
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private (Review author or Admin)
const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check permissions
    const isOwner = review.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if review is older than 7 days (only for owners)
    if (isOwner) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (review.createdAt < sevenDaysAgo) {
        return res.status(400).json({
          success: false,
          message: 'Reviews can only be deleted within 7 days of creation'
        });
      }
    }

    await Review.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark review as helpful
// @route   POST /api/reviews/:id/helpful
// @access  Public
const markHelpful = async (req, res, next) => {
  try {
    const { id } = req.params;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    review.helpful += 1;
    await review.save();

    res.status(200).json({
      success: true,
      message: 'Review marked as helpful',
      data: { helpful: review.helpful }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Report review
// @route   POST /api/reviews/:id/report
// @access  Private
const reportReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Report reason is required'
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    review.reported = true;
    review.reportedReason = reason;
    await review.save();

    res.status(200).json({
      success: true,
      message: 'Review reported successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Respond to review (Worker only)
// @route   POST /api/reviews/:id/respond
// @access  Private (Worker only)
const respondToReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Response content is required'
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user is the worker being reviewed
    if (review.workerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only respond to reviews about your services'
      });
    }

    review.response = {
      content,
      timestamp: new Date()
    };

    await review.save();

    res.status(200).json({
      success: true,
      message: 'Response added successfully',
      data: review.response
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWorkerReviews,
  getUserReviews,
  getWorkerStats,
  createReview,
  updateReview,
  deleteReview,
  markHelpful,
  reportReview,
  respondToReview
};
