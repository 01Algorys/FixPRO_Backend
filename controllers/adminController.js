const { prisma } = require('../config/database');

// GET /api/admin/users/stats
const getUserStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [total, particuliers, techniciens, newThisMonth, actifs,
      prevTotal, prevParticuliers, prevTechniciens, prevNewLastMonth, prevActifs] = await Promise.all([
      prisma.user.count({ where: { role: { not: 'ADMIN' } } }),
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.user.count({ where: { role: 'WORKER' } }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth }, role: { not: 'ADMIN' } } }),
      prisma.user.count({ where: { accountStatus: 'APPROVED', role: { not: 'ADMIN' } } }),
      prisma.user.count({ where: { role: { not: 'ADMIN' }, createdAt: { lte: endOfLastMonth } } }),
      prisma.user.count({ where: { role: 'USER', createdAt: { lte: endOfLastMonth } } }),
      prisma.user.count({ where: { role: 'WORKER', createdAt: { lte: endOfLastMonth } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }, role: { not: 'ADMIN' } } }),
      prisma.user.count({ where: { accountStatus: 'APPROVED', role: { not: 'ADMIN' }, createdAt: { lte: endOfLastMonth } } }),
    ]);

    const delta = (curr, prev) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 1000) / 10;
    };

    res.json({
      success: true,
      data: {
        total:        { count: total,        delta: delta(total, prevTotal) },
        particuliers: { count: particuliers,  delta: delta(particuliers, prevParticuliers) },
        techniciens:  { count: techniciens,   delta: delta(techniciens, prevTechniciens) },
        newThisMonth: { count: newThisMonth,  delta: delta(newThisMonth, prevNewLastMonth) },
        actifs:       { count: actifs,        delta: delta(actifs, prevActifs) },
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/users
const getUsers = async (req, res, next) => {
  try {
    const { search, role, status, isVerified, startDate, endDate, page = 1, limit = 10 } = req.query;

    const where = {};

    if (role && role !== 'ALL') {
      where.role = role.toUpperCase();
    }

    if (status && status !== 'ALL') {
      where.accountStatus = status.toUpperCase();
    }

    if (isVerified !== undefined && isVerified !== 'ALL') {
      where.isVerified = isVerified === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate)   where.createdAt.lte = new Date(endDate);
    }

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, phone: true, avatar: true,
          role: true, accountStatus: true, isVerified: true, location: true, createdAt: true,
          worker: {
            select: {
              id: true, isActive: true, isVerified: true, services: true,
              jobsCompleted: true, averageRating: true, totalReviews: true, hourlyRate: true,
            }
          }
        }
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/users/:id
const getUserById = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: 'Invalid user ID' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, phone: true, avatar: true,
        role: true, accountStatus: true, isVerified: true, location: true,
        createdAt: true, updatedAt: true,
        worker: {
          select: {
            id: true, bio: true, skills: true, services: true, experience: true, hourlyRate: true,
            serviceArea: true, isActive: true, isVerified: true,
            jobsCompleted: true, totalEarnings: true, averageRating: true, totalReviews: true,
          }
        }
      }
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/users/:id/approve
const approveUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: 'Invalid user ID' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'WORKER') {
      return res.status(400).json({ success: false, message: 'Only technician accounts can be approved' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { accountStatus: 'APPROVED' },
      select: { id: true, name: true, email: true, accountStatus: true, role: true }
    });

    res.json({ success: true, message: 'Technician account approved successfully', data: updated });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/users/:id/reject
const rejectUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: 'Invalid user ID' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { accountStatus: 'REJECTED' },
      select: { id: true, name: true, email: true, accountStatus: true, role: true }
    });

    res.json({ success: true, message: 'User account rejected', data: updated });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/users/:id/status
const updateUserStatus = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: 'Invalid user ID' });

    const { accountStatus } = req.body;
    const valid = ['APPROVED', 'REJECTED', 'PENDING_APPROVAL'];
    if (!valid.includes(accountStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { accountStatus },
      select: { id: true, name: true, email: true, accountStatus: true, role: true }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/users/:id/services
const updateWorkerServices = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: 'Invalid user ID' });

    const { services } = req.body;
    if (!Array.isArray(services) || !services.every((id) => Number.isInteger(id))) {
      return res.status(400).json({ success: false, message: 'services must be an array of integer service IDs' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, worker: { select: { id: true } } } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'WORKER' || !user.worker) {
      return res.status(400).json({ success: false, message: 'This user does not have a technician profile' });
    }

    if (services.length > 0) {
      const existingCount = await prisma.service.count({ where: { id: { in: services } } });
      if (existingCount !== new Set(services).size) {
        return res.status(400).json({ success: false, message: 'One or more service IDs do not exist' });
      }
    }

    const updatedWorker = await prisma.worker.update({
      where: { userId },
      data: { services },
      select: { id: true, userId: true, services: true }
    });

    res.json({ success: true, message: 'Technician services updated successfully', data: updatedWorker });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/stats (dashboard overview)
const getDashboardStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      totalWorkers,
      pendingApprovals,
      totalReservations,
      completedReservations,
      newUsersThisMonth,
      earningsResult,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.user.count({ where: { role: 'WORKER', accountStatus: 'APPROVED' } }),
      prisma.user.count({ where: { accountStatus: 'PENDING_APPROVAL' } }),
      prisma.reservation.count(),
      prisma.reservation.count({ where: { status: 'COMPLETED' } }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.reservation.aggregate({ _sum: { actualPrice: true }, where: { status: 'COMPLETED' } }),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalWorkers,
        pendingApprovals,
        totalReservations,
        completedReservations,
        newUsersThisMonth,
        totalRevenue: earningsResult._sum.actualPrice || 0,
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/reservations
const getReservations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const where = {};
    if (status && status !== 'ALL') where.status = status.toUpperCase();

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({ where, skip, take: limitNum, orderBy: { createdAt: 'desc' } }),
      prisma.reservation.count({ where }),
    ]);

    // Enrich with user and worker display names
    const userIds   = [...new Set(reservations.map(r => r.userId))];
    const workerIds = [...new Set(reservations.map(r => r.workerId))];

    const [users, workers] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, avatar: true } }),
      prisma.user.findMany({ where: { id: { in: workerIds } }, select: { id: true, name: true, avatar: true } }),
    ]);

    const userMap   = Object.fromEntries(users.map(u => [u.id, u]));
    const workerMap = Object.fromEntries(workers.map(u => [u.id, u]));

    const enriched = reservations.map(r => ({
      ...r,
      userInfo:   userMap[r.userId]   || null,
      workerInfo: workerMap[r.workerId] || null,
    }));

    res.json({
      success: true,
      data: {
        reservations: enriched,
        pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/reviews
const getReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({ skip, take: limitNum, orderBy: { createdAt: 'desc' } }),
      prisma.review.count(),
    ]);

    const userIds   = [...new Set(reviews.map(r => r.userId))];
    const workerIds = [...new Set(reviews.map(r => r.workerId))];

    const [users, workers] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, avatar: true } }),
      prisma.user.findMany({ where: { id: { in: workerIds } }, select: { id: true, name: true, avatar: true } }),
    ]);

    const userMap   = Object.fromEntries(users.map(u => [u.id, u]));
    const workerMap = Object.fromEntries(workers.map(u => [u.id, u]));

    const enriched = reviews.map(r => ({
      ...r,
      userInfo:   userMap[r.userId]   || null,
      workerInfo: workerMap[r.workerId] || null,
    }));

    res.json({
      success: true,
      data: { reviews: enriched, pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/notifications
const getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({ skip, take: limitNum, orderBy: { createdAt: 'desc' } }),
      prisma.notification.count(),
    ]);

    res.json({
      success: true,
      data: { notifications, pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/services
const getServices = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category } = req.query;
    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;

    const where = {};
    if (category && category !== 'ALL') where.category = category.toUpperCase();

    const [services, total] = await Promise.all([
      prisma.service.findMany({ where, skip, take: limitNum, orderBy: { createdAt: 'desc' } }),
      prisma.service.count({ where }),
    ]);

    res.json({
      success: true,
      data: { services, pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserStats,
  getUsers,
  getUserById,
  approveUser,
  rejectUser,
  updateUserStatus,
  updateWorkerServices,
  getDashboardStats,
  getReservations,
  getReviews,
  getNotifications,
  getServices,
};
