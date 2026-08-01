import mongoose from "mongoose";

const lalpurjaSchema = new mongoose.Schema(
 {
  landId: {
   type: Number,
   required: true,
   unique: true,
   index: true,
  },
  lalpurjaNo: {
   type: String,
   required: true,
   unique: true,
   trim: true,
  },
  lalpurjaDocumentPath: {
   type: String,
   required: true,
  },
  buyngPrice:{
    type: Number,
    required: true,
  },
  CurrentBookValue:{
    type: Number,
    required : true
  },
  taxRate:{
    type : Number
  },
  district: { type: String, required: true, trim: true },
  municipality: { type: String, required: true, trim: true }, // Local Government
  wardNo: { type: Number, required: true },
  kittaNo: { type: Number, required: true },

  category: {
   type: String,
   enum: ["Residential", "Agricultural", "Commercial", "Industrial", "Government"],
   default: "Residential",
  },
  areaInSqMeters: { type: Number, required: true },

  // GeoJSON Polygon for GIS Boundary Mapping
  boundaryLocation: {
   type: {
    type: String,
    enum: ["Polygon"],
    default: "Polygon",
   },
   coordinates: {
    type: [[[Number]]], // Array of linear ring coordinate arrays [[[lng, lat], [lng, lat], ...]]
    required: true,
   },
  },

  // Reference to all co-owners
  owners: [
   {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
   },
  ],

  isFrozen: {
   type: Boolean,
   default: false, // Roka status (Court stay or Bank mortgage)
  },
  onChainTxHash: {
   type: String,
   default: null,
  },
 },
 { timestamps: true }
);

// Index for GIS geospatial queries
lalpurjaSchema.index({ boundaryLocation: "2dsphere" });

export const LalpurjaModel = mongoose.model("Lalpurja", lalpurjaSchema);