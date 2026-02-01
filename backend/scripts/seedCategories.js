import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

// Database configuration
const MASTER_DB_URI =  'mongodb://localhost:27017/ros_platform';
const COMPANY_DB_PREFIX = 'company_';

// Category Schema
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['raw_material', 'finished_good', 'both'], default: 'both' },
  color: { type: String, default: '#6366f1' },
  displayOrder: { type: Number, default: 0 },
  branchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Branch Schema
const branchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: String
  },
  contact: {
    phone: String,
    email: String,
    alternatePhone: String
  },
  gstNumber: String,
  fssaiLicense: String,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Helper function to generate random category name
function generateRandomName(prefix = 'Category', length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomStr = '';
  for (let i = 0; i < length; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}_${randomStr}`;
}

// Helper function to generate random color
function generateRandomColor() {
  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Helper function to generate random type
function generateRandomType() {
  const types = ['raw_material', 'finished_good', 'both'];
  return types[Math.floor(Math.random() * types.length)];
}

// Helper function to get random branches
function getRandomBranches(branches, min = 1, max = null) {
  const maxBranches = max || branches.length;
  const count = Math.floor(Math.random() * (maxBranches - min + 1)) + min;
  const shuffled = [...branches].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).map(b => b._id);
}

// Main seeding function
async function seedCategories() {
  let masterConn = null;
  let companyConn = null;

  try {
    console.log('🚀 Starting category seeding process...\n');

    // Connect to master database
    console.log('📡 Connecting to master database...');
    masterConn = await mongoose.createConnection(MASTER_DB_URI).asPromise();
    console.log('✅ Connected to master database\n');

    // Get company model
    const Company = masterConn.model('Company', new mongoose.Schema({
      companyId: String,
      isActive: Boolean
    }));

    // Find first active company
    const company = await Company.findOne({ isActive: true });
    if (!company) {
      throw new Error('No active company found in master database');
    }

    console.log(`📦 Found company: ${company.companyName} (${company.companyId})\n`);

    // Connect to company database
    const companyDbName = `${COMPANY_DB_PREFIX}${company.companyId}`;
    const companyDbUri = MASTER_DB_URI.replace(/\/[^\/]*$/, `/${companyDbName}`);
    
    console.log('📡 Connecting to company database...',companyDbUri);
    companyConn = await mongoose.createConnection(companyDbUri).asPromise();
    console.log('✅ Connected to company database\n');

    // Get models
    const Category = companyConn.model('Category', categorySchema);
    const Branch = companyConn.model('Branch', branchSchema);

    // Get all active branches
    console.log('🔍 Fetching branches...');
    let branches = await Branch.find({});

    
    // If no active branches, try to get all branches
    if (branches.length === 0) {
      console.log('⚠️  No active branches found, fetching all branches...');
      branches = await Branch.find({});
    }
    
    if (branches.length === 0) {
      console.log('\n❌ No branches found in the database.');
      console.log('📝 Please create at least one branch before running this script.');
      console.log('\nYou can create a branch using the API or MongoDB shell:');
      console.log('```javascript');
      console.log('db.branches.insertOne({');
      console.log('  name: "Main Branch",');
      console.log('  code: "MAIN001",');
      console.log('  isActive: true,');
      console.log('  createdAt: new Date(),');
      console.log('  updatedAt: new Date()');
      console.log('});');
      console.log('```\n');
      throw new Error('No branches found in company database. Please create at least one branch first.');
    }

    console.log(`✅ Found ${branches.length} branch(es)`);
    branches.forEach((branch, index) => {
      console.log(`   ${index + 1}. ${branch.name} (${branch.code}) - ${branch.isActive ? 'Active' : 'Inactive'}`);
    });
    console.log('');

    // Configuration
    const MAIN_CATEGORIES_COUNT = 5000;
    const SUBCATEGORIES_PER_CATEGORY = 50;
    const BATCH_SIZE = 100; // Insert in batches for better performance

    console.log('📊 Seeding Configuration:');
    console.log(`   - Main Categories: ${MAIN_CATEGORIES_COUNT}`);
    console.log(`   - Subcategories per Category: ${SUBCATEGORIES_PER_CATEGORY}`);
    console.log(`   - Total Categories to Insert: ${MAIN_CATEGORIES_COUNT * (1 + SUBCATEGORIES_PER_CATEGORY)}`);
    console.log(`   - Batch Size: ${BATCH_SIZE}\n`);

    let totalInserted = 0;
    const startTime = Date.now();

    // Create main categories in batches
    console.log('🏗️  Creating main categories...');
    for (let i = 0; i < MAIN_CATEGORIES_COUNT; i += BATCH_SIZE) {
      const batchSize = Math.min(BATCH_SIZE, MAIN_CATEGORIES_COUNT - i);
      const mainCategories = [];

      for (let j = 0; j < batchSize; j++) {
        const categoryIndex = i + j + 1;
        mainCategories.push({
          name: generateRandomName('MainCat', 10),
          description: `Auto-generated main category ${categoryIndex}`,
          type: generateRandomType(),
          color: generateRandomColor(),
          displayOrder: categoryIndex,
          branchIds: getRandomBranches(branches, 1, Math.min(5, branches.length)),
          parent: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      const insertedMainCategories = await Category.insertMany(mainCategories);
      totalInserted += insertedMainCategories.length;

      // Create subcategories for each main category
      console.log(`   📝 Creating subcategories for batch ${Math.floor(i / BATCH_SIZE) + 1}...`);
      
      for (const mainCategory of insertedMainCategories) {
        const subcategories = [];
        
        for (let k = 0; k < SUBCATEGORIES_PER_CATEGORY; k++) {
          subcategories.push({
            name: generateRandomName('SubCat', 8),
            description: `Auto-generated subcategory ${k + 1} for ${mainCategory.name}`,
            type: generateRandomType(),
            color: generateRandomColor(),
            displayOrder: k + 1,
            branchIds: getRandomBranches(branches, 1, Math.min(3, branches.length)),
            parent: mainCategory._id,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }

        await Category.insertMany(subcategories);
        totalInserted += subcategories.length;
      }

      const progress = ((i + batchSize) / MAIN_CATEGORIES_COUNT * 100).toFixed(2);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`   ✅ Progress: ${progress}% | Inserted: ${totalInserted} | Time: ${elapsed}s`);
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n🎉 Seeding completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Total Categories Inserted: ${totalInserted}`);
    console.log(`   - Main Categories: ${MAIN_CATEGORIES_COUNT}`);
    console.log(`   - Subcategories: ${MAIN_CATEGORIES_COUNT * SUBCATEGORIES_PER_CATEGORY}`);
    console.log(`   - Total Time: ${totalTime}s`);
    console.log(`   - Average Speed: ${(totalInserted / parseFloat(totalTime)).toFixed(2)} categories/second\n`);

  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
    throw error;
  } finally {
    // Close connections
    if (companyConn) {
      await companyConn.close();
      console.log('🔌 Company database connection closed');
    }
    if (masterConn) {
      await masterConn.close();
      console.log('🔌 Master database connection closed');
    }
  }
}

// Run the seeding script
seedCategories()
  .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
