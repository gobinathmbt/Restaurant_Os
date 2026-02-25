import CompanyUser from '../models/platform/CompanyUser.js';
import { logger } from '../utils/logger.js';

/**
 * LocationNotificationRouter Service
 * 
 * Handles location-based notification routing for stock requests and transfers.
 * Determines which users should receive notifications based on their location access.
 */
class LocationNotificationRouter {
  /**
   * Get all users who should be notified for a specific location and event type
   * 
   * @param {string} companyId - Company ID
   * @param {string} locationId - Location ID (branch or warehouse)
   * @param {string} eventType - Type of event triggering notification
   * @returns {Promise<{superAdmins: Array, locationUsers: Array}>} Recipients grouped by type
   */
  async getNotificationRecipients(companyId, locationId, eventType) {
    try {
      // Query all active users for the company
      const allUsers = await CompanyUser.find({
        companyId,
        isActive: true
      }).lean();

      // Separate Super Admins from other users
      const superAdmins = [];
      const locationUsers = [];

      for (const user of allUsers) {
        // Super Admins have access to ALL locations (empty arrays = all access)
        if (this.isSuperAdmin(user.role)) {
          superAdmins.push(user);
        } 
        // Check if user has access to this specific location
        else if (this.hasLocationAccess(user, locationId)) {
          locationUsers.push(user);
        }
      }

      logger.info(
        `Notification recipients for location ${locationId}, event ${eventType}: ` +
        `${superAdmins.length} super admins, ${locationUsers.length} location users`
      );

      return {
        superAdmins,
        locationUsers
      };
    } catch (error) {
      logger.error('Error getting notification recipients:', error);
      throw error;
    }
  }

  /**
   * Check if user is a Super Admin
   * Super Admins have access to all locations
   * 
   * @param {string} role - User role
   * @returns {boolean} True if user is Super Admin
   */
  isSuperAdmin(role) {
    return role === 'company_super_admin_primary' || 
           role === 'company_super_admin_secondary';
  }

  /**
   * Check if user has access to a specific location
   * 
   * @param {Object} user - User object with branchIds and warehouseIds
   * @param {string} locationId - Location ID to check
   * @returns {boolean} True if user has access to the location
   */
  hasLocationAccess(user, locationId) {
    // Super Admins always have access (but should be filtered separately)
    if (this.isSuperAdmin(user.role)) {
      return true;
    }

    // Check if locationId is in user's branchIds or warehouseIds arrays
    const hasBranchAccess = user.branchIds && user.branchIds.includes(locationId);
    const hasWarehouseAccess = user.warehouseIds && user.warehouseIds.includes(locationId);

    return hasBranchAccess || hasWarehouseAccess;
  }

  /**
   * Get users with specific role and location access
   * 
   * @param {string} companyId - Company ID
   * @param {string} locationId - Location ID
   * @param {string} role - User role to filter by
   * @returns {Promise<Array>} Users matching criteria
   */
  async getUsersByRoleAndLocation(companyId, locationId, role) {
    try {
      const users = await CompanyUser.find({
        companyId,
        role,
        isActive: true,
        $or: [
          { branchIds: locationId },
          { warehouseIds: locationId }
        ]
      }).lean();

      logger.info(
        `Found ${users.length} users with role ${role} for location ${locationId}`
      );

      return users;
    } catch (error) {
      logger.error('Error getting users by role and location:', error);
      throw error;
    }
  }

  /**
   * Get all Super Admins for a company
   * 
   * @param {string} companyId - Company ID
   * @returns {Promise<Array>} All active Super Admins
   */
  async getSuperAdmins(companyId) {
    try {
      const superAdmins = await CompanyUser.find({
        companyId,
        role: { 
          $in: ['company_super_admin_primary', 'company_super_admin_secondary'] 
        },
        isActive: true
      }).lean();

      logger.info(`Found ${superAdmins.length} super admins for company ${companyId}`);

      return superAdmins;
    } catch (error) {
      logger.error('Error getting super admins:', error);
      throw error;
    }
  }

  /**
   * Get Warehouse Admins with access to a specific location
   * 
   * @param {string} companyId - Company ID
   * @param {string} locationId - Location ID
   * @returns {Promise<Array>} Warehouse Admins with access
   */
  async getWarehouseAdmins(companyId, locationId) {
    try {
      return await this.getUsersByRoleAndLocation(
        companyId, 
        locationId, 
        'warehouse_admin'
      );
    } catch (error) {
      logger.error('Error getting warehouse admins:', error);
      throw error;
    }
  }

  /**
   * Get Branch Admins with access to a specific location
   * 
   * @param {string} companyId - Company ID
   * @param {string} locationId - Location ID
   * @returns {Promise<Array>} Branch Admins (company_admin) with access
   */
  async getBranchAdmins(companyId, locationId) {
    try {
      return await this.getUsersByRoleAndLocation(
        companyId, 
        locationId, 
        'company_admin'
      );
    } catch (error) {
      logger.error('Error getting branch admins:', error);
      throw error;
    }
  }
}

export default new LocationNotificationRouter();
