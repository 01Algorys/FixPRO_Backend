const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Service name is required'],
    trim: true,
    maxlength: [100, 'Service name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Service description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['plumbing', 'electrical', 'hvac', 'locksmith'],
    lowercase: true
  },
  icon: {
    type: String,
    default: ''
  },
  basePrice: {
    type: Number,
    min: [0, 'Base price cannot be negative'],
    default: 0
  },
  priceUnit: {
    type: String,
    enum: ['hour', 'job', 'consultation'],
    default: 'hour'
  },
  duration: {
    type: Number, // in minutes
    min: [15, 'Duration must be at least 15 minutes']
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
  requirements: [{
    type: String,
    trim: true
  }],
  images: [{
    type: String,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+\.(jpg|jpeg|png|webp)$/i.test(v);
      },
      message: 'Please provide valid image URLs'
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  emergency: {
    available: Boolean,
    extraCharge: Number,
    responseTime: String // e.g., "30 minutes", "2 hours"
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for faster queries
serviceSchema.index({ category: 1 });
serviceSchema.index({ isActive: 1 });
serviceSchema.index({ isPopular: 1 });
serviceSchema.index({ name: 'text', description: 'text' });

// Static method to get predefined services
serviceSchema.statics.getPredefinedServices = function() {
  return [
    {
      name: 'Plumbing Services',
      description: 'Complete plumbing solutions including repairs, installations, and maintenance',
      category: 'plumbing',
      icon: 'wrench',
      basePrice: 75,
      priceUnit: 'hour',
      duration: 60,
      availability: {
        monday: { available: true, startTime: '08:00', endTime: '20:00' },
        tuesday: { available: true, startTime: '08:00', endTime: '20:00' },
        wednesday: { available: true, startTime: '08:00', endTime: '20:00' },
        thursday: { available: true, startTime: '08:00', endTime: '20:00' },
        friday: { available: true, startTime: '08:00', endTime: '20:00' },
        saturday: { available: true, startTime: '09:00', endTime: '18:00' },
        sunday: { available: true, startTime: '10:00', endTime: '16:00' }
      },
      emergency: {
        available: true,
        extraCharge: 50,
        responseTime: '30 minutes'
      },
      tags: ['24/7', 'emergency', 'repairs', 'installation'],
      isActive: true,
      isPopular: true
    },
    {
      name: 'Electrical Services',
      description: 'Professional electrical work including installations, repairs, and inspections',
      category: 'electrical',
      icon: 'zap',
      basePrice: 85,
      priceUnit: 'hour',
      duration: 60,
      availability: {
        monday: { available: true, startTime: '08:00', endTime: '20:00' },
        tuesday: { available: true, startTime: '08:00', endTime: '20:00' },
        wednesday: { available: true, startTime: '08:00', endTime: '20:00' },
        thursday: { available: true, startTime: '08:00', endTime: '20:00' },
        friday: { available: true, startTime: '08:00', endTime: '20:00' },
        saturday: { available: true, startTime: '09:00', endTime: '18:00' },
        sunday: { available: false, startTime: '09:00', endTime: '18:00' }
      },
      emergency: {
        available: true,
        extraCharge: 75,
        responseTime: '1 hour'
      },
      tags: ['licensed', 'insured', 'commercial', 'residential'],
      isActive: true,
      isPopular: true
    },
    {
      name: 'HVAC Services',
      description: 'Heating, ventilation, and air conditioning installation, repair, and maintenance',
      category: 'hvac',
      icon: 'wind',
      basePrice: 95,
      priceUnit: 'hour',
      duration: 90,
      availability: {
        monday: { available: true, startTime: '08:00', endTime: '18:00' },
        tuesday: { available: true, startTime: '08:00', endTime: '18:00' },
        wednesday: { available: true, startTime: '08:00', endTime: '18:00' },
        thursday: { available: true, startTime: '08:00', endTime: '18:00' },
        friday: { available: true, startTime: '08:00', endTime: '18:00' },
        saturday: { available: true, startTime: '09:00', endTime: '17:00' },
        sunday: { available: false, startTime: '09:00', endTime: '17:00' }
      },
      emergency: {
        available: true,
        extraCharge: 100,
        responseTime: '2 hours'
      },
      tags: ['installation', 'maintenance', 'repair', 'energy-efficient'],
      isActive: true,
      isPopular: true
    },
    {
      name: 'Locksmith Services',
      description: 'Professional locksmith services including emergency lockout, key replacement, and security upgrades',
      category: 'locksmith',
      icon: 'key',
      basePrice: 65,
      priceUnit: 'job',
      duration: 45,
      availability: {
        monday: { available: true, startTime: '00:00', endTime: '23:59' },
        tuesday: { available: true, startTime: '00:00', endTime: '23:59' },
        wednesday: { available: true, startTime: '00:00', endTime: '23:59' },
        thursday: { available: true, startTime: '00:00', endTime: '23:59' },
        friday: { available: true, startTime: '00:00', endTime: '23:59' },
        saturday: { available: true, startTime: '00:00', endTime: '23:59' },
        sunday: { available: true, startTime: '00:00', endTime: '23:59' }
      },
      emergency: {
        available: true,
        extraCharge: 40,
        responseTime: '15 minutes'
      },
      tags: ['24/7', 'emergency', 'automotive', 'commercial'],
      isActive: true,
      isPopular: true
    }
  ];
};

// Static method to initialize predefined services
serviceSchema.statics.initializeServices = async function() {
  const existingServices = await this.countDocuments();
  if (existingServices === 0) {
    const predefinedServices = this.getPredefinedServices();
    await this.insertMany(predefinedServices);
    console.log('Predefined services initialized successfully');
  }
};

module.exports = mongoose.model('Service', serviceSchema);
