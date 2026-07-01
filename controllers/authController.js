const authService = require('../services/authService');
const { validationResult } = require('express-validator');
const { prisma } = require('../config/database');
const supabase = require('../lib/supabase');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
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

    const { name, email, password, role, phone } = req.body;

    const result = await authService.register({
      name,
      email,
      password,
      role,
      phone
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    console.log('Login validation errors:', errors.array());
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    const result = await authService.login(email, password);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res, next) => {
  try {
    const result = await authService.getProfile(req.user.id);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
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

    // Validate avatar if provided
    if (req.body.avatar) {
      const avatar = req.body.avatar;
      
      // Check if it's a valid base64 image
      if (!avatar.startsWith('data:image/jpeg;base64,') && !avatar.startsWith('data:image/png;base64,')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid image format. Only JPEG and PNG are allowed.'
        });
      }
      
      // Check size (2MB limit)
      const base64Data = avatar.split(',')[1];
      const sizeInBytes = Buffer.byteLength(base64Data, 'base64');
      const sizeInMB = sizeInBytes / (1024 * 1024);
      
      if (sizeInMB > 2) {
        return res.status(400).json({
          success: false,
          message: 'Image too large. Please choose an image smaller than 2MB.'
        });
      }
    }

    const result = await authService.updateProfile(req.user._id, req.body);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update worker profile
// @route   PUT /api/auth/worker-profile
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

    const result = await authService.updateWorkerProfile(req.user._id, req.body);

    res.status(200).json({
      success: true,
      message: 'Worker profile updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res, next) => {
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

    const { currentPassword, newPassword } = req.body;

    const result = await authService.changePassword(
      req.user._id,
      currentPassword,
      newPassword
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
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

    const { email } = req.body;

    const result = await authService.forgotPassword(email);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res, next) => {
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

    const { resetToken, newPassword } = req.body;

    const result = await authService.resetPassword(resetToken, newPassword);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify email
// @route   POST /api/auth/verify-email
// @access  Public
const verifyEmail = async (req, res, next) => {
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

    const { token } = req.body;

    const result = await authService.verifyEmail(token);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload avatar
// @route   POST /api/auth/upload-avatar
// @access  Private
const uploadAvatar = async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: 'Avatar upload is not configured on this server.'
      });
    }

    const userId = req.user.id;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Fetch current user from DB
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // If user already has an avatar, delete the old one from Supabase
    if (user.avatar) {
      try {
        // Extract file path from the URL
        const urlParts = user.avatar.split('/');
        const filePath = urlParts[urlParts.length - 1];
        
        if (filePath) {
          await supabase.storage
            .from('avatars')
            .remove([filePath]);
        }
      } catch (deleteError) {
        console.log('Error deleting old avatar:', deleteError);
        // Continue with upload even if deletion fails
      }
    }

    // Generate filename: {userId}_{timestamp}.jpg
    const timestamp = Date.now();
    const fileName = `${userId}_${timestamp}.jpg`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload avatar'
      });
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // Update user record in DB
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatar: publicUrl }
    });

    return res.status(200).json({
      success: true,
      avatarUrl: publicUrl,
      message: 'Avatar uploaded successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res, next) => {
  try {
    // In a stateless JWT implementation, logout is handled client-side
    // by removing the token from storage
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  updateWorkerProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  logout,
  uploadAvatar
};
