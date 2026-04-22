const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    trim: true
  },
  skills: [{
    type: String,
    trim: true,
    maxlength: [50, 'Skill cannot exceed 50 characters']
  }],
  services: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  }],
  experience: {
    type: Number,
    min: [0, 'Experience cannot be negative'],
    max: [50, 'Experience cannot exceed 50 years']
  },
  hourlyRate: {
    type: Number,
    min: [0, 'Hourly rate cannot be negative'],
    max: [1000, 'Hourly rate cannot exceed $1000']
  },
  availability: {
    monday: { available: Boolean, startTime: String, endTime: String },
    tuesday: { available: Boolean, startTime: String, endTime: String },
    wednesday: { available: Boolean, startTime: String, endTime: String },
    thursday: { available: Boolean, startTime: String, endTime: String },
    friday: { available: Boolean, startTime: String, endTime: String },
    saturday: { available: Boolean, startTime: String, endTime: String },
    sunday: { available: Boolean, startTime: String, endTime: String }
  },
  serviceArea: {
    cities: [String],
    radius: {
      type: Number,
      min: [1, 'Service radius must be at least 1 km'],
      max: [100, 'Service radius cannot exceed 100 km']
    }
  },
  portfolio: [{
    title: String,
    description: String,
    images: [String],
    completedAt: Date
  }],
  certifications: [{
    name: String,
    issuer: String,
    issueDate: Date,
    expiryDate: Date,
    certificateUrl: String
  }],
  businessInfo: {
    businessName: String,
    businessLicense: String,
    insurance: Boolean,
    insuranceDetails: String
  },
  stats: {
    jobsCompleted: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    responseRate: { type: Number, default: 0, min: 0, max: 100 },
    responseTime: { type: Number, default: 0 } // in hours
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationDocuments: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for faster queries
workerSchema.index({ userId: 1 });
workerSchema.index({ services: 1 });
workerSchema.index({ 'serviceArea.cities': 1 });
workerSchema.index({ 'stats.averageRating': -1 });
workerSchema.index({ isActive: 1, isVerified: 1 });

// Virtual for reservations
workerSchema.virtual('reservations', {
  ref: 'Reservation',
  localField: 'userId',
  foreignField: 'workerId'
});

// Virtual for reviews
workerSchema.virtual('reviews', {
  ref: 'Review',
  localField: 'userId',
  foreignField: 'workerId'
});

// Method to update rating stats
workerSchema.methods.updateRatingStats = async function() {
  const Review = mongoose.model('Review');
  const stats = await Review.aggregate([
    { $match: { workerId: this._id } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    this.stats.averageRating = Math.round(stats[0].averageRating * 10) / 10;
    this.stats.totalReviews = stats[0].totalReviews;
  } else {
    this.stats.averageRating = 0;
    this.stats.totalReviews = 0;
  }

  await this.save();
};

// Method to check availability
workerSchema.methods.isAvailable = function(date, time) {
  const dayOfWeek = new Date(date).toLocaleLowerCase('en-US', { weekday: 'long' });
  const dayAvailability = this.availability[dayOfWeek];
  
  if (!dayAvailability || !dayAvailability.available) {
    return false;
  }

  const requestedTime = new Date(`2000-01-01T${time}`);
  const startTime = new Date(`2000-01-01T${dayAvailability.startTime}`);
  const endTime = new Date(`2000-01-01T${dayAvailability.endTime}`);

  return requestedTime >= startTime && requestedTime <= endTime;
};

module.exports = mongoose.model('Worker', workerSchema);
