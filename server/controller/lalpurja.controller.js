import fs from "fs";
import { LalpurjaModel } from "../model/lalpurja.model.js";
import { UserModel } from "../model/user.model.js";
import {
    addLandOnChain,
    transferLandOnChain,
    setFreezeStatusOnChain,
    getLandFromChain,
    getLandsByWardFromChain,
} from "../helper/web3service.js";
import { parseCadastralData } from "../utils/pdfScanner.js";
import mongoose from "mongoose";
import { CitizenshipModel } from "../model/citizenship.model.js";

const TAX_RATES = {
  Residential: 0.01,   // 1%
  Agricultural: 0.005, // 0.5%
  Commercial: 0.02,    // 2%
  Industrial: 0.025,   // 2.5%
  Government: 0,
};
const decodeCoordinatesFromChain = (latitudes, longitudes, scaleFactor = 1e6) => {
    if (!latitudes || !longitudes || latitudes.length !== longitudes.length) {
        return [];
    }

    const coordinates = [];
    for (let i = 0; i < latitudes.length; i++) {
        const lat = Number(latitudes[i]) / scaleFactor;
        const lng = Number(longitudes[i]) / scaleFactor;
        // GeoJSON standard expects [longitude, latitude]
        coordinates.push([lng, lat]);
    }

    // Ensure GeoJSON polygon ring is closed
    if (
        coordinates.length > 0 &&
        (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
            coordinates[0][1] !== coordinates[coordinates.length - 1][1])
    ) {
        coordinates.push(coordinates[0]);
    }

    return coordinates;
};


const CATEGORIES = [
    "Residential",  // 0
    "Agricultural", // 1
    "Commercial",   // 2
    "Industrial",   // 3
    "Government",   // 4
];

export const registerLalpurja = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Lalpurja document PDF file is required.",
            });
        }

        const filePath = req.file.path;

        // 1. Extract data from uploaded PDF
        const { extracted } = await parseCadastralData(filePath);

        // 2. Resolve Citizenship Numbers from body & PDF
        const bodyCitizenshipNo = req.body.citizenshipNo ? String(req.body.citizenshipNo).trim() : null;
        const pdfCitizenshipNo = extracted?.citizenshipNo ? String(extracted.citizenshipNo).trim() : null;

        // Validation A: Ensure at least one citizenship number is present
        if (!bodyCitizenshipNo && !pdfCitizenshipNo) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.status(400).json({
                success: false,
                message: "Citizenship number is required either in request body or within the uploaded PDF.",
            });
        }

        // Validation B: If both are present, verify that they match
        if (bodyCitizenshipNo && pdfCitizenshipNo && bodyCitizenshipNo !== pdfCitizenshipNo) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.status(400).json({
                success: false,
                message: `Citizenship number mismatch. Provided in body: "${bodyCitizenshipNo}", but extracted from PDF: "${pdfCitizenshipNo}".`,
            });
        }

        // Final validated citizenship number (prioritizing body if both matched or only body exists)
        const validatedCitizenshipNo = bodyCitizenshipNo || pdfCitizenshipNo;

        // 3. Parse optional manual JSON inputs from req.body
        let parsedCoordinates = req.body.coordinates;
        if (typeof parsedCoordinates === "string") {
            try {
                parsedCoordinates = JSON.parse(parsedCoordinates);
            } catch (e) {
                parsedCoordinates = null;
            }
        }

        // 4. Merge manual req.body inputs with PDF extractions as fallback
        const district = req.body.district || extracted.district;
        const municipality = req.body.municipality || extracted.municipality;
        const wardNo = req.body.wardNo ? Number(req.body.wardNo) : extracted.wardNo;
        const kittaNo = req.body.kittaNo ? Number(req.body.kittaNo) : extracted.kittaNo;
        const areaInSqMeters = req.body.areaInSqMeters ? Number(req.body.areaInSqMeters) : extracted.areaInSqMeters;
        const lalpurjaNo = req.body.lalpurjaNo || extracted.lalpurjaNo;
        const rawCategory = req.body.category !== undefined ? req.body.category : extracted.category;

        const buyngPrice = req.body.buyngPrice
            ? Number(req.body.buyngPrice)
            : extracted.buyngPrice;

        const CurrentBookValue = req.body.CurrentBookValue
            ? Number(req.body.CurrentBookValue)
            : extracted.CurrentBookValue;

        const taxRate = req.body.taxRate !== undefined
            ? Number(req.body.taxRate)
            : extracted.taxRate;

        const coordinates = parsedCoordinates && parsedCoordinates.length >= 3
            ? parsedCoordinates
            : extracted.coordinates;

        // Map category to Mongoose String Enum
        let categoryString;
        if (typeof rawCategory === "number" || (!isNaN(Number(rawCategory)) && rawCategory !== "")) {
            const idx = Number(rawCategory);
            categoryString = CATEGORIES[idx] !== undefined ? CATEGORIES[idx] : "Residential";
        } else if (typeof rawCategory === "string" && CATEGORIES.includes(rawCategory)) {
            categoryString = rawCategory;
        } else {
            categoryString = "Residential"; // Fallback default
        }

        // Derive or accept custom Land ID
        const landId = req.body.landId
            ? Number(req.body.landId)
            : Number(`${wardNo}${kittaNo}${Math.floor(100 + Math.random() * 900)}`);

        // 5. Check for existing record
        const existingLand = await LalpurjaModel.findOne({
            $or: [{ landId }, { lalpurjaNo }, { kittaNo, district, wardNo }],
        });

        if (existingLand) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.status(400).json({
                success: false,
                message: `Land with Kitta No. ${kittaNo} or Lalpurja No. ${lalpurjaNo} is already registered.`,
            });
        }

        // 6. Strict Owner User Resolution ONLY via validatedCitizenshipNo
        const citizenshipDoc = await CitizenshipModel.findOne({ citizenshipNo: validatedCitizenshipNo }).populate("user");

        if (!citizenshipDoc || !citizenshipDoc.user) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.status(404).json({
                success: false,
                message: `No user account found matching Citizenship No: ${validatedCitizenshipNo}. Registration failed.`,
            });
        }

        const ownerUser = citizenshipDoc.user;
        const citizenshipNumbers = [validatedCitizenshipNo];
        const ownerIds = [ownerUser._id];

        console.log("Values to register on-chain:", {
            landId,
            lalpurjaNo,
            wardNo,
            kittaNo,
            areaInSqMeters,
            buyngPrice,
            CurrentBookValue,
            taxRate,
            category: categoryString,
            citizenshipNo: validatedCitizenshipNo,
            coordinates,
        });

        // 7. Execute On-Chain Smart Contract Registration
        const txResult = await addLandOnChain(
            {
                landId,
                lalpurjaNo,
                district,
                municipality,
                wardNo,
                kittaNo,
                category: categoryString,
                areaInSqMeters,
                citizenshipNumbers,
                coordinates,
            },
            filePath
        );

        // 8. Save Record to MongoDB
        const newLand = new LalpurjaModel({
            landId,
            lalpurjaNo,
            lalpurjaDocumentPath: filePath,
            documentHash: txResult.documentHash,
            buyngPrice,
            CurrentBookValue,
            taxRate,

            district,
            municipality,
            wardNo,
            kittaNo,

            category: categoryString,
            areaInSqMeters,

            boundaryLocation: {
                type: "Polygon",
                coordinates: [coordinates],
            },

            owners: ownerIds,

            onChainTxHash: txResult.txHash,
            isFrozen: false,
        });

        await newLand.save();

        // 9. Link Lalpurja to Owner Profile
        await UserModel.findByIdAndUpdate(ownerUser._id, {
            $addToSet: { lalpurjas: newLand._id },
        });

        return res.status(201).json({
            success: true,
            message: "Lalpurja registered successfully on Blockchain & DB.",
            data: {
                landId,
                lalpurjaNo,
                kittaNo,
                district,
                wardNo,
                areaInSqMeters,
                buyngPrice,
                CurrentBookValue,
                taxRate,
                citizenshipNo: validatedCitizenshipNo,
                coordinatesCount: coordinates ? coordinates.length : 0,
            },
            documentHash: txResult.documentHash,
            txHash: txResult.txHash,
            land: newLand,
        });

    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        console.error("Error registering land:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getLalpurjaByLandId = async (req, res) => {
    try {
        // Extract landId exclusively from Query Params or Request Body (NOT req.params)
        const rawLandId = req.query.landId || req.body?.landId;

        // 1. Guard against missing or empty inputs
        if (!rawLandId || rawLandId === "undefined" || rawLandId === "null") {
            return res.status(400).json({
                success: false,
                message: "Land ID is required. Pass it as a query param (?landId=...) or in req.body.",
            });
        }

        let numericLandId = Number(rawLandId);

        // 2. Fallback: If rawLandId is a 24-char Mongo ObjectId string, look up the numeric landId from DB first
        if (isNaN(numericLandId)) {
            if (mongoose.Types.ObjectId.isValid(rawLandId)) {
                const mongoDoc = await LalpurjaModel.findById(rawLandId);
                if (!mongoDoc) {
                    return res.status(404).json({
                        success: false,
                        message: "Lalpurja document not found in database.",
                    });
                }
                numericLandId = Number(mongoDoc.landId);
            } else {
                return res.status(400).json({
                    success: false,
                    message: `Invalid Land ID format received: '${rawLandId}'`,
                });
            }
        }

        // 3. Final numeric verification before Web3 call
        if (isNaN(numericLandId)) {
            return res.status(400).json({
                success: false,
                message: `Invalid Land ID parameter: received '${rawLandId}'`,
            });
        }

        // STEP A: Fetch On-Chain State directly from Smart Contract
        const onChainData = await getLandFromChain(numericLandId);

        if (!onChainData || !onChainData.lalpurjaNo) {
            return res.status(404).json({
                success: false,
                message: "Land record not found on the blockchain.",
            });
        }

        // STEP B: Format Boundaries directly from onChainData.boundaries
        const formattedCoordinates = onChainData.boundaries
            ? onChainData.boundaries.map((coord) => [coord.longitude, coord.latitude])
            : [];

        const boundaryFromChain = {
            type: "Polygon",
            coordinates: formattedCoordinates.length > 0 ? [formattedCoordinates] : [],
        };

        // STEP C: Fetch Off-Chain Metadata from MongoDB
        const dbData = await LalpurjaModel.findOne({ landId: numericLandId }).populate(
            "owners",
            "fullName email role phoneNumber"
        );

        // STEP D: Return Enriched Data using Blockchain as Primary Truth
        return res.status(200).json({
            success: true,
            source: "Blockchain (Primary Truth)",
            land: {
                // --- Immutable Blockchain Data ---
                landId: Number(onChainData.landId),
                lalpurjaNo: onChainData.lalpurjaNo,
                documentHash: onChainData.documentHash,
                categoryIndex: Number(onChainData.category),
                areaInSqMeters: Number(onChainData.areaInSqMeters),
                ownerCitizenshipNumbers: onChainData.citizenshipNumbers || [],
                isFrozen: Boolean(onChainData.isFrozen),
                cadastral: onChainData.cadastral || {},

                // Coordinates & Spatial Polygon:
                boundaryLocation: boundaryFromChain,
                rawChainCoordinates: onChainData.boundaries || [],

                // --- Off-Chain MongoDB Metadata ---
                district: dbData?.district || onChainData.cadastral?.district || null,
                municipality: dbData?.municipality || onChainData.cadastral?.localGovernment || null,
                wardNo: dbData?.wardNo || Number(onChainData.cadastral?.wardNumber) || null,
                kittaNo: dbData?.kittaNo || Number(onChainData.cadastral?.kittaNumber) || null,
                categoryName: dbData?.category || null,
                owners: dbData?.owners || [],
                documentPath: dbData?.lalpurjaDocumentPath || null,
                onChainTxHash: dbData?.onChainTxHash || null,
            },
        });
    } catch (error) {
        console.error("Error retrieving land details:", error);
        return res.status(500).json({
            success: false,
            message: `Failed to retrieve land details from blockchain: ${error.message}`,
        });
    }
};

export const transferLalpurja = async (req, res) => {
    // 1. Start Mongoose Session for Atomic Rollback Safety
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { landId, newOwnerIds, price } = req.body;

        // Payload checks
        if (!landId || !newOwnerIds || !Array.isArray(newOwnerIds) || newOwnerIds.length === 0) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Missing required fields: landId, newOwnerIds (array), or price.",
            });
        }

        // 2. Fetch Land Record from DB and POPULATE current owners & their citizenship
        const land = await LalpurjaModel.findOne({ landId: Number(landId) })
            .populate({
                path: "owners",
                populate: { path: "citizenship" }
            })
            .session(session);

        if (!land) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Land record not found in database.",
            });
        }

        // 3. Check Freeze Status
        if (land.isFrozen) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Cannot transfer ownership. Land is currently frozen (Roka).",
            });
        }

        // 4. Extract Seller Citizenship from the populated current owner(s)
        const currentSeller = land.owners && land.owners.length > 0 ? land.owners[0] : null;

        if (!currentSeller) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Land record has no assigned owners in the database.",
            });
        }

        const sellerCitizenship = currentSeller.citizenship?.citizenshipNo || currentSeller.citizenshipNumber;

        if (!sellerCitizenship) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: `Current seller (${currentSeller.fullName || currentSeller._id}) lacks a verified citizenship number.`,
            });
        }

        // 5. Retrieve New Owners and Validate Buyer Citizenship Data
        const newOwners = await UserModel.find({ _id: { $in: newOwnerIds } })
            .populate("citizenship")
            .session(session);

        if (!newOwners || newOwners.length !== newOwnerIds.length) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "One or more new owner accounts could not be found.",
            });
        }

        const newCitizenshipNumbers = newOwners.map((owner) => {
            const citizenshipNo = owner.citizenship?.citizenshipNo || owner.citizenshipNumber;
            if (!citizenshipNo) {
                throw new Error(`New buyer '${owner.fullName || owner._id}' lacks a verified citizenship number.`);
            }
            return citizenshipNo;
        });

        const buyerCitizenship = newCitizenshipNumbers[0];

        // STEP A: Execute On-Chain Ownership Transfer
        // Parameters: (landId, sellerCitizenship, buyerCitizenship, price)
        const txResult = await transferLandOnChain(
            Number(landId),
            sellerCitizenship,
            buyerCitizenship,
            price
        );

        const extractedTxHash = typeof txResult === "object" && txResult.txHash
            ? txResult.txHash
            : String(txResult);

        // STEP B: Remove Land Reference from Previous Owners
        await UserModel.updateMany(
            { lalpurjas: land._id },
            { $pull: { lalpurjas: land._id } },
            { session }
        );

        // STEP C: Assign Land to New Owners and Save
        land.owners = newOwnerIds;
        land.onChainTxHash = extractedTxHash;
        land.buyngPrice = Number(price);
        
        // If your Lalpurja model does NOT have citizenshipNumbers array, remove this line:
        if ('citizenshipNumbers' in land) {
            land.citizenshipNumbers = newCitizenshipNumbers;
        }

        await land.save({ session });

        await UserModel.updateMany(
            { _id: { $in: newOwnerIds } },
            { $addToSet: { lalpurjas: land._id } },
            { session }
        );

        // Commit Transaction after all operations succeed
        await session.commitTransaction();

        return res.status(200).json({
            success: true,
            message: "Ownership transferred successfully on both Blockchain and Database.",
            txHash: extractedTxHash,
            requestId: txResult?.requestId,
            land,
        });

    } catch (error) {
        await session.abortTransaction();
        console.error("Error transferring ownership:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "An unexpected error occurred during transfer.",
        });
    } finally {
        session.endSession();
    }
};


export const toggleLandFreeze = async (req, res) => {
    try {
        const { landId, isFrozen } = req.body;

        const land = await LalpurjaModel.findOne({ landId: Number(landId) });
        if (!land) {
            return res.status(404).json({ success: false, message: "Land record not found in database." });
        }

        // STEP A: Update Freeze Status On-Chain
        const txHash = await setFreezeStatusOnChain(Number(landId), Boolean(isFrozen));

        // STEP B: Update Freeze Status in MongoDB
        land.isFrozen = Boolean(isFrozen);
        land.onChainTxHash = txHash;
        await land.save();

        return res.status(200).json({
            success: true,
            message: `Land status successfully updated to ${isFrozen ? "Frozen" : "Unfrozen"}.`,
            txHash,
            isFrozen: land.isFrozen,
        });
    } catch (error) {
        console.error("Error toggling freeze status:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getLandByWard = async (req, res) => {
    try {
        const { wardNo, district, municipality, limit = 50, page = 1 } = req.body;

        if (!wardNo || isNaN(Number(wardNo))) {
            return res.status(400).json({
                success: false,
                message: "A valid 'wardNo' property in request body is required.",
            });
        }

        const numericWardNo = Number(wardNo);
        const filter = { wardNo: numericWardNo };

        let onChainLandIds = null;

        // STEP A: Fetch on-chain truth if district & municipality are provided
        if (district && municipality) {
            try {
                onChainLandIds = await getLandsByWardFromChain(
                    district.trim(),
                    municipality.trim(),
                    numericWardNo
                );

                if (!onChainLandIds || onChainLandIds.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: `No on-chain land records found for Ward No. ${numericWardNo} in ${municipality}, ${district}.`,
                        lands: [],
                        totalCount: 0,
                    });
                }

                filter.landId = { $in: onChainLandIds };
            } catch (chainErr) {
                console.warn(
                    "Warning: On-chain lookup failed, falling back to DB query:",
                    chainErr.message
                );
                filter.district = { $regex: new RegExp(`^${district}$`, "i") };
                filter.municipality = { $regex: new RegExp(`^${municipality}$`, "i") };
            }
        } else {
            if (district) filter.district = { $regex: new RegExp(`^${district}$`, "i") };
            if (municipality) filter.municipality = { $regex: new RegExp(`^${municipality}$`, "i") };
        }

        // STEP B: Pagination calculations
        const skip = (Number(page) - 1) * Number(limit);

        // STEP C: Fetch from MongoDB
        const [lands, totalCount] = await Promise.all([
            LalpurjaModel.find(filter)
                .populate("owners", "fullName email phoneNumber role citizenshipNumber")
                .sort({ kittaNo: 1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            LalpurjaModel.countDocuments(filter),
        ]);

        if (!lands || lands.length === 0) {
            return res.status(404).json({
                success: false,
                message: `No land records found for Ward No. ${numericWardNo}.`,
                lands: [],
                totalCount: 0,
            });
        }

        // STEP D: Response formatting
        return res.status(200).json({
            success: true,
            source: onChainLandIds ? "Blockchain + DB Enriched" : "MongoDB (Off-Chain)",
            message: `Retrieved ${lands.length} land records for Ward No. ${numericWardNo}.`,
            pagination: {
                currentPage: Number(page),
                totalPages: Math.ceil(totalCount / Number(limit)),
                totalRecords: totalCount,
                pageSize: Number(limit),
            },
            lands,
        });
    } catch (error) {
        console.error("Error retrieving lands by ward:", error);
        return res.status(500).json({
            success: false,
            message: `Failed to fetch land records by ward: ${error.message}`,
        });
    }
};
export const updateBookValue = async (req, res) => {
  try {
    const { landId, currentBookValue, taxRate } = req.body;

    if (!landId) {
      return res.status(400).json({
        success: false,
        message: "landId is required.",
      });
    }

    const land = await LalpurjaModel.findOne({ landId: Number(landId) });

    if (!land) {
      return res.status(404).json({
        success: false,
        message: "Land not found.",
      });
    }

    if (currentBookValue !== undefined) {
      land.CurrentBookValue = Number(currentBookValue);
    }

    if (taxRate !== undefined) {
      land.taxRate = Number(taxRate);
    }

    await land.save();

    return res.status(200).json({
      success: true,
      message: "Book value updated successfully.",
      land,
    });
  } catch (error) {
    console.error("Update Book Value Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const updateLandType = async (req, res) => {
  try {
    const { newLandType, reason, updatedBy, id } = req.body;

    // 1. Validation
    if (!newLandType) {
      return res.status(400).json({
        success: false,
        message: "Please provide the new land type.",
      });
    }

    const validLandTypes = [
      "Agricultural",
      "Residential",
      "Commercial",
      "Industrial",
      "Forest/Conservation",
      "Public/Government",
    ];

    if (!validLandTypes.includes(newLandType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid land type. Allowed types: ${validLandTypes.join(", ")}`,
      });
    }

    // 2. Find Lalpurja record in DB
    const lalpurja = await LalpurjaModel.findById(id);
    if (!lalpurja) {
      return res.status(404).json({
        success: false,
        message: "Lalpurja record not found.",
      });
    }

    const oldLandType = lalpurja.landType;

    if (oldLandType === newLandType) {
      return res.status(400).json({
        success: false,
        message: `Land type is already set to '${newLandType}'.`,
      });
    }

    // 3. Optional: Execute Smart Contract transaction if interacting with Web3/Blockchain
    let transactionHash = null;
    if (req.blockchainContract) {
      const tx = await req.blockchainContract.updateLandCategory(
        lalpurja.plotId,
        newLandType
      );
      const receipt = await tx.wait();
      transactionHash = receipt.hash;
    }

    // 4. Update Database Record
    lalpurja.landType = newLandType;
    
    // Track history audit log inside document if schema supports history
    if (lalpurja.history) {
      lalpurja.history.push({
        action: "LAND_TYPE_CHANGE",
        from: oldLandType,
        to: newLandType,
        reason: reason || "Land type reclassification",
        updatedBy: updatedBy || req.user?.id,
        updatedAt: new Date(),
        txHash: transactionHash,
      });
    }

    await lalpurja.save();

    return res.status(200).json({
      success: true,
      message: `Land type successfully updated from '${oldLandType}' to '${newLandType}'.`,
      data: {
        id: lalpurja._id,
        plotId: lalpurja.plotId,
        previousLandType: oldLandType,
        currentLandType: lalpurja.landType,
        transactionHash,
      },
    });
  } catch (error) {
    console.error("Error updating land type:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating land type.",
      error: error.message,
    });
  }
};