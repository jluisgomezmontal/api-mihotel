import mongoose from 'mongoose';

/**
 * Database configuration and connection management
 * Handles MongoDB connection with error handling and reconnection logic
 */
class Database {
  constructor() {
    this.connection = null;
  }

  /**
   * Connect to MongoDB database
   */
  async connect() {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mihotel_saas';
      
      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        w: 'majority'
      };

      this.connection = await mongoose.connect(mongoUri, options);

      console.log(`✅ MongoDB connected: ${this.connection.connection.host}`);

      // Connection event handlers
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB reconnected');
      });

      return this.connection;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    try {
      await mongoose.connection.close();
      console.log('📴 MongoDB connection closed');
    } catch (error) {
      console.error('❌ Error closing database connection:', error.message);
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return mongoose.connection.readyState;
  }
}

export default new Database();
