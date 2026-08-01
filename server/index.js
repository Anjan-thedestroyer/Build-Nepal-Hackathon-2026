import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { connect } from "./config/connectDB.js";
import userRouter from "./route/user.route.js";
dotenv.config();
const app = express();
const PORT = process.env.PORT;

const uploadDirs = ['uploads/citizenships', 'uploads/lalpurjas', 'uploads/temp'];
uploadDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.use(helmet());
app.use(cors({
  credentials: true,
  origin: process.env.FRONTEND_URL || 'http://localhost:3000'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); 

app.use('/uploads', express.static('uploads'));



app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'DMalpot running.' });
});

app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Resource not found' });
});
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

app.use('/api/users', userRouter);

const startServer = async () => {
  try {
    await connect();
    
    app.listen(PORT, () => {
      console.log(`listening on port ${PORT}`);
    });
  } catch (error) {
    console.error(`Database Connection Failure: ${error.message}`);
    process.exit(1);
  }
};

startServer();