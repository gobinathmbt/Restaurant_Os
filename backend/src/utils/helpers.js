/**
 * Helper Utilities
 * Common utility functions used across the application
 */

/**
 * Generate a unique company ID
 * Format: COMP_<timestamp>_<random_string>
 * @returns {string} Unique company identifier
 */
export const generateCompanyId = () => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substr(2, 9);
  return `COMP_${timestamp}_${randomString}`;
};

/**
 * Generate database name for a company
 * Format: company_<companyId>
 * @param {string} companyId - The company identifier
 * @returns {string} Database name for the company
 */
export const generateDatabaseName = (companyId) => {
  return `company_${companyId}`;
};

/**
 * Format date to ISO string
 * @param {Date} date - Date object to format
 * @returns {string} ISO formatted date string
 */
export const formatDate = (date) => {
  return date ? new Date(date).toISOString() : null;
};

/**
 * Calculate trial end date (30 days from start)
 * @param {Date} startDate - Trial start date
 * @returns {Date} Trial end date
 */
export const calculateTrialEndDate = (startDate = new Date()) => {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 30);
  return endDate;
};

/**
 * Sanitize user input by removing special characters
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized string
 */
export const sanitizeInput = (input) => {
  if (!input || typeof input !== 'string') return '';
  return input.trim().replace(/[<>]/g, '');
};

/**
 * Check if email is valid
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Generate random string of specified length
 * @param {number} length - Length of random string
 * @returns {string} Random alphanumeric string
 */
export const generateRandomString = (length = 10) => {
  return Math.random().toString(36).substr(2, length);
};
