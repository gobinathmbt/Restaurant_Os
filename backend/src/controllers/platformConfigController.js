import PlatformConfig from '../models/platform/PlatformConfig.js';
import { logger } from '../utils/logger.js';
import { clearConfigCache } from '../config/env.js';

/**
 * Get all platform configurations
 * GET /api/platform-config
 * Access: Platform Super Admin only
 */
export const getAllConfigs = async (req, res, next) => {
  try {
    const { category, isActive, search, page = 1, limit = 20 } = req.query;

    // Build query
    const query = {};
    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { configKey: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const configs = await PlatformConfig.find(query)
      .populate('lastModifiedBy', 'name email')
      .sort({ category: 1, configKey: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await PlatformConfig.countDocuments(query);

    // Mask secret values
    const maskedConfigs = configs.map(config => {
      const configObj = config.toObject();
      if (configObj.isSecret && configObj.configValue) {
        configObj.configValue = '***HIDDEN***';
      }
      return configObj;
    });

    logger.info('Platform configs fetched', { 
      userId: req.user.userId, 
      count: configs.length,
      category,
      isActive 
    });

    res.json({
      success: true,
      data: {
        configs: maskedConfigs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    logger.error('Get all configs error', error);
    next(error);
  }
};

/**
 * Get single platform configuration by ID
 * GET /api/platform-config/:id
 * Access: Platform Super Admin only
 * Returns actual secret values (not masked)
 */
export const getConfigById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const config = await PlatformConfig.findById(id)
      .populate('lastModifiedBy', 'name email');

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found',
      });
    }

    // Return actual value (including secrets) for editing
    const configObj = config.toObject();

    logger.info('Platform config fetched with secret value', { 
      userId: req.user.userId, 
      configId: id,
      configKey: config.configKey,
      isSecret: config.isSecret 
    });

    res.json({
      success: true,
      data: configObj,
    });
  } catch (error) {
    logger.error('Get config by ID error', error);
    next(error);
  }
};

/**
 * Update platform configuration
 * PUT /api/platform-config/:id
 * Access: Platform Super Admin only
 */
export const updateConfig = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { configValue, description, isActive } = req.body;

    const config = await PlatformConfig.findById(id);

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found',
      });
    }

    // Update fields
    if (configValue !== undefined) config.configValue = configValue;
    if (description !== undefined) config.description = description;
    if (isActive !== undefined) config.isActive = isActive;
    config.lastModifiedBy = req.user.userId;

    await config.save();

    // Clear config cache to force reload
    clearConfigCache();

    logger.info('Platform config updated', { 
      userId: req.user.userId, 
      configId: id,
      configKey: config.configKey 
    });

    // Mask secret value in response
    const configObj = config.toObject();
    if (configObj.isSecret && configObj.configValue) {
      configObj.configValue = '***HIDDEN***';
    }

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: configObj,
    });
  } catch (error) {
    logger.error('Update config error', error);
    next(error);
  }
};

/**
 * Toggle configuration active status
 * PATCH /api/platform-config/:id/toggle
 * Access: Platform Super Admin only
 */
export const toggleConfigStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const config = await PlatformConfig.findById(id);

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found',
      });
    }

    config.isActive = !config.isActive;
    config.lastModifiedBy = req.user.userId;
    await config.save();

    // Clear config cache to force reload
    clearConfigCache();

    logger.info('Platform config status toggled', { 
      userId: req.user.userId, 
      configId: id,
      configKey: config.configKey,
      newStatus: config.isActive 
    });

    res.json({
      success: true,
      message: `Configuration ${config.isActive ? 'enabled' : 'disabled'} successfully`,
      data: {
        id: config._id,
        configKey: config.configKey,
        isActive: config.isActive,
      },
    });
  } catch (error) {
    logger.error('Toggle config status error', error);
    next(error);
  }
};

/**
 * Get configuration statistics
 * GET /api/platform-config/stats
 * Access: Platform Super Admin only
 */
export const getConfigStats = async (req, res, next) => {
  try {
    const [total, active, inactive, byCategory] = await Promise.all([
      PlatformConfig.countDocuments(),
      PlatformConfig.countDocuments({ isActive: true }),
      PlatformConfig.countDocuments({ isActive: false }),
      PlatformConfig.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    logger.info('Platform config stats fetched', { userId: req.user.userId });

    res.json({
      success: true,
      data: {
        total,
        active,
        inactive,
        byCategory: byCategory.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    logger.error('Get config stats error', error);
    next(error);
  }
};
