import mongoose from 'mongoose';
import { getCompanyDB } from '../config/database.js';
import { getInventoryReservationModel } from '../models/company/InventoryReservation.js';
import { getInventoryItemLocationModel } from '../models/company/InventoryItemLocation.js';
import { recordLedgerEntry } from '../services/inventoryLedgerService.js';
import { logger } from '../utils/logger.js';

/**
 * Reservation Expiry Cleanup Job
 * 
 * Responsibilities:
 * - Query reservations with expiresAt <= now and status='active'
 * - Release each expired reservation
 * - Create ledger entry with reason='expired'
 * - Run every 5 minutes
 * 
 * Requirements: 26.2, 26.3, 26.4
 */
class ReservationExpiryCleanupJob {
  constructor() {
    this.jobName = 'ReservationExpiryCleanup';
  }

  /**
   * Execute the reservation expiry cleanup job for a specific company
   * @param {string} companyId - Company ID
   * @param {Object} options - Job options
   * @returns {Promise<Object>} Job execution result
   */
  async execute(companyId, options = {}) {
    const startTime = Date.now();
    logger.info(`[${this.jobName}] Starting job for company ${companyId}`);

    try {
      const companyDB = getCompanyDB(companyId);
      const InventoryReservation = getInventoryReservationModel(companyDB);
      const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

      const now = new Date();

      // Find expired reservations (Requirement 26.2)
      const expiredReservations = await InventoryReservation.find({
        status: 'active',
        reservationExpiresAt: { $lte: now }
      }).lean();

      logger.info(`[${this.jobName}] Found ${expiredReservations.length} expired reservations`);

      let released = 0;
      let failed = 0;
      const errors = [];

      // Release each expired reservation (Requirement 26.3, 26.4)
      for (const reservation of expiredReservations) {
        try {
          await this.releaseExpiredReservation(
            companyDB,
            InventoryReservation,
            InventoryItemLocation,
            reservation,
            companyId
          );
          released++;
        } catch (error) {
          failed++;
          errors.push({
            reservationId: reservation._id,
            error: error.message
          });
          logger.error(
            `[${this.jobName}] Failed to release reservation ${reservation._id}:`,
            error
          );
        }
      }

      const duration = Date.now() - startTime;
      const result = {
        success: true,
        companyId,
        executedAt: now,
        duration,
        expiredReservationsFound: expiredReservations.length,
        reservationsReleased: released,
        reservationsFailed: failed,
        errors: errors.length > 0 ? errors : undefined
      };

      logger.info(
        `[${this.jobName}] Completed for company ${companyId} in ${duration}ms`,
        result
      );
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`[${this.jobName}] Failed for company ${companyId}:`, error);

      return {
        success: false,
        companyId,
        executedAt: new Date(),
        duration,
        error: error.message
      };
    }
  }

  /**
   * Release an expired reservation atomically
   * @param {Object} companyDB - Company database connection
   * @param {Model} InventoryReservation - Reservation model
   * @param {Model} InventoryItemLocation - Inventory location model
   * @param {Object} reservation - Expired reservation document
   * @param {string} companyId - Company ID
   * @returns {Promise<void>}
   */
  async releaseExpiredReservation(
    companyDB,
    InventoryReservation,
    InventoryItemLocation,
    reservation,
    companyId
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get current inventory state
      const inventory = await InventoryItemLocation.findOne({
        locationId: reservation.locationId,
        inventoryItem: reservation.inventoryItem,
        isActive: true
      }).session(session);

      if (!inventory) {
        throw new Error(
          `Inventory item ${reservation.inventoryItem} not found at location ${reservation.locationId}`
        );
      }

      // Validate sufficient reserved quantity
      if (inventory.reservedQuantity < reservation.quantity) {
        logger.warn(
          `[${this.jobName}] Insufficient reserved quantity for reservation ${reservation._id}. ` +
          `Reserved: ${inventory.reservedQuantity}, Reservation: ${reservation.quantity}. ` +
          `This may indicate a data inconsistency.`
        );
        // Continue with release using available reserved quantity
      }

      // Store before state for ledger
      const beforeAvailable = inventory.availableQuantity;
      const beforeReserved = inventory.reservedQuantity;
      const beforeInTransit = inventory.inTransitQuantity;

      // Update inventory quantities (Requirement 26.3)
      inventory.availableQuantity += reservation.quantity;
      inventory.reservedQuantity -= reservation.quantity;
      inventory.version += 1;

      await inventory.save({ session });

      // Update reservation status
      const updatedReservation = await InventoryReservation.findByIdAndUpdate(
        reservation._id,
        {
          $set: {
            status: 'expired',
            releasedDate: new Date()
          }
        },
        { session, new: true }
      );

      if (!updatedReservation) {
        throw new Error(`Failed to update reservation ${reservation._id} status`);
      }

      // Record ledger entry with reason='expired' (Requirement 26.4)
      await recordLedgerEntry(
        {
          inventoryItem: reservation.inventoryItem,
          locationId: reservation.locationId,
          movementType: 'release',
          quantityDelta: reservation.quantity,
          beforeAvailable,
          afterAvailable: inventory.availableQuantity,
          beforeReserved,
          afterReserved: inventory.reservedQuantity,
          beforeInTransit,
          afterInTransit: beforeInTransit,
          referenceType: 'RESERVATION',
          referenceId: reservation._id,
          performedBy: reservation.reservedBy, // Use original reserver as performer
          reason: 'expired',
          notes: `Reservation expired at ${reservation.reservationExpiresAt.toISOString()}`
        },
        companyId
      );

      // Commit transaction
      await session.commitTransaction();

      logger.info(
        `[${this.jobName}] Released expired reservation ${reservation._id}: ` +
        `${reservation.quantity} units of item ${reservation.inventoryItem} at location ${reservation.locationId}`
      );
    } catch (error) {
      // Rollback transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Execute the job for all companies
   * @param {Array<string>} companyIds - Array of company IDs
   * @param {Object} options - Job options
   * @returns {Promise<Object>} Summary of results for all companies
   */
  async executeForAllCompanies(companyIds, options = {}) {
    logger.info(`[${this.jobName}] Executing for ${companyIds.length} companies`);

    const results = await Promise.allSettled(
      companyIds.map(companyId => this.execute(companyId, options))
    );

    const summary = {
      total: companyIds.length,
      successful: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
      failed: results.filter(
        r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
      ).length,
      totalExpiredReservations: results
        .filter(r => r.status === 'fulfilled')
        .reduce((sum, r) => sum + (r.value.expiredReservationsFound || 0), 0),
      totalReservationsReleased: results
        .filter(r => r.status === 'fulfilled')
        .reduce((sum, r) => sum + (r.value.reservationsReleased || 0), 0),
      results: results.map(r =>
        r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message }
      )
    };

    logger.info(`[${this.jobName}] Completed for all companies:`, summary);
    return summary;
  }
}

export default new ReservationExpiryCleanupJob();
