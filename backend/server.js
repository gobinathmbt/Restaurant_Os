import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectPlatformDB } from './src/config/database.js';
import { errorHandler } from './src/middlewares/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Connection
connectPlatformDB();

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'ROS Backend is running' });
});

// Routes will be imported here as modules are built
// app.use('/api/auth', authRoutes);

// Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
