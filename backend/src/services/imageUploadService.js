/**
 * Image Upload Service
 * Handles image uploads to AWS S3 with validation and error handling
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { ENV } from '../config/env.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';
import path from 'path';

// Allowed image MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
];

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Initialize S3 client with credentials from environment
 * @returns {S3Client} Configured S3 client
 */
const getS3Client = () => {
  if (!ENV.AWS_ACCESS_KEY_ID || !ENV.AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
  }

  if (!ENV.AWS_S3_BUCKET || !ENV.AWS_S3_REGION) {
    throw new Error('AWS S3 configuration incomplete. Please set AWS_S3_BUCKET and AWS_S3_REGION.');
  }

  return new S3Client({
    region: ENV.AWS_S3_REGION,
    credentials: {
      accessKeyId: ENV.AWS_ACCESS_KEY_ID,
      secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY
    }
  });
};

/**
 * Validate image file
 * @param {Object} file - File object with mimetype and size
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
export const validateImageFile = (file) => {
  if (!file) {
    throw new Error('No file provided');
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new Error(
      `Invalid image format. Allowed formats: JPEG, PNG, WebP. Received: ${file.mimetype}`
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB. File size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`
    );
  }

  return true;
};

/**
 * Generate unique file name with timestamp
 * @param {string} originalFileName - Original file name
 * @param {string} companyId - Company ID for folder organization
 * @returns {string} Unique file name with path
 */
const generateUniqueFileName = (originalFileName, companyId) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const extension = path.extname(originalFileName).toLowerCase();
  
  // Organize by company and date for better S3 structure
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  return `menu-images/${companyId}/${year}/${month}/${timestamp}-${randomString}${extension}`;
};

/**
 * Upload image to S3
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Original file name
 * @param {string} mimeType - File MIME type
 * @param {string} companyId - Company ID
 * @returns {Promise<string>} S3 URL
 */
export const uploadImageToS3 = async (fileBuffer, fileName, mimeType, companyId) => {
  try {
    // Validate inputs
    if (!fileBuffer || !fileName || !mimeType || !companyId) {
      throw new Error('Missing required parameters for image upload');
    }

    // Generate unique file name
    const uniqueFileName = generateUniqueFileName(fileName, companyId);

    // Get S3 client
    const s3Client = getS3Client();

    // Prepare upload command
    const uploadCommand = new PutObjectCommand({
      Bucket: ENV.AWS_S3_BUCKET,
      Key: uniqueFileName,
      Body: fileBuffer,
      ContentType: mimeType,
      CacheControl: 'max-age=31536000' // Cache for 1 year
    });

    // Upload to S3
    await s3Client.send(uploadCommand);

    // Construct S3 URL
    let s3Url;
    if (ENV.AWS_S3_URL) {
      // Use custom S3 URL if provided (e.g., CloudFront)
      s3Url = `${ENV.AWS_S3_URL}/${uniqueFileName}`;
    } else {
      // Use default S3 URL format
      s3Url = `https://${ENV.AWS_S3_BUCKET}.s3.${ENV.AWS_S3_REGION}.amazonaws.com/${uniqueFileName}`;
    }

    logger.info(`Image uploaded successfully to S3: ${uniqueFileName}`);
    return s3Url;

  } catch (error) {
    logger.error('S3 upload failed:', error);

    // Provide descriptive error messages
    if (error.name === 'NoSuchBucket') {
      throw new Error(`S3 bucket '${ENV.AWS_S3_BUCKET}' does not exist. Please verify bucket configuration.`);
    }

    if (error.name === 'InvalidAccessKeyId' || error.name === 'SignatureDoesNotMatch') {
      throw new Error('Invalid AWS credentials. Please verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
    }

    if (error.name === 'NetworkingError' || error.code === 'ENOTFOUND') {
      throw new Error('Network error while uploading to S3. Please check your internet connection and try again.');
    }

    if (error.message.includes('Missing required parameters')) {
      throw error;
    }

    // Generic error with retry guidance
    throw new Error(`Failed to upload image to S3: ${error.message}. Please try again or contact support if the issue persists.`);
  }
};

/**
 * Delete image from S3
 * @param {string} imageUrl - S3 image URL
 * @returns {Promise<void>}
 */
export const deleteImageFromS3 = async (imageUrl) => {
  try {
    if (!imageUrl) {
      throw new Error('Image URL is required for deletion');
    }

    // Extract key from URL
    let key;
    if (imageUrl.includes(ENV.AWS_S3_BUCKET)) {
      // Standard S3 URL format
      const urlParts = imageUrl.split(`${ENV.AWS_S3_BUCKET}.s3.${ENV.AWS_S3_REGION}.amazonaws.com/`);
      key = urlParts[1];
    } else if (ENV.AWS_S3_URL && imageUrl.includes(ENV.AWS_S3_URL)) {
      // Custom S3 URL (CloudFront)
      const urlParts = imageUrl.split(`${ENV.AWS_S3_URL}/`);
      key = urlParts[1];
    } else {
      logger.warn(`Unable to extract S3 key from URL: ${imageUrl}`);
      return; // Skip deletion if URL format is unrecognized
    }

    if (!key) {
      logger.warn(`Invalid S3 URL format: ${imageUrl}`);
      return;
    }

    // Get S3 client
    const s3Client = getS3Client();

    // Prepare delete command
    const deleteCommand = new DeleteObjectCommand({
      Bucket: ENV.AWS_S3_BUCKET,
      Key: key
    });

    // Delete from S3
    await s3Client.send(deleteCommand);

    logger.info(`Image deleted successfully from S3: ${key}`);

  } catch (error) {
    logger.error('S3 deletion failed:', error);

    // Log error but don't throw - deletion failures shouldn't block operations
    logger.warn(`Failed to delete image from S3: ${imageUrl}. Error: ${error.message}`);
  }
};
