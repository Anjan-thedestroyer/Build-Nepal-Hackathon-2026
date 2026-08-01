import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

/**
* Extract raw text from a PDF document buffer or file path
*/
export const extractPdfText = async (filePathOrBuffer) => {
 let dataBuffer;
 if (typeof filePathOrBuffer === "string") {
  dataBuffer = fs.readFileSync(filePathOrBuffer);
 } else {
  dataBuffer = filePathOrBuffer;
 }

 const data = await pdfParse(dataBuffer);
 return data.text;
};

/**
* Helper to safely extract and parse GeoJSON Polygon coordinates from PDF text
*/
const extractCoordinatesFromText = (text) => {
 try {
  // Match JSON-like array block: [[lng, lat], [lng, lat], ...]
  const coordBlockMatch = text.match(/\[\s*(\[\s*[\d\.\s,-]+\s*\]\s*,?\s*)+\]/s);

  if (coordBlockMatch) {
   const parsedCoords = JSON.parse(coordBlockMatch[0]);
   if (Array.isArray(parsedCoords) && parsedCoords.length >= 3) {
    return parsedCoords;
   }
  }
 } catch (err) {
  console.warn("Could not parse coordinates array from PDF, using fallback mock coordinates.");
 }

 // Fallback mock GeoJSON ring if PDF has no valid coordinates array
 const baseLng = 85.312345;
 const baseLat = 27.756789;
 return [
  [baseLng, baseLat],
  [baseLng + 0.001, baseLat],
  [baseLng + 0.001, baseLat + 0.001],
  [baseLng, baseLat + 0.001],
  [baseLng, baseLat],
 ];
};

/**
* Extract cadastral/lalpurja key fields and polygon coordinates from raw text or PDF
*/
export const parseCadastralData = async (filePathOrBuffer) => {
 const text = await extractPdfText(filePathOrBuffer);

 // Extract text fields using Regex
 const citizenshipMatch = text.match(
  /(?:Citizenship No|नागरिकता नं\.?)\)?\s*:\s*([0-9\-\/]+)/i
 );

 const districtMatch = text.match(
  /(?:District|जिल्ला)\)?\s*:\s*\n?\s*([A-Za-z]+|[\u0900-\u097F]+)/i
 );

 const municipalityMatch = text.match(
  /(?:Municipality|स्थानीय तह)\)?\s*:\s*\n?\s*([A-Za-z\s]+|[\u0900-\u097F\s]+)/i
 );

 const wardMatch = text.match(
  /(?:Ward No|वडा नं\.?)\)?\s*:\s*\n?\s*(\d+)/i
 );

 const kittaMatch = text.match(
  /(?:Kitta(?:\s*\/\s*Plot)?\s*No|Plot No|कित्ता नं\.?)\)?\s*:\s*(\d+)/i
 );

 const areaMatch = text.match(
  /(?:Area in Sq\. M\.|Area|क्षेत्रफल)\)?\s*:\s*\n?\s*([\d\.]+)/i
 );

 const regNoMatch = text.match(
  /(?:Registration No|दर्ता नं\.?)\)?\s*:\s*([A-Za-z0-9\-]+)/i
 );

 const ownerNameMatch = text.match(
  /(?:Full Name|नाम)\)?\s*:\s*([A-Za-z\s]+|[\u0900-\u097F\s]+)/i
 );
 const buyingPriceMatch = text.match(
  /(?:Buying Price|Purchase Price|खरिद मूल्य)\)?\s*:\s*([\d,]+(?:\.\d+)?)/i
);

const currentBookValueMatch = text.match(
  /(?:Current Book Value|Book Value|हालको किताबी मूल्य)\)?\s*:\s*([\d,]+(?:\.\d+)?)/i
);

const taxRateMatch = text.match(
  /(?:Tax Rate|Capital Gains Tax|कर दर)\)?\s*:\s*([\d.]+)\s*%?/i
);

 // Parse extracted coordinates array or apply fallback
 const boundaryCoordinates = extractCoordinatesFromText(text);

 return {
  rawText: text,
  extracted: {
    lalpurjaNo: regNoMatch ? regNoMatch[1].trim() : `LAL-${Date.now()}`,
    ownerName: ownerNameMatch ? ownerNameMatch[1].trim() : null,
    citizenshipNo: citizenshipMatch ? citizenshipMatch[1].trim() : null,
    district: districtMatch ? districtMatch[1].trim() : "Tarakeshwar",
    municipality: municipalityMatch
      ? municipalityMatch[1].trim()
      : "Tarakeshwar Municipality",
    wardNo: wardMatch ? parseInt(wardMatch[1], 10) : 5,
    kittaNo: kittaMatch ? parseInt(kittaMatch[1], 10) : 812,
    areaInSqMeters: areaMatch ? parseFloat(areaMatch[1]) : 215.8,

    buyngPrice: buyingPriceMatch
      ? Number(buyingPriceMatch[1].replace(/,/g, ""))
      : 0,

    CurrentBookValue: currentBookValueMatch
      ? Number(currentBookValueMatch[1].replace(/,/g, ""))
      : 0,

    taxRate: taxRateMatch
      ? parseFloat(taxRateMatch[1])
      : 0,

    coordinates: boundaryCoordinates,
    category: 1,
  },
};
};