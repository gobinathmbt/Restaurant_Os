/**
 * Database Indexing Script
 * Creates all compound indexes from design document for optimal query performance
 * Run this script to ensure all indexes are created for 5000+ location deployments
 * 
 * Usage: node scripts/createIndexes.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

/**
 * Index definitions from design document
 * Organized by collection for clarity
 */
const indexDefinitions = {
  // Location indexes
  locations: [
    { keys: { code: 1 }, options: { unique: true, name: 'idx_location_code_unique' } },
    { keys: { type: 1 }, options: { name: 'idx_location_type' } },
    { keys: { isActive: 1 }, options: { name: 'idx_location_isActive' } },
    { keys: { isArchived: 1 }, options: { name: 'idx_location_isArchived' } },
    { keys: { 'capabilities.canProcureDirectly': 1 }, options: { name: 'idx_location_canProcureDirectly' } },
    { keys: { 'capabilities.canDispatchStock': 1 }, options: { name: 'idx_location_canDispatchStock' } },
    { keys: { 'capabilities.canReceiveStock': 1 }, options: { name: 'idx_location_canReceiveStock' } }
  ],
  
  // InventoryItemLocation indexes
  inventoryitemlocations: [
    { keys: { locationId: 1, inventoryItem: 1 }, options: { unique: true, name: 'idx_invitemloc_location_item_unique' } },
    { keys: { inventoryItem: 1, locationId: 1 }, options: { name: 'idx_invitemloc_item_location' } },
    { keys: { locationId: 1, isActive: 1 }, options: { name: 'idx_invitemloc_location_active' } },
    { keys: { inventoryItem: 1, isActive: 1 }, options: { name: 'idx_invitemloc_item_active' } },
    { keys: { supplier: 1 }, options: { name: 'idx_invitemloc_supplier' } },
    { keys: { costingMethod: 1 }, options: { name: 'idx_invitemloc_costingMethod' } }
  ],
  
  // InventoryBatchLocation indexes
  inventorybatchlocations: [
    { keys: { locationId: 1, inventoryItem: 1, batchNumber: 1 }, options: { unique: true, name: 'idx_invbatchloc_location_item_batch_unique' } },
    { keys: { locationId: 1, inventoryItem: 1, expiryDate: 1 }, options: { name: 'idx_invbatchloc_location_item_expiry' } },
    { keys: { locationId: 1, inventoryItem: 1, createdAt: 1 }, options: { name: 'idx_invbatchloc_location_item_created' } },
    { keys: { expiryDate: 1, status: 1 }, options: { name: 'idx_invbatchloc_expiry_status' } },
    { keys: { status: 1 }, options: { name: 'idx_invbatchloc_status' } },
    { keys: { grnReference: 1 }, options: { name: 'idx_invbatchloc_grn' } },
    { keys: { supplier: 1 }, options: { name: 'idx_invbatchloc_supplier' } }
  ],
  
  // InventoryLedger indexes
  inventoryledgers: [
    { keys: { locationId: 1, inventoryItem: 1, createdAt: -1 }, options: { name: 'idx_invledger_location_item_created' } },
    { keys: { referenceType: 1, referenceId: 1 }, options: { name: 'idx_invledger_reference' } },
    { keys: { movementType: 1, createdAt: -1 }, options: { name: 'idx_invledger_movementType_created' } },
    { keys: { createdAt: -1 }, options: { name: 'idx_invledger_created' } },
    { keys: { performedBy: 1, createdAt: -1 }, options: { name: 'idx_invledger_performedBy_created' } },
    { keys: { locationId: 1, createdAt: -1 }, options: { name: 'idx_invledger_location_created' } },
    { keys: { inventoryItem: 1, createdAt: -1 }, options: { name: 'idx_invledger_item_created' } },
    { keys: { batchNumber: 1, createdAt: -1 }, options: { name: 'idx_invledger_batch_created' } },
    { keys: { correlationId: 1 }, options: { name: 'idx_invledger_correlationId' } }
  ],
  
  // InventoryLedgerArchive indexes (same as InventoryLedger)
  inventoryledgerarchives: [
    { keys: { locationId: 1, inventoryItem: 1, originalCreatedAt: -1 }, options: { name: 'idx_invledgerarch_location_item_created' } },
    { keys: { referenceType: 1, referenceId: 1 }, options: { name: 'idx_invledgerarch_reference' } },
    { keys: { movementType: 1, originalCreatedAt: -1 }, options: { name: 'idx_invledgerarch_movementType_created' } },
    { keys: { originalCreatedAt: -1 }, options: { name: 'idx_invledgerarch_created' } },
    { keys: { performedBy: 1, originalCreatedAt: -1 }, options: { name: 'idx_invledgerarch_performedBy_created' } },
    { keys: { archivedDate: 1 }, options: { name: 'idx_invledgerarch_archivedDate' } }
  ],
  
  // StockTransfer indexes
  stocktransfers: [
    { keys: { transferNumber: 1 }, options: { unique: true, name: 'idx_transfer_number_unique' } },
    { keys: { destinationLocation: 1, status: 1 }, options: { name: 'idx_transfer_fromLocation_status' } },
    { keys: { sourceLocation: 1, status: 1 }, options: { name: 'idx_transfer_toLocation_status' } },
    { keys: { status: 1, requestDate: -1 }, options: { name: 'idx_transfer_status_requestDate' } },
    { keys: { destinationLocation: 1, sourceLocation: 1, status: 1 }, options: { name: 'idx_transfer_fromTo_status' } },
    { keys: { transferType: 1 }, options: { name: 'idx_transfer_type' } },
    { keys: { requestDate: -1 }, options: { name: 'idx_transfer_requestDate' } },
    // Legacy indexes for backward compatibility
    { keys: { fromBranch: 1, status: 1 }, options: { name: 'idx_transfer_fromBranch_status' } },
    { keys: { toBranch: 1, status: 1 }, options: { name: 'idx_transfer_toBranch_status' } }
  ],
  
  // StockAdjustment indexes
  stockadjustments: [
    { keys: { adjustmentNumber: 1 }, options: { unique: true, name: 'idx_adjustment_number_unique' } },
    { keys: { locationId: 1, status: 1 }, options: { name: 'idx_adjustment_location_status' } },
    { keys: { status: 1, createdDate: -1 }, options: { name: 'idx_adjustment_status_createdDate' } },
    { keys: { createdDate: -1 }, options: { name: 'idx_adjustment_createdDate' } },
    { keys: { adjustmentType: 1 }, options: { name: 'idx_adjustment_type' } },
    { keys: { stockCountSessionId: 1 }, options: { name: 'idx_adjustment_stockCountSession' } },
    // Legacy indexes
    { keys: { branch: 1, adjustmentDate: -1 }, options: { name: 'idx_adjustment_branch_date' } },
    { keys: { branch: 1, adjustmentNumber: 1 }, options: { name: 'idx_adjustment_branch_number' } }
  ],
  
  // GRN indexes
  grns: [
    { keys: { grnNumber: 1 }, options: { unique: true, name: 'idx_grn_number_unique' } },
    { keys: { locationId: 1, receivedDate: -1 }, options: { name: 'idx_grn_location_receivedDate' } },
    { keys: { supplier: 1, receivedDate: -1 }, options: { name: 'idx_grn_supplier_receivedDate' } },
    { keys: { receivedDate: -1 }, options: { name: 'idx_grn_receivedDate' } },
    { keys: { status: 1 }, options: { name: 'idx_grn_status' } },
    { keys: { locationId: 1, status: 1 }, options: { name: 'idx_grn_location_status' } },
    // Legacy indexes
    { keys: { branch: 1, grnNumber: 1 }, options: { name: 'idx_grn_branch_number' } },
    { keys: { branch: 1, receivedDate: -1 }, options: { name: 'idx_grn_branch_receivedDate' } }
  ],
  
  // InventoryReservation indexes
  inventoryreservations: [
    { keys: { locationId: 1, inventoryItem: 1, status: 1 }, options: { name: 'idx_reservation_location_item_status' } },
    { keys: { locationId: 1, status: 1, reservationExpiresAt: 1 }, options: { name: 'idx_reservation_location_status_expires' } },
    { keys: { status: 1, reservationExpiresAt: 1 }, options: { name: 'idx_reservation_status_expires' } },
    { keys: { referenceType: 1, referenceId: 1 }, options: { name: 'idx_reservation_reference' } },
    { keys: { reservedBy: 1, reservedDate: -1 }, options: { name: 'idx_reservation_reservedBy_date' } }
  ],
  
  // StockBackorder indexes
  stockbackorders: [
    { keys: { destinationLocation: 1, status: 1 }, options: { name: 'idx_backorder_fromLocation_status' } },
    { keys: { sourceLocation: 1, status: 1 }, options: { name: 'idx_backorder_toLocation_status' } },
    { keys: { inventoryItem: 1, status: 1 }, options: { name: 'idx_backorder_item_status' } },
    { keys: { originalTransferId: 1 }, options: { name: 'idx_backorder_originalTransfer' } },
    { keys: { fulfilledTransferId: 1 }, options: { name: 'idx_backorder_fulfilledTransfer' } },
    { keys: { status: 1, createdDate: -1 }, options: { name: 'idx_backorder_status_createdDate' } }
  ],
  
  // IdempotencyRecord indexes
  idempotencyrecords: [
    { keys: { idempotencyKey: 1 }, options: { unique: true, name: 'idx_idempotency_key_unique' } },
    { keys: { expiresAt: 1 }, options: { expireAfterSeconds: 0, name: 'idx_idempotency_ttl' } },
    { keys: { operationType: 1, status: 1 }, options: { name: 'idx_idempotency_operation_status' } },
    { keys: { requestedBy: 1, requestDate: -1 }, options: { name: 'idx_idempotency_requestedBy_date' } }
  ],
  
  // StockCountSession indexes
  stockcountsessions: [
    { keys: { sessionNumber: 1 }, options: { unique: true, name: 'idx_stockcount_number_unique' } },
    { keys: { locationId: 1, status: 1 }, options: { name: 'idx_stockcount_location_status' } },
    { keys: { status: 1, createdDate: -1 }, options: { name: 'idx_stockcount_status_createdDate' } },
    { keys: { countType: 1 }, options: { name: 'idx_stockcount_type' } }
  ],
  
  // InventoryPeriod indexes
  inventoryperiods: [
    { keys: { locationId: 1, periodStart: 1, periodEnd: 1 }, options: { name: 'idx_period_location_dates' } },
    { keys: { status: 1 }, options: { name: 'idx_period_status' } },
    { keys: { locationId: 1, status: 1 }, options: { name: 'idx_period_location_status' } }
  ],
  
  // DomainEvent indexes
  domainevents: [
    { keys: { eventType: 1, timestamp: -1 }, options: { name: 'idx_event_type_timestamp' } },
    { keys: { entityType: 1, entityId: 1, timestamp: -1 }, options: { name: 'idx_event_entity_timestamp' } },
    { keys: { timestamp: -1 }, options: { name: 'idx_event_timestamp' } },
    { keys: { userId: 1, timestamp: -1 }, options: { name: 'idx_event_userId_timestamp' } },
    { keys: { locationId: 1, timestamp: -1 }, options: { name: 'idx_event_locationId_timestamp' } },
    { keys: { correlationId: 1 }, options: { name: 'idx_event_correlationId' } }
  ]
};

/**
 * Create indexes for a collection
 */
async function createIndexesForCollection(db, collectionName, indexes) {
  console.log(`\n📊 Processing collection: ${collectionName}`);
  
  try {
    const collection = db.collection(collectionName);
    
    // Get existing indexes
    const existingIndexes = await collection.indexes();
    const existingIndexNames = existingIndexes.map(idx => idx.name);
    
    console.log(`   Found ${existingIndexes.length} existing indexes`);
    
    let created = 0;
    let skipped = 0;
    
    for (const indexDef of indexes) {
      const indexName = indexDef.options.name;
      
      if (existingIndexNames.includes(indexName)) {
        console.log(`   ⏭️  Skipping ${indexName} (already exists)`);
        skipped++;
      } else {
        try {
          await collection.createIndex(indexDef.keys, indexDef.options);
          console.log(`   ✅ Created ${indexName}`);
          created++;
        } catch (error) {
          console.error(`   ❌ Failed to create ${indexName}:`, error.message);
        }
      }
    }
    
    console.log(`   Summary: ${created} created, ${skipped} skipped`);
    return { created, skipped };
  } catch (error) {
    console.error(`   ❌ Error processing collection ${collectionName}:`, error.message);
    return { created: 0, skipped: 0 };
  }
}

/**
 * Verify index usage with explain plans
 */
async function verifyIndexUsage(db) {
  console.log('\n🔍 Verifying index usage with explain plans...\n');
  
  const testQueries = [
    {
      collection: 'inventoryitemlocations',
      query: { locationId: new mongoose.Types.ObjectId(), isActive: true },
      description: 'Inventory by location (active)'
    },
    {
      collection: 'inventorybatchlocations',
      query: { 
        locationId: new mongoose.Types.ObjectId(), 
        inventoryItem: new mongoose.Types.ObjectId(),
        status: 'active'
      },
      sort: { expiryDate: 1 },
      description: 'FIFO batch query'
    },
    {
      collection: 'inventoryledgers',
      query: { 
        locationId: new mongoose.Types.ObjectId(),
        inventoryItem: new mongoose.Types.ObjectId()
      },
      sort: { createdAt: -1 },
      description: 'Ledger entries by location and item'
    },
    {
      collection: 'stocktransfers',
      query: { destinationLocation: new mongoose.Types.ObjectId(), status: 'approved' },
      description: 'Transfers from location by status'
    },
    {
      collection: 'grns',
      query: { locationId: new mongoose.Types.ObjectId() },
      sort: { receivedDate: -1 },
      description: 'GRNs by location'
    }
  ];
  
  for (const test of testQueries) {
    try {
      const collection = db.collection(test.collection);
      const explain = await collection.find(test.query)
        .sort(test.sort || {})
        .limit(10)
        .explain('executionStats');
      
      const winningPlan = explain.queryPlanner?.winningPlan || explain.executionStats?.executionStages;
      const indexUsed = winningPlan?.inputStage?.indexName || winningPlan?.indexName || 'COLLSCAN';
      
      if (indexUsed === 'COLLSCAN') {
        console.log(`   ⚠️  ${test.description}: COLLECTION SCAN (no index used)`);
      } else {
        console.log(`   ✅ ${test.description}: Using index "${indexUsed}"`);
      }
    } catch (error) {
      console.log(`   ⏭️  ${test.description}: Collection not found or query failed`);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Database Indexing Script');
  console.log('============================\n');
  
  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurantOS';
  console.log(`📡 Connecting to MongoDB...`);
  
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Create indexes for all collections
    let totalCreated = 0;
    let totalSkipped = 0;
    
    for (const [collectionName, indexes] of Object.entries(indexDefinitions)) {
      const result = await createIndexesForCollection(db, collectionName, indexes);
      totalCreated += result.created;
      totalSkipped += result.skipped;
    }
    
    console.log('\n📈 Overall Summary');
    console.log('==================');
    console.log(`Total indexes created: ${totalCreated}`);
    console.log(`Total indexes skipped: ${totalSkipped}`);
    
    // Verify index usage
    await verifyIndexUsage(db);
    
    console.log('\n✅ Indexing complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the script
main().catch(console.error);
