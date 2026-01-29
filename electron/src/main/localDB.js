const { MongoClient } = require('mongodb');

// Local MongoDB connection
let client = null;
let db = null;

const LOCAL_DB_URI = process.env.LOCAL_DB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'ros_local';

/**
 * Connect to local MongoDB instance
 * @returns {Promise<Object>} Database connection
 */
const connectLocalDB = async () => {
  try {
    if (db) {
      return db;
    }

    client = new MongoClient(LOCAL_DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();
    db = client.db(DB_NAME);
    
    console.log('✅ Connected to local MongoDB');
    return db;
  } catch (error) {
    console.error('❌ Failed to connect to local MongoDB:', error);
    throw error;
  }
};

/**
 * Get pending changes that need to be synced to server
 * @param {string} collection - Collection name
 * @returns {Promise<Array>} Array of unsynced documents
 */
const getPendingChanges = async (collection) => {
  try {
    const database = await connectLocalDB();
    const coll = database.collection(collection);
    
    // Find all documents that haven't been synced
    const pendingDocs = await coll.find({ _synced: { $ne: true } }).toArray();
    
    return pendingDocs;
  } catch (error) {
    console.error(`❌ Error getting pending changes from ${collection}:`, error);
    throw error;
  }
};

/**
 * Mark records as synced
 * @param {string} collection - Collection name
 * @param {Array<string>} ids - Array of document IDs to mark as synced
 * @returns {Promise<Object>} Update result
 */
const markAsSynced = async (collection, ids) => {
  try {
    const database = await connectLocalDB();
    const coll = database.collection(collection);
    
    const result = await coll.updateMany(
      { _id: { $in: ids } },
      { 
        $set: { 
          _synced: true,
          _syncedAt: new Date()
        } 
      }
    );
    
    console.log(`✅ Marked ${result.modifiedCount} records as synced in ${collection}`);
    return result;
  } catch (error) {
    console.error(`❌ Error marking records as synced in ${collection}:`, error);
    throw error;
  }
};

/**
 * Get last sync timestamp
 * @returns {Promise<Date|null>} Last sync timestamp or null
 */
const getLastSyncTime = async () => {
  try {
    const database = await connectLocalDB();
    const syncMetadata = database.collection('_sync_metadata');
    
    const metadata = await syncMetadata.findOne({ key: 'last_sync_time' });
    
    return metadata ? metadata.value : null;
  } catch (error) {
    console.error('❌ Error getting last sync time:', error);
    throw error;
  }
};

/**
 * Set last sync timestamp
 * @param {Date} timestamp - Timestamp to set
 * @returns {Promise<Object>} Update result
 */
const setLastSyncTime = async (timestamp) => {
  try {
    const database = await connectLocalDB();
    const syncMetadata = database.collection('_sync_metadata');
    
    const result = await syncMetadata.updateOne(
      { key: 'last_sync_time' },
      { 
        $set: { 
          key: 'last_sync_time',
          value: timestamp,
          updatedAt: new Date()
        } 
      },
      { upsert: true }
    );
    
    console.log(`✅ Updated last sync time to ${timestamp}`);
    return result;
  } catch (error) {
    console.error('❌ Error setting last sync time:', error);
    throw error;
  }
};

/**
 * Insert or update local records
 * @param {string} collection - Collection name
 * @param {Object|Array} data - Document(s) to upsert
 * @returns {Promise<Object>} Upsert result
 */
const upsert = async (collection, data) => {
  try {
    const database = await connectLocalDB();
    const coll = database.collection(collection);
    
    // Handle single document
    if (!Array.isArray(data)) {
      const result = await coll.updateOne(
        { _id: data._id },
        { $set: { ...data, _lastModified: new Date() } },
        { upsert: true }
      );
      
      return result;
    }
    
    // Handle multiple documents
    const bulkOps = data.map(doc => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { ...doc, _lastModified: new Date() } },
        upsert: true
      }
    }));
    
    const result = await coll.bulkWrite(bulkOps);
    
    console.log(`✅ Upserted ${result.upsertedCount + result.modifiedCount} records in ${collection}`);
    return result;
  } catch (error) {
    console.error(`❌ Error upserting records in ${collection}:`, error);
    throw error;
  }
};

/**
 * Find document by ID
 * @param {string} collection - Collection name
 * @param {string} id - Document ID
 * @returns {Promise<Object|null>} Document or null if not found
 */
const findById = async (collection, id) => {
  try {
    const database = await connectLocalDB();
    const coll = database.collection(collection);
    
    const document = await coll.findOne({ _id: id });
    
    return document;
  } catch (error) {
    console.error(`❌ Error finding document by ID in ${collection}:`, error);
    throw error;
  }
};

/**
 * Close database connection
 */
const closeConnection = async () => {
  try {
    if (client) {
      await client.close();
      client = null;
      db = null;
      console.log('✅ Closed local MongoDB connection');
    }
  } catch (error) {
    console.error('❌ Error closing local MongoDB connection:', error);
    throw error;
  }
};

module.exports = {
  connectLocalDB,
  getPendingChanges,
  markAsSynced,
  getLastSyncTime,
  setLastSyncTime,
  upsert,
  findById,
  closeConnection,
};
