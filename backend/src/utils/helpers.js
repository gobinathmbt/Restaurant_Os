// Helper utility functions

/**
 * Generate unique company ID
 * Format: COMP_<timestamp>_<random>
 */
export const generateCompanyId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `COMP_${timestamp}_${random}`;
};

/**
 * Calculate trial end date
 * @param {number} days - Number of days for trial
 * @returns {Date} Trial end date
 */
export const calculateTrialEndDate = (days = 30) => {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);
  return endDate;
};

/**
 * Check if subscription is active
 * @param {Object} subscription - Subscription object
 * @returns {boolean} True if subscription is active
 */
export const isSubscriptionActive = (subscription) => {
  return ['trial', 'active', 'grace_period'].includes(subscription.status);
};
