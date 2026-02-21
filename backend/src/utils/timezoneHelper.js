import moment from 'moment-timezone';
import { getCompanyDB } from '../config/database.js';
import { getLocationModel } from '../models/company/Location.js';

/**
 * Get the start of day in a specific timezone
 * @param {string} timezone - IANA timezone string (e.g., 'America/New_York', 'Asia/Kolkata')
 * @param {Date} date - Optional date, defaults to today
 * @returns {Date} Start of day in UTC
 */
export const getStartOfDayInTimezone = (timezone = 'UTC', date = new Date()) => {
  return moment.tz(date, timezone).startOf('day').toDate();
};

/**
 * Get the end of day in a specific timezone
 * @param {string} timezone - IANA timezone string
 * @param {Date} date - Optional date, defaults to today
 * @returns {Date} End of day in UTC
 */
export const getEndOfDayInTimezone = (timezone = 'UTC', date = new Date()) => {
  return moment.tz(date, timezone).endOf('day').toDate();
};

/**
 * Add days to a date in a specific timezone
 * @param {Date} date - Base date
 * @param {number} days - Number of days to add
 * @param {string} timezone - IANA timezone string
 * @returns {Date} New date in UTC
 */
export const addDaysInTimezone = (date, days, timezone = 'UTC') => {
  return moment.tz(date, timezone).add(days, 'days').toDate();
};

/**
 * Get location timezone from database
 * @param {string} locationId - Location ID
 * @param {string} companyId - Company ID
 * @returns {Promise<string>} Timezone string
 */
export const getLocationTimezone = async (locationId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);
    
    const location = await Location.findById(locationId).select('timezone').lean();
    
    return location?.timezone || 'UTC';
  } catch (error) {
    console.error('Error fetching location timezone:', error);
    return 'UTC'; // Fallback to UTC
  }
};

/**
 * Convert a UTC date to a specific timezone for display
 * @param {Date} utcDate - Date in UTC
 * @param {string} timezone - Target timezone
 * @returns {string} Formatted date string in target timezone
 */
export const convertToTimezone = (utcDate, timezone = 'UTC') => {
  return moment.tz(utcDate, timezone).format('YYYY-MM-DD HH:mm:ss z');
};

/**
 * Convert a UTC date to ISO string in a specific timezone
 * @param {Date} utcDate - Date in UTC
 * @param {string} timezone - Target timezone
 * @returns {string} ISO string in target timezone
 */
export const toTimezoneISO = (utcDate, timezone = 'UTC') => {
  return moment.tz(utcDate, timezone).toISOString();
};

/**
 * Check if a date is expired in a specific timezone
 * @param {Date} expiryDate - Expiry date (stored in UTC)
 * @param {string} timezone - Timezone to check against
 * @returns {boolean} True if expired
 */
export const isExpiredInTimezone = (expiryDate, timezone = 'UTC') => {
  const nowInTimezone = moment.tz(timezone);
  const expiryInTimezone = moment.tz(expiryDate, timezone);
  
  return expiryInTimezone.isBefore(nowInTimezone, 'day');
};

/**
 * Get date range for expiring batches in a specific timezone
 * @param {number} daysUntilExpiry - Number of days to look ahead
 * @param {string} timezone - Timezone for calculation
 * @returns {Object} Object with startDate and endDate in UTC
 */
export const getExpiryDateRange = (daysUntilExpiry, timezone = 'UTC') => {
  const startDate = getStartOfDayInTimezone(timezone);
  const endDate = getEndOfDayInTimezone(timezone, addDaysInTimezone(new Date(), daysUntilExpiry, timezone));
  
  return { startDate, endDate };
};
