const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
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
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: [true, 'Service ID is required']
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    validate: {
      validator: function(v) {
        return v > new Date();
      },
      message: 'Reservation date must be in the future'
    }
  },
  time: {
    type: String,
    required: [true, 'Time is required'],
    validate: {
      validator: function(v) {
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Please provide a valid time in HH:MM format'
    }
  },
  duration: {
    type: Number, // in minutes
    required: [true, 'Duration is required'],
    min: [15, 'Duration must be at least 15 minutes']
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  location: {
    address: {
      type: String,
      required: [true, 'Address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: {
      type: String,
      required: [true, 'State is required']
    },
    zipCode: {
      type: String,
      required: [true, 'Zip code is required']
    },
    coordinates: {
      lat: Number,
      lng: Number
    },
    specialInstructions: String
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    trim: true
  },
  estimatedPrice: {
    type: Number,
    min: [0, 'Estimated price cannot be negative']
  },
  actualPrice: {
    type: Number,
    min: [0, 'Actual price cannot be negative']
  },
  emergency: {
    type: Boolean,
    default: false
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
  tracking: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    location: {
      lat: Number,
      lng: Number
    }
  }],
  payment: {
    method: {
      type: String,
      enum: ['cash', 'card', 'online'],
      default: 'cash'
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'refunded'],
      default: 'pending'
    },
    amount: Number,
    transactionId: String,
    paidAt: Date
  },
  notes: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    internal: {
      type: Boolean,
      default: false
    }
  }],
  cancellationReason: String,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completedAt: Date,
  workerArrivalTime: Date,
  startTime: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for faster queries
reservationSchema.index({ userId: 1, status: 1 });
reservationSchema.index({ workerId: 1, status: 1 });
reservationSchema.index({ service: 1 });
reservationSchema.index({ date: 1, status: 1 });
reservationSchema.index({ 'location.city': 1 });

// Virtual for review
reservationSchema.virtual('review', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'reservationId',
  justOne: true
});

// Pre-save middleware
reservationSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

// Method to add tracking update
reservationSchema.methods.addTracking = function(status, note, location) {
  this.tracking.push({
    status,
    note,
    location,
    timestamp: new Date()
  });
  return this.save();
};

// Method to calculate duration
reservationSchema.methods.calculateDuration = function() {
  if (this.startTime && this.completedAt) {
    return Math.round((this.completedAt - this.startTime) / (1000 * 60)); // in minutes
  }
  return this.duration;
};

// Method to check if user can cancel
reservationSchema.methods.canCancel = function(userId) {
  const isUser = this.userId.toString() === userId.toString();
  const isWorker = this.workerId.toString() === userId.toString();
  const canCancelByStatus = ['pending', 'accepted'].includes(this.status);
  const notTooLate = this.date > new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours before
  
  return (isUser || isWorker) && canCancelByStatus && notTooLate;
};

// Static method to get worker stats
reservationSchema.statics.getWorkerStats = async function(workerId, startDate, endDate) {
  const matchStage = {
    workerId: mongoose.Types.ObjectId(workerId),
    status: 'completed'
  };
  
  if (startDate && endDate) {
    matchStage.completedAt = {
      $gte: startDate,
      $lte: endDate
    };
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalJobs: { $sum: 1 },
        totalEarnings: { $sum: '$actualPrice' },
        averageJobPrice: { $avg: '$actualPrice' },
        averageDuration: { $avg: '$duration' }
      }
    }
  ]);
  
  return stats[0] || {
    totalJobs: 0,
    totalEarnings: 0,
    averageJobPrice: 0,
    averageDuration: 0
  };
};

module.exports = mongoose.model('Reservation', reservationSchema);
