const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Worker ID is required']
  },
  reservationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reservation',
    required: [true, 'Reservation ID is required'],
    unique: true
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    validate: {
      validator: Number.isInteger,
      message: 'Rating must be an integer'
    }
  },
  comment: {
    type: String,
    maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    trim: true
  },
  aspects: {
    professionalism: {
      type: Number,
      min: 1,
      max: 5
    },
    quality: {
      type: Number,
      min: 1,
      max: 5
    },
    timeliness: {
      type: Number,
      min: 1,
      max: 5
    },
    communication: {
      type: Number,
      min: 1,
      max: 5
    },
    value: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  wouldHireAgain: {
    type: Boolean,
    required: [true, 'Would hire again field is required']
  },
  images: [{
    type: String,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+\.(jpg|jpeg|png|webp)$/i.test(v);
      },
      message: 'Please provide valid image URLs'
    }
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  helpful: {
    type: Number,
    default: 0,
    min: 0
  },
  response: {
    content: String,
    timestamp: Date
  },
  reported: {
    type: Boolean,
    default: false
  },
  reportedReason: String,
  moderated: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for faster queries
reviewSchema.index({ workerId: 1, rating: -1 });
reviewSchema.index({ userId: 1 });
reviewSchema.index({ reservationId: 1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ isVerified: 1 });

// Compound index for worker stats
reviewSchema.index({ workerId: 1, isVerified: 1 });

// Virtual for average aspect rating
reviewSchema.virtual('averageAspectRating').get(function() {
  const aspects = Object.values(this.aspects).filter(val => val !== undefined);
  if (aspects.length === 0) return 0;
  return aspects.reduce((sum, val) => sum + val, 0) / aspects.length;
});

// Pre-save middleware
reviewSchema.pre('save', async function(next) {
  // Update worker rating stats when review is created or modified
  if (this.isNew || this.isModified('rating')) {
    const Worker = mongoose.model('Worker');
    const worker = await Worker.findOne({ userId: this.workerId });
    if (worker) {
      await worker.updateRatingStats();
    }
  }
  next();
});

// Pre-remove middleware
reviewSchema.pre('remove', async function(next) {
  // Update worker rating stats when review is deleted
  const Worker = mongoose.model('Worker');
  const worker = await Worker.findOne({ userId: this.workerId });
  if (worker) {
    await worker.updateRatingStats();
  }
  next();
});

// Static method to get worker rating breakdown
reviewSchema.statics.getWorkerRatingBreakdown = async function(workerId) {
  const breakdown = await this.aggregate([
    { $match: { workerId: mongoose.Types.ObjectId(workerId), isVerified: true } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: -1 } }
  ]);

  const result = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  breakdown.forEach(item => {
    result[item._id] = item.count;
  });

  return result;
};

// Static method to get worker aspect averages
reviewSchema.statics.getWorkerAspectAverages = async function(workerId) {
  const aspects = await this.aggregate([
    { $match: { workerId: mongoose.Types.ObjectId(workerId), isVerified: true } },
    {
      $group: {
        _id: null,
        professionalism: { $avg: '$aspects.professionalism' },
        quality: { $avg: '$aspects.quality' },
        timeliness: { $avg: '$aspects.timeliness' },
        communication: { $avg: '$aspects.communication' },
        value: { $avg: '$aspects.value' }
      }
    }
  ]);

  return aspects[0] || {
    professionalism: 0,
    quality: 0,
    timeliness: 0,
    communication: 0,
    value: 0
  };
};

// Static method to get recent reviews
reviewSchema.statics.getRecentReviews = function(workerId, limit = 10) {
  return this.find({ workerId, isVerified: true })
    .populate('userId', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Review', reviewSchema);
