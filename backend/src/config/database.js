import mongoose from 'mongoose';

// Platform Database Connection
export const connectPlatformDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.PLATFORM_DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ Platform Database Connected: ${conn.connection.host}`);
    
    // After connecting, load environment configs from database
    await loadEnvironmentConfigsFromDB();
  } catch (error) {
    console.error(`❌ Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};

// Load environment configurations from Platform Admin Database
export const loadEnvironmentConfigsFromDB = async () => {
  try {
    // Import models (avoid circular dependency)
    const EnvironmentConfig = (await import('../models/platform/EnvironmentConfig.js')).default;
    const PlatformAdmin = (await import('../models/platform/PlatformAdmin.js')).default;
    
    // Find Platform Admin Primary user
    const platformAdminPrimary = await PlatformAdmin.findOne({ 
      role: 'platform_super_admin',
      isActive: true 
    }).sort({ createdAt: 1 }).limit(1); // Get the first/primary admin
    
    if (!platformAdminPrimary) {
      console.warn('⚠️  No Platform Admin Primary user found. Using .env file configurations.');
      return;
    }
    
    // Fetch environment configurations for this primary admin
    const envConfig = await EnvironmentConfig.findOne({
      platformAdminPrimaryId: platformAdminPrimary._id,
      isActive: true,
    }).select('+configs.JWT_SECRET +configs.GOOGLE_CLIENT_SECRET');
    
    if (!envConfig) {
      console.warn('⚠️  No environment configurations found in database. Using .env file configurations.');
      return;
    }
    
    // Override process.env with database values
    console.log('📦 Loading environment configurations from Platform Admin Database...');
    
    // Decrypt and set sensitive configs
    if (envConfig.configs.JWT_SECRET) {
      process.env.JWT_SECRET = envConfig.getDecryptedConfig('JWT_SECRET');
    }
    if (envConfig.configs.GOOGLE_CLIENT_SECRET) {
      process.env.GOOGLE_CLIENT_SECRET = envConfig.getDecryptedConfig('GOOGLE_CLIENT_SECRET');
    }
    
    // Set non-sensitive configs
    if (envConfig.configs.PORT) process.env.PORT = envConfig.configs.PORT.toString();
    if (envConfig.configs.NODE_ENV) process.env.NODE_ENV = envConfig.configs.NODE_ENV;
    if (envConfig.configs.COMPANY_DB_BASE_URI) process.env.COMPANY_DB_BASE_URI = envConfig.configs.COMPANY_DB_BASE_URI;
    if (envConfig.configs.JWT_EXPIRE) process.env.JWT_EXPIRE = envConfig.configs.JWT_EXPIRE;
    if (envConfig.configs.GOOGLE_CLIENT_ID) process.env.GOOGLE_CLIENT_ID = envConfig.configs.GOOGLE_CLIENT_ID;
    if (envConfig.configs.GOOGLE_CALLBACK_URL) process.env.GOOGLE_CALLBACK_URL = envConfig.configs.GOOGLE_CALLBACK_URL;
    if (envConfig.configs.FRONTEND_URL) process.env.FRONTEND_URL = envConfig.configs.FRONTEND_URL;
    
    // Load custom configs
    if (envConfig.configs.customConfigs) {
      for (const [key, value] of envConfig.configs.customConfigs) {
        process.env[key] = value;
      }
    }
    
    console.log('✅ Environment configurations loaded from database successfully');
    console.log(`   Managed by: ${platformAdminPrimary.name} (${platformAdminPrimary.email})`);
    
  } catch (error) {
    console.error('❌ Error loading environment configs from database:', error.message);
    console.warn('⚠️  Falling back to .env file configurations');
  }
};

// Dynamic Company Database Connection
export const getCompanyDB = (companyId) => {
  const dbName = `company_${companyId}`;
  const companyConnection = mongoose.createConnection(
    process.env.COMPANY_DB_BASE_URI.replace('<dbname>', dbName),
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  );
  return companyConnection;
};
