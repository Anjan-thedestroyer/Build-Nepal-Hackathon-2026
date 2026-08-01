import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
 {
  fullName: {
   type: String,
   required: true,
   trim: true,
  },
  email: {
   type: String,
   required: true,
   unique: true,
   lowercase: true,
   trim: true,
   match: [/\S+@\S+\.\S+/, "Provide a valid email address"],
  },
  password: {
   type: String,
   required: true,
  },
  walletAddress: {
   type: String,
   lowercase: true,
   trim: true,
   default: null, // Optional on initial register, updated when Web3 wallet connects
  },
  role: {
   type: String,
   enum: ["ADMIN", "MALPOT", "CITIZEN"],
   default: "CITIZEN", // Fixed: Was default: ["CITIZEN"]
  },
  citizenship: {
   type: mongoose.Schema.Types.ObjectId,
   ref: "Citizenship",
  },

  lalpurjas: [
   {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Lalpurja",
   },
  ],
 },
 { timestamps: true }
);

export const UserModel = mongoose.model("User", userSchema);