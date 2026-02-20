import express from 'express';
import { jobScheduler } from '../jobs/index.js';
import { authenticate, requireRole } from '../middlewares/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Get job scheduler status
 * GET /api/jobs/status
 */
router.get('/status', authenticate, requireRole(['company_super_admin_primary', 'company_super_admin_secondary']), async (req, res) => {
  try {
    const status = jobScheduler.getStatus();
    
    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error getting job status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job status',
      error: error.message
    });
  }
});

/**
 * Run a specific job manually for the authenticated user's company
 * POST /api/jobs/:jobName/run
 */
router.post('/:jobName/run', authenticate, requireRole(['company_super_admin_primary', 'company_super_admin_secondary']), async (req, res) => {
  try {
    const { jobName } = req.params;
    const { companyId } = req.user;
    const options = req.body || {};

    logger.info(`Manual job execution requested: ${jobName} for company ${companyId}`);

    const result = await jobScheduler.runJobForCompany(jobName, companyId, options);

    res.status(200).json({
      success: true,
      message: `Job ${jobName} executed successfully`,
      data: result
    });
  } catch (error) {
    logger.error('Error running job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run job',
      error: error.message
    });
  }
});

/**
 * Get available jobs
 * GET /api/jobs
 */
router.get('/', authenticate, requireRole(['company_super_admin_primary', 'company_super_admin_secondary']), async (req, res) => {
  try {
    const jobs = [
      {
        name: 'batchExpiryMonitoring',
        description: 'Monitor and notify about expiring inventory batches',
        schedule: 'Daily at 2:00 AM',
        parameters: {
          expiryWarningDays: 'Number of days before expiry to send warning (default: 7)'
        }
      },
      {
        name: 'inventoryRecalculation',
        description: 'Recalculate inventory quantities from batches and verify ledger consistency',
        schedule: 'Weekly on Sunday at 3:00 AM',
        parameters: {}
      },
      {
        name: 'archivedDataCleanup',
        description: 'Archive old ledger entries and completed transfers',
        schedule: 'Monthly on 1st at 4:00 AM',
        parameters: {
          ledgerRetentionDays: 'Number of days to retain ledger entries (default: 730)',
          transferRetentionDays: 'Number of days to retain completed transfers (default: 730)'
        }
      }
    ];

    res.status(200).json({
      success: true,
      data: jobs
    });
  } catch (error) {
    logger.error('Error getting jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get jobs',
      error: error.message
    });
  }
});

export default router;
