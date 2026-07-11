const Fuse = require('fuse.js');
const { prisma } = require('../config/database');

const CATEGORY_LABELS = {
  PLUMBING: 'Plomberie',
  ELECTRICAL: 'Électricité',
  HVAC: 'Climatisation',
  LOCKSMITH: 'Serrurerie',
};

const INDEX_TTL_MS = 60 * 1000;
let indexCache = { entries: null, expiresAt: 0 };

// Builds the in-memory search index from categories/services/workers. Cached
// for a short TTL so keystroke-by-keystroke search doesn't hit the DB every time,
// while staying fresh enough for a marketplace of this size.
const buildSearchIndex = async () => {
  const now = Date.now();
  if (indexCache.entries && indexCache.expiresAt > now) {
    return indexCache.entries;
  }

  const categoryEntries = Object.entries(CATEGORY_LABELS).map(([id, label]) => ({
    type: 'category',
    id,
    label,
    subtitle: 'Catégorie de service',
  }));

  const services = await prisma.service.findMany({
    where: { isActive: true },
    select: { id: true, name: true, description: true, category: true },
    take: 200,
  });
  const serviceEntries = services.map((s) => ({
    type: 'service',
    id: s.id,
    label: s.name,
    subtitle: CATEGORY_LABELS[s.category] || s.category,
    category: s.category,
  }));

  const workers = await prisma.worker.findMany({
    where: { isActive: true },
    select: {
      id: true,
      userId: true,
      bio: true,
      skills: true,
      averageRating: true,
      user: { select: { name: true, avatar: true } },
    },
    take: 300,
  });
  const workerEntries = workers.map((w) => ({
    type: 'worker',
    id: w.userId,
    label: w.user?.name || 'Professionnel',
    subtitle: w.skills?.[0] || w.bio || 'Professionnel',
    avatar: w.user?.avatar,
    rating: w.averageRating,
    skills: w.skills,
  }));

  const entries = [...categoryEntries, ...serviceEntries, ...workerEntries];
  indexCache = { entries, expiresAt: now + INDEX_TTL_MS };
  return entries;
};

// @desc    Smart search across workers, services, categories with fuzzy/typo tolerance
// @route   GET /api/search?q=
// @access  Public
const search = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();

    if (!q) {
      const popular = await getPopularCategories();
      return res.status(200).json({
        success: true,
        data: { workers: [], services: [], categories: [], popular },
      });
    }

    const entries = await buildSearchIndex();
    const fuse = new Fuse(entries, {
      keys: ['label', 'subtitle', 'skills'],
      threshold: 0.4,
      includeScore: true,
      minMatchCharLength: 2,
    });

    const results = fuse.search(q, { limit: 30 }).map((r) => r.item);

    res.status(200).json({
      success: true,
      data: {
        categories: results.filter((r) => r.type === 'category').slice(0, 4),
        services: results.filter((r) => r.type === 'service').slice(0, 10),
        workers: results.filter((r) => r.type === 'worker').slice(0, 10),
        popular: [],
      },
    });
  } catch (error) {
    next(error);
  }
};

const getPopularCategories = async () => {
  const grouped = await prisma.reservation.groupBy({
    by: ['serviceId'],
    _count: { serviceId: true },
    orderBy: { _count: { serviceId: 'desc' } },
    take: 20,
  });

  if (grouped.length === 0) return [];

  const services = await prisma.service.findMany({
    where: { id: { in: grouped.map((g) => g.serviceId) } },
    select: { id: true, category: true },
  });
  const categoryById = new Map(services.map((s) => [s.id, s.category]));

  const countByCategory = new Map();
  grouped.forEach((g) => {
    const category = categoryById.get(g.serviceId);
    if (!category) return;
    countByCategory.set(category, (countByCategory.get(category) || 0) + g._count.serviceId);
  });

  return [...countByCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([category]) => ({
      type: 'category',
      id: category,
      label: CATEGORY_LABELS[category] || category,
      subtitle: 'Catégorie populaire',
    }));
};

module.exports = { search };
