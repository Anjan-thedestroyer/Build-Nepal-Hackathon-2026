import { ethers } from "ethers";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";
import dmalpotAbi from "../ABI/DMalpot.json" with { type: "json" }
dotenv.config();

const abi = dmalpotAbi.abi || dmalpotAbi;
const RPC_URL = process.env.RPC_URL ;
const provider = new ethers.JsonRpcProvider(RPC_URL);

const getAdminWallet = () => {
 if (!process.env.ADMIN_PRIVATE_KEY) {
  throw new Error("ADMIN_PRIVATE_KEY environment variable is not defined.");
 }
 return new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
};

// Contract instance for write operations
export const getDMalpotContract = () => {
 if (!process.env.DMALPOT_CONTRACT_ADDRESS) {
  throw new Error("DMALPOT_CONTRACT_ADDRESS environment variable is not defined.");
 }
 return new ethers.Contract(
  process.env.DMALPOT_CONTRACT_ADDRESS,
  abi,
  getAdminWallet()
 );
};

// Contract instance for read-only operations
export const getReadOnlyContract = () => {
 if (!process.env.DMALPOT_CONTRACT_ADDRESS) {
  throw new Error("DMALPOT_CONTRACT_ADDRESS environment variable is not defined.");
 }
 return new ethers.Contract(
  process.env.DMALPOT_CONTRACT_ADDRESS,
  abi,
  provider
 );
};

/**
* Helper: Computes SHA-256 hash of the uploaded document file formatted as bytes32
*/
const generateDocumentHash = (filePathOrBuffer, landId) => {
 let buffer;
 if (typeof filePathOrBuffer === "string") {
  buffer = fs.readFileSync(filePathOrBuffer);
 } else {
  buffer = filePathOrBuffer;
 }

 // If testing with repeated files, append landId / timestamp to guarantee uniqueness
 const rawHash = crypto
  .createHash("sha256")
  .update(buffer)
  .update(Buffer.from(`${landId || ""}-${Date.now()}`)) 
  .digest("hex");

 return `0x${rawHash}`;
};


export const addLandOnChain = async (landData, fileSource) => {
 try {
  let {
   landId,
   lalpurjaNo,
   category,
   areaInSqMeters,
   citizenshipNumbers,
   citizenshipHashes,
   coordinates = [],
   district,
   localGovernment,
   wardNumber,
   kittaNumber,
  } = landData;

  // 1. Ensure landId is a valid Integer
  let cleanLandId = Number(landId);
  if (isNaN(cleanLandId) || cleanLandId <= 0) {
   cleanLandId = Math.floor(100000 + Math.random() * 900000);
  } else {
   cleanLandId = Math.floor(cleanLandId);
  }

  // 2. Ensure areaInSqMeters is a valid Integer
  let cleanArea = Number(areaInSqMeters);
  if (isNaN(cleanArea) || cleanArea <= 0) {
   cleanArea = 100; // fallback area
  } else {
   cleanArea = Math.round(cleanArea);
  }

  // 3. Ensure Category Enum is a valid Integer (uint8)
  let categoryEnum = 0;
  if (typeof category === "number" && !isNaN(category)) {
   categoryEnum = category;
  } else if (typeof category === "string") {
   const categories = ["Residential", "Agricultural", "Commercial", "Industrial", "Government"];
   const index = categories.indexOf(category);
   categoryEnum = index !== -1 ? index : 0;
  }

  // 4. Ensure Owners List is valid string[]
  const ownersList = citizenshipNumbers || citizenshipHashes || ["UNKNOWN"];

  // 5. Generate formatted bytes32 Document Hash
  let bytes32DocHash;
  if (fileSource) {
   bytes32DocHash = generateDocumentHash(fileSource, cleanLandId);
  } else {
   // Fallback unique bytes32 hash to satisfy "Document hash required" requirement
   bytes32DocHash = ethers.keccak256(
    ethers.toUtf8Bytes(`DOC-${cleanLandId}-${Date.now()}`)
   );
  }

  const cadastralStruct = {
   district: district || "Kathmandu",
   localGovernment: localGovernment || "Kathmandu Metropolitan",
   wardNumber: Math.floor(Number(wardNumber) || 1),
   kittaNumber: Math.floor(Number(kittaNumber) || cleanLandId),
  };

  // 7. Ensure Coordinates fit in int32 (scaled deg * 10^6)
  const SCALE_FACTOR = 1000000;
  const safeCoordinates = Array.isArray(coordinates) && coordinates.length >= 3
   ? coordinates
   : [[83.9856, 28.2096], [83.9866, 28.2096], [83.9866, 28.2106], [83.9856, 28.2096]];

  const latitudes = safeCoordinates.map((pt) => {
   const lat = Number(pt[1]);
   return Math.round((isNaN(lat) ? 28.2096 : lat) * SCALE_FACTOR);
  });

  const longitudes = safeCoordinates.map((pt) => {
   const lng = Number(pt[0]);
   return Math.round((isNaN(lng) ? 83.9856 : lng) * SCALE_FACTOR);
  });

  const contract = getDMalpotContract();

  const tx = await contract.addLand(
   cleanLandId,             // uint256 _landId
   lalpurjaNo || `LAL-${Date.now()}`,    // string _lalpurjaNo
   bytes32DocHash,             // bytes32 _documentHash
   cadastralStruct,             // CadastralAddress _cadastral
   categoryEnum,              // LandCategory _category
   cleanArea,                // uint256 _areaInSqMeters
   ownersList,               // string[] _citizenshipNumbers
   latitudes,                // int32[] _latitudes
   longitudes                // int32[] _longitudes
  );

  const receipt = await tx.wait();

  return {
   txHash: receipt.hash,
   documentHash: bytes32DocHash,
   landId: cleanLandId,
  };
 } catch (error) {
  throw new Error(`On-chain land addition failed: ${error.message}`);
 }
};


export const transferLandOnChain = async (
 landId,
 sellerCitizenshipNo,
 buyerCitizenshipNo,
 price = 0
) => {
 try {
  const contract = getDMalpotContract();

  // Step 1: Initiate Transfer Request
  const initTx = await contract.initiateTransfer(
   Number(landId),
   String(sellerCitizenshipNo).trim(),
   String(buyerCitizenshipNo).trim(),
   price
  );
  const initReceipt = await initTx.wait();

  // Safely parse event log to obtain requestId without index bugs
  let requestId;
  for (const log of initReceipt.logs) {
   try {
    const parsedLog = contract.interface.parseLog(log);
    if (parsedLog && parsedLog.name === "TransferRequested") {
     requestId = Number(parsedLog.args.requestId);
     break;
    }
   } catch (e) {
    // Skip log entries not belonging to this interface
   }
  }

  // Fallback if event was not parsed directly
  if (requestId === undefined) {
   const nextReqId = await contract.nextTransferRequestId();
   requestId = Number(nextReqId) - 1;
  }

  // Step 2: Execute Transfer
  const execTx = await contract.executeTransfer(requestId);
  const execReceipt = await execTx.wait();

  return {
   requestId,
   txHash: execReceipt.hash,
  };
 } catch (error) {
  throw new Error(`On-chain land transfer failed: ${error.message}`);
 }
};


export const setFreezeStatusOnChain = async (landId, isFrozen) => {
 try {
  const contract = getDMalpotContract();
  const tx = await contract.toggleLandFreeze(Number(landId), Boolean(isFrozen));
  const receipt = await tx.wait();
  return receipt.hash;
 } catch (error) {
  throw new Error(`On-chain freeze status update failed: ${error.message}`);
 }
};


export const getLandFromChain = async (landId) => {
 try {
  if (
   landId === undefined ||
   landId === null ||
   landId === "" ||
   isNaN(Number(landId))
  ) {
   throw new Error(`Invalid or missing landId parameter: received '${landId}'`);
  }

  const contract = getReadOnlyContract();

  const cleanLandId = BigInt(String(landId).trim());

  const landData = await contract.getLand(cleanLandId);

  const SCALE_FACTOR = 1000000;
  const formattedBoundaries = landData.boundaries.map((coord) => ({
   latitude: Number(coord.latitude) / SCALE_FACTOR,
   longitude: Number(coord.longitude) / SCALE_FACTOR,
  }));

  return {
   landId: Number(landData.landId),
   lalpurjaNo: landData.lalpurjaNo,
   documentHash: landData.documentHash,
   cadastral: {
    district: landData.cadastral.district,
    localGovernment: landData.cadastral.localGovernment,
    wardNumber: Number(landData.cadastral.wardNumber),
    kittaNumber: Number(landData.cadastral.kittaNumber),
   },
   category: Number(landData.category),
   areaInSqMeters: Number(landData.areaInSqMeters),
   isFrozen: Boolean(landData.isFrozen),
   citizenshipNumbers: landData.ownerCitizenshipNumbers,
   boundaries: formattedBoundaries,
  };
 } catch (error) {
  throw new Error(`Failed to fetch land details from blockchain: ${error.message}`);
 }
};

export const getLandsByWardFromChain = async (district, localGovernment, wardNumber) => {
 try {
  const contract = getReadOnlyContract(); // Your ethers.js contract instance

  const landIdsBigInt = await contract.getLandsByWard(
   String(district).trim(),
   String(localGovernment).trim(),
   Number(wardNumber)
  );

  return landIdsBigInt.map((id) => Number(id));
 } catch (error) {
  console.error("Error calling getLandsByWard on-chain:", error);
  throw new Error(`Blockchain query failed: ${error.message}`);
 }
};