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
  user: {
   type: mongoose.Schema.Types.ObjectId,
   ref: "User",
   required: true,
  },
  lalpurja: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Lalpurja",
},
 },
 { timestamps: true }
);

export const CitizenshipModel = mongoose.model("Citizenship", citizenshipSchema);