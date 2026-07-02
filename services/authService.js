const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { prisma } = require('../config/database');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

// Register User
const register = async (userData) => {
  const { name, email, password, role = 'USER', phone } = userData;

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });
  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Workers require manual admin approval before they can access the app
  const accountStatus = role === 'WORKER' ? 'PENDING_APPROVAL' : 'APPROVED';

  // Create user
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role,
      phone,
      accountStatus
    }
  });

  // Create worker profile if role is worker
  if (role === 'WORKER') {
    await prisma.worker.create({
      data: {
        userId: user.id,
        jobsCompleted: 0,
        totalEarnings: 0,
        averageRating: 0,
        totalReviews: 0
      }
    });

    // Workers cannot log in until approved — do not return a token
    const { password: _, ...userWithoutPassword } = user;
    return { pendingApproval: true, user: userWithoutPassword };
  }

  // Generate token
  const token = generateToken(user.id);

  // Remove password from response
  const { password: _, ...userWithoutPassword } = user;

  return {
    token,
    user: userWithoutPassword
  };
};

// Login User — accepts email or phone number as identifier
const login = async (identifier, password) => {
  if (!identifier) {
    throw new Error('Invalid credentials');
  }

  // Determine lookup strategy: email if contains '@', otherwise phone
  let user;
  if (identifier.includes('@')) {
    user = await prisma.user.findUnique({ where: { email: identifier } });
  } else {
    // Try exact phone match first, then with +216 country prefix
    user = await prisma.user.findFirst({ where: { phone: identifier } });
    if (!user) {
      user = await prisma.user.findFirst({ where: { phone: `+216${identifier}` } });
    }
  }

  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Check if password matches
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  // Enforce account status checks before issuing a token
  if (user.accountStatus === 'PENDING_APPROVAL') {
    throw new Error('ACCOUNT_PENDING_APPROVAL');
  }
  if (user.accountStatus === 'REJECTED') {
    throw new Error('ACCOUNT_REJECTED');
  }

  // Generate token
  const token = generateToken(user.id);

  // Remove password from response
  const { password: _, ...userWithoutPassword } = user;

  return {
    token,
    user: userWithoutPassword
  };
};

// Get User Profile
const getProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new Error('User not found');
  }

  // If user is worker, get worker profile
  let workerProfile = null;
  if (user.role === 'worker') {
    workerProfile = await prisma.worker.findUnique({
      where: { userId: user.id },
      include: {
        services: true,
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

  // Remove password from response
  const { password: _, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword,
    workerProfile
  };
};

// Update User Profile
const updateProfile = async (userId, updateData) => {
  const allowedFields = ['name', 'phone', 'location', 'avatar'];
  const filteredData = {};

  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredData[key] = updateData[key];
    }
  });

  const user = await prisma.user.update({
    where: { id: userId },
    data: filteredData
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Remove password from response
  const { password: _, ...userWithoutPassword } = user;

  return userWithoutPassword;
};

// Update Worker Profile
const updateWorkerProfile = async (userId, updateData) => {
  const worker = await prisma.worker.findUnique({
    where: { userId }
  });

  if (!worker) {
    throw new Error('Worker profile not found');
  }

  const allowedFields = [
    'bio', 'skills', 'experience', 'hourlyRate', 
    'availability', 'serviceArea', 'portfolio', 
    'certifications', 'businessInfo'
  ];

  const filteredData = {};

  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredData[key] = updateData[key];
    }
  });

  const updatedWorker = await prisma.worker.update({
    where: { userId },
    data: filteredData
  });

  return updatedWorker;
};

// Change Password
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Check current password
  const isMatch = await bcrypt.compare(currentPassword, user.password);

  if (!isMatch) {
    throw new Error('Current password is incorrect');
  }

  // Hash new password
  const hashedNewPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedNewPassword }
  });

  return { message: 'Password updated successfully' };
};

// Forgot Password
const forgotPassword = async (email) => {
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    throw new Error('No user found with this email');
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: resetTokenHash,
      passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    }
  });

  // In production, send email with reset token
  // For now, just return the token
  return {
    message: 'Password reset token generated',
    resetToken // Remove this in production
  };
};

// Reset Password
const resetPassword = async (resetToken, newPassword) => {
  const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: resetTokenHash,
      passwordResetExpires: {
        gt: new Date()
      }
    }
  });

  if (!user) {
    throw new Error('Invalid or expired reset token');
  }

  // Hash new password
  const hashedNewPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedNewPassword,
      passwordResetToken: null,
      passwordResetExpires: null
    }
  });

  // Generate new token
  const token = generateToken(user.id);

  return {
    token,
    message: 'Password reset successful'
  };
};

// Verify Email
const verifyEmail = async (token) => {
  const user = await prisma.user.findFirst({
    where: {
      verificationToken: token
    }
  });

  if (!user) {
    throw new Error('Invalid verification token');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      verificationToken: null
    }
  });

  return { message: 'Email verified successfully' };
};

module.exports = {
  generateToken,
  register,
  login,
  getProfile,
  updateProfile,
  updateWorkerProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail
};
