import mongoose from "mongoose";
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.MONGO_URI) {
  throw new Error("Please set MONGODB_URI in your .env");
}
export async function connect() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('DB connected');
  } catch (error) {
    console.log("DBconnection error", error);
    process.exit(1);
  }
}