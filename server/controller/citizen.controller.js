import { UserModel } from "../model/user.model.js";
import { LalpurjaModel } from "../model/lalpurja.model.js";
import { getLandFromChain } from "../helper/web3service.js";
import { extractPdfText, parseCadastralData } from "../utils/pdfScanner.js";
import fs from "fs";


export const getMyLands = async (req, res) => {
 try {
  const userId = req.user._id;

  const user = await UserModel.findById(userId)
   .populate("citizenship")
   .populate({
    path: "lalpurjas",
    populate: { path: "owners", select: "fullName email" },
   });

  if (!user) {
   return res.status(404).json({ success: false, message: "User not found." });
  }

  const citizenshipHash = user.citizenship?.citizenshipHash;

  const verifiedLands = await Promise.all(
   user.lalpurjas.map(async (land) => {
    try {
     const chainData = await getLandFromChain(land.landId);

     const isOnChainOwner = chainData?.ownerCitizenshipHashes?.includes(
      citizenshipHash
     );

     return {
      ...land.toObject(),
      onChainVerified: Boolean(isOnChainOwner),
      isFrozenOnChain: Boolean(chainData?.isFrozen),
     };
    } catch (err) {
     return {
      ...land.toObject(),
      onChainVerified: false,
      chainError: "Unable to reach blockchain network.",
     };
    }
   })
  );

  return res.status(200).json({
   success: true,
   count: verifiedLands.length,
   citizenshipHash,
   lands: verifiedLands,
  });
 } catch (error) {
  return res.status(500).json({ success: false, message: error.message });
 }
};

export const verifyLalpurjaPdf = async (req, res) => {
 try {
  if (!req.file) {
   return res.status(400).json({
    success: false,
    message: "PDF document file is required.",
   });
  }

  // Step 1: Extract text from PDF
  const rawText = await extractPdfText(req.file.path);
  const parsedData = parseCadastralData(rawText);

  // Clean up temporary uploaded file
  if (fs.existsSync(req.file.path)) {
   fs.unlinkSync(req.file.path);
  }

  if (!parsedData.kittaNo) {
   return res.status(400).json({
    success: false,
    message: "Could not detect a valid Kitta Number in the document.",
   });
  }

  // Step 2: Query DB for land record
  const dbLand = await LalpurjaModel.findOne({ kittaNo: parsedData.kittaNo });
  if (!dbLand) {
   return res.status(404).json({
    success: false,
    message: "No matching land record found for this Kitta Number.",
    extractedData: parsedData,
   });
  }

  // Step 3: Fetch On-Chain Truth
  const chainLand = await getLandFromChain(dbLand.landId);

  return res.status(200).json({
   success: true,
   message: "Document scanned and verified against blockchain.",
   extractedData: parsedData,
   verificationResult: {
    landId: dbLand.landId,
    lalpurjaNo: chainLand.lalpurjaNo,
    kittaNo: dbLand.kittaNo,
    isFrozen: chainLand.isFrozen,
    matchesOnChain: chainLand.lalpurjaNo === dbLand.lalpurjaNo,
   },
  });
 } catch (error) {
  if (req.file && fs.existsSync(req.file.path)) {
   fs.unlinkSync(req.file.path);
  }
  return res.status(500).json({ success: false, message: error.message });
 }
};
export const getLandByCitizenshipNo = async (req, res) => {
 try {
  // Extracted strictly from req.body instead of req.params
  const { citizenshipNo } = req.body;

  if (!citizenshipNo) {
   return res.status(400).json({
    success: false,
    message: "'citizenshipNo' field is required in request body.",
   });
  }

  const cleanCitizenshipNo = String(citizenshipNo).trim();

  // Step 1: Find matching lands in MongoDB matching the citizenship number array
  const dbLands = await LalpurjaModel.find({
   citizenshipNumbers: cleanCitizenshipNo,
  }).populate("owners", "fullName email phoneNumber");

  if (!dbLands || dbLands.length === 0) {
   return res.status(404).json({
    success: false,
    message: `No land records found for citizenship number: ${cleanCitizenshipNo}`,
    lands: [],
   });
  }

  // Step 2: Verify each land against the Blockchain primary truth
  const verifiedLands = await Promise.all(
   dbLands.map(async (land) => {
    try {
     const chainData = await getLandFromChain(land.landId);

     const isOnChainOwner =
      chainData?.ownerCitizenshipNumbers?.includes(cleanCitizenshipNo) ||
      chainData?.ownerCitizenshipHashes?.includes(cleanCitizenshipNo);

     return {
      ...land.toObject(),
      onChainVerified: Boolean(isOnChainOwner),
      isFrozenOnChain: Boolean(chainData?.isFrozen),
     };
    } catch (err) {
     return {
      ...land.toObject(),
      onChainVerified: false,
      chainError: "Unable to reach blockchain network.",
     };
    }
   })
  );

  return res.status(200).json({
   success: true,
   citizenshipNo: cleanCitizenshipNo,
   count: verifiedLands.length,
   lands: verifiedLands,
  });
 } catch (error) {
  console.error("Error retrieving land by citizenship number:", error);
  return res.status(500).json({
   success: false,
   message: error.message,
  });
 }
};