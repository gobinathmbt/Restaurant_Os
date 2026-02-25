/**
 * Input Sanitization Utilities
 * Provides sanitization functions for user inputs to prevent security vulnerabilities
 * Requirements: 20.5, 20.6
 */

import mongoose from 'mongoose';
import { ValidationError } from './errorResponses.js';

/**
 * Sanitize and validate MongoDB ObjectId
 * Prevents injection attacks through invalid ObjectId formats
 * 
 * @param {string} value - Value to sanitize
 * @param {string} fieldName - Name of the field (for error messages)
 * @returns {string} Sanitized ObjectId string
 * @throws {ValidationError} If value is not a valid ObjectId
 */
const sanitizeObjectId = (value, fieldName = 'id') => {
  if (!value) {
    throw new ValidationError(`${fieldName} is required`, [
      { field: fieldName, message: 'Value is required' }
    ]);
  }

  // Check if it's a valid ObjectId format
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ValidationError(`Invalid ${fieldName} format`, [
      { field: fieldName, message: 'Must be a valid ObjectId' }
    ]);
  }

  // Return as string (trimmed)
  return String(value).trim();
};

/**
 * Sanitize and validate number input
 * Prevents injection attacks and ensures valid numeric values
 * 
 * @param {any} value - Value to sanitize
 * @param {string} fieldName - Name of the field (for error messages)
 * @param {Object} options - Validation options
 * @param {number} [options.min] - Minimum allowed value
 * @param {number} [options.max] - Maximum allowed value
 * @param {boolean} [options.allowZero=false] - Whether zero is allowed
 * @param {boolean} [options.allowNegative=false] - Whether negative values are allowed
 * @param {number} [options.decimals] - Maximum decimal places allowed
 * @returns {number} Sanitized number
 * @throws {ValidationError} If value is not a valid number or violates constraints
 */
const sanitizeNumber = (value, fieldName = 'number', options = {}) => {
  const {
    min = null,
    max = null,
    allowZero = false,
    allowNegative = false,
    decimals = null
  } = options;

  // Check if value exists
  if (value === null || value === undefined || value === '') {
    throw new ValidationError(`${fieldName} is required`, [
      { field: fieldName, message: 'Value is required' }
    ]);
  }

  // Convert to number
  const num = Number(value);

  // Check if it's a valid number
  if (isNaN(num) || !isFinite(num)) {
    throw new ValidationError(`Invalid ${fieldName} format`, [
      { field: fieldName, message: 'Must be a valid number' }
    ]);
  }

  // Check zero constraint
  if (!allowZero && num === 0) {
    throw new ValidationError(`${fieldName} cannot be zero`, [
      { field: fieldName, message: 'Value cannot be zero' }
    ]);
  }

  // Check negative constraint
  if (!allowNegative && num < 0) {
    throw new ValidationError(`${fieldName} cannot be negative`, [
      { field: fieldName, message: 'Value cannot be negative' }
    ]);
  }

  // Check min constraint
  if (min !== null && num < min) {
    throw new ValidationError(`${fieldName} is below minimum value`, [
      { field: fieldName, message: `Value must be at least ${min}` }
    ]);
  }

  // Check max constraint
  if (max !== null && num > max) {
    throw new ValidationError(`${fieldName} exceeds maximum value`, [
      { field: fieldName, message: `Value must be at most ${max}` }
    ]);
  }

  // Check decimal places
  if (decimals !== null) {
    const decimalPart = String(num).split('.')[1];
    if (decimalPart && decimalPart.length > decimals) {
      throw new ValidationError(`${fieldName} has too many decimal places`, [
        { field: fieldName, message: `Value must have at most ${decimals} decimal places` }
      ]);
    }
  }

  return num;
};

/**
 * Sanitize string input
 * Prevents XSS, SQL injection, and command injection attacks
 * 
 * @param {string} value - Value to sanitize
 * @param {string} fieldName - Name of the field (for error messages)
 * @param {Object} options - Sanitization options
 * @param {number} [options.minLength] - Minimum string length
 * @param {number} [options.maxLength] - Maximum string length
 * @param {boolean} [options.allowEmpty=false] - Whether empty strings are allowed
 * @param {boolean} [options.trim=true] - Whether to trim whitespace
 * @param {RegExp} [options.pattern] - Pattern the string must match
 * @param {string} [options.patternMessage] - Custom error message for pattern mismatch
 * @returns {string} Sanitized string
 * @throws {ValidationError} If value violates constraints
 */
const sanitizeString = (value, fieldName = 'string', options = {}) => {
  const {
    minLength = null,
    maxLength = null,
    allowEmpty = false,
    trim = true,
    pattern = null,
    patternMessage = 'Invalid format'
  } = options;

  // Check if value exists
  if (value === null || value === undefined) {
    if (!allowEmpty) {
      throw new ValidationError(`${fieldName} is required`, [
        { field: fieldName, message: 'Value is required' }
      ]);
    }
    return '';
  }

  // Convert to string
  let str = String(value);

  // Trim if requested
  if (trim) {
    str = str.trim();
  }

  // Check empty constraint
  if (!allowEmpty && str.length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`, [
      { field: fieldName, message: 'Value cannot be empty' }
    ]);
  }

  // Check for dangerous patterns (XSS, SQL injection, command injection)
  const dangerousPatterns = [
    /<script[^>]*>.*?<\/script>/gi,  // Script tags
    /javascript:/gi,                  // JavaScript protocol
    /on\w+\s*=/gi,                   // Event handlers
    /(\$\{|\$\()/g,                  // Template injection
    /(;|\||&|`|>|<)/g,               // Command injection characters
    /(union|select|insert|update|delete|drop|create|alter|exec|execute)/gi  // SQL keywords
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(str)) {
      throw new ValidationError(`${fieldName} contains invalid characters`, [
        { field: fieldName, message: 'Value contains potentially dangerous content' }
      ]);
    }
  }

  // Check min length
  if (minLength !== null && str.length < minLength) {
    throw new ValidationError(`${fieldName} is too short`, [
      { field: fieldName, message: `Value must be at least ${minLength} characters` }
    ]);
  }

  // Check max length
  if (maxLength !== null && str.length > maxLength) {
    throw new ValidationError(`${fieldName} is too long`, [
      { field: fieldName, message: `Value must be at most ${maxLength} characters` }
    ]);
  }

  // Check custom pattern
  if (pattern && !pattern.test(str)) {
    throw new ValidationError(`${fieldName} format is invalid`, [
      { field: fieldName, message: patternMessage }
    ]);
  }

  return str;
};

/**
 * Sanitize enum value
 * Ensures value is one of the allowed values
 * 
 * @param {string} value - Value to sanitize
 * @param {Array<string>} allowedValues - Array of allowed values
 * @param {string} fieldName - Name of the field (for error messages)
 * @returns {string} Sanitized enum value
 * @throws {ValidationError} If value is not in allowed values
 */
const sanitizeEnum = (value, allowedValues, fieldName = 'enum') => {
  if (!value) {
    throw new ValidationError(`${fieldName} is required`, [
      { field: fieldName, message: 'Value is required' }
    ]);
  }

  const str = String(value).trim().toLowerCase();

  // Check if value is in allowed values (case-insensitive)
  const normalizedAllowedValues = allowedValues.map(v => v.toLowerCase());
  if (!normalizedAllowedValues.includes(str)) {
    throw new ValidationError(`Invalid ${fieldName} value`, [
      { 
        field: fieldName, 
        message: `Value must be one of: ${allowedValues.join(', ')}` 
      }
    ]);
  }

  // Return the original casing from allowedValues
  const index = normalizedAllowedValues.indexOf(str);
  return allowedValues[index];
};

/**
 * Sanitize array of values
 * Applies sanitization function to each element
 * 
 * @param {Array} value - Array to sanitize
 * @param {Function} sanitizeFn - Sanitization function to apply to each element
 * @param {string} fieldName - Name of the field (for error messages)
 * @param {Object} options - Options
 * @param {number} [options.minLength] - Minimum array length
 * @param {number} [options.maxLength] - Maximum array length
 * @param {boolean} [options.allowEmpty=false] - Whether empty arrays are allowed
 * @returns {Array} Sanitized array
 * @throws {ValidationError} If array violates constraints
 */
const sanitizeArray = (value, sanitizeFn, fieldName = 'array', options = {}) => {
  const {
    minLength = null,
    maxLength = null,
    allowEmpty = false
  } = options;

  // Check if value exists
  if (!value || !Array.isArray(value)) {
    if (!allowEmpty) {
      throw new ValidationError(`${fieldName} is required`, [
        { field: fieldName, message: 'Value must be an array' }
      ]);
    }
    return [];
  }

  // Check empty constraint
  if (!allowEmpty && value.length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`, [
      { field: fieldName, message: 'Array cannot be empty' }
    ]);
  }

  // Check min length
  if (minLength !== null && value.length < minLength) {
    throw new ValidationError(`${fieldName} has too few items`, [
      { field: fieldName, message: `Array must have at least ${minLength} items` }
    ]);
  }

  // Check max length
  if (maxLength !== null && value.length > maxLength) {
    throw new ValidationError(`${fieldName} has too many items`, [
      { field: fieldName, message: `Array must have at most ${maxLength} items` }
    ]);
  }

  // Sanitize each element
  return value.map((item, index) => {
    try {
      return sanitizeFn(item, `${fieldName}[${index}]`);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Invalid item in ${fieldName}`, [
        { field: `${fieldName}[${index}]`, message: error.message }
      ]);
    }
  });
};

/**
 * Sanitize date input
 * Ensures value is a valid date
 * 
 * @param {any} value - Value to sanitize
 * @param {string} fieldName - Name of the field (for error messages)
 * @param {Object} options - Options
 * @param {Date} [options.minDate] - Minimum allowed date
 * @param {Date} [options.maxDate] - Maximum allowed date
 * @returns {Date} Sanitized date
 * @throws {ValidationError} If value is not a valid date or violates constraints
 */
const sanitizeDate = (value, fieldName = 'date', options = {}) => {
  const { minDate = null, maxDate = null } = options;

  if (!value) {
    throw new ValidationError(`${fieldName} is required`, [
      { field: fieldName, message: 'Value is required' }
    ]);
  }

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    throw new ValidationError(`Invalid ${fieldName} format`, [
      { field: fieldName, message: 'Must be a valid date' }
    ]);
  }

  if (minDate && date < minDate) {
    throw new ValidationError(`${fieldName} is too early`, [
      { field: fieldName, message: `Date must be after ${minDate.toISOString()}` }
    ]);
  }

  if (maxDate && date > maxDate) {
    throw new ValidationError(`${fieldName} is too late`, [
      { field: fieldName, message: `Date must be before ${maxDate.toISOString()}` }
    ]);
  }

  return date;
};

export {
  sanitizeObjectId,
  sanitizeNumber,
  sanitizeString,
  sanitizeEnum,
  sanitizeArray,
  sanitizeDate
};
