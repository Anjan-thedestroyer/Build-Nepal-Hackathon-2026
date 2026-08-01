import mongoose from "mongoose";

const citizenshipSchema = new mongoose.Schema(
 {
  citizenshipNo: {
   type: String,
   required: true,
   unique: true,
   trim: true,
  },
  issueDistrict: {
   type: String,
   required: true,
   trim: true,
  },
  citizenshipDocumentPath: {
   type: String, // Path to uploaded PDF/image via Multer
   required: true,
  },
  citizenshipHash: {
   type: String,
   required: true,
   unique: true,
   index: true,
  },
  user: {
   type: mongoose.Schema.Types.ObjectId,
   ref: "User",
   required: true,
  },
 },
 { timestamps: true }
);

export const CitizenshipModel = mongoose.model("Citizenship", citizenshipSchema);