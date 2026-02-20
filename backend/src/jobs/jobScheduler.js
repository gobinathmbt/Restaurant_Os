import batchExpiryMonitoringJob from './batchExpiryMonitoringJob.js';
import inventoryRecalculationJob from './inventoryRecalculationJob.js';
import archivedDataCleanupJob from './archivedDataCleanupJob.js';
import { logger } from '../utils/logger.js';

/**
 * Job Scheduler
 * 
 * Manages scheduled background jobs for inventory maintenance
 * Supports both time-based scheduling and manual execution
 */
class JobScheduler {
  constructor() {
    this.jobs = new Map();
    this.intervals = new Map();
    this.isRunning = false;
    
    // Register jobs
    this.registerJob('batchExpiryMonitoring', batchExpiryMonitoringJob, {
      schedule: 'daily', // Run daily
      time: '02:00' // 2 AM
    });
    
    this.registerJob('inventoryRecalculation', inventoryRecalculationJob, {
      schedule: 'weekly', // Run weekly
      day: 0, // Sunday
      time: '03:00' // 3 AM
    });
    
    this.registerJob('archivedDataCleanup', archivedDataCleanupJob, {
      schedule: 'monthly', // Run monthly
      dayOfMonth: 1, // First day of month
      time: '04:00' // 4 AM
    });
  }

  /**
   * Register a job
   * @param {string} name - Job name
   * @param {Object} job - Job instance
   * @param {Object} config - Job configuration
   */
  registerJob(name, job, config) {
    this.jobs.set(name, { job, config });
    logger.info(`[JobScheduler] Registered job: ${name}`, config);
  }

  /**
   * Start the job scheduler
   * @param {Array<string>} companyIds - Array of company IDs to run jobs for
   */
  start(companyIds = []) {
    if (this.isRunning) {
      logger.warn('[JobScheduler] Scheduler is already running');
      return;
    }

    this.isRunning = true;
    this.companyIds = companyIds;
    
    logger.info(`[JobScheduler] Starting scheduler for ${companyIds.length} companies`);

    // Check jobs every minute
    const checkInterval = setInterval(() => {
      this.checkAndRunJobs();
    }, 60000); // 60 seconds

    this.intervals.set('main', checkInterval);
    
    // Run initial check
    this.checkAndRunJobs();
    
    logger.info('[JobScheduler] Scheduler started');
  }

  /**
   * Stop the job scheduler
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('[JobScheduler] Scheduler is not running');
      return;
    }

    this.isRunning = false;
    
    // Clear all intervals
    for (const [name, interval] of this.intervals.entries()) {
      clearInterval(interval);
      logger.info(`[JobScheduler] Cleared interval: ${name}`);
    }
    
    this.intervals.clear();
    logger.info('[JobScheduler] Scheduler stopped');
  }

  /**
   * Check if any jobs should run now
   */
  checkAndRunJobs() {
    const now = new Date();
    
    for (const [name, { job, config }] of this.jobs.entries()) {
      if (this.shouldRunJob(name, config, now)) {
        logger.info(`[JobScheduler] Running scheduled job: ${name}`);
        this.runJob(name);
      }
    }
  }

  /**
   * Check if a job should run based on its schedule
   * @param {string} name - Job name
   * @param {Object} config - Job configuration
   * @param {Date} now - Current date/time
   * @returns {boolean} Whether the job should run
   */
  shouldRunJob(name, config, now) {
    const lastRun = this.getLastRunTime(name);
    
    // If never run, check if it's time to run
    if (!lastRun) {
      return this.isScheduledTime(config, now);
    }

    // Check if enough time has passed since last run
    const timeSinceLastRun = now - lastRun;
    
    switch (config.schedule) {
      case 'daily':
        // Run if more than 23 hours have passed and it's the scheduled time
        return timeSinceLastRun > 23 * 60 * 60 * 1000 && this.isScheduledTime(config, now);
      
      case 'weekly':
        // Run if more than 6 days have passed and it's the scheduled day/time
        return timeSinceLastRun > 6 * 24 * 60 * 60 * 1000 && this.isScheduledTime(config, now);
      
      case 'monthly':
        // Run if more than 28 days have passed and it's the scheduled day/time
        return timeSinceLastRun > 28 * 24 * 60 * 60 * 1000 && this.isScheduledTime(config, now);
      
      default:
        return false;
    }
  }

  /**
   * Check if current time matches the scheduled time
   * @param {Object} config - Job configuration
   * @param {Date} now - Current date/time
   * @returns {boolean} Whether it's the scheduled time
   */
  isScheduledTime(config, now) {
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.getDay(); // 0 = Sunday
    const currentDayOfMonth = now.getDate();
    
    // Parse scheduled time (HH:MM format)
    const [schedHour, schedMinute] = config.time.split(':').map(Number);
    
    // Check if current time matches scheduled time (within 1 minute)
    const timeMatches = currentHour === schedHour && currentMinute === schedMinute;
    
    if (!timeMatches) {
      return false;
    }

    // Check day-specific conditions
    switch (config.schedule) {
      case 'daily':
        return true;
      
      case 'weekly':
        return currentDay === config.day;
      
      case 'monthly':
        return currentDayOfMonth === config.dayOfMonth;
      
      default:
        return false;
    }
  }

  /**
   * Get the last run time for a job
   * @param {string} name - Job name
   * @returns {Date|null} Last run time or null
   */
  getLastRunTime(name) {
    // In a production system, this would be stored in a database
    // For now, we use in-memory storage
    if (!this.lastRunTimes) {
      this.lastRunTimes = new Map();
    }
    return this.lastRunTimes.get(name);
  }

  /**
   * Set the last run time for a job
   * @param {string} name - Job name
   * @param {Date} time - Run time
   */
  setLastRunTime(name, time) {
    if (!this.lastRunTimes) {
      this.lastRunTimes = new Map();
    }
    this.lastRunTimes.set(name, time);
  }

  /**
   * Run a job manually
   * @param {string} name - Job name
   * @param {Object} options - Job options
   * @returns {Promise<Object>} Job result
   */
  async runJob(name, options = {}) {
    const jobData = this.jobs.get(name);
    
    if (!jobData) {
      throw new Error(`Job not found: ${name}`);
    }

    const { job } = jobData;
    const startTime = Date.now();
    
    logger.info(`[JobScheduler] Starting job: ${name}`);

    try {
      // Run job for all companies
      const result = await job.executeForAllCompanies(this.companyIds, options);
      
      // Update last run time
      this.setLastRunTime(name, new Date());
      
      const duration = Date.now() - startTime;
      logger.info(`[JobScheduler] Job completed: ${name} in ${duration}ms`, result);
      
      return {
        success: true,
        jobName: name,
        duration,
        result
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`[JobScheduler] Job failed: ${name}`, error);
      
      return {
        success: false,
        jobName: name,
        duration,
        error: error.message
      };
    }
  }

  /**
   * Get job status
   * @returns {Object} Scheduler status
   */
  getStatus() {
    const jobs = [];
    
    for (const [name, { config }] of this.jobs.entries()) {
      jobs.push({
        name,
        schedule: config.schedule,
        lastRun: this.getLastRunTime(name),
        config
      });
    }

    return {
      isRunning: this.isRunning,
      companyCount: this.companyIds?.length || 0,
      jobs
    };
  }

  /**
   * Run a specific job for a specific company
   * @param {string} jobName - Job name
   * @param {string} companyId - Company ID
   * @param {Object} options - Job options
   * @returns {Promise<Object>} Job result
   */
  async runJobForCompany(jobName, companyId, options = {}) {
    const jobData = this.jobs.get(jobName);
    
    if (!jobData) {
      throw new Error(`Job not found: ${jobName}`);
    }

    const { job } = jobData;
    
    logger.info(`[JobScheduler] Running job ${jobName} for company ${companyId}`);
    
    return await job.execute(companyId, options);
  }
}

export default new JobScheduler();
