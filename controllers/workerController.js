const { prisma } = require('../config/database');
const { validationResult } = require('express-validator');
const { haversineDistanceKm } = require('../utils/geo');

// @desc    Get all workers
// @route   GET /api/workers
// @access  Public
const getWorkers = async (req, res, next) => {
  try {
    const {
      category,
      city,
      page = 1,
      limit = 10,
      sortBy = 'averageRating',
      sortOrder = 'desc',
      minRating = 0,
      isActive,
      lat,
      lng
    } = req.query;

    const skip = (page - 1) * limit;

    // When the client sends their coordinates, we sort by distance instead
    // of the default DB ordering, so pagination has to happen in memory
    // after every matching worker's distance has been computed.
    const userLat = lat !== undefined ? parseFloat(lat) : null;
    const userLng = lng !== undefined ? parseFloat(lng) : null;
    const sortByDistance = Number.isFinite(userLat) && Number.isFinite(userLng);

    // Build where clause
    const where = {};

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (category) {
      // Find services with this category (convert to uppercase for Prisma enum)
      const servicesInCategory = await prisma.service.findMany({
        where: { category: category.toUpperCase() },
        select: { id: true }
      });
      const serviceIds = servicesInCategory.map(s => s.id);
      where.services = {
        hasSome: serviceIds
      };
    }

    if (city) {
      where.serviceArea = {
        path: '$',
        string_contains: city
      };
    }

    if (minRating > 0) {
      where.averageRating = {
        gte: parseFloat(minRating)
      };
    }

    // Sort options
    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const workers = await prisma.worker.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            avatar: true,
            location: true
          }
        }
      },
      orderBy,
      // Distance sorting/pagination happens after the query, so fetch
      // every matching worker instead of just one page.
      ...(sortByDistance ? {} : { skip, take: parseInt(limit) })
    });

    // DEBUG: Log raw workers data
    console.log('DEBUG: Raw workers from DB:', JSON.stringify(workers, null, 2));

    // Fetch services for each worker if they have service IDs
    const workersWithServices = await Promise.all(workers.map(async worker => {
      let serviceDetails = [];
      if (worker.services && worker.services.length > 0) {
        serviceDetails = await prisma.service.findMany({
          where: { id: { in: worker.services } },
          select: {
            name: true,
            description: true,
            category: true,
            basePrice: true
          }
        });
      }
      const distanceKm = sortByDistance && Number.isFinite(worker.latitude) && Number.isFinite(worker.longitude)
        ? haversineDistanceKm(userLat, userLng, worker.latitude, worker.longitude)
        : null;

      return {
        ...worker,
        id: worker.id, // Add worker's primary ID
        services: serviceDetails,
        ...(sortByDistance ? { distanceKm: distanceKm !== null ? Math.round(distanceKm * 10) / 10 : null } : {})
      };
    }));

    // DEBUG: Log final workers data
    console.log('DEBUG: Final workers data:', JSON.stringify(workersWithServices, null, 2));

    const total = await prisma.worker.count({ where });
    console.log('DEBUG: Total workers count:', total);

    let pagedWorkers = workersWithServices;

    if (sortByDistance) {
      // Workers without saved coordinates can't be placed on the distance
      // scale, so they sort after everyone who has a known distance.
      pagedWorkers = [...workersWithServices].sort((a, b) => {
        if (a.distanceKm === null && b.distanceKm === null) return 0;
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });
      pagedWorkers = pagedWorkers.slice(skip, skip + parseInt(limit));
    }

    const response = {
      success: true,
      data: {
        workers: pagedWorkers,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    };

    console.log('DEBUG: Final API response:', JSON.stringify(response, null, 2));

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// @desc    Get worker by ID
// @route   GET /api/workers/:id
// @access  Public
const getWorker = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid worker ID'
      });
    }

    const worker = await prisma.worker.findUnique({
      where: { userId: parseInt(id) },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            avatar: true,
            location: true
          }
        }
      }
    });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Fetch services for this worker
    let serviceDetails = [];
    if (worker.services && worker.services.length > 0) {
      serviceDetails = await prisma.service.findMany({
        where: { id: { in: worker.services } },
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          basePrice: true
        }
      });
    }

    const workerWithServices = {
      ...worker,
      services: serviceDetails
    };

    // Get reviews for this worker
    const reviews = await prisma.review.findMany({
      where: { workerId: parseInt(id), isVerified: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Get rating breakdown
    const ratingBreakdown = null; // TODO: Implement rating breakdown

    res.status(200).json({
      success: true,
      data: {
        worker: workerWithServices,
        reviews,
        ratingBreakdown
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get worker profile (for logged in worker)
// @route   GET /api/workers/profile
// @access  Private (Worker only)
const getWorkerProfile = async (req, res, next) => {
  try {
    const worker = await prisma.worker.findUnique({
      where: { userId: req.user.id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            avatar: true,
            location: true
          }
        }
      }
    });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker profile not found'
      });
    }

    // Fetch services for this worker
    let serviceDetails = [];
    if (worker.services && worker.services.length > 0) {
      serviceDetails = await prisma.service.findMany({
        where: { id: { in: worker.services } },
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          basePrice: true
        }
      });
    }

    const workerWithServices = {
      ...worker,
      services: serviceDetails
    };

    res.status(200).json({
      success: true,
      data: workerWithServices
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update worker profile
// @route   PUT /api/workers/profile
// @access  Private (Worker only)
const updateWorkerProfile = async (req, res, next) => {
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

    const worker = await prisma.worker.findUnique({
      where: { userId: req.user.id }
    });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker profile not found'
      });
    }

    const allowedFields = [
      'bio', 'skills', 'services', 'experience', 'hourlyRate',
      'availability', 'serviceArea', 'portfolio', 'certifications', 'businessInfo',
      'latitude', 'longitude'
    ];

    const updateData = {};

    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    const updatedWorker = await prisma.worker.update({
      where: { userId: req.user.id },
      data: updateData
    });

    res.status(200).json({
      success: true,
      message: 'Worker profile updated successfully',
      data: updatedWorker
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get worker reservations
// @route   GET /api/workers/reservations
// @access  Private (Worker only)
const getWorkerReservations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    console.log(req)
    const worker = await prisma.worker.findUnique({
      where: { id: req.user.id },
      select: { id: true }
    });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker profile not found'
      });
    }

    // Build where clause
    const where = { workerId: worker.id };
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

// @desc    Update reservation status
// @route   PUT /api/workers/reservations/:id/status
// @access  Private (Worker only)
const updateReservationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!['accepted', 'rejected', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const worker = await prisma.worker.findUnique({
      where: { userId: req.user.id },
      select: { id: true }
    });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker profile not found'
      });
    }

    const reservation = await prisma.reservation.findFirst({
      where: {
        id: parseInt(id),
        workerId: worker.id
      }
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // Check if status transition is valid
    const validTransitions = {
      'pending': ['accepted', 'rejected'],
      'accepted': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'cancelled']
    };

    if (!validTransitions[reservation.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${reservation.status} to ${status}`
      });
    }

    // Update status
    const updatedReservation = await prisma.reservation.update({
      where: { id: parseInt(id) },
      data: {
        status,
        ...(note && { notes: note })
      }
    });

    // Update worker stats if completed
    if (status === 'completed') {
      const currentWorker = await prisma.worker.findUnique({
        where: { id: worker.id }
      });
      if (currentWorker) {
        await prisma.worker.update({
          where: { id: currentWorker.id },
          data: {
            jobsCompleted: currentWorker.jobsCompleted + 1,
            totalEarnings: currentWorker.totalEarnings + (reservation.actualPrice || 0)
          }
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Reservation status updated successfully',
      data: updatedReservation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get worker reviews
// @route   GET /api/workers/reviews
// @access  Private (Worker only)
const getWorkerReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, rating } = req.query;
    const skip = (page - 1) * limit;
    const worker = await prisma.worker.findUnique({
      where: { userId: req.user.id },
      select: { id: true }
    });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker profile not found'
      });
    }

    // Build where clause
    const where = { workerId: worker.id, isVerified: true };
    if (rating) {
      where.rating = parseInt(rating);
    }

    const reviews = await prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: parseInt(limit)
    });

    const total = await prisma.review.count({ where });

    // Get aspect averages - TODO: Implement for Prisma
    const aspectAverages = null;

    res.status(200).json({
      success: true,
      data: {
        reviews,
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

// @desc    Get worker dashboard
// @route   GET /api/workers/dashboard
// @access  Private (Worker only)
const getWorkerDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get worker profile with stats
    const worker = await prisma.worker.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            avatar: true
          }
        }
      }
    });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker profile not found'
      });
    }

    // Get recent reservations
    const recentReservations = await prisma.reservation.findMany({
      where: { workerId: worker.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // Fetch user and service data for recent reservations
    const recentReservationsWithData = await Promise.all(recentReservations.map(async (reservation) => {
      const [user, service] = await Promise.all([
        prisma.user.findUnique({
          where: { id: reservation.userId },
          select: {
            name: true,
            avatar: true
          }
        }),
        prisma.service.findUnique({
          where: { id: reservation.serviceId },
          select: {
            name: true,
            category: true
          }
        })
      ]);
      return {
        ...reservation,
        user,
        service
      };
    }));

    // Get stats for current month - TODO: Implement for Prisma
    const monthlyStats = null;

    // Get pending reservations count
    const pendingCount = await prisma.reservation.count({
      where: {
        workerId: worker.id,
        status: 'pending'
      }
    });

    // Get recent reviews
    const recentReviews = await prisma.review.findMany({
      where: { workerId: worker.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const dashboardData = {
      worker,
      stats: {
        ...worker.stats,
        ...monthlyStats
      },
      pendingReservations: pendingCount,
      recentReservations: recentReservationsWithData,
      recentReviews
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get worker by database ID (not userId)
// @route   GET /api/workers/by-id/:id
// @access  Public
const getWorkerById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    console.log("getWorkerById", id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid worker ID'
      });
    }

    const worker = await prisma.worker.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            avatar: true,
            location: true
          }
        }
      }
    });
    console.log(worker)
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    res.status(200).json({
      success: true,
      data: worker
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get worker reviews by ID (public)
// @route   GET /api/workers/:id/reviews
// @access  Public
const getWorkerReviewsPublic = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid worker ID'
      });
    }

    const reviews = await prisma.review.findMany({
      where: { workerId: parseInt(id), isVerified: true },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 10
    });

    // Review has no Prisma relation to User, so attach reviewer info manually
    const reviewerIds = [...new Set(reviews.map(r => r.userId))];
    const reviewers = await prisma.user.findMany({
      where: { id: { in: reviewerIds } },
      select: { id: true, name: true, avatar: true }
    });
    const reviewerById = Object.fromEntries(reviewers.map(u => [u.id, u]));
    const reviewsWithUser = reviews.map(review => ({
      ...review,
      user: reviewerById[review.userId] || null
    }));

    const total = await prisma.review.count({ where: { workerId: parseInt(id), isVerified: true } });

    res.status(200).json({
      success: true,
      data: {
        reviews: reviewsWithUser,
        pagination: {
          current: 1,
          pages: Math.ceil(total / 10),
          total
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get worker dashboard by ID (public)
// @route   GET /api/workers/:id/dashboard
// @access  Public
const getWorkerDashboardPublic = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("getWorkerDashboardPublic", id)
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid worker ID'
      });
    }

    const worker = await prisma.worker.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            avatar: true
          }
        }
      }
    });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Get basic stats for this worker
    const stats = {
      totalJobs: worker.jobsCompleted || 0,
      totalEarnings: worker.totalEarnings || 0,
      averageRating: worker.averageRating || 0,
      totalReviews: worker.totalReviews || 0
    };

    res.status(200).json({
      success: true,
      data: {
        worker,
        stats
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search workers
// @route   GET /api/workers/search
// @access  Public
const searchWorkers = async (req, res, next) => {
  try {
    const {
      q,
      category,
      city,
      minRating = 0,
      maxPrice,
      page = 1,
      limit = 10
    } = req.query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where = { isActive: true };

    // Text search - search in bio and user name
    if (q) {
      where.OR = [
        { bio: { contains: q } },
        { user: { name: { contains: q } } }
      ];
    }

    // Category filter
    if (category) {
      // Find services with this category (convert to uppercase for Prisma enum)
      const servicesInCategory = await prisma.service.findMany({
        where: { category: category.toUpperCase() },
        select: { id: true }
      });
      const serviceIds = servicesInCategory.map(s => s.id);
      where.services = {
        hasSome: serviceIds
      };
    }

    // Location filter
    if (city) {
      where.serviceArea = {
        path: '$',
        string_contains: city
      };
    }

    // Rating filter
    if (minRating > 0) {
      where.averageRating = {
        gte: parseFloat(minRating)
      };
    }

    // Price filter
    if (maxPrice) {
      where.hourlyRate = {
        lte: parseFloat(maxPrice)
      };
    }

    const workers = await prisma.worker.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            avatar: true,
            location: true
          }
        }
      },
      orderBy: [
        { averageRating: 'desc' },
        { jobsCompleted: 'desc' }
      ],
      skip: skip,
      take: parseInt(limit)
    });

    // Fetch services for each worker
    const workersWithServices = await Promise.all(workers.map(async worker => {
      let serviceDetails = [];
      if (worker.services && worker.services.length > 0) {
        serviceDetails = await prisma.service.findMany({
          where: { id: { in: worker.services } },
          select: {
            name: true,
            description: true,
            category: true,
            basePrice: true
          }
        });
      }
      return {
        ...worker,
        services: serviceDetails
      };
    }));

    const total = await prisma.worker.count({ where });

    res.status(200).json({
      success: true,
      data: {
        workers: workersWithServices,
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
  getWorkers,
  getWorker,
  getWorkerById,
  getWorkerProfile,
  updateWorkerProfile,
  getWorkerReservations,
  updateReservationStatus,
  getWorkerReviews,
  getWorkerReviewsPublic,
  getWorkerDashboard,
  getWorkerDashboardPublic,
  searchWorkers
};
