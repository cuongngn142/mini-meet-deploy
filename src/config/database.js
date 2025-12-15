/**
 * Database Configuration
 * Kết nối MongoDB với Mongoose
 * Sử dụng connection string từ environment variable
 */
const mongoose = require('mongoose');

/**
 * Kết nối đến MongoDB
 * Exit process nếu kết nối thất bại
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/minimeet', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

