/**
 * Image Upload Controller
 * HTTP request handlers for image upload endpoints
 */

import multer from 'multer';
import * as imageUploadService from '../services/imageUploadService.js';
import { logger } from '../utils/logger.js';

// Configure multer for memory storage (files stored in memory as Buffer)
const storage = multer.memoryStorage();

// Configure multer upload middleware
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
  }
});

// Export multer middleware for use in routes
export const uploadMiddleware = upload.single('image');

/**
 * Upload image to S3
 * POST /api/menu/upload
 */
export const uploadImage = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Validate image file
    try {
      imageUploadService.validateImageFile(req.file);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message
      });
    }

    // Upload to S3
    const imageUrl = await imageUploadService.uploadImageToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      companyId
    );

    logger.info('Image uploaded via API', { 
      imageUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: { 
        url: imageUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      }
    });
  } catch (error) {
    logger.error('Upload image error', error);
    
    // Handle S3 configuration errors (500)
    if (error.message.includes('AWS credentials not configured') ||
        error.message.includes('AWS S3 configuration incomplete')) {
      return res.status(500).json({
        success: false,
        message: 'Image upload service is not properly configured. Please contact support.'
      });
    }

    // Handle S3 upload errors (500)
    if (error.message.includes('Failed to upload image to S3') ||
        error.message.includes('S3 bucket') ||
        error.message.includes('Invalid AWS credentials') ||
        error.message.includes('Network error')) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }

    // Handle validation errors (400)
    if (error.message.includes('Missing required parameters')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get image from S3 (proxy endpoint for private bucket)
 * GET /api/menu/images/proxy?url=<encoded-s3-url>
 */
export const getImage = async (req, res, next) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Image URL parameter is required'
      });
    }

    // Decode URL if it's encoded
    const decodedUrl = decodeURIComponent(url);

    // Get image from S3
    const { buffer, contentType } = await imageUploadService.getImageFromS3(decodedUrl);

    // Set cache headers for better performance
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      'Content-Length': buffer.length
    });

    // Send image buffer
    res.send(buffer);

  } catch (error) {
    logger.error('Get image error', error);

    // Handle not found errors (404)
    if (error.message.includes('Image not found')) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Handle invalid URL errors (400)
    if (error.message.includes('Invalid S3 URL format') ||
        error.message.includes('Image URL is required')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Handle S3 configuration errors (500)
    if (error.message.includes('AWS credentials') ||
        error.message.includes('S3 bucket')) {
      return res.status(500).json({
        success: false,
        message: 'Image service is not properly configured'
      });
    }

    next(error);
  }
};

/**
 * Multer error handler middleware
 * Handles errors from multer file upload
 */
export const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    // Multer-specific errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds maximum limit of 5MB'
      });
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field. Use "image" as the field name.'
      });
    }

    return res.status(400).json({
      success: false,
      message: `File upload error: ${error.message}`
    });
  }

  // File filter errors
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  // Pass other errors to next error handler
  next(error);
};
