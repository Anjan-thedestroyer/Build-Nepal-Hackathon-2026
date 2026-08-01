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

        const { extracted } = await parseCadastralData(filePath);

        // 3. Parse optional manual JSON inputs from req.body (handles stringified JSON from Multer form-data)
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
        const citizenshipNo = req.body.citizenshipNo || extracted.citizenshipNo;
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

        // --- OPTION 1 FIX: Safely map category to Mongoose String Enum ---
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

        // 6. Resolve Owner User
        let ownerUser = null;

        // Priority A: Check manually provided ownerIds
        if (req.body.ownerIds) {
            const ownerId = Array.isArray(req.body.ownerIds) ? req.body.ownerIds[0] : req.body.ownerIds;
            ownerUser = await UserModel.findById(ownerId).populate("citizenship");
        }

        // Priority B: Check Citizenship number from request body or PDF scan
        if (!ownerUser && citizenshipNo) {
            const citizenshipDoc = await CitizenshipModel.findOne({ citizenshipNo }).populate("user");
            if (citizenshipDoc && citizenshipDoc.user) {
                ownerUser = citizenshipDoc.user;
            }
        }

        // Priority C: Logged in user fallback
        if (!ownerUser && req.user) {
            ownerUser = await UserModel.findById(req.user._id || req.user.id).populate("citizenship");
        }

        if (!ownerUser) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.status(404).json({
                success: false,
                message: `No user found matching Citizenship No: ${citizenshipNo || "N/A"}. Please register user first.`,
            });
        }

        const resolvedCitizenshipNo =
            citizenshipNo ||
            ownerUser.citizenship?.citizenshipNo ||
            "UNKNOWN-CITIZENSHIP";

        const citizenshipNumbers = [resolvedCitizenshipNo];
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
                category: categoryString, // web3service handles converting this back to uint enum
                areaInSqMeters,
                citizenshipNumbers,
                coordinates,
            },
            filePath
        );

        // 8. Save Record to MongoDB (categoryString matches Mongoose Schema enum)
        const newLand = new LalpurjaModel({
            landId,
            lalpurjaNo,
            lalpurjaDocumentPath: filePath,
            documentHash: txResult.documentHash,   // <-- Add this
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
            citizenshipNo: resolvedCitizenshipNo,
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
    try {
        const { landId, newOwnerIds, price = 0 } = req.body;

        // 1. Validate land record existence
        const land = await LalpurjaModel.findOne({ landId: Number(landId) });
        if (!land) {
            return res.status(404).json({
                success: false,
                message: "Land record not found in database.",
            });
        }

        // 2. Check if land is frozen (Roka)
        if (land.isFrozen) {
            return res.status(400).json({
                success: false,
                message: "Cannot transfer ownership. Land is currently frozen (Roka).",
            });
        }

        // 3. Retrieve new owners' citizenship numbers
        const newOwners = await UserModel.find({ _id: { $in: newOwnerIds } }).populate("citizenship");
        if (!newOwners || newOwners.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid new owners specified.",
            });
        }

        const newCitizenshipNumbers = newOwners.map((owner) => {
            const citizenshipNo = owner.citizenship?.citizenshipNo || owner.citizenshipNumber;
            if (!citizenshipNo) {
                throw new Error(`Owner '${owner.fullName}' lacks a verified citizenship number.`);
            }
            return citizenshipNo;
        });

        // 4. Extract single strings for seller and buyer citizenship numbers
        const sellerCitizenship = Array.isArray(land.citizenshipNumbers) && land.citizenshipNumbers.length > 0
            ? land.citizenshipNumbers[0]
            : "UNKNOWN";

        const buyerCitizenship = newCitizenshipNumbers[0];

        // STEP A: Execute On-Chain Ownership Transfer
        // Returns { requestId, txHash }
        const txResult = await transferLandOnChain(
            Number(landId),
            sellerCitizenship,
            buyerCitizenship,
            Number(price)
        );

        // Ensure we extract string hash cleanly
        const extractedTxHash = typeof txResult === "object" && txResult.txHash
            ? txResult.txHash
            : String(txResult);

        // STEP B: Remove Land from previous owners in MongoDB
        await UserModel.updateMany(
            { lalpurjas: land._id },
            { $pull: { lalpurjas: land._id } }
        );

        // STEP C: Assign Land to new owners and update MongoDB
        land.owners = newOwnerIds;
        land.citizenshipNumbers = newCitizenshipNumbers;
        land.onChainTxHash = extractedTxHash; // 👈 Assigns pure string, preventing CastError

        await land.save();

        await UserModel.updateMany(
            { _id: { $in: newOwnerIds } },
            { $addToSet: { lalpurjas: land._id } }
        );

        return res.status(200).json({
            success: true,
            message: "Ownership transferred successfully on both Blockchain and Database.",
            txHash: extractedTxHash,
            requestId: txResult.requestId,
            land,
        });
    } catch (error) {
        console.error("Error transferring ownership:", error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
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