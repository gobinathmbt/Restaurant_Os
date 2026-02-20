/**
 * Location Service
 * Business logic for location management operations
 * Supports branches, warehouses, central kitchens, and cloud kitchens
 */

import { getCompanyDB } from '../config/database.js';
import { getLocationModel } from '../models/company/Location.js';
import { logger } from '../utils/logger.js';

/**
 * Validate location capabilities based on type
 * @param {string} type - Location type
 * @param {Object} capabilities - Capabilities object
 * @returns {Object} Validated capabilities with defaults
 */
const validateAndSetDefaultCapabilities = (type, capabilities = {}) => {
  const defaults = {
    branch: {
      canProcureDirectly: true,
      canDispatchStock: true,
      canReceiveStock: true,
      isProductionUnit: false,
      allowsCustomerOrders: true
    },
    warehouse: {
      canProcureDirectly: true,
      canDispatchStock: true,
      canReceiveStock: true,
      isProductionUnit: false,
      allowsCustomerOrders: false
    },
    central_kitchen: {
      canProcureDirectly: true,
      canDispatchStock: true,
      canReceiveStock: true,
      isProductionUnit: true,
      allowsCustomerOrders: false
    },
    cloud_kitchen: {
      canProcureDirectly: false,
      canDispatchStock: false,
      canReceiveStock: true,
      isProductionUnit: true,
      allowsCustomerOrders: true
    }
  };

  const typeDefaults = defaults[type] || {};
  
  return {
    canProcureDirectly: capabilities.canProcureDirectly !== undefined 
      ? capabilities.canProcureDirectly 
      : typeDefaults.canProcureDirectly,
    canDispatchStock: capabilities.canDispatchStock !== undefined 
      ? capabilities.canDispatchStock 
      : typeDefaults.canDispatchStock,
    canReceiveStock: capabilities.canReceiveStock !== undefined 
      ? capabilities.canReceiveStock 
      : typeDefaults.canReceiveStock,
    isProductionUnit: capabilities.isProductionUnit !== undefined 
      ? capabilities.isProductionUnit 
      : typeDefaults.isProductionUnit,
    allowsCustomerOrders: capabilities.allowsCustomerOrders !== undefined 
      ? capabilities.allowsCustomerOrders 
      : typeDefaults.allowsCustomerOrders
  };
};

/**
 * Validate capability value
 * @param {string} capability - Capability name
 * @returns {boolean} True if valid capability
 */
export const isValidCapability = (capability) => {
  const validCapabilities = [
    'canProcureDirectly',
    'canDispatchStock',
    'canReceiveStock',
    'isProductionUnit',
    'allowsCustomerOrders'
  ];
  return validCapabilities.includes(capability);
};

/**
 * Validate location has specific capability
 * @param {string} locationId - Location ID
 * @param {string} capability - Capability to check
 * @param {string} companyId - Company ID
 * @returns {Promise<boolean>} True if location has capability
 */
export const validateCapability = async (locationId, capability, companyId) => {
  try {
    if (!isValidCapability(capability)) {
      throw new Error(`Invalid capability: ${capability}`);
    }

    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);

    const location = await Location.findOne({
      _id: locationId,
      isActive: true,
      isArchived: false
    });

    if (!location) {
      throw new Error('Location not found or inactive');
    }

    return location.capabilities[capability] === true;
  } catch (error) {
    logger.error('Error validating capability:', error);
    throw error;
  }
};

/**
 * Create a new location
 * @param {Object} locationData - Location data
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Created location
 */
export const createLocation = async (locationData, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);

    // Validate required fields
    const requiredFields = ['name', 'code', 'type'];
    const missingFields = requiredFields.filter(field => !locationData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate type
    const validTypes = ['branch', 'warehouse', 'central_kitchen', 'cloud_kitchen'];
    if (!validTypes.includes(locationData.type)) {
      throw new Error(`Invalid location type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Check for unique code
    const existingLocation = await Location.findOne({ 
      code: locationData.code.toUpperCase() 
    });
    
    if (existingLocation) {
      throw new Error(`Location code '${locationData.code}' already exists`);
    }

    // Validate and set default capabilities based on type
    const capabilities = validateAndSetDefaultCapabilities(
      locationData.type, 
      locationData.capabilities
    );

    // Validate preferredWarehouse if provided
    if (locationData.preferredWarehouse) {
      const warehouse = await Location.findOne({
        _id: locationData.preferredWarehouse,
        type: 'warehouse',
        isActive: true,
        isArchived: false
      });
      
      if (!warehouse) {
        throw new Error('Preferred warehouse not found or is not a valid warehouse');
      }
    }

    // Create location
    const location = new Location({
      ...locationData,
      code: locationData.code.toUpperCase(),
      capabilities,
      isActive: true,
      isArchived: false
    });

    await location.save();

    logger.info(`Location created: ${location._id} (${location.code}) for company: ${companyId}`);

    return location;
  } catch (error) {
    logger.error('Error creating location:', error);
    throw error;
  }
};

/**
 * Update location
 * @param {string} locationId - Location ID
 * @param {Object} updateData - Update data
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Updated location
 */
export const updateLocation = async (locationId, updateData, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);

    // Get existing location
    const existingLocation = await Location.findOne({
      _id: locationId,
      isActive: true,
      isArchived: false
    });
    
    if (!existingLocation) {
      throw new Error('Location not found or inactive');
    }

    // Validate code uniqueness if code is being updated
    if (updateData.code && updateData.code.toUpperCase() !== existingLocation.code) {
      const duplicateCode = await Location.findOne({ 
        code: updateData.code.toUpperCase(),
        _id: { $ne: locationId }
      });
      
      if (duplicateCode) {
        throw new Error(`Location code '${updateData.code}' already exists`);
      }
      
      updateData.code = updateData.code.toUpperCase();
    }

    // Validate type if being updated
    if (updateData.type) {
      const validTypes = ['branch', 'warehouse', 'central_kitchen', 'cloud_kitchen'];
      if (!validTypes.includes(updateData.type)) {
        throw new Error(`Invalid location type. Must be one of: ${validTypes.join(', ')}`);
      }
    }

    // Validate and merge capabilities if provided
    if (updateData.capabilities) {
      const currentType = updateData.type || existingLocation.type;
      updateData.capabilities = {
        ...existingLocation.capabilities,
        ...updateData.capabilities
      };
    }

    // Validate preferredWarehouse if provided
    if (updateData.preferredWarehouse) {
      const warehouse = await Location.findOne({
        _id: updateData.preferredWarehouse,
        type: 'warehouse',
        isActive: true,
        isArchived: false
      });
      
      if (!warehouse) {
        throw new Error('Preferred warehouse not found or is not a valid warehouse');
      }
    }

    // Don't allow direct updates to isActive or isArchived through this method
    delete updateData.isActive;
    delete updateData.isArchived;

    // Update location
    Object.assign(existingLocation, updateData);
    await existingLocation.save();

    logger.info(`Location updated: ${locationId} for company: ${companyId}`);

    return existingLocation;
  } catch (error) {
    logger.error('Error updating location:', error);
    throw error;
  }
};

/**
 * Get location by ID
 * @param {string} locationId - Location ID
 * @param {string} companyId - Company ID
 * @param {boolean} includeArchived - Include archived locations
 * @returns {Promise<Object>} Location
 */
export const getLocation = async (locationId, companyId, includeArchived = false) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);

    const query = { _id: locationId };
    
    if (!includeArchived) {
      query.isArchived = false;
    }

    const location = await Location.findOne(query)
      .populate('preferredWarehouse', 'name code type')
      .lean();

    if (!location) {
      throw new Error('Location not found');
    }

    return location;
  } catch (error) {
    logger.error('Error getting location by ID:', error);
    throw error;
  }
};

/**
 * List locations with filtering
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated locations
 */
export const listLocations = async (companyId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);

    const {
      page = 1,
      limit = 10,
      search = '',
      type = '',
      isActive = 'all',
      includeArchived = false,
      capability = ''
    } = filters;

    // Build query
    const query = {};

    // Status filter
    if (isActive !== 'all') {
      query.isActive = isActive === 'true' || isActive === true;
    }

    // Archived filter
    if (!includeArchived) {
      query.isArchived = false;
    }

    // Type filter
    if (type && type !== 'all') {
      query.type = type;
    }

    // Capability filter
    if (capability && isValidCapability(capability)) {
      query[`capabilities.${capability}`] = true;
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
        { 'address.state': { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [locations, total] = await Promise.all([
      Location.find(query)
        .populate('preferredWarehouse', 'name code type')
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Location.countDocuments(query)
    ]);

    return {
      locations,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error listing locations:', error);
    throw error;
  }
};

/**
 * Get locations by capability
 * @param {string} capability - Capability to filter by
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} Locations with the specified capability
 */
export const getLocationsByCapability = async (capability, companyId) => {
  try {
    if (!isValidCapability(capability)) {
      throw new Error(`Invalid capability: ${capability}`);
    }

    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);

    const locations = await Location.find({
      [`capabilities.${capability}`]: true,
      isActive: true,
      isArchived: false
    })
      .select('name code type capabilities')
      .sort({ name: 1 })
      .lean();

    return locations;
  } catch (error) {
    logger.error('Error getting locations by capability:', error);
    throw error;
  }
};

/**
 * Archive location (soft delete)
 * @param {string} locationId - Location ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Archived location
 */
export const archiveLocation = async (locationId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);

    const location = await Location.findByIdAndUpdate(
      locationId,
      { 
        isActive: false,
        isArchived: true
      },
      { new: true }
    );

    if (!location) {
      throw new Error('Location not found');
    }

    logger.info(`Location archived: ${locationId} for company: ${companyId}`);

    return location;
  } catch (error) {
    logger.error('Error archiving location:', error);
    throw error;
  }
};

/**
 * Restore archived location
 * @param {string} locationId - Location ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Restored location
 */
export const restoreLocation = async (locationId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);

    const location = await Location.findByIdAndUpdate(
      locationId,
      { 
        isActive: true,
        isArchived: false
      },
      { new: true }
    );

    if (!location) {
      throw new Error('Location not found');
    }

    logger.info(`Location restored: ${locationId} for company: ${companyId}`);

    return location;
  } catch (error) {
    logger.error('Error restoring location:', error);
    throw error;
  }
};
